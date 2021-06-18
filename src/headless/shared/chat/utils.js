import debounce from 'lodash-es/debounce.js';
import { api, converse } from '@converse/headless/core.js';

const { u } = converse.env;

export function pruneHistory (model) {
    const max_history = api.settings.get('prune_messages_above');
    if (max_history && typeof max_history === 'number') {
        if (model.messages.length > max_history) {
            const non_empty_messages = model.messages.filter((m) => !u.isEmptyMessage(m));
            if (non_empty_messages.length > max_history) {
                while (non_empty_messages.length > max_history) {
                    non_empty_messages.shift().destroy();
                }
                /**
                 * Triggered once the message history has been pruned, i.e.
                 * once older messages have been removed to keep the
                 * number of messages below the value set in `prune_messages_above`.
                 * @event _converse#historyPruned
                 * @type { _converse.ChatBox | _converse.ChatRoom }
                 * @example _converse.api.listen.on('historyPruned', this => { ... });
                 */
                api.trigger('historyPruned', model);
            }
        }
    }
}

export const debouncedPruneHistory = debounce(pruneHistory, 250);
