/*global mock, converse */

const { u } = converse.env;

describe("XMPP URI Query Actions (XEP-0147) - Roster", function () {

    /**
     * Test roster add functionality when action=add-roster
     * This tests URI parsing and adding a contact to the roster
     */
    it("adds a contact to roster when action=add-roster",
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const { api } = _converse;
        await mock.waitForRoster(_converse, 'current', 1);

        const originalHash = window.location.hash;
        const originalReplaceState = window.history.replaceState;

        window.history.replaceState = jasmine.createSpy('replaceState');

        // Mock URI with add-roster action: ?uri=xmpp:juliet@capulet.lit?action=add-roster&name=Juliet&group=Friends
        window.location.hash = '#converse/action?uri=xmpp%3Ajuliet%40capulet.lit%3Faction%3Dadd-roster%26name%3DJuliet%26group%3DFriends';

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
                true,  // subscribe to presence
                ''     // no custom message
            );
        } finally {
            window.location.hash = originalHash;
            window.history.replaceState = originalReplaceState;
        }
    }));
});
