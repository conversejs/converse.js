/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * Pure parse/build helpers for the Social app's hash routes. No DOM or side
 * effects, so they are unit-testable in isolation. Every dynamic segment is
 * `encodeURIComponent`-encoded so a JID's `@` or resource `/` never collides with
 * the path separator.
 *
 * Grammar:
 *   #converse/social                                    timeline
 *   #converse/social/profile/<jid>                      author profile
 *   #converse/social/post/<feedJid>/<itemId>            post detail (microblog node)
 *   #converse/social/post/<feedJid>/<node>/<itemId>     post detail (explicit node)
 *   #converse/social/tag/<tag>                          hashtag filter (tag without '#')
 */

// The XEP-0277 microblog node. Duplicated as a local constant because it isn't
// re-exported from @converse/headless; it's a fixed protocol namespace so it
// won't drift.
const MICROBLOG_NODE = 'urn:xmpp:microblog:0';

export const SOCIAL_ROUTE_ROOT = '#converse/social';

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
 * Parse a `location.hash` into a Social route, or null when the hash is not a
 * Social route (so other routers can ignore it too). Never throws: a malformed
 * `#converse/social/...` falls back to the timeline.
 * @param {string} [hash=location.hash]
 * @returns {import("./types.ts").SocialRoute|null}
 */
export function parseSocialRoute(hash = location.hash) {
    // Drop the leading '#' and any '?query' (Social routes carry none).
    const path = hash.replace(/^#/, '').split('?')[0];
    if (path !== 'converse/social' && !path.startsWith('converse/social/')) return null;

    const rest = path.slice('converse/social'.length).replace(/^\//, '');
    if (!rest) return { view: 'timeline' };

    // Split before decoding so an encoded '/' inside a segment survives.
    const seg = rest.split('/').map(decodeSegment);
    switch (seg[0]) {
        case 'profile': {
            // A malformed/empty jid falls back to the timeline; a non-empty but
            // otherwise invalid jid just yields a profile that fails to load
            // (validation is a view concern, kept out of this pure module).
            const jid = seg[1];
            return jid ? { view: 'profile', jid } : { view: 'timeline' };
        }
        case 'post':
            if (seg.length === 3) return { view: 'post', feedJid: seg[1], node: MICROBLOG_NODE, itemId: seg[2] };
            if (seg.length >= 4) return { view: 'post', feedJid: seg[1], node: seg[2], itemId: seg[3] };
            return { view: 'timeline' };
        case 'tag': {
            const tag = seg[1];
            return tag ? { view: 'tag', tag } : { view: 'timeline' };
        }
        default:
            return { view: 'timeline' };
    }
}

/**
 * Build the `#converse/...` hash for a Social route, or null when the route is
 * incomplete (so callers can no-op). The node segment is omitted for the common
 * microblog node, keeping post URLs terse.
 * @param {import("./types.ts").SocialRoute} route
 * @returns {string|null}
 */
export function buildSocialRoute(route) {
    switch (route?.view) {
        case 'profile':
            return route.jid ? `${SOCIAL_ROUTE_ROOT}/profile/${encodeURIComponent(route.jid)}` : null;
        case 'post': {
            if (!route.feedJid || !route.itemId) return null;
            const node = route.node ?? MICROBLOG_NODE;
            const base = `${SOCIAL_ROUTE_ROOT}/post/${encodeURIComponent(route.feedJid)}`;
            return node === MICROBLOG_NODE
                ? `${base}/${encodeURIComponent(route.itemId)}`
                : `${base}/${encodeURIComponent(node)}/${encodeURIComponent(route.itemId)}`;
        }
        case 'tag':
            return route.tag ? `${SOCIAL_ROUTE_ROOT}/tag/${encodeURIComponent(route.tag)}` : null;
        case 'timeline':
        default:
            return SOCIAL_ROUTE_ROOT;
    }
}
