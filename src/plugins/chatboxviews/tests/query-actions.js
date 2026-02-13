/*global mock, converse */

const { u } = converse.env;

describe("XMPP URI Query Actions (XEP-0147) - ChatBoxes", function () {

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
        const originalHash = window.location.hash;
        const originalReplaceState = window.history.replaceState;

        // Spy on history.replaceState to verify URL cleanup
        const replaceStateSpy = jasmine.createSpy('replaceState');
        window.history.replaceState = replaceStateSpy;

        // Simulate a protocol handler URI by setting the hash
        window.location.hash = '#converse/action?uri=xmpp%3Aromeo%40montague.lit';

        try {
            // Call the function - this should parse URI and open chat
            await u.routeToQueryAction();

            // Verify that the URL was cleaned up (protocol handler removes ?uri=...)
            const expected_url = `${window.location.origin}${window.location.pathname}`;
            expect(replaceStateSpy).toHaveBeenCalledWith({}, document.title, expected_url);

            // Wait for and verify that a chatbox was created
            await u.waitUntil(() => _converse.chatboxes.get('romeo@montague.lit'));
            const chatbox = _converse.chatboxes.get('romeo@montague.lit');
            expect(chatbox).toBeDefined();
            expect(chatbox.get('jid')).toBe('romeo@montague.lit');
        } finally {
            // Restore original globals to avoid test pollution
            window.location.hash = originalHash;
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

        const originalHash = window.location.hash;
        const originalReplaceState = window.history.replaceState;

        window.history.replaceState = jasmine.createSpy('replaceState');

        // Mock URI with message action
        window.location.hash = '#converse/action?uri=xmpp%3Aromeo%40montague.lit%3Faction%3Dmessage%26body%3DHello';

        try {
            // Spy on the connection send method to verify XMPP stanza sending
            spyOn(api.connection.get(), 'send');

            // Execute the function
            await u.routeToQueryAction();

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
            window.location.hash = originalHash;
            window.history.replaceState = originalReplaceState;
        }
    }));

    /**
     * Test handling of invalid JIDs
     * This ensures the function gracefully handles malformed JIDs
     */
    it("handles invalid JID gracefully",
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const { api } = _converse;
        await mock.waitForRoster(_converse, 'current', 1);

        const originalHash = window.location.hash;
        const originalReplaceState = window.history.replaceState;

        window.history.replaceState = jasmine.createSpy('replaceState');

        // Mock URI with invalid JID (missing domain)
        window.location.hash = '#converse/action?uri=xmpp%3Ainvalid-jid';

        try {
            // Spy on api.chats.open to ensure it's NOT called for invalid JID
            spyOn(api.chats, 'open');

            // Execute the function
            await u.routeToQueryAction();

            // Verify that no chat was opened for the invalid JID
            expect(api.chats.open).not.toHaveBeenCalled();

            // Verify no chatbox was created
            expect(_converse.chatboxes.get('invalid-jid')).toBeUndefined();
        } finally {
            window.location.hash = originalHash;
            window.history.replaceState = originalReplaceState;
        }
    }));
});
