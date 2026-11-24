/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * The emoji-shortname typeahead source, shared by every rich composer: typing `:smi`
 * offers the matching emoji and picking one replaces the trigger with the glyph.
 *
 * Nothing here is specific to a composer, so it is shared rather than owned by one.
 */
import { api, converse } from '@converse/headless';
import { shortnamesToEmojis } from 'shared/chat/utils.js';
import { EMOJI_TRIGGER } from './triggers.js';
import { MAX_SUGGESTIONS } from './typeahead.js';

/** @type {import('./types').TypeaheadSource} */
export const EMOJI_SOURCE = {
    kind: 'emoji',

    getQuery: (handle) => handle?.getTriggerQuery?.(EMOJI_TRIGGER) ?? null,

    /**
     * All emoji whose shortname contains the query, prefix matches (then alphabetical)
     * first.
     * @param {string} query
     * @returns {Promise<import('./types').TypeaheadItem[]>}
     */
    async getItems(query) {
        await api.emojis.initialize();
        const q = query.toLowerCase();
        const ranked = [];
        for (const emoji of /** @type {any[]} */ (converse.emojis.list)) {
            const idx = emoji.sn.slice(1, -1).indexOf(q); // strip the wrapping colons
            if (idx !== -1) ranked.push({ emoji, idx });
        }
        ranked.sort((a, b) => a.idx - b.idx || (a.emoji.sn < b.emoji.sn ? -1 : 1));
        return ranked.slice(0, MAX_SUGGESTIONS).map(({ emoji }) => ({
            label: emoji.sn,
            url: emoji.url,
            glyph: shortnamesToEmojis(emoji.sn, { unicode_only: true, add_title_wrapper: false }).join(''),
        }));
    },

    choose: (handle, query, item) => handle?.replaceTrigger(`:${query}`, item.glyph),
};
