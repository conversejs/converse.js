export default CommentFeeds;
/**
 * @extends {PubSubFeeds}
 */
declare class CommentFeeds extends PubSubFeeds {
    get model(): typeof CommentFeed;
    /**
     * Get an existing comment thread (touching its recency on explicit access),
     * or create + persist one. A `create=false` lookup (e.g. PEP routing) neither
     * creates a thread nor bumps recency.
     * @param {string} jid - The comments service JID.
     * @param {string} node - The comments node.
     * @param {boolean} [create=true]
     * @returns {CommentFeed|undefined}
     */
    getFeed(jid: string, node: string, create?: boolean): CommentFeed | undefined;
    /**
     * Evict threads once the collection exceeds `social_max_comment_threads`,
     * destroying each evicted thread and its store. Empty threads (they cache no
     * comments, so re-fetching is cheap) are evicted before non-empty ones, which
     * hold real content; within each group the least-recently-viewed goes first.
     * Pinned threads (own posts, kept live) and threads with a fetch in flight
     * are never evicted.
     */
    pruneThreads(): void;
    /**
     * Bound the number of *pinned* threads (our own posts', subscribed for live
     * comment/like counts) to `social_max_pinned_threads`: past the cap, the
     * least-recently-pinned are unsubscribed and evicted so server-side
     * subscriptions don't accumulate without limit. A thread mid-fetch is
     * exempt; the most-recently-pinned always survive.
     * @returns {Promise<void>}
     */
    enforcePinnedCap(): Promise<void>;
}
import PubSubFeeds from './feeds.js';
import CommentFeed from './comment-feed.js';
//# sourceMappingURL=comment-feeds.d.ts.map