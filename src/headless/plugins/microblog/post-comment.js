/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import PubSubMessage from './message.js';
import { LIKE_MARKER } from './constants.js';

/**
 * @extends {PubSubMessage}
 */
class PostComment extends PubSubMessage {
    /**
     * Whether this comment is a "like": a ♥-comment (XEP-0277 convention) whose
     * entry text is exactly the heart marker. Likes ride the comments node, so a
     * single fetch of the node yields both comments and likes.
     * @returns {boolean}
     */
    isLike() {
        return this.get('title') === LIKE_MARKER;
    }
}

export default PostComment;
