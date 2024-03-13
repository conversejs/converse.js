import MAMPlaceholderMessage from '@converse/headless/plugins/mam/placeholder.js';
import { _converse, api, log } from '@converse/headless';
import { fetchArchivedMessages } from '@converse/headless/plugins/mam/utils';
import { html } from 'lit/html.js';
import { CHATROOMS_TYPE } from '@converse/headless/shared/constants';


export function getPlaceholderTemplate (message, tpl) {
    if (message instanceof MAMPlaceholderMessage) {
        return html`<converse-mam-placeholder .model=${message}></converse-mam-placeholder>`;
    } else {
        return tpl;
    }
}

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
            const stanza_id = oldest_message && oldest_message.get(`stanza_id ${by_jid}`);
            view.model.ui.set('chat-content-spinner-top', true);
            try {
                if (stanza_id) {
                    await fetchArchivedMessages(view.model, { 'before': stanza_id });
                } else {
                    await fetchArchivedMessages(view.model, { 'end': oldest_message.get('time') });
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
