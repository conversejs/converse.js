/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import sizzle from 'sizzle';
import { Strophe } from 'strophe.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import log from '@converse/log';
import { findPostForThread, syncCommentThread } from './comment-summary.js';
import { COMMENTS_NODE_PREFIX, FOLLOWING_NODE, MICROBLOG_NODE } from './constants.js';

/**
 * Build the `tag:` URI used as the Atom `<id>` of a new entry (RFC 4151).
 * @param {string} jid
 * @param {string} id
 * @returns {string}
 */
export function buildTagId(jid, id) {
    const domain = Strophe.getDomainFromJid(jid) || jid;
    const date = new Date().toISOString().split('T')[0];
    return `tag:${domain},${date}:posts-${id}`;
}

/**
 * Parse a feed address into a `{ jid, node }` pair, or null if it isn't a usable
 * address. Accepts either a bare JID (a user like `news@example.org` or a service
 * like `pubsub.example.org`), which defaults to the PEP microblog node, or an XMPP
 * pubsub URI carrying an explicit node (`xmpp:pubsub.example.org?;node=news`, per
 * RFC 5122 / XEP-0060).
 * @param {string} address
 * @returns {{ jid: string, node: string }|null}
 */
export function parseFeedAddress(address) {
    const raw = address?.trim();
    if (!raw) return null;

    let jid = raw;
    let node = MICROBLOG_NODE;

    if (/^xmpp:/i.test(raw)) {
        const [jid_part, query = ''] = raw.slice('xmpp:'.length).split('?');
        jid = decodeURIComponent(jid_part);
        // The query is `[action];key=value;key=value` (the leading action may be
        // empty), so pick out the `node=` pair wherever it sits.
        const node_pair = query.split(';').find((p) => p.startsWith('node='));
        if (node_pair) node = decodeURIComponent(node_pair.slice('node='.length));
    }

    // Strip any resource and require a dotted domain, so a stray word isn't taken
    // for a JID. A service JID (`pubsub.example.org`) has no local part.
    jid = Strophe.getBareJidFromJid(jid) || jid;
    const domain = Strophe.getDomainFromJid(jid);
    if (!jid || !node || !domain?.includes('.')) return null;

    return { jid, node };
}

// Coalesce follow-list re-syncs. A burst of `+notify` pushes (e.g. a bulk-follow
// on another device) must not fire N concurrent list re-reads: while one pass
// runs, further triggers just mark it to run once more when it finishes.
let resyncing_following = false;
let resync_following_pending = false;

/**
 * Re-sync the local follow state from the durable XEP-0330 list (coalesced,
 * fire-and-forget). Triggered by a `+notify` push on our own follow-list node.
 */
function resyncFollowing() {
    if (resyncing_following) {
        resync_following_pending = true;
        return;
    }
    resyncing_following = true;
    (async () => {
        do {
            resync_following_pending = false;
            await api.microblog.syncFollowing();
        } while (resync_following_pending);
    })()
        .catch((e) => log.error(e))
        .finally(() => {
            resyncing_following = false;
        });
}

/**
 * Retrieve the payloads of any items that arrived as a bare `<item id/>` header.
 *
 * The retrieval itself is by `api.pubsub.items.resolve`. A header for an item we
 * already hold isn't fetched at all. It keeps a redelivered comment from raising
 * a second notification, and drops the id from a batch we'd otherwise ask the
 * service to re-send content we have. The cost is that an *edit* republished under
 * the same id goes unseen on such a node, because a bare header carries nothing
 * that tells an edit from a redelivery.
 *
 * @param {import('./feed').default} feed - The feed the items belong to.
 * @param {Element[]} items
 * @returns {Promise<Element[]>}
 */
async function resolveItemPayloads(feed, items) {
    const { jid, node } = feed.attrs;
    // The collection can only answer "do we have this already" once hydrated,
    // which is what addItems waits on too.
    await feed.messages.hydrated;
    const wanted = items.filter((el) => el.firstElementChild || !feed.messages.get(el.getAttribute('id')));
    return api.pubsub.items.resolve(jid, node, wanted);
}

/**
 * Handle an incoming PEP/PubSub event, routing items to the relevant feed. A feed
 * is auto-created only for the user's own microblog node; events from any other
 * node are applied only to a feed the user already follows (a contact's microblog
 * or an arbitrary community node on a pubsub service).
 *
 * @param {Element} message
 * @returns {boolean} Always `true`, to keep the Strophe handler registered.
 */
