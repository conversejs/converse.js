import { __ } from 'i18n';
import { _converse, api,u } from '@converse/headless';
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
 * Extracts URI from window location, parses it, and triggers xmppURIAction event
 * for plugin-specific handling via api.listen.
 *
 * @param {Event} [event] - Optional event object (used when called as protocol handler)
 * @returns {Promise<void>}
 * @example
 * // Automatically called on initialization in src/index.js
 * // Can be called manually after location.hash changes:
 * window.location.hash = '#converse/action?uri=xmpp%3Auser%40example.com';
 * await routeToQueryAction();
 */
export async function routeToQueryAction(event) {
    const { u } = _converse.env;

    const uri = extractXMPPURI(event);
    if (!uri) return;

    const { jid, query_params } = parseXMPPURI(uri);
    if (!u.isValidJID(jid)) {
        return log.warn(`routeToQueryAction: Invalid JID: "${jid}"`);
    }

    const action = query_params?.get('action');
    
    // Trigger event to let specific plugins handle plugin-specific actions
    api.trigger('xmppURIAction', { jid, query_params, action });
}

/**
 * Extracts and decodes the xmpp: URI from the window location or hash.
 */
export function extractXMPPURI(event) {
    let uri = null;
    // hash-based (#converse/action?uri=...)
    if (location.hash.startsWith('#converse/action?uri=')) {
        event?.preventDefault();
        uri = location.hash.split('#converse/action?uri=').pop();
    }

    if (!uri) return null;

    // Decode URI and remove xmpp: prefix
    uri = decodeURIComponent(uri);
    if (uri.startsWith('xmpp:')) uri = uri.slice(5);

    // Clean up URL (remove ?uri=... for a clean view)
    const clean_url = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, clean_url);

    return uri;
}

/**
 * Splits an xmpp: URI into a JID and query parameters.
 */
export function parseXMPPURI(uri) {
    const [jid, query] = uri.split('?');
    const query_params = new URLSearchParams(query || '');
    return { jid, query_params };
}

Object.assign(u,{
    routeToQueryAction,
})