import HeadlinesFeed from './feed';
import { _converse, api } from "@converse/headless";
import { isHeadline, isServerMessage } from '@converse/headless/shared/parsers';
import { parseMessage } from '@converse/headless/plugins/chat/parsers';

/**
 * Handler method for all incoming messages of type "headline".
 * @param { Element } stanza
 */
export async function onHeadlineMessage (stanza) {
    if (isHeadline(stanza) || isServerMessage(stanza)) {
        const from_jid = stanza.getAttribute('from');

        await api.waitUntil('rosterInitialized')
        if (from_jid.includes('@') &&
                !_converse.roster.get(from_jid) &&
                !api.settings.get("allow_non_roster_messaging")) {
            return;
        }
        if (stanza.querySelector('body') === null) {
            // Avoid creating a chat box if we have nothing to show inside it.
            return;
        }

        const chatbox = await api.chatboxes.create(from_jid, {
            'id': from_jid,
            'jid': from_jid,
            'type': _converse.HEADLINES_TYPE,
            'from': from_jid
        }, HeadlinesFeed);

        const attrs = await parseMessage(stanza);
        await chatbox.createMessage(attrs);
        api.trigger('message', {chatbox, stanza, attrs});
    }
}
