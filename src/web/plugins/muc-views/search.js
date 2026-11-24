import { _converse, api, log } from '@converse/headless';
import { html } from 'lit';
import { __ } from 'i18n';
import { highlightMatches } from 'shared/autocomplete/utils.js';

/**
 * Search results, keyed by search service and query
 * @type {Map<string, Promise<import('./types').RoomData[]>>}
 */
const rooms_cache = new Map();

export function clearRoomsCache() {
    rooms_cache.clear();
}

/**
 * @param {string} query
 * @returns {Promise<import('./types').RoomData[]>}
 */
async function searchRooms(query) {
    const { items } = await api.rooms.search(query);
    return items.map((item) => ({
        ...item,
        label: item.name ? `${item.name} (${item.jid})` : item.jid,
        value: item.jid,
    }));
}

/**
 * @param {string} query
 */
export function getAutoCompleteList(query) {
    const key = `${api.settings.get('muc_search_service')} ${query}`;
    if (!rooms_cache.has(key)) {
        const promise = searchRooms(query).catch((e) => {
            // Refusals are expected while a service is backed off, so don't warn on every keystroke
            if (!(e instanceof _converse.exports.ChannelSearchRefusedError)) log.warn(e);
            // Don't cache failures, so that the same query can be retried
            if (rooms_cache.get(key) === promise) rooms_cache.delete(key);
            return [];
        });
        rooms_cache.set(key, promise);
    }
    return rooms_cache.get(key);
}

/**
 * Renders a groupchat found by searching, together with its number of participants.
 * @param {import('shared/autocomplete/suggestion').default<import('@converse/headless').ChannelSearchItem>} suggestion
 * @param {string} query
 */
export function tplRoomSuggestion(suggestion, query) {
    const { nusers, description } = suggestion.data;
    const i18n_participants = __('Participants');
    return html`<li aria-selected="false" class="room-suggestion" title="${description ?? ''}">
        <span class="room-suggestion__label">${highlightMatches(suggestion.label, query)}</span>
        ${
            nusers === undefined
                ? ''
                : html`<span class="room-suggestion__nusers" title="${i18n_participants}">
                      <converse-icon class="fa fa-users" size="0.8em"></converse-icon> ${nusers}
                  </span>`
        }
    </li>`;
}
