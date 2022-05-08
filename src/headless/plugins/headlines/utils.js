import { _converse, api } from "@converse/headless/core";
import { isHeadline, isServerMessage } from '@converse/headless/shared/parsers';
import { parseMessage } from '@converse/headless/plugins/chat/parsers';

/**
 * Handler method for all incoming messages of type "headline".
 * @param { XMLElement } stanza
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
        const chatbox = _converse.chatboxes.create({
            'id': from_jid,
            'jid': from_jid,
            'type': _converse.HEADLINES_TYPE,
            'from': from_jid
        });
        const attrs = await parseMessage(stanza, _converse);
        await chatbox.createMessage(attrs);
        api.trigger('message', {chatbox, stanza, attrs});
    }
}
