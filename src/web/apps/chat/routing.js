/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * Pure parse/build helpers for the Chat app's hash routes. No DOM or side
 * effects, so they are unit-testable in isolation. The JID segment is
 * `encodeURIComponent`-encoded so its `@` or resource `/` never collides with the
 * path separator.
 *
 * Grammar:
 *   #converse/chat                     the chat app (no conversation foregrounded)
 *   #converse/chat/<jid>               a 1:1 chat
 *   #converse/room/<jid>               a MUC / groupchat
 *
 * A hash with a query (e.g. the legacy `#converse/chat?jid=<jid>` deep link) is
 * not a Chat route. The legacy forms are read by the rootview protocol handler,
 * as the `xmpp:` URI they stand for.
 */

export const CHAT_ROUTE_ROOT = '#converse/chat';

/**
 * Decode one path segment, tolerating a malformed `%` sequence rather than throwing.
 * @param {string} s
 * @returns {string}
 */
function decodeSegment(s) {
    try {
        return decodeURIComponent(s);
    } catch {
        return s;
    }
}

/**
 * Parse a `location.hash` into a Chat route, or null when the hash is not a Chat
 * route (so other routers can ignore it too). Never throws: a malformed
 * `#converse/chat/...` falls back to the list.
 * @param {string} [hash=location.hash]
 * @returns {import("./types.ts").ChatRoute|null}
 */
export function parseChatRoute(hash = location.hash) {
    const path = hash.replace(/^#/, '');
    if (path.includes('?')) return null;

    /** @type {'chat'|'room'} */
    let kind;
    if (path === 'converse/chat' || path.startsWith('converse/chat/')) kind = 'chat';
    else if (path === 'converse/room' || path.startsWith('converse/room/')) kind = 'room';
    else return null;

    // `converse/chat` / `converse/room` alone is the list.
    const jid = path.split('/').map(decodeSegment)[2];
    return jid ? { view: kind, jid } : { view: 'list' };
}

/**
 * Build the `#converse/...` hash for a Chat route, or null when a chat/room route
 * is missing its JID (so callers can no-op).
 * @param {import("./types.ts").ChatRoute} route
 * @returns {string|null}
 */
export function buildChatRoute(route) {
    switch (route?.view) {
        case 'chat':
            return route.jid ? `${CHAT_ROUTE_ROOT}/${encodeURIComponent(route.jid)}` : null;
        case 'room':
            return route.jid ? `#converse/room/${encodeURIComponent(route.jid)}` : null;
        case 'list':
        default:
            return CHAT_ROUTE_ROOT;
    }
}
