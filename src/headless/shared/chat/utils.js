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

/**
 * Given an array of {@link MediaURLMetadata} objects and text, return an
 * array of {@link MediaURL} objects.
 * @param { Array<MediaURLMetadata> } arr
 * @param { String } text
 * @returns{ Array<MediaURL> }
 */
export function getMediaURLs (arr, text, offset=0) {
    /**
     * @typedef { Object } MediaURLData
     * An object representing a URL found in a chat message
     * @property { Boolean } is_audio
     * @property { Boolean } is_image
     * @property { Boolean } is_video
     * @property { String } end
     * @property { String } start
     * @property { String } url
     */
    return arr.map(o => {
        const start = o.start - offset;
        const end = o.end - offset;
        if (start < 0 || start >= text.length) {
            return null;
        }
        return Object.assign({}, o, {
            start,
            end,
            'url': text.substring(o.start-offset, o.end-offset),
        });
    }).filter(o => o);
}

export const debouncedPruneHistory = debounce(pruneHistory, 500);
