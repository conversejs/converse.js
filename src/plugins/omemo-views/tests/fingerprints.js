import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import { answerV2DeviceList, answerV2Bundle } from './utils.js';

const { u } = converse.env;

describe('OMEMO 2 fingerprints', function () {
    it(
        'displays a fingerprint for both the legacy and the omemo:2 device of the same id',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitUntilBlocklistInitialized(_converse);
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.waitUntilDiscoConfirmed(
                _converse,
                _converse.bare_jid,
                [{ category: 'pubsub', type: 'pep' }],
                ['http://jabber.org/protocol/pubsub#publish-options'],
            );

            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            _converse.api.trigger('OMEMOInitialized');

            const view = _converse.chatboxviews.get(contact_jid);
            view.querySelector('.show-user-details-modal').click();
            const modal = _converse.api.modal.get('converse-user-details-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000);

            // The same physical device id (555) is published to both the legacy
            // and the omemo:2 device list, each with its own identity key.
            await mock.deviceListFetched(_converse, contact_jid, ['555']);
            await mock.bundleFetched(_converse, {
                jid: contact_jid,
                device_id: '555',
                identity_key: '3333',
                signed_prekey_id: '4223',
                signed_prekey_public: '1111',
                signed_prekey_sig: '2222',
                prekeys: ['1001', '1002', '1003'],
            });
            await answerV2DeviceList(_converse, contact_jid, ['555']);
            await answerV2Bundle(_converse, contact_jid, '555');

            modal.querySelector('.nav-item #omemo-tab').click();

            // Both versions render their own fingerprint row. Before omemo:2
            // fingerprints were generated, only the legacy row appeared.
            await u.waitUntil(() => modal.querySelectorAll('.fingerprints .fingerprint').length === 2, 2000);

            const fingerprints = Array.from(modal.querySelectorAll('.fingerprints .fingerprint')).map((el) =>
                el.textContent.trim(),
            );
            // The legacy (Curve25519) and omemo:2 (Ed25519) fingerprints differ.
            expect(fingerprints[0]).not.toBe(fingerprints[1]);

            // Each version's trust radios are tagged with their version.
            expect(
                modal.querySelector('input[type="radio"][data-version="eu.siacs.conversations.axolotl"]'),
            ).toBeTruthy();
            expect(modal.querySelector('input[type="radio"][data-version="urn:xmpp:omemo:2"]')).toBeTruthy();
        }),
    );
});
