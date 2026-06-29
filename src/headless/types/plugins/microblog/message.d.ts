export default PubSubMessage;
/**
 * Represents a single microblog post (a parsed Atom entry).
 * Extends {@link BaseMessage} to inherit vCard/contact/colour awareness.
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
     * Resolve the post's author to an *existing* roster contact (or our own
     * profile for own posts) and expose it as `this.contact`. Unlike chat
     * messages we pass `create: false` since a social feed may have many authors
     * who aren't contacts, and we don't want to inject them into the roster.
     * The author avatar is rendered from the vCard cache regardless
     * (see {@link getVCardJID}).
     * @returns {Promise<void>}
     */
    setContact(): Promise<void>;
    /**
     * The bare JID whose vCard represents this post's author. Consulted by
     * {@link getVCardForModel} so a post resolves its avatar from the vCard cache
     * (never the roster) — authors who aren't contacts still show an avatar.
     * @returns {string|undefined}
     */
    getVCardJID(): string | undefined;
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