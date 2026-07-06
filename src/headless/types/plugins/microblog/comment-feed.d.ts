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
     * @returns {Promise<void>}
     */
    fetchComments(): Promise<void>;
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