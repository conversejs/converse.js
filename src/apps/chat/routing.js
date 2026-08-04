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
 *   #converse/chat/<jid>               a 1:1 chat (canonical)
 *   #converse/room/<jid>               a MUC / groupchat (canonical)
 *   #converse/chat?jid=<jid>           a 1:1 chat (legacy `routeToChat` form, accepted)
 *   #converse/room?jid=<jid>           a MUC (legacy `routeToRoom` form, accepted)
 *
 * The legacy `?jid=` forms are accepted on input but never emitted: `buildChatRoute`
 * only ever produces the canonical `/jid` path form, so the first foreground->hash
 * mirror canonicalizes a legacy deep-link.
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
    const raw = hash.replace(/^#/, '');
    const qi = raw.indexOf('?');
    const path = qi === -1 ? raw : raw.slice(0, qi);
    const query = qi === -1 ? '' : raw.slice(qi + 1);

    /** @type {'chat'|'room'} */
    let kind;
    if (path === 'converse/chat' || path.startsWith('converse/chat/')) kind = 'chat';
    else if (path === 'converse/room' || path.startsWith('converse/room/')) kind = 'room';
    else return null;

    // The legacy `?jid=<jid>` form (`routeToChat`/`routeToRoom`). Checked before the
    // path segments so it never collapses to the bare list route
    if (query.startsWith('jid=')) {
        const jid = decodeSegment(query.slice(4).split(/[&;]/)[0]);
        return jid ? { view: kind, jid } : { view: 'list' };
    }

    // The canonical path form. `converse/chat` / `converse/room` alone is the list.
    const jid = path.split('/').map(decodeSegment)[2];
    return jid ? { view: kind, jid } : { view: 'list' };
}

/**
 * Build the `#converse/...` hash for a Chat route, or null when a chat/room route
 * is missing its JID (so callers can no-op). Only the canonical `/jid` path form is
 * emitted; the legacy `?jid=` form is never produced.
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
