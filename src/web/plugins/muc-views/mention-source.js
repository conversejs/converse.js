/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * The occupant-nickname typeahead source: typing `@ali` in a MUC offers the people in the
 * room, and picking one inserts a plain `@nick`.
 *
 * Plain text on purpose. The MUC turns mentions into XEP-0372 references downstream, by
 * scanning the message body for `@nick` and recording character offsets into it (see
 * MUC#parseTextForReferences), so anything richer than text would corrupt
 * those offsets and put markup on a wire format that has no notion of it.
 */
import { api } from '@converse/headless';
import { FILTER_CONTAINS, FILTER_STARTSWITH } from 'shared/autocomplete/utils.js';
import { MENTION_TRIGGER } from 'shared/rich-composer/triggers.js';
import { MAX_SUGGESTIONS } from 'shared/rich-composer/typeahead.js';

/**
 * The occupant whose avatar should stand for `nick`, or undefined. A nickname can come from
 * the message history rather than the current occupant list, in which case there is nobody
 * to show.
 * @param {import('@converse/headless').MUC} muc
 * @param {string} nick
 */
function getAvatarModel(muc, nick) {
    const n = nick.toLowerCase();
    return muc.occupants.find(
        /** @param {import('@converse/headless').MUCOccupant} o */
        (o) =>
            o.get('nick')?.toLowerCase() === n ||
            o.getDisplayName()?.toLowerCase()?.startsWith(n) ||
            o.get('nickname')?.toLowerCase()?.startsWith(n) ||
            o.get('jid')?.toLowerCase()?.startsWith(n),
    );
}

/**
 * Build the mention source for one MUC composer.
 * @param {() => import('@converse/headless').MUC} getMUC
 * @param {() => boolean} canComplete - Whether completion applies right now (the room has
 *      been entered, and we are not a visitor in a moderated room).
 * @returns {import('shared/rich-composer/types').TypeaheadSource}
 */
export function makeMentionSource(getMUC, canComplete) {
    return {
        kind: 'mention',

        getQuery: (handle) => (canComplete() ? (handle?.getTriggerQuery?.(MENTION_TRIGGER) ?? null) : null),

        /** @param {string} query */
        getItems(query) {
            const muc = getMUC();
            if (!muc) return [];
            if (query.length < api.settings.get('muc_mention_autocomplete_min_chars')) return [];

            const filter =
                api.settings.get('muc_mention_autocomplete_filter') === 'contains'
                    ? FILTER_CONTAINS
                    : FILTER_STARTSWITH;
            const show_avatar = api.settings.get('muc_mention_autocomplete_show_avatar');

            const q = query.toLowerCase();
            const matches = muc.getAllKnownNicknames().filter((nick) => !query || filter(nick, query));

            // Earliest match first, then shortest, so `@ber` offers "bernard" before
            // "naber" before "helberlo". Ranking a bare `@` that way would be arbitrary
            // (every position is 0), so it falls back to alphabetical; the nicknames
            // arrive in occupant-join order, which is no order at all to the reader.
            const byName = (/** @type {string} */ a, /** @type {string} */ b) =>
                a.toLowerCase() < b.toLowerCase() ? -1 : 1;
            matches.sort((a, b) => {
                if (!query) return byName(a, b);
                const rank = (/** @type {string} */ s) => {
                    const i = s.toLowerCase().indexOf(q);
                    return i === -1 ? Infinity : i;
                };
                return rank(a) - rank(b) || a.length - b.length || byName(a, b);
            });

            return matches.slice(0, MAX_SUGGESTIONS).map((nick) => ({
                label: nick,
                avatar: show_avatar ? getAvatarModel(muc, nick) : undefined,
            }));
        },

        // A trailing space, so typing can carry straight on after the mention.
        choose: (handle, query, item) => handle?.replaceTrigger(`@${query}`, `@${item.label} `),
    };
}
