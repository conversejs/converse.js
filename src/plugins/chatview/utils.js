import { __ } from 'i18n';
import { _converse, api } from '@converse/headless';
import log from "@converse/log";


export function clearHistory (jid) {
    if (location.hash === `converse/chat?jid=${jid}`) {
        history.pushState(null, '', window.location.pathname);
    }
}

export async function clearMessages (chat) {
    const result = await api.confirm(
        __('Confirm'),
        __('Are you sure you want to clear the messages from this conversation?')
    );
    if (result) {
        await chat.clearMessages();
    }
}

export async function parseMessageForCommands (chat, text) {
    const match = text.replace(/^\s*/, '').match(/^\/(.*)\s*$/);
    if (match) {
        let handled = false;
        /**
         * *Hook* which allows plugins to add more commands to a chat's textbox.
         * Data provided is the chatbox model and the text typed - {model, text}.
         * Check `handled` to see if the hook was already handled.
         * @event _converse#parseMessageForCommands
         * @example
         *  api.listen.on('parseMessageForCommands', (data, handled) {
         *      if (!handled) {
         *         const command = (data.text.match(/^\/([a-zA-Z]*) ?/) || ['']).pop().toLowerCase();
         *         // custom code comes here
         *      }
         *      return handled;
         *  }
         */
        handled = await api.hook('parseMessageForCommands', { model: chat, text }, handled);
        if (handled) {
            return true;
        }

        if (match[1] === 'clear') {
            clearMessages(chat);
            return true;
        } else if (match[1] === 'close') {
            const { chatboxviews } = _converse.state;
            chatboxviews.get(chat.get('jid'))?.close();
            return true;
        } else if (match[1] === 'help') {
            chat.set({ 'show_help_messages': false }, { 'silent': true });
            chat.set({ 'show_help_messages': true });
            return true;
        }
    }
    return false;
}

export function resetElementHeight (ev) {
    if (window.CSS?.supports('field-sizing', 'content')) {
        return;
    }

    if (ev.target.value) {
        const height = ev.target.scrollHeight + 'px';
        if (ev.target.style.height != height) {
            ev.target.style.height = 'auto';
            ev.target.style.height = height;
        }
    } else {
        ev.target.style = '';
    }
}


/**
 * Handle XEP-0147 "query actions" invoked via xmpp: URIs.
 * Supports message sending, roster management, and future actions.
 *
 * Example URIs:
 *   xmpp:user@example.com?action=message&body=Hello
 *   xmpp:user@example.com?action=add-roster&name=John&group=Friends
 */
export async function routeToQueryAction(event) {
    const { u } = _converse.env;

    try {
        const uri = extractXMPPURI(event);
        if (!uri) return;

        const { jid, queryParams } = parseXMPPURI(uri);
        if (!u.isValidJID(jid)) {
            return log.warn(`Invalid JID: "${jid}"`);
        }

        const action = queryParams.get('action');
        if (!action) {
            log.debug(`routeToQueryAction: No action specified, opening chat for "${jid}"`);
            return api.chats.open(jid);
        }

        switch (action) {
            case 'message':
                await handleMessageAction(jid, queryParams);
                break;

            case 'add-roster':
                await handleRosterAction(jid, queryParams);
                break;

            default:
                log.warn(`routeToQueryAction: Unsupported XEP-0147 action: "${action}"`);
                await api.chats.open(jid);
        }
    } catch (error) {
        log.error('Failed to process XMPP query action:', error);
    }
}

/**
 * Extracts and decodes the xmpp: URI from the window location or hash.
 */
function extractXMPPURI(event) {
    let uri = null;

    // Case 1: protocol handler (?uri=...)
    const searchParams = new URLSearchParams(window.location.search);
    uri = searchParams.get('uri');

    // Case 2: hash-based (#converse/action?uri=...)
    if (!uri && location.hash.startsWith('#converse/action?uri=')) {
        event?.preventDefault();
        uri = location.hash.split('uri=').pop();
    }

    if (!uri) return null;

    // Decode URI and remove xmpp: prefix
    uri = decodeURIComponent(uri);
    if (uri.startsWith('xmpp:')) uri = uri.slice(5);

    // Clean up URL (remove ?uri=... for a clean view)
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, cleanUrl);

    return uri;
}

/**
 * Splits an xmpp: URI into a JID and query parameters.
 */
function parseXMPPURI(uri) {
    const [jid, query] = uri.split('?');
    const queryParams = new URLSearchParams(query);
    return { jid, queryParams };
}

/**
 * Handles the `action=message` case.
 */
async function handleMessageAction(jid, params) {
    const body = params.get('body') || '';
    const chat = await api.chats.open(jid);

    if (body && chat) {
        await chat.sendMessage({ body });
    }
}

/**
 * Handles the `action=add-roster` case.
 */
async function handleRosterAction(jid, params) {
    await api.waitUntil('connected');
    await api.waitUntil('rosterContactsFetched');

    const name = params.get('name') || jid.split('@')[0];
    const group = params.get('group');
    const groups = group ? [group] : [];

    try {
        await api.contacts.add(
            { jid, name, groups },
            true,   // persist on server
            true,   // subscribe to presence
            ''      // no custom message
        );
    } catch (err) {
        log.error(`Failed to add "${jid}" to roster:`, err);
    }
}