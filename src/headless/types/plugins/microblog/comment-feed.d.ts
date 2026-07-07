export default CommentFeed;
/**
 * A single post's comments thread (XEP-0277 § Comments): a {@link PubSubFeed}
 * over that post's comments node. Kept in a collection separate from the
 * timeline feeds ({@link CommentFeeds}) so comments never surface in the
 * aggregated feed.
 *
 * @extends {PubSubFeed}
 */
declare class CommentFeed extends PubSubFeed {
    /**
     * Fetch this thread's comments (one shot, newest first). The node may not
     * exist yet which surfaces as an error here, treated as an empty thread.
     *
     * Marks the thread as fetching for the duration so a concurrent
     * {@link CommentFeeds.pruneThreads} can't evict it mid-fetch.
     * @returns {Promise<void>}
     */
    fetchComments(): Promise<void>;
    _fetching: boolean;
    /**
     * Whether a {@link fetchComments} is currently in flight. Consulted by
     * {@link CommentFeeds.pruneThreads} to exempt an actively-fetching thread
     * from eviction.
     * @returns {boolean}
     */
    isFetching(): boolean;
    /**
     * This thread's items as {@link PostComment}s (the collection's element
     * type; the base `messages` is typed as the timeline {@link PubSubMessage}).
     * @returns {import('./post-comment').default[]}
     */
    get comments(): import("./post-comment").default[];
    /**
     * This thread's real comments (every item except ♥ likes).
     * @returns {import('./post-comment').default[]}
     */
    getComments(): import("./post-comment").default[];
    /**
     * The ♥ likes in this thread authored by me. There should be at most one,
     * but duplicates can accrue (e.g. liking from a second device).
     * {@link _converse.api.microblog.unlike} retracts all of them.
     * @returns {import('./post-comment').default[]}
     */
    getMyLikes(): import("./post-comment").default[];
    /**
     * Denormalised comment/like counts for this thread, partitioning its items
     * into real comments and ♥ likes. Written onto the post by
     * {@link syncCommentSummary} so the timeline can show counts without opening
     * the thread.
     *
     * Likes are counted by **distinct liker**, not raw ♥ items: a post can carry
     * several ♥ from the same person (e.g. liked from multiple devices, or a
     * client that doesn't guard against it), and that's one like, not several.
     * @returns {{ comment_count: number, like_count: number, liked_by_me: boolean, my_like_id: (string|undefined) }}
     */
    summarize(): {
        comment_count: number;
        like_count: number;
        liked_by_me: boolean;
        my_like_id: (string | undefined);
    };
    /**
     * Publish a comment to this thread's node and optimistically render it.
     * @param {import('./types').PubSubCommentAttrs} attrs
     * @returns {Promise<import('./message').default|undefined>}
     */
    publishComment(attrs: import("./types").PubSubCommentAttrs): Promise<import("./message").default | undefined>;
    /**
     * Construct the PubSub `<item>` for a new comment (XEP-0277 § Adding a
     * Comment): an Atom entry carrying the commenter's `<author>` and text. The
     * `<author><uri>` lets readers run the XEP-0277 § Comment Author check
     * (see {@link PubSubMessage.getAuthorMismatch}).
     * @param {import('./types').PubSubCommentAttrs} attrs
     * @returns {import('strophe.js').Stanza}
     */
    createCommentStanza(attrs: import("./types").PubSubCommentAttrs): import("strophe.js").Stanza;
}
import PubSubFeed from './feed.js';
//# sourceMappingURL=comment-feed.d.ts.map