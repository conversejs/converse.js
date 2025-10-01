/**
 * @description Plugin for handling XMPP protocol links and opening chats.
 * @license Mozilla Public License (MPLv2)
 */
import { api, converse } from '@converse/headless';

converse.plugins.add('converse-protocol-handler', {
    dependencies: [],  // No dependencies needed

    initialize () {
        let jidFromUrl = null;  // Store the JID from the URL for later use
        // The first step is to register the protocol handler on app initialization
        if ('registerProtocolHandler' in navigator) {
            try {
                // Defining the URL pattern for the protocol handler so that the browser knows where to redirect
                // when an xmpp: link is clicked. The %s will be replaced by the full JID, using /dev as by default it was redirecting to the website.
                const handlerUrl = `${window.location.origin}/dev?jid=%s`;
                navigator.registerProtocolHandler('xmpp', handlerUrl)
            } catch (error) {
                console.warn('Failed to register protocol handler:', error);
            }
        } else {
            // If the browser doesn't support it, we can't do much
            return;
        }

        // If the protocol is registered , we parse the JID from the URL on page load
        const urlParams = new URLSearchParams(window.location.search);
        jidFromUrl = urlParams.get('jid');  // e.g., 'xmpp:user@example.com'

        if (jidFromUrl) {
            // Sanitize: Remove 'xmpp:' prefix if present
            if (jidFromUrl.startsWith('xmpp:')) {
                jidFromUrl = jidFromUrl.substring(5);
            }
            // Clean up the URL
            const newUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, newUrl);
        }
            // If already connected, open the chat immediately
        if (jidFromUrl) {
            api.chats.open(jidFromUrl).then(() => {
                const chatbox = api.chatboxes.get(jidFromUrl);
                chatbox.show();  // Bring to front
            })
        }
        // Open the chat only after the user logs in (connects)
        api.listen.on('connected', () => {
            if (jidFromUrl) {
                api.chats.open(jidFromUrl).catch((error) => {
                    console.error('Failed to open chat for JID:', jidFromUrl, error);
                });
                // Clear the JID after opening to avoid re-opening on reconnect
                jidFromUrl = null;
            }
        });
    }
});