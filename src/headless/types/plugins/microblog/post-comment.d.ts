export default PostComment;
/**
 * @extends {PubSubMessage}
 */
declare class PostComment extends PubSubMessage {
    /**
     * Whether this comment is a "like": a ♥-comment (XEP-0277 convention) whose
     * entry text is exactly the heart marker. Likes ride the comments node, so a
     * single fetch of the node yields both comments and likes.
     * @returns {boolean}
     */
    isLike(): boolean;
    /**
     * The `{ jid, node }` of a *dedicated* comments node this comment advertises
     * for its own replies, or null. This is the Libervia ActivityPub-gateway model
     * (a comments node per comment).
     * @returns {{ jid: string, node: string }|null}
     */
    getRepliesRef(): {
        jid: string;
        node: string;
    } | null;
}
import PubSubMessage from './message.js';
//# sourceMappingURL=post-comment.d.ts.map