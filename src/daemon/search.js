/**
 * Searching messages, in the server's archive or among those held locally.
 * @module @converse/daemon/search
 */
import { log } from '@converse/headless';
import { getText } from './dto.js';
import { heldConversations } from './find.js';
import { isMessage } from './history.js';

/**
 * The newest `limit` messages whose text has every word of `text`. The
 * server's full-text search of its archive is used where the server offers
 * it. Otherwise, or if the server's search fails, the messages held locally
 * are searched.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {string} text
 * @param {string} [jid] - The bare JID of the conversation to search, else every one
 * @param {number} limit
 * @returns {Promise<{ method: 'server'|'local', messages: import('@converse/headless').Message[] }>}
 */
export async function searchMessages(_converse, text, jid, limit) {
    const found = await searchServer(_converse, text, jid, limit);
    if (found) return { method: 'server', messages: found };

    return { method: 'local', messages: await searchLocal(_converse, text, jid, limit) };
}

/**
 * The matches for `text` that the server's archive holds, or null where the
 * server can't search it. A search that fails is logged, and is treated the same.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {string} text
 * @param {string} [jid] - The bare JID of the conversation to search, else every one
 * @param {number} limit
 * @returns {Promise<import('@converse/headless').Message[]|null>}
 */
async function searchServer(_converse, text, jid, limit) {
    const { api } = _converse;
    if (!api.connection.connected()) return null;
    try {
        // Created, so that each match is held, and its id works with the other commands.
        const result = await api.archive.search(text, { with: jid, max: limit, create: true });
        return result?.messages ?? null;
    } catch (e) {
        log.warn(`The server couldn't search its archive, so the messages held locally are searched: ${e.message}`);
        return null;
    }
}

/**
 * The newest `limit` messages held locally whose text has every word of `text`,
 * oldest first.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {string} text
 * @param {string} [jid] - The bare JID of the conversation to search, else every one
 * @param {number} limit
 * @returns {Promise<import('@converse/headless').Message[]>}
 */
async function searchLocal(_converse, text, jid, limit) {
    const words = fold(text).split(/\s+/);
    return (await heldConversations(_converse, jid))
        .flatMap((c) => c.messages.models.filter(isMessage))
        .filter((m) => !m.isRetracted())
        .filter((m) => {
            const text = fold(m.stripReplyFallback(getText(m)) ?? '');
            return words.every((word) => text.includes(word));
        })
        .sort((a, b) => Date.parse(a.get('time')) - Date.parse(b.get('time')))
        .slice(-limit);
}

/**
 * Text as a search compares it: neither case nor accents count.
 * @param {string} text
 */
const fold = (text) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
