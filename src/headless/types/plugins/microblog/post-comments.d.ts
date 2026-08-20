export default PostComments;
/**
 * The collection of {@link PostComment}s in one post's comment thread (a
 * {@link CommentFeed}). Identical to {@link PubSubMessages} but for its element
 * type, so a thread's items carry comment-only behaviour (`isLike`) that timeline
 * posts don't.
 *
 * @extends {PubSubMessages}
 */
declare class PostComments extends PubSubMessages {
    get model(): typeof PostComment;
}
import PubSubMessages from './messages.js';
import PostComment from './post-comment.js';
//# sourceMappingURL=post-comments.d.ts.map