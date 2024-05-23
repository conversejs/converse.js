/**
 * @typedef {import('../chatview/chat.js').default} ChatView
 * @typedef {import('../muc-views/muc.js').default} MUCView
 */
import { html } from 'lit/html.js';
import { _converse, api, log, constants, u, MAMPlaceholderMessage } from '@converse/headless';

const { CHATROOMS_TYPE } = constants;


export function getPlaceholderTemplate (message, tpl) {
    if (message instanceof MAMPlaceholderMessage) {
        return html`<converse-mam-placeholder .model=${message}></converse-mam-placeholder>`;
    } else {
        return tpl;
    }
}

/**
 * @param {ChatView|MUCView} view
 */
export async function fetchMessagesOnScrollUp (view) {
    if (view.model.ui.get('chat-content-spinner-top')) {
        return;
    }
    if (view.model.messages.length) {
        const is_groupchat = view.model.get('type') === CHATROOMS_TYPE;
        const oldest_message = view.model.getOldestMessage();
        if (oldest_message) {
            const bare_jid = _converse.session.get('bare_jid');
            const by_jid = is_groupchat ? view.model.get('jid') : bare_jid;
            const stanza_id = oldest_message.get(`stanza_id ${by_jid}`);
            view.model.ui.set('chat-content-spinner-top', true);
            try {
                if (stanza_id) {
                    await u.mam.fetchArchivedMessages(view.model, { 'before': stanza_id });
                } else {
                    await u.mam.fetchArchivedMessages(view.model, { 'end': oldest_message.get('time') });
                }
            } catch (e) {
                log.error(e);
                view.model.ui.set('chat-content-spinner-top', false);
                return;
            }
            if (api.settings.get('allow_url_history_change')) {
                history.pushState(null, '', `#${oldest_message.get('msgid')}`)
            }
            setTimeout(() => view.model.ui.set('chat-content-spinner-top', false), 250);
        }
    }
}
