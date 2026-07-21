/**
 * Tests for OMEMO 2 (urn:xmpp:omemo:2) functionality:
 *   - OMEMO 2 bundle parsing
 *   - OMEMO 2 message stanza routing
 */
import { afterEach } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import { answerV2DeviceList, answerV2Bundle } from './utils.js';

const { Strophe, sizzle, stx, u } = converse.env;

// These specs answer the device-list IQ that decryption fetches by polling on a timer.
// Registering the timers means a spec that gives up early (decryption is CPU-heavy, and a
// wait can time out) cannot leave one running to inject stanzas into whatever runs next.
const pollers = [];
function pollFor(fn, ms = 50) {
    const id = setInterval(fn, ms);
    pollers.push(id);
    return id;
}
afterEach(() => {
    while (pollers.length) clearInterval(pollers.pop());
});

// Decryption sets up an X3DH session before the reaction lands, which can outrun
// waitUntil's default on a loaded machine. Still inside vitest's per-test timeout, so a
// genuine failure reports as itself rather than as the whole test timing out.
const DECRYPT_WAIT = 5000;

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
            const interval = pollFor(() => {
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
        'extracts body-coupled metadata (references/reply/oob/spoiler) from the SCE content',
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
            const plaintext = 'Hi juliet, look here';

            // The contact builds the SCE payload with body-coupled metadata
            // encrypted inside <content>.
            const extensions = [
                stx`<reference xmlns="${Strophe.NS.REFERENCE}" begin="3" end="9" type="mention" uri="xmpp:juliet@capulet.lit"></reference>`,
                stx`<reply xmlns="${Strophe.NS.REPLY}" id="replied-to-id" to="${contact_jid}"></reply>`,
                stx`<fallback xmlns="${Strophe.NS.FALLBACK}" for="${Strophe.NS.REPLY}"><body start="0" end="7"/></fallback>`,
                stx`<x xmlns="${Strophe.NS.OUTOFBAND}"><url>https://example.org/file.txt</url></x>`,
                stx`<spoiler xmlns="${Strophe.NS.SPOILER}">a spoiler</spoiler>`,
            ];
            const { key_and_tag, payload } = await u.omemo.encryptSCE(
                plaintext,
                { from_jid: contact_jid, to_jid: null },
                extensions,
            );

            // Answer the contact's v2 device-list IQ fetched during decryption.
            const conn = api.connection.get();
            const v2_dl_selector = `iq[to="${contact_jid}"] items[node="${Strophe.NS.OMEMO2_DEVICELIST}"]`;
            const interval = pollFor(() => {
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

            const message = view.model.messages.at(0);
            expect(message.get('plaintext')).toBe(plaintext);

            const references = message.get('references');
            expect(references.length).toBe(1);
            expect(references[0].uri).toBe('xmpp:juliet@capulet.lit');
            expect(references[0].value).toBe('juliet');

            expect(message.get('reply_to_id')).toBe('replied-to-id');
            // The XEP-0428 fallback marker is parsed from the decrypted SCE content.
            expect(message.get('fallback')?.[Strophe.NS.REPLY]).toEqual({ start: 0, end: 7 });
            expect(message.get('reply_to')).toBe(contact_jid);
            expect(message.get('oob_url')).toBe('https://example.org/file.txt');
            expect(message.get('is_spoiler')).toBe(true);
            expect(message.get('spoiler_hint')).toBe('a spoiler');
        }),
    );

    it(
        'applies an incoming encrypted (omemo:2) reaction to its target message',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.initializedOMEMO(_converse);
            mock.deferV2DeviceList(contact_jid); // we answer this contact's v2 list ourselves
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const conn = api.connection.get();
            const our_device_id = _converse.state.omemo_store.get('device_id');
            const sender_device_id = '555';

            // A (cleartext) message for the reaction to target.
            await _converse.handleMessageStanza(
                stx`<message xmlns="jabber:client" from="${contact_jid}" to="${conn.jid}" type="chat" id="omemo-react-target">
                    <body>React to me</body>
                </message>`,
            );
            await u.waitUntil(() => view.model.messages.findWhere({ msgid: 'omemo-react-target' }));
            const msg_model = view.model.messages.findWhere({ msgid: 'omemo-react-target' });

            // The contact sends a bodyless, SCE-encrypted XEP-0444 reaction.
            const extensions = [
                stx`<reactions xmlns="urn:xmpp:reactions:0" id="omemo-react-target"><reaction>👍</reaction></reactions>`,
            ];
            const { key_and_tag, payload } = await u.omemo.encryptSCE(
                null,
                { from_jid: contact_jid, to_jid: null },
                extensions,
            );

            // Answer the contact's v2 device-list IQ fetched during decryption.
            const v2_dl_selector = `iq[to="${contact_jid}"] items[node="${Strophe.NS.OMEMO2_DEVICELIST}"]`;
            const interval = pollFor(() => {
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

            await u.waitUntil(() => msg_model.get('reactions')?.[contact_jid]?.includes('👍'), DECRYPT_WAIT);
            clearInterval(interval);

            expect(msg_model.get('reactions')[contact_jid]).toContain('👍');
            // The reaction must not create a separate visible message, and must
            // not clobber the target message's body.
            expect(view.model.messages.length).toBe(1);
            expect(msg_model.get('body')).toBe('React to me');
        }),
    );

    it(
        'suppresses the emoji fallback body of an encrypted reaction',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.initializedOMEMO(_converse);
            mock.deferV2DeviceList(contact_jid); // we answer this contact's v2 list ourselves
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const conn = api.connection.get();
            const our_device_id = _converse.state.omemo_store.get('device_id');
            const sender_device_id = '555';

            // A (cleartext) message for the reaction to target.
            await _converse.handleMessageStanza(
                stx`<message xmlns="jabber:client" from="${contact_jid}" to="${conn.jid}" type="chat" id="omemo-react-fb-target">
                    <body>React to me with a fallback</body>
                </message>`,
            );
            await u.waitUntil(() => view.model.messages.findWhere({ msgid: 'omemo-react-fb-target' }));
            const msg_model = view.model.messages.findWhere({ msgid: 'omemo-react-fb-target' });

            // The contact sends an SCE-encrypted XEP-0444 reaction whose body
            // carries a quote of the reacted-to message plus the emoji as a
            // legacy fallback, marked by a whole-body XEP-0428
            // <fallback for="urn:xmpp:reactions:0">.
            const extensions = [
                stx`<reactions xmlns="urn:xmpp:reactions:0" id="omemo-react-fb-target"><reaction>👍</reaction></reactions>`,
                stx`<fallback xmlns="${Strophe.NS.FALLBACK}" for="urn:xmpp:reactions:0"><body/></fallback>`,
            ];
            const { key_and_tag, payload } = await u.omemo.encryptSCE(
                '> React to me with a fallback\n👍',
                { from_jid: contact_jid, to_jid: null },
                extensions,
            );

            // Answer the contact's v2 device-list IQ fetched during decryption.
            const v2_dl_selector = `iq[to="${contact_jid}"] items[node="${Strophe.NS.OMEMO2_DEVICELIST}"]`;
            const interval = pollFor(() => {
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

            await u.waitUntil(() => msg_model.get('reactions')?.[contact_jid]?.includes('👍'), DECRYPT_WAIT);
            clearInterval(interval);

            expect(msg_model.get('reactions')[contact_jid]).toContain('👍');
            // The emoji fallback body must NOT be surfaced as a standalone
            // message, and must not clobber the target message's body/plaintext.
            expect(view.model.messages.length).toBe(1);
            expect(msg_model.get('body')).toBe('React to me with a fallback');
            expect(msg_model.get('plaintext')).toBeFalsy();
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
            const interval = pollFor(() => {
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

    it(
        'returns null instead of throwing when no bundle element is present',
        mock.initConverse(converse, [], {}, function (_converse) {
            // A stale/orphaned device with no published bundle makes the server
            // answer the fetch with an empty result, so parseBundle*/V2 can be
            // handed `undefined`. They must fail soft (return null) so the caller
            // skips just that one device rather than crashing the whole send with
            // "Cannot read properties of undefined (reading 'querySelector')".
            expect(u.omemo.parseBundleV2(undefined)).toBe(null);
            expect(u.omemo.parseBundleV2(null)).toBe(null);
            expect(u.omemo.parseBundle(undefined)).toBe(null);
            expect(u.omemo.parseBundle(null)).toBe(null);
        }),
    );
});

describe('OMEMO 2 store self-healing', function () {
    it(
        'backfills missing prekeys/signed-prekeys without changing the device id or identity key',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.initializedOMEMO(_converse);
            const store = _converse.state.omemo_store;
            const device_id = store.get('device_id');
            const identity_keypair = store.get('identity_keypair');

            // Simulate a generateBundle() interrupted after the device_id and
            // identity key were persisted but before the prekeys (e.g. the tab
            // was closed mid key-generation). Previously publishBundle() then
            // threw on the absent prekeys and the device never recovered.
            store.unset('prekeys');
            store.unset('signed_prekey');
            store.unset('signed_prekey_omemo2');
            expect(Object.keys(store.getPreKeys()).length).toBe(0);

            await store.ensureProvisioned();

            // Key material is restored, and the device id + identity (fingerprint)
            // are reused so trusted sessions and the published device id survive.
            expect(store.get('device_id')).toBe(device_id);
            expect(store.get('identity_keypair')).toEqual(identity_keypair);
            expect(Object.keys(store.getPreKeys()).length).toBe(_converse.NUM_PREKEYS);
            expect(store.get('signed_prekey')).toBeTruthy();
            expect(store.get('signed_prekey_omemo2')).toBeTruthy();

            // A complete store is left untouched (ensureProvisioned is a no-op).
            const prekeys = store.get('prekeys');
            const spk = store.get('signed_prekey');
            await store.ensureProvisioned();
            expect(store.get('prekeys')).toBe(prekeys);
            expect(store.get('signed_prekey')).toBe(spk);
        }),
    );

    it(
        'reports whether it regenerated key material, so the bundle is only republished when it changed',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.initializedOMEMO(_converse);
            const store = _converse.state.omemo_store;

            // A fully provisioned store needs no repair, so nothing changed and
            // there's nothing new to publish.
            expect(await store.ensureProvisioned()).toBe(false);

            // Each kind of missing key material is backfilled and reported as a
            // change, so initOMEMO knows the bundle must be (re)published. First
            // the omemo:2 signed prekey (i.e. a store from before omemo:2 support).
            store.unset('signed_prekey_omemo2');
            expect(await store.ensureProvisioned()).toBe(true);
            expect(await store.ensureProvisioned()).toBe(false); // now intact again

            store.unset('signed_prekey');
            expect(await store.ensureProvisioned()).toBe(true);

            store.unset('prekeys');
            expect(await store.ensureProvisioned()).toBe(true);
            expect(await store.ensureProvisioned()).toBe(false);
        }),
    );
});

