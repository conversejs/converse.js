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
     * Fetch this thread and make it complete enough to render as a tree. Drives
     * the inherited {@link PubSubFeed.fetchPosts} paging (RSM where the comments
     * service supports it, else the newest-`POSTS_MAX_WITHOUT_RSM` window with
     * `history_complete`), then {@link resolveOrphans} to reconnect a reply whose
     * parent fell outside the window on a non-RSM node. The node may not exist yet
     * (an empty thread), which `fetchPosts` records as `fetch_error` rather than
     * throwing.
     *
     * Marks the thread as fetching for the duration so a concurrent
     * {@link CommentFeeds.pruneThreads} can't evict it mid-fetch.
     * @returns {Promise<void>}
     */
    fetchComments(): Promise<void>;
    _fetching: boolean;
    /**
     * Reconnect orphans (replies whose in-thread parent isn't loaded) by fetching
     * the missing ancestors by item id, walking up the chain until each branch
     * reaches a loaded root or a retracted (not-found) ancestor.
     *
     * **Non-RSM only.** On an RSM-capable node normal "load older" paging brings
     * parents in *in order*, so a targeted id-fetch is unnecessary and harmful: an
     * out-of-order item carries no `rsm_cursor` and lands at an arbitrary time
     * position, polluting the anchors and gap detection `fetchOlder` relies on. So
     * this early-returns when the node paged via RSM and lets paging adopt orphans.
     *
     * A parent that comes back not-found is recorded in an in-memory absent-set so
     * it isn't re-requested; its orphan stays kept-but-hidden (see buildCommentTree).
     * @returns {Promise<void>}
     */
    resolveOrphans(): Promise<void>;
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
     * This thread's real comments (every item except ♥ likes). Excludes any
     * "load older" placeholders the inherited paging seeds into the collection.
     * @returns {import('./post-comment').default[]}
     */
    getComments(): import("./post-comment").default[];
    /**
     * The ♥ likes authored by me that target `parent_id` (a comment's item id),
     * or the *post* when `parent_id` is omitted. There should be at most one, but
     * duplicates can accrue (e.g. liking from a second device);
     * {@link _converse.api.microblog.unlike} retracts all of them. Matches on the
     * raw `in_reply_to` since our own likes always carry the target's item id.
     * @param {string} [parent_id] - A comment's item id; omit for the post.
     * @returns {import('./post-comment').default[]}
     */
    getMyLikes(parent_id?: string): import("./post-comment").default[];
    /**
     * Denormalised counts for one target in this thread: the **post** (omit
     * `parent_id`) or a specific **comment** (its item id). Written onto the post
     * by {@link syncCommentSummary} and onto each comment by
     * {@link syncCommentCounts}, so the timeline/thread can show counts without
     * re-walking the node.
     *
     * A ♥ is attributed to the item it targets, so a like on a comment no longer
     * inflates the post's like count; likes are counted by **distinct liker** (a
     * person liking from two devices is one like). See {@link computeThreadCounts}.
     * @param {string} [parent_id] - A comment's item id; omit for the post.
     * @returns {{ comment_count?: number, reply_count?: number, like_count: number, liked_by_me: boolean, my_like_id: (string|undefined) }}
     */
    summarize(parent_id?: string): {
        comment_count?: number;
        reply_count?: number;
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
     * Construct the PubSub `<item>` for a new comment (XEP-0277 § Adding a Comment).
     * an Atom entry carrying the commenter's `<author>` and text.
     * The `<author><uri>` lets readers run the XEP-0277 § Comment Author check
     * (see {@link PubSubMessage.getAuthorMismatch}).
     * @param {import('./types').PubSubCommentAttrs} attrs
     * @returns {import('strophe.js').Stanza}
     */
    createCommentStanza(attrs: import("./types").PubSubCommentAttrs): import("strophe.js").Stanza;
}
import PubSubFeed from './feed.js';
//# sourceMappingURL=comment-feed.d.ts.map