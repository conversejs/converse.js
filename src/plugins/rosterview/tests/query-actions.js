import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

describe("XMPP URI Query Actions (XEP-0147) - Roster", function () {

    /**
     * Test roster add functionality when action=roster
     * This tests URI parsing and adding a contact to the roster
     */
    it("adds a contact to roster when action=roster",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {

        const { api } = _converse;
        await mock.waitForRoster(_converse, 'current', 1);

        const originalHash = window.location.hash;
        const originalReplaceState = window.history.replaceState;

        window.history.replaceState = jasmine.createSpy('replaceState');

        // Mock URI with roster action: ?roster;name=Juliet;group=Friends
        window.location.hash = '#converse/action?uri=xmpp%3Ajuliet%40capulet.lit%3Froster%3Bname%3DJuliet%3Bgroup%3DFriends';

        try {
            // Spy on the contacts.add API method - return a resolved promise to avoid network calls
            spyOn(api.contacts, 'add').and.returnValue(Promise.resolve());

            // Execute the function
            await u.routeToQueryAction();

            // Verify that contacts.add was called with correct parameters
            expect(api.contacts.add).toHaveBeenCalledWith(
                {
                    jid: 'juliet@capulet.lit',
                    name: 'Juliet',
                    groups: ['Friends']
                },
                true,  // persist on server
                false, // subscribe to presence
                ''     // no custom message
            );
        } finally {
            window.location.hash = originalHash;
            window.history.replaceState = originalReplaceState;
        }
    }));
});
