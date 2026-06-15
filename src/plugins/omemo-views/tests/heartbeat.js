/**
 * Tests for the XEP-0384 OMEMO heartbeat: when we receive the first message for
 * a given ratchet key whose counter is >= 53, we must send an (empty,
 * payload-less) OMEMO message to forward the ratchet.
 *
 * The ratchet counter/key reported on decryption are driven by
 * `window.libomemo.mock_ratchet` (see src/shared/tests/mock.js).
 */
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import { answerV2DeviceList, answerV2Bundle } from './utils.js';

const { Strophe, sizzle, stx, u } = converse.env;

/**
 * Open a chat for a contact, turn OMEMO on, send one normal omemo:2 message and
 * answer the device-list/bundle fetches it triggers. This warms the device-list
 * and bundle caches and builds sessions, so a subsequently-triggered heartbeat
 * resolves without needing further IQ round-trips. Returns context for the test.
 */
async function setupAndPrewarm(_converse) {
    await mock.waitForRoster(_converse, 'current', 1);
    const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
    await mock.initializedOMEMO(_converse);
    mock.deferV2DeviceList(contact_jid); // we answer this contact's v2 list ourselves
    await mock.openChatBoxFor(_converse, contact_jid);

    const view = _converse.chatboxviews.get(contact_jid);
    view.model.set('omemo_active', true);

    const rendered = mock.sendMessage(_converse, view, 'prewarm');
    await mock.deviceListFetched(_converse, contact_jid, ['555']);
    await answerV2DeviceList(_converse, contact_jid, ['555']);
    await mock.bundleFetched(_converse, {
        jid: _converse.bare_jid,
        device_id: '482886413b977930064a5888b92134fe',
        identity_key: '300000',
        signed_prekey_id: '4224',
        signed_prekey_public: '100000',
        signed_prekey_sig: '200000',
        prekeys: ['1991', '1992', '1993'],
    });
    await answerV2Bundle(_converse, contact_jid, '555');
    await rendered;

    return { view, contact_jid, conn: _converse.api.connection.get() };
}

/**
 * Build an incoming omemo:2 message from `sender_device_id`, exactly as the
 * contact would, so decryption succeeds and the heartbeat logic runs with
 * whatever `window.libomemo.mock_ratchet` currently reports. Returns the stanza
 * so callers can inject several back-to-back (see the concurrency test).
 */
async function buildOMEMO2Message(_converse, contact_jid, sender_device_id, conn) {
    const our_device_id = _converse.state.omemo_store.get('device_id');
    const { key_and_tag, payload } = await u.omemo.encryptSCE('hi', { from_jid: contact_jid, to_jid: null });
    return stx`<message from="${contact_jid}"
            to="${conn.jid}"
            type="chat"
            id="${conn.getUniqueId()}"
            xmlns="jabber:client">
        <encrypted xmlns="${Strophe.NS.OMEMO2}">
            <header sid="${sender_device_id}">
                <keys jid="${_converse.bare_jid}">
                    <key rid="${our_device_id}">${u.arrayBufferToBase64(key_and_tag)}</key>
                </keys>
            </header>
            <payload>${payload}</payload>
        </encrypted>
        <encryption xmlns="${Strophe.NS.EME}" namespace="${Strophe.NS.OMEMO2}"/>
    </message>`;
}

/** Build and inject a single incoming omemo:2 message. */
async function receiveOMEMO2Message(_converse, contact_jid, sender_device_id, conn) {
    const stanza = await buildOMEMO2Message(_converse, contact_jid, sender_device_id, conn);
    conn._dataRecv(mock.createRequest(_converse, stanza));
}

/** A sent <encrypted> element (for `ns`) with no <payload> is a heartbeat. */
function sentHeartbeats(conn, ns = Strophe.NS.OMEMO2) {
    return conn.sent_stanzas.filter((s) => {
        const enc = sizzle(`encrypted[xmlns="${ns}"]`, s).pop();
        return enc && !enc.querySelector('payload');
    });
}

/**
 * Legacy variant of {@link setupAndPrewarm}: the contact has a single legacy
 * (eu.siacs.conversations.axolotl) device and no omemo:2 device.
 */
