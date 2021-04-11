import { fetchArchivedMessages } from '@converse/headless/plugins/mam/utils';
import { _converse } from '@converse/headless/core';

export async function fetchMessagesOnScrollUp (view) {
    if (view.model.messages.length) {
        const is_groupchat = view.model.get('type') === _converse.CHATROOMS_TYPE;
        const oldest_message = view.model.getOldestMessage();
        if (oldest_message) {
            const by_jid = is_groupchat ? view.model.get('jid') : _converse.bare_jid;
            const stanza_id = oldest_message && oldest_message.get(`stanza_id ${by_jid}`);
            view.addSpinner();
            if (stanza_id) {
                await fetchArchivedMessages(view.model, { 'before': stanza_id });
            } else {
                await fetchArchivedMessages(view.model, { 'end': oldest_message.get('time') });
            }
            view.clearSpinner();
            _converse.router.history.navigate(`#${oldest_message.get('msgid')}`);
        }
    }
}
