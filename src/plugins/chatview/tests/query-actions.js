/*global mock, converse */

const { u } = converse.env;

describe("XMPP URI Query Actions (XEP-0147)", function () {

    /**
     * Test the core functionality: opening a chat when no action is specified
     * This tests the basic URI parsing and chat opening behavior
     */
    it("opens a chat when URI has no action parameter",
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const { api } = _converse;
        // Wait for roster to be initialized so we can open chats
        await mock.waitForRoster(_converse, 'current', 1);

        // Save original globals to restore them later
        const originalLocation = window.location;
        const originalReplaceState = window.history.replaceState;

        // Mock window.location to simulate a protocol handler URI
        // This simulates: ?uri=xmpp:romeo@montague.lit
        delete window.location;
        window.location = {
            search: '?uri=xmpp%3Aromeo%40montague.lit', // URL-encoded: xmpp:romeo@montague.lit
            hash: '',
            origin: 'http://localhost',
            pathname: '/',
        };

        // Spy on history.replaceState to verify URL cleanup
        const replaceStateSpy = jasmine.createSpy('replaceState');
        window.history.replaceState = replaceStateSpy;

        try {
            // Import the function to test
            const { routeToQueryAction } = await import('../utils.js');

            // Call the function - this should parse URI and open chat
            await routeToQueryAction();

            // Verify that the URL was cleaned up (protocol handler removes ?uri=...)
            expect(replaceStateSpy).toHaveBeenCalledWith(
                {},
                document.title,
                'http://localhost/'
            );

            // Wait for and verify that a chatbox was created
            await u.waitUntil(() => _converse.chatboxes.get('romeo@montague.lit'));
            const chatbox = _converse.chatboxes.get('romeo@montague.lit');
            expect(chatbox).toBeDefined();
            expect(chatbox.get('jid')).toBe('romeo@montague.lit');
        } finally {
            // Restore original globals to avoid test pollution
            window.location = originalLocation;
            window.history.replaceState = originalReplaceState;
        }
    }));

    /**
     * Test message sending functionality when action=message
     * This tests URI parsing, chat opening, and message sending
     */
    it("sends a message when action=message with body",
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const { api } = _converse;
        await mock.waitForRoster(_converse, 'current', 1);

        const originalLocation = window.location;
        const originalReplaceState = window.history.replaceState;

        // Mock URI with message action: ?uri=xmpp:romeo@montague.lit?action=message&body=Hello
        delete window.location;
        window.location = {
            search: '?uri=xmpp%3Aromeo%40montague.lit%3Faction%3Dmessage%26body%3DHello',
            hash: '',
            origin: 'http://localhost',
            pathname: '/',
        };

        window.history.replaceState = jasmine.createSpy('replaceState');

        try {
            const { routeToQueryAction } = await import('../utils.js');

            // Spy on the connection send method to verify XMPP stanza sending
            spyOn(api.connection.get(), 'send');

            // Execute the function
            await routeToQueryAction();

            // Verify chat was opened
            await u.waitUntil(() => _converse.chatboxes.get('romeo@montague.lit'));
            const chatbox = _converse.chatboxes.get('romeo@montague.lit');
            expect(chatbox).toBeDefined();

            // Verify message was sent and stored in chat
            await u.waitUntil(() => chatbox.messages.length > 0);
            const message = chatbox.messages.at(0);
            expect(message.get('message')).toBe('Hello');
            expect(message.get('type')).toBe('chat');
        } finally {
            window.location = originalLocation;
            window.history.replaceState = originalReplaceState;
        }
    }));

    /**
     * Test error handling for invalid JIDs
     * This ensures the function doesn't crash and handles invalid input gracefully
     */
    it("handles invalid JID gracefully",
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const originalLocation = window.location;
        const originalReplaceState = window.history.replaceState;

        // Mock URI with invalid JID format
        delete window.location;
        window.location = {
            search: '?uri=xmpp%3Ainvalid-jid',
            hash: '',
            origin: 'http://localhost',
            pathname: '/',
        };

        window.history.replaceState = jasmine.createSpy('replaceState');

        try {
            const { routeToQueryAction } = await import('../utils.js');

            // Record initial chatbox count
            const initialCount = _converse.chatboxes.length;

            // Function should not throw an error, just log warning and return
            await routeToQueryAction();

            // Verify no new chatbox was created for invalid JID
            expect(_converse.chatboxes.length).toBe(initialCount);

            // URL should still be cleaned up even for invalid JIDs
            expect(window.history.replaceState).toHaveBeenCalled();
        } finally {
            window.location = originalLocation;
            window.history.replaceState = originalReplaceState;
        }
    }));

    /**
     * Test roster contact addition (action=add-roster)
     * This tests the contact management functionality
     */
    it("adds contact to roster when action=add-roster",
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const { api } = _converse;
        await mock.waitForRoster(_converse, 'current', 1);
        await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], []);

        const originalLocation = window.location;
        const originalReplaceState = window.history.replaceState;

        // Mock URI with roster action: ?uri=xmpp:newcontact@montague.lit?action=add-roster&name=John&group=Friends
        delete window.location;
        window.location = {
            search: '?uri=xmpp%3Anewcontact%40montague.lit%3Faction%3Dadd-roster%26name%3DJohn%26group%3DFriends',
            hash: '',
            origin: 'http://localhost',
            pathname: '/',
        };

        window.history.replaceState = jasmine.createSpy('replaceState');

        try {
            const { routeToQueryAction } = await import('../utils.js');

            // Spy on connection send to verify roster IQ stanza
            spyOn(api.connection.get(), 'send');

            await routeToQueryAction();

            // Wait for roster IQ to be sent
            await u.waitUntil(() => api.connection.get().send.calls.count() > 0);

            // Verify the roster addition IQ was sent
            const sent_stanzas = api.connection.get().send.calls.all().map(call => call.args[0]);
            const roster_iq = sent_stanzas.find(s =>
                s.querySelector &&
                s.querySelector('iq[type="set"] query[xmlns="jabber:iq:roster"]')
            );
            expect(roster_iq).toBeDefined();

            // Verify roster item details
            const item = roster_iq.querySelector('item');
            expect(item.getAttribute('jid')).toBe('newcontact@montague.lit');
            expect(item.getAttribute('name')).toBe('John');
            expect(item.querySelector('group').textContent).toBe('Friends');
        } finally {
            window.location = originalLocation;
            window.history.replaceState = originalReplaceState;
        }
    }));
});