async function setupAndPrewarmLegacy(_converse) {
    await mock.waitForRoster(_converse, 'current', 1);
    const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
    await mock.initializedOMEMO(_converse);
    await mock.openChatBoxFor(_converse, contact_jid);
    await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid, ['555']));

    const view = _converse.chatboxviews.get(contact_jid);
    view.model.set('omemo_active', true);

    const rendered = mock.sendMessage(_converse, view, 'prewarm');
    await u.waitUntil(() =>
        mock.bundleFetched(_converse, {
            jid: contact_jid,
            device_id: '555',
            identity_key: '3333',
            signed_prekey_id: '4223',
            signed_prekey_public: '1111',
            signed_prekey_sig: '2222',
            prekeys: ['1001', '1002', '1003'],
        }),
    );
    await u.waitUntil(() =>
        mock.bundleFetched(_converse, {
            jid: _converse.bare_jid,
            device_id: '482886413b977930064a5888b92134fe',
            identity_key: '300000',
            signed_prekey_id: '4224',
            signed_prekey_public: '100000',
            signed_prekey_sig: '200000',
            prekeys: ['1991', '1992', '1993'],
        }),
    );
    await rendered;
    return { view, contact_jid, conn: _converse.api.connection.get() };
}

/** Inject an incoming legacy OMEMO message from `sender_device_id`. */
async function receiveLegacyMessage(_converse, contact_jid, sender_device_id, conn) {
    const our_device_id = _converse.state.omemo_store.get('device_id');
    const obj = await u.omemo.encryptMessage('hi');
    const stanza = stx`<message from="${contact_jid}"
            to="${conn.jid}"
            type="chat"
            id="${conn.getUniqueId()}"
            xmlns="jabber:client">
        <encrypted xmlns="${Strophe.NS.OMEMO}">
            <header sid="${sender_device_id}">
                <key rid="${our_device_id}">${u.arrayBufferToBase64(obj.key_and_tag)}</key>
                <iv>${obj.iv}</iv>
            </header>
            <payload>${obj.payload}</payload>
        </encrypted>
        <encryption xmlns="${Strophe.NS.EME}" namespace="${Strophe.NS.OMEMO}"/>
    </message>`;
    conn._dataRecv(mock.createRequest(_converse, stanza));
}

/**
 * Inject an incoming *payload-less* omemo:2 message — i.e. an empty/heartbeat
 * message: a `<header>` carrying our `<key>` but no `<payload>`. Per XEP-0384
 * the sender encrypts 32 zero-bytes directly with the ratchet, so the leading
 * key byte is 0x00 and the message decrypts via a regular (non-key-exchange)
 * session, exactly as our own {@link getOMEMO2HeartbeatElement} produces.
 */
function receiveOMEMO2Heartbeat(_converse, contact_jid, sender_device_id, conn) {
    const our_device_id = _converse.state.omemo_store.get('device_id');
    const key_b64 = u.arrayBufferToBase64(new ArrayBuffer(32));
    const stanza = stx`<message from="${contact_jid}"
            to="${conn.jid}"
            type="chat"
            id="${conn.getUniqueId()}"
            xmlns="jabber:client">
        <encrypted xmlns="${Strophe.NS.OMEMO2}">
            <header sid="${sender_device_id}">
                <keys jid="${_converse.bare_jid}">
                    <key rid="${our_device_id}">${key_b64}</key>
                </keys>
            </header>
        </encrypted>
        <encryption xmlns="${Strophe.NS.EME}" namespace="${Strophe.NS.OMEMO2}"/>
        <store xmlns="${Strophe.NS.HINTS}"/>
    </message>`;
    conn._dataRecv(mock.createRequest(_converse, stanza));
}

/**
 * Inject an incoming legacy KeyTransportElement: a `<header>` with `<key>`s and
 * an `<iv>`, but no `<payload>` (XEP-0384 0.3.0 §Sending a key). This is what a
 * legacy heartbeat looks like on the wire.
 */
