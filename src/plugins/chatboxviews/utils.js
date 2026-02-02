import { api } from '@converse/headless';
import log from '@converse/log';

export function calculateViewportHeightUnit () {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

/**
 * Handle XEP-0147 "query actions" for chatboxes (both 1:1 and MUC).
 * This function is called by the chatview plugin's routeToQueryAction.
 * Handles:
 *   - No action: opens a chat
 *   - action=message: opens a chat and sends a message
 *
 * @param {string} jid - The JID to open a chat with
 * @param {URLSearchParams} query_params - Query parameters from the URI
 */
export async function routeToQueryAction(jid, query_params) {
    const action = query_params?.get('action');

    if (!action) {
        // No action specified, just open the chat
        log.debug(`routeToQueryAction (chatboxviews): Opening chat for "${jid}"`);
        return api.chats.open(jid);
    }

    if (action === 'message') {
        await handleMessageAction(jid, query_params);
    } else {
        // Other actions are not handled by this plugin
        log.debug(`routeToQueryAction (chatboxviews): Action "${action}" not handled`);
    }
}

/**
 * Handles the `action=message` case.
 * Opens a chat and sends a message if a body is provided.
 *
 * @param {string} jid - The JID to send a message to
 * @param {URLSearchParams} params - Query parameters including 'body'
 */
async function handleMessageAction(jid, params) {
    const body = params.get('body') || '';
    const chat = await api.chats.open(jid);

    if (body && chat) {
        await chat.sendMessage({ body });
    }
}
