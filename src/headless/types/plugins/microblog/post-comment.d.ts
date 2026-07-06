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
}
import PubSubMessage from './message.js';
//# sourceMappingURL=post-comment.d.ts.map