async function receiveLegacyHeartbeat(_converse, contact_jid, sender_device_id, conn) {
    const our_device_id = _converse.state.omemo_store.get('device_id');
    const obj = await u.omemo.encryptMessage('');
    const stanza = stx`<message from="${contact_jid}"
            to="${conn.jid}"
            type="chat"
            id="${conn.getUniqueId()}"
            xmlns="jabber:client">
        <encrypted xmlns="${Strophe.NS.OMEMO}">
            <header sid="${sender_device_id}">
                <key rid="${our_device_id}">${u.arrayBufferToBase64(obj.key_and_tag)}</key>
                <iv>${obj.iv}</iv>
            </header>
        </encrypted>
        <encryption xmlns="${Strophe.NS.EME}" namespace="${Strophe.NS.OMEMO}"/>
        <store xmlns="${Strophe.NS.HINTS}"/>
    </message>`;
    conn._dataRecv(mock.createRequest(_converse, stanza));
}

describe('The OMEMO heartbeat', function () {
    beforeEach(() => (window.libomemo.mock_ratchet = { counter: 0, key: new Uint8Array([5, 1, 2, 3]).buffer }));
    afterEach(() => (window.libomemo.mock_ratchet = { counter: 0, key: new Uint8Array([5, 1, 2, 3]).buffer }));

    it(
        'is sent (as a payload-less message) when an incoming message has a ratchet counter >= 53',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { contact_jid, conn } = await setupAndPrewarm(_converse);

            window.libomemo.mock_ratchet = { counter: 53, key: new Uint8Array([5, 9, 9, 9]).buffer };
            await receiveOMEMO2Message(_converse, contact_jid, '555', conn);

            const heartbeat = await u.waitUntil(() => sentHeartbeats(conn).pop(), 1500);
            // Addressed to the contact's v2 device, carries the store hint, no payload.
            const enc = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO2}"]`, heartbeat).pop();
            expect(sizzle(`keys[jid="${contact_jid}"] key[rid="555"]`, enc).length).toBe(1);
            expect(enc.querySelector('payload')).toBe(null);
            expect(sizzle(`store[xmlns="${Strophe.NS.HINTS}"]`, heartbeat).length).toBe(1);
        }),
    );

    it(
        'is NOT sent when the ratchet counter is below 53',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { contact_jid, conn } = await setupAndPrewarm(_converse);

            window.libomemo.mock_ratchet = { counter: 52, key: new Uint8Array([5, 9, 9, 9]).buffer };
            await receiveOMEMO2Message(_converse, contact_jid, '555', conn);
            // Give any (erroneous) heartbeat a chance to be sent.
            await new Promise((resolve) => setTimeout(resolve, 500));
            expect(sentHeartbeats(conn).length).toBe(0);
        }),
    );

    it(
        'is sent only once per ratchet key',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { contact_jid, conn } = await setupAndPrewarm(_converse);

            // Two messages on the same ratchet key, both past the threshold.
            window.libomemo.mock_ratchet = { counter: 53, key: new Uint8Array([5, 9, 9, 9]).buffer };
            await receiveOMEMO2Message(_converse, contact_jid, '555', conn);
            await u.waitUntil(() => sentHeartbeats(conn).length === 1, 1500);

            window.libomemo.mock_ratchet = { counter: 54, key: new Uint8Array([5, 9, 9, 9]).buffer };
            await receiveOMEMO2Message(_converse, contact_jid, '555', conn);
            await new Promise((resolve) => setTimeout(resolve, 500));
            expect(sentHeartbeats(conn).length).toBe(1);
        }),
    );

    it(
        'is sent only once even when two messages on the same ratchet key race',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { contact_jid, conn } = await setupAndPrewarm(_converse);

            // Pre-build both stanzas (the expensive encryptSCE work) up front, so
            // that injecting them is cheap and synchronous.
            window.libomemo.mock_ratchet = { counter: 53, key: new Uint8Array([5, 9, 9, 9]).buffer };
            const s1 = await buildOMEMO2Message(_converse, contact_jid, '555', conn);
            const s2 = await buildOMEMO2Message(_converse, contact_jid, '555', conn);

            // Inject both stanzas synchronously. Both decryption pipelines start in the
            // same tick and the in-flight Set guard ensures only one heartbeat is sent.
            conn._dataRecv(mock.createRequest(_converse, s1));
            conn._dataRecv(mock.createRequest(_converse, s2));

            await u.waitUntil(() => sentHeartbeats(conn).length >= 1, 1500);
            // Let any erroneous second heartbeat have a chance to be sent.
            await new Promise((resolve) => setTimeout(resolve, 500));
            expect(sentHeartbeats(conn).length).toBe(1);
        }),
    );

    it(
        'is sent as a legacy KeyTransportElement (no payload) for legacy OMEMO',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { contact_jid, conn } = await setupAndPrewarmLegacy(_converse);

            window.libomemo.mock_ratchet = { counter: 53, key: new Uint8Array([5, 7, 7, 7]).buffer };
            await receiveLegacyMessage(_converse, contact_jid, '555', conn);

            const heartbeat = await u.waitUntil(() => sentHeartbeats(conn, Strophe.NS.OMEMO).pop(), 1500);
            const enc = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO}"]`, heartbeat).pop();
            // A KeyTransportElement: header with <key>s and an <iv>, but no <payload>.
            expect(sizzle(`key[rid="555"]`, enc).length).toBe(1);
            expect(enc.querySelector('iv')).toBeTruthy();
            expect(enc.querySelector('payload')).toBe(null);
            expect(sizzle(`store[xmlns="${Strophe.NS.HINTS}"]`, heartbeat).length).toBe(1);
        }),
    );

    it(
        'is sent as a groupchat message to the room for MUC messages',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const features = [
                'http://jabber.org/protocol/muc',
                'jabber:iq:register',
                'muc_membersonly',
                'muc_nonanonymous',
            ];
            const muc_jid = 'lounge@montague.lit';
            const nick = 'romeo';
            const sender_jid = 'newguy@montague.lit';
            const sender_device_id = '555';
            const conn = _converse.api.connection.get();

            await mock.openAndEnterMUC(_converse, muc_jid, nick, features);
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => mock.initializedOMEMO(_converse));

            // Enable OMEMO
            const toolbar = await u.waitUntil(() => view.querySelector('.chat-toolbar'));
            const el = await u.waitUntil(() => toolbar.querySelector('.toggle-omemo'));
            el.click();
            expect(view.model.get('omemo_active')).toBe(true);

            // newguy enters the room, so we fetch (and answer) his device list.
            const presence = stx`
            <presence to='romeo@montague.lit/orchard' from='${muc_jid}/newguy' xmlns="jabber:client">
                <x xmlns='${Strophe.NS.MUC_USER}'>
                    <item affiliation='member' jid='${sender_jid}/_converse.js-290929789' role='participant'/>
                </x>
            </presence>`;
            conn._dataRecv(mock.createRequest(_converse, presence));
            await mock.deviceListFetched(_converse, sender_jid, [sender_device_id]);

            // Prewarm: send a groupchat message, which builds sessions for the
            // room's devices (fetching newguy's bundle and our own). This warms
            // the caches so the subsequently-triggered heartbeat resolves without
            // needing further IQ round-trips. See setupAndPrewarm for the 1:1 case.
            const rendered = mock.sendMessage(_converse, view, 'prewarm');
            await mock.bundleFetched(_converse, {
                jid: sender_jid,
                device_id: sender_device_id,
                identity_key: '3333',
                signed_prekey_id: '4223',
                signed_prekey_public: '1111',
                signed_prekey_sig: '2222',
                prekeys: ['1001', '1002', '1003'],
            });
            await mock.bundleFetched(_converse, {
                jid: _converse.bare_jid,
                device_id: '482886413b977930064a5888b92134fe',
                identity_key: '300000',
                signed_prekey_id: '4224',
                signed_prekey_public: '100000',
                signed_prekey_sig: '200000',
                prekeys: ['1991', '1992', '1993'],
            });
            await rendered;

            // Build and inject an incoming MUC omemo message (type=groupchat, from=room/nick)
            const our_device_id = _converse.state.omemo_store.get('device_id');
            const obj = await u.omemo.encryptMessage('hi');
            window.libomemo.mock_ratchet = { counter: 53, key: new Uint8Array([5, 9, 9, 9]).buffer };
            const incoming = stx`<message from="${muc_jid}/newguy"
                    to="${conn.jid}"
                    type="groupchat"
                    id="${conn.getUniqueId()}"
                    xmlns="jabber:client">
                <encrypted xmlns="${Strophe.NS.OMEMO}">
                    <header sid="${sender_device_id}">
                        <key rid="${our_device_id}">${u.arrayBufferToBase64(obj.key_and_tag)}</key>
                        <iv>${obj.iv}</iv>
                    </header>
                    <payload>${obj.payload}</payload>
                </encrypted>
                <encryption xmlns="${Strophe.NS.EME}" namespace="${Strophe.NS.OMEMO}"/>
            </message>`;
            conn._dataRecv(mock.createRequest(_converse, incoming));

            const heartbeat = await u.waitUntil(() => sentHeartbeats(conn, Strophe.NS.OMEMO).pop(), 1500);
            // The heartbeat must be a groupchat addressed to the room JID.
            expect(heartbeat.getAttribute('type')).toBe('groupchat');
            expect(heartbeat.getAttribute('to')).toBe(muc_jid);
            const enc = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO}"]`, heartbeat).pop();
            expect(enc).toBeTruthy();
            expect(enc.querySelector('payload')).toBe(null);
            expect(sizzle(`store[xmlns="${Strophe.NS.HINTS}"]`, heartbeat).length).toBe(1);
        }),
    );
});

