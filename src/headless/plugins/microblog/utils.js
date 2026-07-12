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
import { COMMENTS_NODE_PREFIX, MICROBLOG_NODE } from './constants.js';

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
 * @param {string} [node]
 * @returns {boolean}
 */
export function isMicroblogNode(node) {
    return node === MICROBLOG_NODE || (!!node && node.startsWith(COMMENTS_NODE_PREFIX));
}

/**
 * Handle an incoming PEP/PubSub event, routing microblog items to the relevant
 * feed. New feeds are auto-created only for the user's own PEP node; events from
 * other JIDs are applied only to feeds the user already follows (M3 adds the
 * machinery to follow others).
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
            if (!isMicroblogNode(node)) continue;

            const items = sizzle('> item', items_el);
            const retracts = sizzle('> retract', items_el)
                .map((el) => el.getAttribute('id'))
                .filter(Boolean);
            if (!items.length && !retracts.length) continue;

            // Comments route to their own separate collection, and only when a
            // thread is already open (create=false) — so a comment event never
            // creates a timeline feed nor surfaces in the aggregated feed.
            const is_comments = node.startsWith(COMMENTS_NODE_PREFIX);
            const feed = is_comments
                ? _converse.state.commentfeeds?.getFeed(from, node, false)
                : feeds.getFeed(from, node, from === bare_jid);
            if (!feed) continue;

            if (items.length) {
                // Snapshot the thread's existing comment ids so a re-delivered
                // item (already present) can't raise a second notification.
                const known = is_comments ? new Set(feed.messages.models.map((m) => m.get('id'))) : null;
                const added = feed.addItems(items);
                // A live comment/like landing on a materialised (pinned/open)
                // thread updates the owning post's denormalised counts, so the
                // timeline reflects it without reopening the thread, and a comment
                // or like on one of *our* posts raises a desktop notification.
                // addItems is async, so guard the follow-up against an escaping
                // rejection.
                if (is_comments) {
                    added
                        .then((comments) => {
                            syncCommentThread(from, node, feed);
                            notifyOfThreadActivity(from, node, comments, known);
                        })
                        .catch((e) => log.error(e));
                }
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