export function handleMicroblogEvent(message) {
    try {
        const event = sizzle(`event[xmlns="${Strophe.NS.PUBSUB}#event"]`, message).pop();
        if (!event) return true;

        const feeds = _converse.state.pubsubfeeds;
        if (!feeds) return true;

        const bare_jid = _converse.session.get('bare_jid');
        const from = Strophe.getBareJidFromJid(message.getAttribute('from')) || bare_jid;

        for (const items_el of sizzle('> items', event)) {
            const node = items_el.getAttribute('node');
            if (!node) continue;

            // A change to our *own* XEP-0330 follow list (a follow/unfollow made
            // on another device or client) arrives here via `+notify`. It isn't a
            // timeline node, so re-sync the mirror + feeds from the server rather
            // than routing items. A contact's list (from someone else) must never
            // mutate our own follows, so it's ignored.
            if (node === FOLLOWING_NODE) {
                if (from === bare_jid) resyncFollowing();
                continue;
            }

            // Route by feed *existence*, not by node name, so any followed node
            // works (a contact's `urn:xmpp:microblog:0`, or an arbitrary community
            // node on a pubsub service), while our own non-feed PEP nodes (avatar,
            // bookmarks, OMEMO...) are ignored:
            //  - a comments node routes to its own collection, and only into an
            //    already-open thread (create=false), so it never surfaces in the timeline;
            //  - our own microblog node is auto-created;
            //  - a followed community/contact node routes into its already-materialised
            //    feed (persisted, so present even before the Social app opens);
            //  - anything else has no feed and is dropped.
            const is_comments = node.startsWith(COMMENTS_NODE_PREFIX);
            const feed = is_comments
                ? _converse.state.commentfeeds?.getFeed(from, node, false)
                : feeds.getFeed(from, node, from === bare_jid && node === MICROBLOG_NODE);
            if (!feed) continue;

            const items = sizzle('> item', items_el);
            const retracts = sizzle('> retract', items_el)
                .map((el) => el.getAttribute('id'))
                .filter(Boolean);
            if (!items.length && !retracts.length) continue;

            if (items.length) {
                // Snapshot the thread's existing comment ids so a re-delivered
                // item (already present) can't raise a second notification.
                const known = is_comments ? new Set(feed.messages.models.map((m) => m.get('id'))) : null;
                // A live comment/like landing on a materialised (pinned/open)
                // thread updates the owning post's denormalised counts, so the
                // timeline reflects it without reopening the thread, and a comment
                // or like on one of *our* posts raises a desktop notification.
                // Resolution and addItems are both async, so the one catch at the
                // end of the chain keeps a rejection from escaping.
                resolveItemPayloads(feed, items)
                    .then((resolved) => feed.addItems(resolved))
                    .then((added) => {
                        if (!is_comments) return;
                        syncCommentThread(from, node, feed);
                        notifyOfThreadActivity(from, node, added, known);
                    })
                    .catch((e) => log.error(e));
            }
            if (retracts.length) {
                feed.removeItems(retracts);
                if (is_comments) syncCommentThread(from, node, feed);
            }
        }
    } catch (e) {
        log.error(e);
    }
    return true;
}

/**
 * Raise a `microblogNotification` for each newly-arrived comment or ♥ like on one
 * of *our* own posts, so the notifications plugin can show a desktop alert (parity
 * with chat messages). Deliberately narrow:
 *  - runs only from the live PEP path (never the `fetchComments` backfill), so
 *    opening or pinning a thread never back-notifies its existing activity;
 *  - `known` filters out a re-delivered item already in the thread;
 *  - our own comments/likes are skipped;
 *  - a ♥ like notifies as `type: 'like'`, a text comment as `type: 'comment'`,
 *    so the notifications plugin can word each one;
 *  - the thread's owning post must be ours (`is_mine`), which also requires it to
 *    be loaded in a timeline feed (otherwise there's nothing to open/attribute).
 *
 * @param {string} service - The comments service JID.
 * @param {string} node - The comments node.
 * @param {import('./post-comment').default[]} comments - The models `addItems` returned.
 * @param {Set<string>} known - Comment ids present before this batch.
 */
function notifyOfThreadActivity(service, node, comments, known) {
    const post = findPostForThread(service, node);
    if (!post?.get('is_mine')) return;
    const ref = { feedJid: post.get('from'), node: post.get('node'), itemId: post.get('id') };
    for (const comment of comments) {
        if (known.has(comment.get('id')) || comment.get('is_mine')) continue;
        const type = comment.isLike?.() ? 'like' : 'comment';
        /**
         * Triggered for a notifiable microblog event: a comment on, or a ♥ like
         * of, one of the user's own posts. The notifications plugin listens for
         * this to raise an HTML5 desktop notification.
         * @event _converse#microblogNotification
         * @type {{ type: 'comment'|'like', post: import('./message').default, comment: import('./post-comment').default, ref: { feedJid: string, node: string, itemId: string } }}
         */
        api.trigger('microblogNotification', { type, post, comment, ref });
    }
}

/**
 * Register a handler for microblog items pushed via PEP from our own or
 * followed nodes.
 */
export function registerMicroblogHandler() {
    api.connection.get().addHandler(handleMicroblogEvent, null, 'message');
}