describe('OMEMO bundle publishing', function () {
    it(
        'only republishes the bundle when it changed or was never confirmed on the server',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.initializedOMEMO(_converse);
            const store = _converse.state.omemo_store;

            // The gate initOMEMO applies on connect. Instead of a resumed-session
            // check we track `bundle_published`, so this holds for any connection
            // type (full login, XEP-0198 resume, shared-worker attach, BOSH prebind).
            const wouldPublish = (changed) => changed || !store.get('bundle_published');

            // initializedOMEMO drove a successful publish, so the bundle is flagged
            // as published and an unchanged (re)connection skips the large republish.
            expect(store.get('bundle_published')).toBe(true);
            expect(wouldPublish(await store.ensureProvisioned())).toBe(false);

            // A change (here the omemo:2 migration) clears the flag and forces a
            // republish, regardless of how we (re)connected.
            store.unset('signed_prekey_omemo2');
            const changed = await store.ensureProvisioned();
            expect(changed).toBe(true);
            expect(store.get('bundle_published')).toBe(false);
            expect(wouldPublish(changed)).toBe(true);

            // A successful publish records that the bundle reached the server, so
            // the next unchanged connection skips again. (Stub the network so we
            // don't have to answer the publish IQ here.)
            spyOn(api.pubsub, 'publish').and.resolveTo();
            await store.publishBundle();
            expect(store.get('bundle_published')).toBe(true);
            expect(wouldPublish(await store.ensureProvisioned())).toBe(false);

            // A bundle that never reached the server (e.g. the initial publish
            // failed) is retried even when nothing changed. This is what a
            // resumed-session check would have missed on a BOSH prebind attach.
            store.save({ bundle_published: false });
            expect(wouldPublish(await store.ensureProvisioned())).toBe(true);
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
        'does not leak the reply in cleartext for an encrypted message',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.initializedOMEMO(_converse);
            mock.deferV2DeviceList(contact_jid); // we answer this contact's v2 list ourselves
            await mock.openChatBoxFor(_converse, contact_jid);

            const view = _converse.chatboxviews.get(contact_jid);
            view.model.set('omemo_active', true);
            // Reply state is read by getOutgoingMessageAttributes for the next send.
            view.model.set({ reply_to_id: 'replied-to-id', reply_to: contact_jid });

            const rendered = mock.sendMessage(_converse, view, 'This is an encrypted reply');

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

            const sent_stanza = await u.waitUntil(
                () =>
                    _converse.api.connection
                        .get()
                        .sent_stanzas.filter((s) => s.querySelector('encrypted'))
                        .pop(),
                1000,
            );

            // The encrypted message must be sent (omemo:2 payload present)...
            expect(sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO2}"] payload`, sent_stanza).length).toBe(1);
            // ...but the body-coupled <reply> must NOT appear in cleartext — it
            // now lives encrypted inside the SCE <content> instead.
            expect(sizzle(`> reply[xmlns="${Strophe.NS.REPLY}"]`, sent_stanza).length).toBe(0);
            // Nor may the XEP-0461/0428 reply fallback marker leak in cleartext.
            expect(sizzle(`> fallback[xmlns="${Strophe.NS.FALLBACK}"]`, sent_stanza).length).toBe(0);
            // The XEP-0085 chat state must not leak in cleartext either; it's
            // carried encrypted inside the SCE <content>.
            expect(sizzle(`> active[xmlns="${Strophe.NS.CHATSTATES}"]`, sent_stanza).length).toBe(0);
        }),
    );

    it(
        'encrypts an outgoing reaction instead of sending it in cleartext',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.initializedOMEMO(_converse);
            mock.deferV2DeviceList(contact_jid); // we answer this contact's v2 list ourselves
            await mock.openChatBoxFor(_converse, contact_jid);

            const view = _converse.chatboxviews.get(contact_jid);
            view.model.set('omemo_active', true);

            const conn = api.connection.get();

            // A received message for us to react to.
            await _converse.handleMessageStanza(
                stx`<message xmlns="jabber:client" from="${contact_jid}" to="${conn.jid}" type="chat" id="omemo-react-send-target">
                    <body>React to me</body>
                </message>`,
            );
            await u.waitUntil(() => view.querySelector('.chat-msg[data-msgid="omemo-react-send-target"]'));

            // Open the reaction picker for the target message and select an emoji.
            // This kicks off the (async, encrypted) reaction send.
            const msg_el = view.querySelector('.chat-msg[data-msgid="omemo-react-send-target"]');
            const toggle_el = await u.waitUntil(() =>
                msg_el.querySelector('converse-message-actions converse-dropdown .dropdown-toggle'),
            );
            toggle_el.click();
            const action_el = await u.waitUntil(() => msg_el.querySelector('.chat-msg__action-reaction'));
            action_el.click();
            const picker_el = await u.waitUntil(() => msg_el.querySelector('converse-reaction-picker'));
            picker_el.onEmojiSelected('👍');

            // The encrypted send fetches recipient devices/bundles for both
            // versions, exactly like a normal message send.
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

            const sent_stanza = await u.waitUntil(
                () => conn.sent_stanzas.filter((s) => s.querySelector('encrypted')).pop(),
                1000,
            );

            // The reaction is encrypted: an omemo:2 <encrypted> payload is sent
            // (the structured <reactions> lives inside the SCE <content>)...
            expect(sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO2}"] payload`, sent_stanza).length).toBe(1);
            // ...and our own legacy device is addressed via the legacy element.
            expect(sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO}"]`, sent_stanza).length).toBe(1);
            // The EME hint advertises omemo:2 (the newest method present).
            const eme = sizzle(`encryption[xmlns="${Strophe.NS.EME}"]`, sent_stanza).pop();
            expect(eme.getAttribute('namespace')).toBe(Strophe.NS.OMEMO2);

            // Crucially, neither the structured <reactions> nor the emoji body
            // may leak in cleartext.
            expect(sizzle(`> reactions[xmlns="${Strophe.NS.REACTIONS}"]`, sent_stanza).length).toBe(0);
            expect(sizzle(`> body`, sent_stanza).length).toBe(0);

            // The optimistic local update still applies our reaction.
            const msg_model = view.model.messages.findWhere({ msgid: 'omemo-react-send-target' });
            await u.waitUntil(() => msg_model.get('reactions')?.[_converse.bare_jid]?.includes('👍'));
            expect(msg_model.get('reactions')[_converse.bare_jid]).toContain('👍');
        }),
    );

    it(
        'quotes the reacted-to message in the encrypted reaction fallback body',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.initializedOMEMO(_converse);
            mock.deferV2DeviceList(contact_jid); // we answer this contact's v2 list ourselves
            await mock.openChatBoxFor(_converse, contact_jid);

            const view = _converse.chatboxviews.get(contact_jid);
            view.model.set('omemo_active', true);
            const conn = api.connection.get();

            const target_text =
                'But soft, what light through yonder airlock breaks, and who on earth goes there in the dead of night?';
            await _converse.handleMessageStanza(
                stx`<message xmlns="jabber:client" from="${contact_jid}" to="${conn.jid}" type="chat" id="omemo-react-quote-target">
                    <body>${target_text}</body>
                </message>`,
            );
            await u.waitUntil(() => view.querySelector('.chat-msg[data-msgid="omemo-react-quote-target"]'));

            // Intercept the encrypted send before any crypto/IQ work, so we can
            // inspect the (otherwise encrypted) fallback body and SCE extensions.
            const send_spy = spyOn(api.omemo, 'send');

            const msg_el = view.querySelector('.chat-msg[data-msgid="omemo-react-quote-target"]');
            const toggle_el = await u.waitUntil(() =>
                msg_el.querySelector('converse-message-actions converse-dropdown .dropdown-toggle'),
            );
            toggle_el.click();
            const action_el = await u.waitUntil(() => msg_el.querySelector('.chat-msg__action-reaction'));
            action_el.click();
            const picker_el = await u.waitUntil(() => msg_el.querySelector('converse-reaction-picker'));
            picker_el.onEmojiSelected('👍');

            await u.waitUntil(() => send_spy.calls.count() > 0);
            const [chat_arg, body_arg, extensions_arg] = send_spy.calls.mostRecent().args;

            expect(chat_arg).toBe(view.model);

            // The body is a `>`-quote of the reacted-to text (truncated to the
            // first 80 code points + an ellipsis) followed by the emoji.
            const [quote_line, emoji_line] = body_arg.split('\n');
            expect(quote_line.startsWith('> But soft, what light through yonder')).toBe(true);
            expect(quote_line.endsWith('…')).toBe(true);
            expect(quote_line).not.toContain('dead of night');
            expect([...quote_line].length).toBe(2 + 80 + 1); // "> " + 80 code points + "…"
            expect(emoji_line).toBe('👍');

            // The structured <reactions> and a whole-body XEP-0428 fallback
            // marker travel as encrypted SCE extensions (not in the body).
            const ext_els = extensions_arg.map((e) => (e instanceof Element ? e : e.tree()));
            expect(ext_els.some((el) => el.localName === 'reactions')).toBe(true);
            const fallback = ext_els.find((el) => el.localName === 'fallback');
            expect(fallback.getAttribute('for')).toBe('urn:xmpp:reactions:0');
            // Whole-body marker: no start/end range.
            expect(fallback.querySelector('body').getAttribute('start')).toBe(null);
        }),
    );

    it(
        'rolls back the optimistic reaction when the encrypted send fails',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.initializedOMEMO(_converse);
            mock.deferV2DeviceList(contact_jid); // we answer this contact's v2 list ourselves
            await mock.openChatBoxFor(_converse, contact_jid);

            const view = _converse.chatboxviews.get(contact_jid);
            view.model.set('omemo_active', true);
            const conn = api.connection.get();

            await _converse.handleMessageStanza(
                stx`<message xmlns="jabber:client" from="${contact_jid}" to="${conn.jid}" type="chat" id="omemo-react-fail-target">
                    <body>React to me</body>
                </message>`,
            );
            await u.waitUntil(() => view.querySelector('.chat-msg[data-msgid="omemo-react-fail-target"]'));
            const msg_model = view.model.messages.findWhere({ msgid: 'omemo-react-fail-target' });

            // Make the encrypted send fail (e.g. no reachable devices). The real
            // api.omemo.send would have already alerted the user before rejecting.
            // Reject from a callFake (not a pre-built rejected promise) so the
            // rejection is created at call time and awaited immediately.
            spyOn(api.omemo, 'send').and.callFake(async () => {
                throw new Error('no devices');
            });
            spyOn(converse.env.log, 'error');

            const msg_el = view.querySelector('.chat-msg[data-msgid="omemo-react-fail-target"]');
            const toggle_el = await u.waitUntil(() =>
                msg_el.querySelector('converse-message-actions converse-dropdown .dropdown-toggle'),
            );
            toggle_el.click();
            const action_el = await u.waitUntil(() => msg_el.querySelector('.chat-msg__action-reaction'));
            action_el.click();
            const picker_el = await u.waitUntil(() => msg_el.querySelector('converse-reaction-picker'));
            picker_el.onEmojiSelected('👍');

            // The optimistic reaction is applied, then rolled back once the send
            // rejects — so we end up with no reaction from ourselves.
            await u.waitUntil(() => converse.env.log.error.calls.count() > 0);
            await u.waitUntil(() => !msg_model.get('reactions')?.[_converse.bare_jid]?.length);
            expect(msg_model.get('reactions')?.[_converse.bare_jid]).toBeFalsy();
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
