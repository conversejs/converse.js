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
 *   #converse/social/profile/<jid>                      author profile (posts)
 *   #converse/social/profile/<jid>/following            author profile (who they follow)
 *   #converse/social/feed/<jid>/<node>                  a followed community/topic feed
 *   #converse/social/post/<feedJid>/<itemId>            post detail (microblog node)
 *   #converse/social/post/<feedJid>/<node>/<itemId>     post detail (explicit node)
 *   #converse/social/post/.../<itemId>/comment/<cId>    focused comment (flat thread)
 *   #converse/social/post/.../<itemId>/comment/<cJid>/<cNode>/<cId>   focused comment (child node)
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
            // (validation is a view concern, kept out of this pure module). A
            // trailing `/following` segment selects that tab.
            const jid = seg[1];
            if (!jid) return { view: 'timeline' };
            return seg[2] === 'following' ? { view: 'profile', jid, tab: 'following' } : { view: 'profile', jid };
        }
        case 'feed': {
            // A followed community/topic feed: the same profile view, node-aware.
            const jid = seg[1];
            const node = seg[2];
            return jid && node ? { view: 'profile', jid, node } : { view: 'timeline' };
        }
        case 'post': {
            // A `comment` marker splits the post part from the focused-comment part:
            //   post/<feedJid>/<itemId>[/comment/...]
            //   post/<feedJid>/<node>/<itemId>[/comment/...]
            // The comment part is either a bare id (a comment in the post's own
            // comments node) or <cJid>/<cNode>/<cId> (a Libervia child node).
            const rest = seg.slice(1);
            const ci = rest.indexOf('comment');
            const post_part = ci === -1 ? rest : rest.slice(0, ci);
            const comment_part = ci === -1 ? [] : rest.slice(ci + 1);

            /** @type {import("./types.ts").SocialRoute} */
            let route;
            if (post_part.length === 2) route = { view: 'post', feedJid: post_part[0], node: MICROBLOG_NODE, itemId: post_part[1] };
            else if (post_part.length >= 3) route = { view: 'post', feedJid: post_part[0], node: post_part[1], itemId: post_part[2] };
            else return { view: 'timeline' };

            if (comment_part.length === 1) route.commentId = comment_part[0];
            else if (comment_part.length >= 3) {
                route.commentJid = comment_part[0];
                route.commentNode = comment_part[1];
                route.commentId = comment_part[2];
            }
            return route;
        }
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
        case 'profile': {
            if (!route.jid) return null;
            // A non-microblog node is a followed community feed: its own route.
            if (route.node && route.node !== MICROBLOG_NODE) {
                return `${SOCIAL_ROUTE_ROOT}/feed/${encodeURIComponent(route.jid)}/${encodeURIComponent(route.node)}`;
            }
            const base = `${SOCIAL_ROUTE_ROOT}/profile/${encodeURIComponent(route.jid)}`;
            return route.tab === 'following' ? `${base}/following` : base;
        }
        case 'post': {
            if (!route.feedJid || !route.itemId) return null;
            const node = route.node ?? MICROBLOG_NODE;
            let base = `${SOCIAL_ROUTE_ROOT}/post/${encodeURIComponent(route.feedJid)}`;
            base +=
                node === MICROBLOG_NODE
                    ? `/${encodeURIComponent(route.itemId)}`
                    : `/${encodeURIComponent(node)}/${encodeURIComponent(route.itemId)}`;
            // A focused comment: a bare id (post's own comments node) or the long
            // <cJid>/<cNode>/<cId> form for a Libervia child node.
            if (route.commentId) {
                const cid = encodeURIComponent(route.commentId);
                if (route.commentJid && route.commentNode) {
                    const cj = encodeURIComponent(route.commentJid);
                    const cn = encodeURIComponent(route.commentNode);
                    base += `/comment/${cj}/${cn}/${cid}`;
                } else {
                    base += `/comment/${cid}`;
                }
            }
            return base;
        }
        case 'tag':
            return route.tag ? `${SOCIAL_ROUTE_ROOT}/tag/${encodeURIComponent(route.tag)}` : null;
        case 'timeline':
        default:
            return SOCIAL_ROUTE_ROOT;
    }
}
