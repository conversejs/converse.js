/**
 * Tests for OMEMO 2 (urn:xmpp:omemo:2) functionality:
 *   - OMEMO 2 bundle parsing
 *   - OMEMO 2 message stanza routing
 */
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import { answerV2DeviceList, answerV2Bundle } from './utils.js';

const { Strophe, sizzle, stx, u } = converse.env;

/**
 * Override the read-only `document.visibilityState` and fire a
 * `visibilitychange` event, so focus-dependent behaviour can be tested.
 * @param {DocumentVisibilityState} state
 */
function setVisibilityState(state) {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
}

function restoreVisibilityState() {
    delete (/** @type {any} */ (document)).visibilityState;
}

describe('OMEMO 2 message reception', function () {
    it(
        'decrypts an incoming omemo:2 message and renders the plaintext',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.initializedOMEMO(_converse);
            mock.deferV2DeviceList(contact_jid); // we answer this contact's v2 list ourselves
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const our_device_id = _converse.state.omemo_store.get('device_id');
            const sender_device_id = '555';
            const plaintext = 'This is an OMEMO 2 encrypted message';

            // Build the SCE payload exactly as the sending contact would.
            const { key_and_tag, payload } = await u.omemo.encryptSCE(plaintext, {
                from_jid: contact_jid,
                to_jid: null,
            });

            // During decryption the device's active state is updated, which
            // fetches the contact's v2 device list. Answer that IQ in the
            // background with a list containing the sending device.
            const conn = api.connection.get();
            const v2_dl_selector = `iq[to="${contact_jid}"] items[node="${Strophe.NS.OMEMO2_DEVICELIST}"]`;
            const interval = setInterval(() => {
                const iq = Array.from(conn.IQ_stanzas)
                    .filter((i) => i.querySelector(v2_dl_selector) && !i.dataset_handled)
                    .pop();
                if (!iq) return;
                iq.dataset_handled = true;
                const result = stx`<iq from="${contact_jid}"
                                       id="${iq.getAttribute('id')}"
                                       to="${conn.jid}"
                                       xmlns="jabber:server"
                                       type="result">
                    <pubsub xmlns="${Strophe.NS.PUBSUB}">
                        <items node="${Strophe.NS.OMEMO2_DEVICELIST}">
                            <item>
                                <devices xmlns="${Strophe.NS.OMEMO2}">
                                    <device id="${sender_device_id}"/>
                                </devices>
                            </item>
                        </items>
                    </pubsub>
                </iq>`;
                conn._dataRecv(mock.createRequest(_converse, result));
            }, 50);

            const stanza = stx`<message from="${contact_jid}"
                    to="${conn.jid}"
                    type="chat"
                    id="${conn.getUniqueId()}"
                    xmlns="jabber:client">
                <body>This is a fallback message</body>
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
            conn._dataRecv(mock.createRequest(_converse, stanza));

            await new Promise((resolve) => view.model.messages.once('rendered', resolve));
            clearInterval(interval);

            expect(view.model.messages.length).toBe(1);
            expect(view.querySelector('.chat-msg__body').textContent.trim()).toBe(plaintext);
            expect(view.model.messages.at(0).get('is_encrypted')).toBe(true);
            expect(view.model.messages.at(0).get('encryption_namespace')).toBe(Strophe.NS.OMEMO2);
        }),
    );

    it(
        'shows an error for an undecryptable message that has no fallback body',
        // Regression test for https://github.com/conversejs/converse.js/issues/2097
        // An OMEMO message that we can't decrypt (here: not encrypted for this
        // device) and which carries no fallback <body> must still be surfaced to
        // the user instead of being silently dropped.
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.initializedOMEMO(_converse);

            // Stub out IntersectionObserver so the message's visibility is driven
            // manually below, instead of the observer firing as soon as the
            // (visible) message is rendered.
            spyOn(window, 'IntersectionObserver').and.returnValue(
                /** @type {any} */ ({ observe() {}, unobserve() {}, disconnect() {} }),
            );

            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const conn = api.connection.get();

            // The message addresses our bare JID, but with a <key> for some other
            // device of ours (rid="999999"), not the one we're running. There's
            // no fallback <body>, so previously the message was dropped silently.
            const stanza = stx`<message from="${contact_jid}"
                    to="${conn.jid}"
                    type="chat"
                    id="${conn.getUniqueId()}"
                    xmlns="jabber:client">
                <encrypted xmlns="${Strophe.NS.OMEMO2}">
                    <header sid="555">
                        <keys jid="${_converse.bare_jid}">
                            <key rid="999999">${btoa('not-for-this-device')}</key>
                        </keys>
                    </header>
                    <payload>${btoa('irrelevant')}</payload>
                </encrypted>
                <encryption xmlns="${Strophe.NS.EME}" namespace="${Strophe.NS.OMEMO2}"/>
            </message>`;
            conn._dataRecv(mock.createRequest(_converse, stanza));

            await u.waitUntil(() => view.model.messages.length === 1);
            const message = view.model.messages.at(0);
            expect(message.get('is_error')).toBe(true);
            expect(message.get('type')).toBe('error');
            expect(message.get('error_condition')).toBe('not-encrypted-for-this-device');

            await u.waitUntil(() => view.querySelector('.chat-info__message'));
            expect(view.querySelector('.chat-info .reason').textContent).toContain('could not be decrypted');

            // The ephemeral auto-destruct countdown must not start until the
            // message has been seen, so we're confident the user saw it. See #2097.
            expect(message.get('is_ephemeral')).toBe(true);
            expect(message.get('defer_ephemeral_timer')).toBe(true);
            expect(message.ephemeral_timer).toBeFalsy();

            // The message opts into focus-aware visibility, so being scrolled
            // into view on a *background* tab must not start the countdown.
            const message_el = view.querySelector('converse-chat-message');
            expect(message_el.observableRequireFocus).toBe(true);
            try {
                setVisibilityState('hidden');
                message_el.handleIntersectionCallback([/** @type {any} */ ({ intersectionRatio: 1 })]);
                expect(message.ephemeral_timer).toBeFalsy();

                // It then scrolls back out of view (e.g. pushed up by later
                // messages) while still on the background tab.
                message_el.handleIntersectionCallback([/** @type {any} */ ({ intersectionRatio: 0 })]);

                // Returning to the tab must NOT start the countdown, because the
                // message is no longer in view — the current intersection state
                // is re-checked, not the stale first sighting.
                setVisibilityState('visible');
                expect(message.ephemeral_timer).toBeFalsy();

                // Only once it's actually in view AND the tab is focused does the
                // countdown start.
                message_el.handleIntersectionCallback([/** @type {any} */ ({ intersectionRatio: 1 })]);
                expect(message.ephemeral_timer).toBeTruthy();
            } finally {
                restoreVisibilityState();
            }
        }),
    );

    it(
        'routes by which <encrypted> block addresses our device, not by the EME hint',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.initializedOMEMO(_converse);
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const conn = _converse.api.connection.get();
            const our_device_id = _converse.state.omemo_store.get('device_id');
            const plaintext = 'Legacy block addressed to me, even though EME says omemo:2';

            // The legacy decryption path fetches the contact's (legacy) device
            // list to mark the sending device active. Answer that IQ in the
            // background with a list containing the sending device.
            const dl_selector = `iq[to="${contact_jid}"] items[node="${Strophe.NS.OMEMO_DEVICELIST}"]`;
            const interval = setInterval(() => {
                const iq = Array.from(conn.IQ_stanzas)
                    .filter((i) => i.querySelector(dl_selector) && !i.dataset_handled)
                    .pop();
                if (!iq) return;
                iq.dataset_handled = true;
                const result = stx`<iq from="${contact_jid}"
                                       id="${iq.getAttribute('id')}"
                                       to="${conn.jid}"
                                       xmlns="jabber:server"
                                       type="result">
                    <pubsub xmlns="${Strophe.NS.PUBSUB}">
                        <items node="${Strophe.NS.OMEMO_DEVICELIST}">
                            <item>
                                <list xmlns="${Strophe.NS.OMEMO}">
                                    <device id="555"/>
                                </list>
                            </item>
                        </items>
                    </pubsub>
                </iq>`;
                conn._dataRecv(mock.createRequest(_converse, result));
            }, 50);

            // A dual-stack sender addressed one of *their own* omemo:2 devices in
            // the omemo:2 block (<keys jid> is the sender, not us) and addressed
            // *us* in the legacy block. The EME hint points at omemo:2 (the
            // newest method, meant only for clients that can decrypt neither),
            // but our key lives only in the legacy block — we must still decrypt
            // it instead of mis-routing to the omemo:2 path and erroring out.
            const obj = await u.omemo.encryptMessage(plaintext);
            const stanza = stx`<message from="${contact_jid}"
                    to="${conn.jid}"
                    type="chat"
                    id="${conn.getUniqueId()}"
                    xmlns="jabber:client">
                <body>This is a fallback message</body>
                <encrypted xmlns="${Strophe.NS.OMEMO2}">
                    <header sid="999">
                        <keys jid="${contact_jid}">
                            <key rid="111">${btoa('not-for-us')}</key>
                        </keys>
                    </header>
                    <payload>${btoa('irrelevant')}</payload>
                </encrypted>
                <encrypted xmlns="${Strophe.NS.OMEMO}">
                    <header sid="555">
                        <key rid="${our_device_id}">${u.arrayBufferToBase64(obj.key_and_tag)}</key>
                        <iv>${obj.iv}</iv>
                    </header>
                    <payload>${obj.payload}</payload>
                </encrypted>
                <encryption xmlns="${Strophe.NS.EME}" namespace="${Strophe.NS.OMEMO2}"/>
            </message>`;
            conn._dataRecv(mock.createRequest(_converse, stanza));

            await new Promise((resolve) => view.model.messages.once('rendered', resolve));
            clearInterval(interval);

            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.at(0).get('is_error')).not.toBe(true);
            expect(view.querySelector('.chat-msg__body').textContent.trim()).toBe(plaintext);
        }),
    );
});

describe('OMEMO 2 bundle parsing', function () {
    it(
        'parses an omemo:2 bundle element into the internal bundle format',
        mock.initConverse(converse, [], {}, function (_converse) {
            const bundle_el = stx`
                <bundle xmlns="${Strophe.NS.OMEMO2}">
                    <spk id="42">${btoa('signed-prekey-pub')}</spk>
                    <spks>${btoa('signed-prekey-sig')}</spks>
                    <ik>${btoa('identity-key')}</ik>
                    <prekeys>
                        <pk id="1">${btoa('prekey-1')}</pk>
                        <pk id="2">${btoa('prekey-2')}</pk>
                        <pk id="3">${btoa('prekey-3')}</pk>
                    </prekeys>
                </bundle>`.tree();

            const bundle = u.omemo.parseBundleV2(bundle_el);
            expect(bundle.identity_key).toBe(btoa('identity-key'));
            expect(bundle.signed_prekey.id).toBe(42);
            expect(bundle.signed_prekey.public_key).toBe(btoa('signed-prekey-pub'));
            expect(bundle.signed_prekey.signature).toBe(btoa('signed-prekey-sig'));
            expect(bundle.prekeys.length).toBe(3);
            expect(bundle.prekeys[0]).toEqual({ id: 1, key: btoa('prekey-1') });
            expect(bundle.prekeys[2]).toEqual({ id: 3, key: btoa('prekey-3') });
        }),
    );
});

describe('OMEMO 2 sending', function () {
    it(
        "fetches a contact's v2 devicelist on send and encrypts via omemo:2",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.initializedOMEMO(_converse);
            mock.deferV2DeviceList(contact_jid); // we answer this contact's v2 list ourselves
            await mock.openChatBoxFor(_converse, contact_jid);

            const view = _converse.chatboxviews.get(contact_jid);
            view.model.set('omemo_active', true);

            // Kick off the send (don't await yet — we still have to answer the
            // device-list and bundle fetches it triggers).
            const rendered = mock.sendMessage(_converse, view, 'This is an omemo:2 message');

            // The send path fetches the contact's devices for BOTH versions.
            // Before the fetch-on-send fix the v2 list was never queried, so a
            // contact whose v2 devicelist isn't already cached went out
            // legacy-only.
            await mock.deviceListFetched(_converse, contact_jid, ['555']);
            await answerV2DeviceList(_converse, contact_jid, ['555']);

            // Our own second (legacy-only) device still needs its bundle; the
            // contact's device 555 is addressed via v2 (preferred on dedup).
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

            const sent_stanza = await u.waitUntil(
                () =>
                    _converse.api.connection
                        .get()
                        .sent_stanzas.filter((s) => s.querySelector('encrypted'))
                        .pop(),
                1000,
            );

            // The contact (device 555) is addressed via an omemo:2 <encrypted>
            // element, grouped under <keys jid="contact">.
            const v2_enc = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO2}"]`, sent_stanza).pop();
            expect(v2_enc).toBeTruthy();
            expect(sizzle(`keys[jid="${contact_jid}"] key[rid="555"]`, v2_enc).length).toBe(1);
            expect(v2_enc.querySelector('payload')).toBeTruthy();

            // The EME hint advertises omemo:2 (the newest method present).
            const eme = sizzle(`encryption[xmlns="${Strophe.NS.EME}"]`, sent_stanza).pop();
            expect(eme.getAttribute('namespace')).toBe(Strophe.NS.OMEMO2);

            // Our own legacy-only device is still addressed via the legacy
            // element, but the contact's 555 is NOT (deduplicated to v2).
            const legacy_enc = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO}"]`, sent_stanza).pop();
            expect(legacy_enc).toBeTruthy();
            expect(sizzle(`key[rid="482886413b977930064a5888b92134fe"]`, legacy_enc).length).toBe(1);
            expect(sizzle(`key[rid="555"]`, legacy_enc).length).toBe(0);
        }),
    );

    it(
        'does not drop a device whose id collides with a different JID across versions',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';

            // Our own (non-sending) legacy device has this id. We deliberately
            // give the *contact* an omemo:2 device with the SAME id but on a
            // different JID. Device ids are unique only per user, so keying the
            // cross-version dedup on the id alone would treat the contact's v2
            // device and our own legacy device as the same physical device and
            // drop ours — silently leaving our other device unable to read what
            // we send. Keying on (JID, id) keeps both.
            const shared_id = '482886413b977930064a5888b92134fe';

            await mock.initializedOMEMO(_converse);
            mock.deferV2DeviceList(contact_jid); // we answer this contact's v2 list ourselves
            await mock.openChatBoxFor(_converse, contact_jid);

            const view = _converse.chatboxviews.get(contact_jid);
            view.model.set('omemo_active', true);

            const rendered = mock.sendMessage(_converse, view, 'Collision test');

            // The contact has no legacy devices, but an omemo:2 device whose id
            // collides with our own legacy device's id.
            await mock.deviceListFetched(_converse, contact_jid, []);
            await answerV2DeviceList(_converse, contact_jid, [shared_id]);

            // Bundles: our own legacy device (the would-be dedup victim) and the
            // contact's colliding omemo:2 device.
            await mock.bundleFetched(_converse, {
                jid: _converse.bare_jid,
                device_id: shared_id,
                identity_key: '300000',
                signed_prekey_id: '4224',
                signed_prekey_public: '100000',
                signed_prekey_sig: '200000',
                prekeys: ['1991', '1992', '1993'],
            });
            await answerV2Bundle(_converse, contact_jid, shared_id);

            await rendered;

            const sent_stanza = await u.waitUntil(
                () =>
                    _converse.api.connection
                        .get()
                        .sent_stanzas.filter((s) => s.querySelector('encrypted'))
                        .pop(),
                1000,
            );

            // The contact's omemo:2 device is addressed via the v2 element...
            const v2_enc = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO2}"]`, sent_stanza).pop();
            expect(sizzle(`keys[jid="${contact_jid}"] key[rid="${shared_id}"]`, v2_enc).length).toBe(1);

            // ...and our OWN legacy device of the same id is STILL addressed via
            // the legacy element. With the old id-only dedup it was dropped, so
            // no legacy <encrypted> element would be emitted at all.
            const legacy_enc = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO}"]`, sent_stanza).pop();
            expect(legacy_enc).toBeTruthy();
            expect(sizzle(`key[rid="${shared_id}"]`, legacy_enc).length).toBe(1);
        }),
    );
});

describe('The OMEMO session store', function () {
    it(
        'scopes removeAllSessions to its own version (a legacy wipe leaves omemo:2 sessions intact)',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.initializedOMEMO(_converse);

            const legacy_store = u.omemo.getVersionedStore(Strophe.NS.OMEMO);
            const v2_store = u.omemo.getVersionedStore(Strophe.NS.OMEMO2);

            // Same libsignal address in both versions. Legacy keys are stored
            // unprefixed for backward compat, v2 keys behind a 'v2:' prefix, so
            // the legacy key is a string-prefix of the v2 one.
            const address = 'juliet@capulet.lit.555';
            await legacy_store.storeSession(address, { record: 'legacy' });
            await v2_store.storeSession(address, { record: 'v2' });

            expect(await legacy_store.loadSession(address)).toBeTruthy();
            expect(await v2_store.loadSession(address)).toBeTruthy();

            // Wiping legacy sessions must not touch the v2 session that merely
            // shares the key prefix. (Before the fix this also cleared v2.)
            await legacy_store.removeAllSessions();

            expect(await legacy_store.loadSession(address)).toBeFalsy();
            expect(await v2_store.loadSession(address)).toBeTruthy();
        }),
    );
});
