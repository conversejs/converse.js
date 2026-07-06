import CommentFeed from './comment-feed.js';
import PubSubFeeds from './feeds.js';

/**
 * The set of open comment threads (one per post whose comments are being
 * viewed), registered as `_converse.state.commentfeeds`. Held separately from
 * {@link PubSubFeeds} so comments never enter the aggregated timeline, and in
 * memory only (no store) so browsing many threads doesn't grow the offline
 * cache — each thread is refetched when reopened.
 *
 * @extends {PubSubFeeds}
 */
class CommentFeeds extends PubSubFeeds {
    get model() {
        return CommentFeed;
    }

    get autoSync() {
        return false;
    }

    // In-memory only: no backing store (overrides PubSubFeeds' store setup).
    initialize() {}

    /**
     * Get an existing comment thread, or (when `create`) add one in memory.
     * Uses `add` rather than `create` since there's no store to persist to.
     * @param {string} jid - The comments service JID.
     * @param {string} node - The comments node.
     * @param {boolean} [create=true]
     * @returns {CommentFeed|undefined}
     */
    getFeed(jid, node, create = true) {
        const id = PubSubFeeds.getFeedId(jid, node);
        const existing = this.get(id);
        if (existing || !create) return /** @type {CommentFeed|undefined} */ (existing);
        return /** @type {CommentFeed} */ (this.add({ id, jid, node }));
    }
}

export default CommentFeeds;
