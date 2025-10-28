/*global mock, converse */

const { u } = converse.env;

describe("XMPP URI Query Actions (XEP-0147)", function () {

    /**
     * Test the core functionality: opening a chat when no action is specified
     * This tests the basic URI parsing and chat opening behavior
     */
    fit("opens a chat when URI has no action parameter",
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const { api } = _converse;
        // Wait for roster to be initialized so we can open chats
        await mock.waitForRoster(_converse, 'current', 1);

        // Save original globals to restore them later
        const originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
        const originalReplaceState = window.history.replaceState;

        // Mock window.location to simulate a protocol handler URI
        // This simulates: ?uri=xmpp:romeo@montague.lit
        Object.defineProperty(window, "location", {
            value: {
                search: '?uri=xmpp%3Aromeo%40montague.lit', // URL-encoded: xmpp:romeo@montague.lit
                hash: '',
                origin: 'http://localhost',
                pathname: '/',
            },
            configurable: true,
        });

        // Spy on history.replaceState to verify URL cleanup
        const replaceStateSpy = jasmine.createSpy('replaceState');
        window.history.replaceState = replaceStateSpy;

        try {
            // Call the function - this should parse URI and open chat
            await u.routeToQueryAction();

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
            if (originalLocationDescriptor) {
                Object.defineProperty(window, 'location', originalLocationDescriptor);
            } else {
                delete window.location;
            }
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

        const originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
        const originalReplaceState = window.history.replaceState;

        // Mock URI with message action: ?uri=xmpp:romeo@montague.lit?action=message&body=Hello
        Object.defineProperty(window, "location", {
            value: {
                search: '?uri=xmpp%3Aromeo%40montague.lit%3Faction%3Dmessage%26body%3DHello',
                hash: '',
                origin: 'http://localhost',
                pathname: '/',
            },
            configurable: true,
        });

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
            if (originalLocationDescriptor) {
                Object.defineProperty(window, 'location', originalLocationDescriptor);
            } else {
                delete window.location;
            }
            window.history.replaceState = originalReplaceState;
        }
    }));
});