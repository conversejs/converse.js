export default CommentFeeds;
/**
 * The set of open comment threads (one per post whose comments are being
 * viewed), registered as `_converse.state.commentfeeds`. Held separately from
 * {@link PubSubFeeds} so comments never enter the aggregated timeline, and in
 * memory only (no store) so browsing many threads doesn't grow the offline
 * cache — each thread is refetched when reopened.
 *
 * @extends {PubSubFeeds}
 */
declare class CommentFeeds extends PubSubFeeds {
    get model(): typeof CommentFeed;
    /**
     * Get an existing comment thread, or (when `create`) add one in memory.
     * Uses `add` rather than `create` since there's no store to persist to.
     * @param {string} jid - The comments service JID.
     * @param {string} node - The comments node.
     * @param {boolean} [create=true]
     * @returns {CommentFeed|undefined}
     */
    getFeed(jid: string, node: string, create?: boolean): CommentFeed | undefined;
}
import PubSubFeeds from './feeds.js';
import CommentFeed from './comment-feed.js';
//# sourceMappingURL=comment-feeds.d.ts.map