describe('Receiving an OMEMO heartbeat', function () {
    beforeEach(() => (window.libomemo.mock_ratchet = { counter: 0, key: new Uint8Array([5, 1, 2, 3]).buffer }));
    afterEach(() => (window.libomemo.mock_ratchet = { counter: 0, key: new Uint8Array([5, 1, 2, 3]).buffer }));

    it(
        'decrypts an incoming payload-less omemo:2 message without surfacing a message or error',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { view, contact_jid, conn } = await setupAndPrewarm(_converse);
            // setupAndPrewarm sent one (visible) outgoing message.
            expect(view.model.messages.length).toBe(1);

            // Counter stays at 0 (below threshold) so we isolate reception from
            // the sending logic: receiving a heartbeat must not, by itself, send one.
            await receiveOMEMO2Heartbeat(_converse, contact_jid, '555', conn);
            // Give any (erroneous) visible message / error / heartbeat a chance to appear.
            await new Promise((resolve) => setTimeout(resolve, 500));

            // The empty message decrypted cleanly: no new chat message is stored, no
            // decryption error is surfaced, and we did not send a heartbeat back.
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.filter((m) => m.get('is_error')).length).toBe(0);
            expect(sentHeartbeats(conn).length).toBe(0);
        }),
    );

    it(
        'decrypts an incoming legacy KeyTransportElement (no payload) without surfacing a message or error',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { view, contact_jid, conn } = await setupAndPrewarmLegacy(_converse);
            const initial = view.model.messages.length;

            await receiveLegacyHeartbeat(_converse, contact_jid, '555', conn);
            await new Promise((resolve) => setTimeout(resolve, 500));

            expect(view.model.messages.length).toBe(initial);
            expect(view.model.messages.filter((m) => m.get('is_error')).length).toBe(0);
            expect(sentHeartbeats(conn, Strophe.NS.OMEMO).length).toBe(0);
        }),
    );

    it(
        'forwards the ratchet (sends a heartbeat back) when an incoming heartbeat has counter >= 53',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { view, contact_jid, conn } = await setupAndPrewarm(_converse);
            expect(view.model.messages.length).toBe(1);

            // A payload-less incoming message must still be decrypted end-to-end so
            // its ratchet counter is read; a counter >= 53 then triggers our own
            // heartbeat. This proves reception runs the full decrypt pipeline.
            window.libomemo.mock_ratchet = { counter: 53, key: new Uint8Array([5, 6, 6, 6]).buffer };
            await receiveOMEMO2Heartbeat(_converse, contact_jid, '555', conn);

            await u.waitUntil(() => sentHeartbeats(conn).length === 1, 1500);
            // Still no visible message for the (empty) incoming heartbeat itself.
            expect(view.model.messages.length).toBe(1);
        }),
    );
});
