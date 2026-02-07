/*global mock, converse */

const { u } = converse.env;

describe("XMPP URI Query Actions (XEP-0147) - URI Parsing", function () {

    /**
     * Test URI extraction and parsing functionality
     * This tests the extractXMPPURI and parseXMPPURI functions
     */
    it("extracts and parses XMPP URI correctly",
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const originalHash = window.location.hash;
        const originalReplaceState = window.history.replaceState;

        // Spy on history.replaceState to verify URL cleanup
        const replaceStateSpy = jasmine.createSpy('replaceState');
        window.history.replaceState = replaceStateSpy;

        // Simulate a protocol handler URI by setting the hash
        window.location.hash = '#converse/action?uri=xmpp%3Aromeo%40montague.lit%3Faction%3Dmessage%26body%3DHello';

        try {
            // Call the function - this should extract and parse the URI
            await u.routeToQueryAction();

            // Verify that the URL was cleaned up (protocol handler removes ?uri=...)
            const expected_url = `${window.location.origin}${window.location.pathname}`;
            expect(replaceStateSpy).toHaveBeenCalledWith({}, document.title, expected_url);
        } finally {
            // Restore original globals to avoid test pollution
            window.location.hash = originalHash;
            window.history.replaceState = originalReplaceState;
        }
    }));

    /**
     * Test that routeToQueryAction triggers xmppURIAction event
     * This tests the event-based delegation to plugin-specific handlers
     */
    it("triggers xmppURIAction event with parsed data",
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const { api } = _converse;
        const originalHash = window.location.hash;
        const originalReplaceState = window.history.replaceState;

        window.history.replaceState = jasmine.createSpy('replaceState');

        // Track if the event was triggered with correct data
        let eventTriggered = false;
        let eventData = null;

        api.listen.on('xmppURIAction', (data) => {
            eventTriggered = true;
            eventData = data;
        });

        // Mock URI with message action
        window.location.hash = '#converse/action?uri=xmpp%3Aromeo%40montague.lit%3Faction%3Dmessage%26body%3DHello';

        try {
            // Execute the function
            await u.routeToQueryAction();

            // Verify that xmppURIAction event was triggered
            expect(eventTriggered).toBe(true);
            expect(eventData.jid).toBe('romeo@montague.lit');
            expect(eventData.action).toBe('message');
            expect(eventData.query_params.get('body')).toBe('Hello');
        } finally {
            window.location.hash = originalHash;
            window.history.replaceState = originalReplaceState;
        }
    }));

    /**
     * Test handling of invalid JIDs in URI parsing
     * This ensures the function gracefully handles malformed JIDs
     */
    it("handles invalid JID gracefully and does not trigger event",
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const { api } = _converse;
        const originalHash = window.location.hash;
        const originalReplaceState = window.history.replaceState;

        window.history.replaceState = jasmine.createSpy('replaceState');

        // Track if the event was triggered
        let eventTriggered = false;

        api.listen.on('xmppURIAction', () => {
            eventTriggered = true;
        });

        // Mock URI with invalid JID (missing domain)
        window.location.hash = '#converse/action?uri=xmpp%3Ainvalid-jid';

        try {
            // Execute the function
            await u.routeToQueryAction();

            // Verify that xmppURIAction event was NOT triggered for invalid JID
            expect(eventTriggered).toBe(false);
        } finally {
            window.location.hash = originalHash;
            window.history.replaceState = originalReplaceState;
        }
    }));
});
