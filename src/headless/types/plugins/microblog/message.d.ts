export default PubSubMessage;
/**
 * Represents a single microblog post (a parsed Atom entry).
 *
 * Extends {@link BaseMessage} to inherit vCard/contact/colour awareness (useful
 * for rendering a post's author) without the chat-specific `<message>` plumbing
 * of `ModelWithMessages`. Posts are PubSub items, published via
 * `api.pubsub.publish`, not sent as message stanzas.
 *
 * This is part of the reference adoption of the new @converse/skeletor APIs: it
 * uses `computed` for derived display values and `autoSync` to persist itself as
 * an offline cache.
 *
 * @extends {BaseMessage}
 */
declare class PubSubMessage extends BaseMessage {
    defaults(): {
        msgid: string;
        time: string;
        is_ephemeral: boolean;
    } & {
        type: string;
    };
    /**
     * Derived display values, recomputed automatically when their deps change.
     * @returns {import('@converse/skeletor').ComputedProperties<this>}
     */
    get computed(): import("@converse/skeletor").ComputedProperties<this>;
    /**
     * @returns {string}
     */
    getDisplayName(): string;
    /**
     * The author whose feed/JID this post is attributed to (the original author
     * for a repost, otherwise the publisher).
     * @returns {string|undefined}
     */
    getAuthorJID(): string | undefined;
}
import BaseMessage from '../../shared/message.js';
//# sourceMappingURL=message.d.ts.map