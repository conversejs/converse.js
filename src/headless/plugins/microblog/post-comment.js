/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { Strophe } from 'strophe.js';
import PubSubMessage from './message.js';
import { LIKE_MARKER } from './constants.js';
import { isSingleEmoji } from './utils/emoji.js';

/**
 * @extends {PubSubMessage}
 */
class PostComment extends PubSubMessage {
    /**
     * The emoji this comment is a reaction with, or `null` if it is a real
     * comment. A reaction is a comment whose entry text (`<title>`) is exactly one
     * emoji (XEP-0277 convention, generalising the ♥ like). Reactions ride the
     * comments node, so a single fetch of the node yields comments and reactions.
     * @returns {string|null}
     */
    getReactionEmoji() {
        const title = this.get('title');
        return isSingleEmoji(title) ? title.trim() : null;
    }

    /**
     * Whether this comment is a reaction (any single-emoji comment) rather than a
     * real comment.
     * @returns {boolean}
     */
    isReaction() {
        return this.getReactionEmoji() !== null;
    }

    /**
     * Whether this comment is a "like": the ♥ special case of a reaction (U+2665).
     * Kept so existing like-specific code (counts, notifications) keeps working.
     * @returns {boolean}
     */
    isLike() {
        return this.getReactionEmoji() === LIKE_MARKER;
    }

    /**
     * The `{ jid, node }` of a *dedicated* comments node this comment advertises
     * for its own replies, or null. This is the Libervia ActivityPub-gateway model
     * (a comments node per comment).
     * @returns {{ jid: string, node: string }|null}
     */
    getRepliesRef() {
        const node = this.get('comments_node');
        if (!node) return null;

        const author = this.getAuthorJID();
        const jid = this.get('comments_jid') || (author ? Strophe.getBareJidFromJid(author) : undefined);
        return jid ? { jid, node } : null;
    }
}

export default PostComment;
