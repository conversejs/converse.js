import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { stx, u } = converse.env;

describe('OMEMO Trust Verification', function () {
    describe('isTrustedIdentity', function () {
        it(
            'accepts a new identity that has not been seen before',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.initializedOMEMO(_converse);

                const store = _converse.state.omemo_store;
                const identifier = 'alice.42';
                const new_identity = new Uint8Array([1, 2, 3, 4]).buffer;

                const trusted = await store.isTrustedIdentity(identifier, new_identity, store.Direction.RECEIVING);
                expect(trusted).toBe(true);
            }),
        );

        it(
            'accepts an identity that matches the stored one',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.initializedOMEMO(_converse);

                const store = _converse.state.omemo_store;
                const identifier = 'bob.99';
                const identity_key = new Uint8Array([5, 6, 7, 8]).buffer;

                await store.saveIdentity(identifier, identity_key);

                const trusted = await store.isTrustedIdentity(identifier, identity_key, store.Direction.RECEIVING);
                expect(trusted).toBe(true);
            }),
        );

        it(
            'rejects an identity that differs from the stored one',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.initializedOMEMO(_converse);

                const store = _converse.state.omemo_store;
                const identifier = 'charlie.77';
                const original_identity = new Uint8Array([10, 20, 30, 40]).buffer;
                const different_identity = new Uint8Array([50, 60, 70, 80]).buffer;

                await store.saveIdentity(identifier, original_identity);

                const trusted = await store.isTrustedIdentity(
                    identifier,
                    different_identity,
                    store.Direction.RECEIVING,
                );
                expect(trusted).toBe(false);
            }),
        );

        it(
            'throws an error when identifier is null or undefined',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.initializedOMEMO(_converse);

                const store = _converse.state.omemo_store;
                const identity_key = new Uint8Array([1, 2, 3]).buffer;

                expect(() =>
                    store.isTrustedIdentity(null, identity_key, store.Direction.RECEIVING),
                ).toThrowError("Can't check identity key for invalid key");
                expect(() =>
                    store.isTrustedIdentity(undefined, identity_key, store.Direction.RECEIVING),
                ).toThrowError("Can't check identity key for invalid key");
            }),
        );

        it(
            'throws an error when identity_key is not an ArrayBuffer',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.initializedOMEMO(_converse);

                const store = _converse.state.omemo_store;

                expect(() =>
                    store.isTrustedIdentity('test.1', 'not-an-arraybuffer', store.Direction.RECEIVING),
                ).toThrowError('Expected identity_key to be an ArrayBuffer');
            }),
        );
    });

    describe('saveIdentity', function () {
        it(
            'stores a new identity and returns false (no change)',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.initializedOMEMO(_converse);

                const store = _converse.state.omemo_store;
                const identifier = 'dave.55';
                const identity_key = new Uint8Array([100, 200, 150, 50]).buffer;

                const changed = await store.saveIdentity(identifier, identity_key);
                expect(changed).toBe(false);

                const stored = store.get('identity_key' + 'dave.55');
                expect(stored).toBe(u.arrayBufferToBase64(identity_key));
            }),
        );

        it(
            'returns true when identity has changed',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.initializedOMEMO(_converse);

                const store = _converse.state.omemo_store;
                const identifier = 'eve.33';
                const original_identity = new Uint8Array([1, 2, 3, 4]).buffer;
                const new_identity = new Uint8Array([5, 6, 7, 8]).buffer;

                await store.saveIdentity(identifier, original_identity);

                const changed = await store.saveIdentity(identifier, new_identity);
                expect(changed).toBe(true);

                const stored = store.get('identity_key' + 'eve.33');
                expect(stored).toBe(u.arrayBufferToBase64(new_identity));
            }),
        );

        it(
            'stores identity keyed by the full address string',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.initializedOMEMO(_converse);

                const store = _converse.state.omemo_store;
                const identifier = 'frank.42';
                const identity_key = new Uint8Array([9, 8, 7, 6]).buffer;

                await store.saveIdentity(identifier, identity_key);

                const stored = store.get('identity_key' + 'frank.42');
                expect(stored).toBe(u.arrayBufferToBase64(identity_key));
            }),
        );

        it(
            'throws an error when identifier is null or undefined',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.initializedOMEMO(_converse);

                const store = _converse.state.omemo_store;
                const identity_key = new Uint8Array([1, 2, 3]).buffer;

                expect(() => store.saveIdentity(null, identity_key)).toThrowError(
                    "Can't save identity_key for invalid address",
                );
                expect(() => store.saveIdentity(undefined, identity_key)).toThrowError(
                    "Can't save identity_key for invalid address",
                );
            }),
        );
    });

    describe('loadIdentityKey', function () {
        it(
            'loads a previously stored identity key',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.initializedOMEMO(_converse);

                const store = _converse.state.omemo_store;
                const identifier = 'grace.11';
                const identity_key = new Uint8Array([11, 22, 33, 44]).buffer;

                await store.saveIdentity(identifier, identity_key);

                const loaded = await store.loadIdentityKey(identifier);
                expect(loaded).toBeInstanceOf(ArrayBuffer);
                expect(u.arrayBufferToBase64(loaded)).toBe(u.arrayBufferToBase64(identity_key));
            }),
        );
    });

    describe('Trust filtering during message encryption', function () {
        it(
            'does not encrypt messages for untrusted devices',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                const { UNTRUSTED } = _converse.constants;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.initializedOMEMO(_converse);
                await mock.openChatBoxFor(_converse, contact_jid);
                await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid, ['555']));
                await u.waitUntil(() => _converse.state.omemo_store);

                const view = _converse.chatboxviews.get(contact_jid);
                view.model.set('omemo_active', true);

                const devicelist = _converse.state.devicelists.get({ 'jid': contact_jid });
                const device = devicelist.devices.get('555');
                device.save('trusted', UNTRUSTED);

                const textarea = view.querySelector('.chat-textarea');
                textarea.value = 'This message should not be encrypted for untrusted device';
                const message_form = view.querySelector('converse-message-form');
                message_form.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault() {},
                    key: 'Enter',
                });

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

                const sent_stanzas = _converse.api.connection.get().sent_stanzas;
                const sent_stanza = await u.waitUntil(
                    () => sent_stanzas.filter((s) => s.querySelector('encrypted')).pop(),
                    1000,
                );

                const keys = sent_stanza.querySelectorAll('encrypted header key');
                const key_rids = Array.from(keys).map((k) => k.getAttribute('rid'));
                expect(key_rids).not.toContain('555');
                expect(key_rids).toContain('482886413b977930064a5888b92134fe');
            }),
        );

        it(
            'encrypts messages for trusted and undecided devices',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                const { UNDECIDED } = _converse.constants;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.initializedOMEMO(_converse);
                await mock.openChatBoxFor(_converse, contact_jid);
                await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid, ['555']));
                await u.waitUntil(() => _converse.state.omemo_store);

                const view = _converse.chatboxviews.get(contact_jid);
                view.model.set('omemo_active', true);

                const devicelist = _converse.state.devicelists.get({ 'jid': contact_jid });
                const device = devicelist.devices.get('555');
                expect(device.get('trusted')).toBe(UNDECIDED);

                const textarea = view.querySelector('.chat-textarea');
                textarea.value = 'This message should be encrypted for undecided device';
                const message_form = view.querySelector('converse-message-form');
                message_form.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault() {},
                    key: 'Enter',
                });

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

                const sent_stanzas = _converse.api.connection.get().sent_stanzas;
                const sent_stanza = await u.waitUntil(
                    () => sent_stanzas.filter((s) => s.querySelector('encrypted')).pop(),
                    1000,
                );

                const keys = sent_stanza.querySelectorAll('encrypted header key');
                const key_rids = Array.from(keys).map((k) => k.getAttribute('rid'));
                expect(key_rids).toContain('555');
                expect(key_rids).toContain('482886413b977930064a5888b92134fe');
            }),
        );

        it(
            'encrypts messages for explicitly trusted devices',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                const { TRUSTED } = _converse.constants;

                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.initializedOMEMO(_converse);
                await mock.openChatBoxFor(_converse, contact_jid);
                await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid, ['555']));
                await u.waitUntil(() => _converse.state.omemo_store);

                const view = _converse.chatboxviews.get(contact_jid);
                view.model.set('omemo_active', true);

                const devicelist = _converse.state.devicelists.get({ 'jid': contact_jid });
                const device = devicelist.devices.get('555');
                device.save('trusted', TRUSTED);

                const textarea = view.querySelector('.chat-textarea');
                textarea.value = 'This message should be encrypted for trusted device';
                const message_form = view.querySelector('converse-message-form');
                message_form.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault() {},
                    key: 'Enter',
                });

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

                const sent_stanzas = _converse.api.connection.get().sent_stanzas;
                const sent_stanza = await u.waitUntil(
                    () => sent_stanzas.filter((s) => s.querySelector('encrypted')).pop(),
                    1000,
                );

                const keys = sent_stanza.querySelectorAll('encrypted header key');
                const key_rids = Array.from(keys).map((k) => k.getAttribute('rid'));
                expect(key_rids).toContain('555');
                expect(key_rids).toContain('482886413b977930064a5888b92134fe');
            }),
        );
    });

    describe('Device trust UI interactions', function () {
        it(
            'reflects trust changes in the OMEMO fingerprints component',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                const { UNDECIDED, TRUSTED, UNTRUSTED } = _converse.constants;
                await mock.waitUntilBlocklistInitialized(_converse);
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.waitUntilDiscoConfirmed(
                    _converse,
                    _converse.bare_jid,
                    [{ 'category': 'pubsub', 'type': 'pep' }],
                    ['http://jabber.org/protocol/pubsub#publish-options'],
                );

                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                _converse.api.trigger('OMEMOInitialized');

                const view = _converse.chatboxviews.get(contact_jid);
                const show_modal_button = view.querySelector('.show-user-details-modal');
                show_modal_button.click();
                const modal = _converse.api.modal.get('converse-user-details-modal');
                await u.waitUntil(() => u.isVisible(modal), 1000);

                let iq_stanza = await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));

                _converse.api.connection.get()._dataRecv(
                    mock.createRequest(
                        _converse,
                        stx`<iq from="${contact_jid}"
                        id="${iq_stanza.getAttribute('id')}"
                        to="${_converse.bare_jid}"
                        xmlns="jabber:client"
                        type="result">
                    <pubsub xmlns="http://jabber.org/protocol/pubsub">
                        <items node="eu.siacs.conversations.axolotl.devicelist">
                            <item xmlns="http://jabber.org/protocol/pubsub">
                                <list xmlns="eu.siacs.conversations.axolotl">
                                    <device id="555"/>
                                </list>
                            </item>
                        </items>
                    </pubsub>
                </iq>`,
                    ),
                );

                await u.waitUntil(() => u.isVisible(modal), 1000);

                iq_stanza = await u.waitUntil(() => mock.bundleIQRequestSent(_converse, contact_jid, '555'));

                _converse.api.connection.get()._dataRecv(
                    mock.createRequest(
                        _converse,
                        stx`<iq from="${contact_jid}"
                    id="${iq_stanza.getAttribute('id')}"
                    to="${_converse.bare_jid}"
                    xmlns="jabber:client"
                    type="result">
                        <pubsub xmlns="http://jabber.org/protocol/pubsub">
                            <items node="eu.siacs.conversations.axolotl.bundles:555">
                                <item>
                                    <bundle xmlns="eu.siacs.conversations.axolotl">
                                        <signedPreKeyPublic signedPreKeyId="4223">${btoa('1111')}</signedPreKeyPublic>
                                        <signedPreKeySignature>${btoa('2222')}</signedPreKeySignature>
                                        <identityKey>${'BQmHEOHjsYm3w5M8VqxAtqJmLCi7CaxxsdZz6G0YpuMI'}</identityKey>
                                        <prekeys>
                                            <preKeyPublic preKeyId="1">${btoa('1001')}</preKeyPublic>
                                            <preKeyPublic preKeyId="2">${btoa('1002')}</preKeyPublic>
                                            <preKeyPublic preKeyId="3">${btoa('1003')}</preKeyPublic>
                                        </prekeys>
                                    </bundle>
                                </item>
                            </items>
                        </pubsub>
                    </iq>`,
                    ),
                );

                modal.querySelector('.nav-item #omemo-tab').click();
                await u.waitUntil(() => modal.querySelectorAll('.fingerprints .fingerprint').length);

                const devicelist = _converse.state.devicelists.get(contact_jid);
                const device = devicelist.devices.get('555');

                expect(device.get('trusted')).toBe(UNDECIDED);

                const trusted_radio = modal.querySelector('input[type="radio"][name="555"][value="1"]');
                const untrusted_radio = modal.querySelector('input[type="radio"][name="555"][value="-1"]');
                expect(trusted_radio.checked).toBe(true);
                expect(untrusted_radio.checked).toBe(false);

                untrusted_radio.click();
                await u.waitUntil(() => device.get('trusted') === UNTRUSTED);
                expect(device.get('trusted')).toBe(UNTRUSTED);

                trusted_radio.click();
                await u.waitUntil(() => device.get('trusted') === TRUSTED);
                expect(device.get('trusted')).toBe(TRUSTED);
            }),
        );

        it(
            'tracks trust per version when a device id appears in both the legacy and omemo:2 lists',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                const { Devices } = _converse.exports;
                const { UNDECIDED, UNTRUSTED } = _converse.constants;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.initializedOMEMO(_converse);

                // The same physical device id is published to both the legacy and
                // the omemo:2 device list. Each version has its own identity key
                // (fingerprint) and therefore its own, independent trust state.
                const legacy_devices = new Devices(null, { version: 'eu.siacs.conversations.axolotl' });
                u.initStorage(legacy_devices, `converse.test-fp-legacy-${contact_jid}`);
                const v2_devices = new Devices(null, { version: 'urn:xmpp:omemo:2' });
                u.initStorage(v2_devices, `converse.test-fp-v2-${contact_jid}`);

                const legacy_device = await legacy_devices.create(
                    { id: '555', jid: contact_jid, bundle: { fingerprint: 'aaaa' } },
                    { promise: true },
                );
                const v2_device = await v2_devices.create(
                    { id: '555', jid: contact_jid, bundle: { fingerprint: 'bbbb' } },
                    { promise: true },
                );
                expect(legacy_device.getVersion()).toBe('eu.siacs.conversations.axolotl');
                expect(v2_device.getVersion()).toBe('urn:xmpp:omemo:2');

                // Feed the prepared lists to the real component (bypassing the
                // network fetch in initialize()).
                const orig_get = _converse.api.omemo.devicelists.get;
                _converse.api.omemo.devicelists.get = (_jid, _create, version) =>
                    Promise.resolve(
                        version === 'urn:xmpp:omemo:2'
                            ? { devices: v2_devices, initialized: Promise.resolve() }
                            : { devices: legacy_devices, initialized: Promise.resolve() },
                    );

                const el = document.createElement('converse-omemo-fingerprints');
                el.setAttribute('jid', contact_jid);
                document.body.appendChild(el);

                // Both devices render their own fingerprint row.
                await u.waitUntil(() => el.querySelectorAll('.fingerprint').length === 2, 1000);

                expect(legacy_device.get('trusted')).toBe(UNDECIDED);
                expect(v2_device.get('trusted')).toBe(UNDECIDED);

                // Untrust the *omemo:2* device. This must update the v2 device and
                // leave the legacy device of the same id untouched. The pre-fix
                // handler resolved by id alone and would have written to legacy.
                const v2_untrusted = el.querySelector(
                    'input[type="radio"][value="-1"][data-version="urn:xmpp:omemo:2"]',
                );
                v2_untrusted.click();
                await u.waitUntil(() => v2_device.get('trusted') === UNTRUSTED);
                expect(v2_device.get('trusted')).toBe(UNTRUSTED);
                expect(legacy_device.get('trusted')).toBe(UNDECIDED);

                // Untrusting the legacy device is likewise independent.
                const legacy_untrusted = el.querySelector(
                    'input[type="radio"][value="-1"][data-version="eu.siacs.conversations.axolotl"]',
                );
                legacy_untrusted.click();
                await u.waitUntil(() => legacy_device.get('trusted') === UNTRUSTED);
                expect(legacy_device.get('trusted')).toBe(UNTRUSTED);
                expect(v2_device.get('trusted')).toBe(UNTRUSTED);

                _converse.api.omemo.devicelists.get = orig_get;
                el.remove();
            }),
        );
    });

    describe('Inactive devices and trust', function () {
        it(
            'does not encrypt messages for inactive devices even if trusted',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                const { TRUSTED } = _converse.constants;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.initializedOMEMO(_converse);
                await mock.openChatBoxFor(_converse, contact_jid);
                await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid, ['555']));
                await u.waitUntil(() => _converse.state.omemo_store);

                const view = _converse.chatboxviews.get(contact_jid);
                view.model.set('omemo_active', true);

                const devicelist = _converse.state.devicelists.get({ 'jid': contact_jid });
                const inactive_device = await devicelist.devices.create(
                    { id: '777', jid: contact_jid },
                    { promise: true },
                );
                inactive_device.save({
                    'active': false,
                    'trusted': TRUSTED,
                    'bundle': {
                        identity_key: '9999',
                        signed_prekey: { id: 1, public_key: '8888', signature: '7777' },
                        prekeys: [{ id: 1, key: '6666' }],
                    },
                });

                const textarea = view.querySelector('.chat-textarea');
                textarea.value = 'This message should skip inactive devices';
                const message_form = view.querySelector('converse-message-form');
                message_form.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault() {},
                    key: 'Enter',
                });

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

                const sent_stanzas = _converse.api.connection.get().sent_stanzas;
                const sent_stanza = await u.waitUntil(
                    () => sent_stanzas.filter((s) => s.querySelector('encrypted')).pop(),
                    1000,
                );

                const keys = sent_stanza.querySelectorAll('encrypted header key');
                const key_rids = Array.from(keys).map((k) => k.getAttribute('rid'));
                expect(key_rids).toContain('482886413b977930064a5888b92134fe');
                expect(key_rids).toContain('555');
                expect(key_rids).not.toContain('777');
            }),
        );
    });
});
