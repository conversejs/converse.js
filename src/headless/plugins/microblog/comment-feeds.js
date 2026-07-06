/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import log from '@converse/log';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import { createStore } from '../../utils/storage.js';
import CommentFeed from './comment-feed.js';
import PubSubFeeds from './feeds.js';

/**
 * @extends {PubSubFeeds}
 */
class CommentFeeds extends PubSubFeeds {
    get model() {
        return CommentFeed;
    }

    initialize() {
        const bare_jid = _converse.session.get('bare_jid');
        this.storage = createStore(`converse.pubsub-comment-feeds-${bare_jid}`);
    }

    /**
     * Get an existing comment thread (touching its recency on explicit access),
     * or create + persist one. A `create=false` lookup (e.g. PEP routing) neither
     * creates a thread nor bumps recency.
     * @param {string} jid - The comments service JID.
     * @param {string} node - The comments node.
     * @param {boolean} [create=true]
     * @returns {CommentFeed|undefined}
     */
    getFeed(jid, node, create = true) {
        const id = PubSubFeeds.getFeedId(jid, node);
        const existing = /** @type {CommentFeed|undefined} */ (this.get(id));
        if (existing) {
            if (create) existing.save({ last_viewed: Date.now() });
            return existing;
        }
        if (!create) return undefined;
        const feed = /** @type {CommentFeed} */ (this.create({ id, jid, node, last_viewed: Date.now() }));
        this.pruneThreads();
        return feed;
    }

    /**
     * Evict threads once the collection exceeds `social_max_comment_threads`,
     * destroying each evicted thread and its store. Empty threads (they cache no
     * comments, so re-fetching is cheap) are evicted before non-empty ones, which
     * hold real content; within each group the least-recently-viewed goes first.
     * Pinned threads (own posts, kept live) and threads with a fetch in flight
     * are never evicted.
     */
    pruneThreads() {
        const cap = api.settings.get('social_max_comment_threads');
        if (!cap || typeof cap !== 'number' || this.length <= cap) return;
        // A just-created thread pending its first fetch looks empty but is the
        // newest, so it sorts last within the empty group and survives; one whose
        // fetch has actually started is exempt outright (isFetching).
        const evictable = this.filter((f) => !f.get('pinned') && !f.isFetching()).sort((a, b) => {
            const a_empty = a.messages.length === 0;
            const b_empty = b.messages.length === 0;
            if (a_empty !== b_empty) return a_empty ? -1 : 1; // empties first
            return (a.get('last_viewed') || 0) - (b.get('last_viewed') || 0); // then oldest
        });
        evictable.slice(0, this.length - cap).forEach((f) => f.close());
    }

    /**
     * Bound the number of *pinned* threads (our own posts', subscribed for live
     * comment/like counts) to `social_max_pinned_threads`: past the cap, the
     * least-recently-pinned are unsubscribed and evicted so server-side
     * subscriptions don't accumulate without limit. A thread mid-fetch is
     * exempt; the most-recently-pinned always survive.
     * @returns {Promise<void>}
     */
    async enforcePinnedCap() {
        const cap = api.settings.get('social_max_pinned_threads');
        if (!cap || typeof cap !== 'number') return;
        const pinned = this.filter((f) => f.get('pinned') && !f.isFetching());
        if (pinned.length <= cap) return;
        const excess = pinned
            .sort((a, b) => (a.get('last_viewed') || 0) - (b.get('last_viewed') || 0))
            .slice(0, pinned.length - cap);
        for (const feed of excess) {
            try {
                await api.pubsub.unsubscribe(feed.get('jid'), feed.get('node'));
            } catch (e) {
                log.debug(`enforcePinnedCap: unsubscribe from ${feed.get('node')} failed (non-fatal): ${e}`);
            }
            await feed.close();
        }
    }
}

export default CommentFeeds;
