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
            }
        }
    }
}

export const debouncedPruneHistory = debounce(pruneHistory, 250);
