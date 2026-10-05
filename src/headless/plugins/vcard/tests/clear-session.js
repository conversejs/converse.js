import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

describe('Getting a VCard for a model', function () {
    it(
        'resolves to null if the session is cleared while it is waiting for the VCards',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const contact = _converse.state.roster.get(contact_jid);
            await contact.getVCard();
            contact._vcard = undefined;

            // `getVCard` gets past `VCardsInitialized` before `clearSession` removes the VCards.
            const promise = contact.getVCard();
            api.trigger('clearSession');
            expect(_converse.state.vcards).toBeUndefined();
            expect(await promise).toBeNull();
        }),
    );
});
