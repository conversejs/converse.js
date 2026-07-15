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
     * The bare JID of the account that *reposted* this post into the feed (the
     * server-stamped publisher). This is distinct from {@link getAuthorJID},
     * which — for a repost — names the *original* author. Returns undefined when
     * the post isn't a repost.
     * @returns {string|undefined}
     */
    getReposterJID(): string | undefined;
    /**
     * The reposter's cached vCard (or null), resolved lazily by
     * {@link setReposter}. Used only to put a name on the "… reposted" line.
     * @returns {import('../vcard/vcard').default|null}
     */
    get reposterVCard(): import("../vcard/vcard").default;
    /**
     * Resolve the reposter's vCard from the cache
     * No-op for non-reposts and for our own reposts (which are labeled "you").
     * @returns {Promise<void>}
     */
    setReposter(): Promise<void>;
    _reposter_vcard: any;
    /**
     * The reposter's display name from their vCard, falling back to their bare
     * JID. Only meaningful for a repost that isn't our own.
     * @returns {string|undefined}
     */
    getReposterName(): string | undefined;
    /**
     * Give the author a human name even when the post carries no Atom `<author><name>`.
     * @returns {Promise<void>}
     */
    setAuthorName(): Promise<void>;
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
     * for a repost, otherwise the publisher). The entry's own `<author>` wins
     * over the via link: the via href is a *location* — for a post reposted off
     * a community node that's the node's service JID, not a person.
     * @returns {string|undefined}
     */
    getAuthorJID(): string | undefined;
    /**
     * The community/topic feed this post arrived through, when that feed is a
     * thing distinct from its author. Null for an ordinary personal-microblog
     * post and for comment items.
     *
     * `title` is the human label we follow the feed by (from the XEP-0330 list),
     * falling back to the raw node id for a feed we're only browsing.
     * @returns {{ jid: string, node: string, title: string }|null}
     */
    getSourceFeed(): {
        jid: string;
        node: string;
        title: string;
    } | null;
    /**
     * Colour the post by its *displayed* author, so every post from the same
     * author shares a colour and the name colour matches the avatar. Overrides
     * {@link ColorAwareModel}'s default, which would key on `from` — the
     * *reposter* for a repost, not the original author shown in the header.
     * @returns {string}
     */
    getIdentifier(): string;
    /**
     * The PubSub node holding this post's comments. Uses the node advertised
     * by the post's `rel="replies"` link, else derives the conventional per-post
     * node `urn:xmpp:microblog:0:comments/<post-id>`.
     * @returns {string}
     */
    getCommentsNode(): string;
    /**
     * The JID of the PubSub service hosting this post's comments node. The
     * comments link MAY point at a dedicated pubsub component; absent that, the
     * node lives on the post author's PEP service (their bare JID).
     * @returns {string|undefined}
     */
    getCommentsService(): string | undefined;
    /**
     * XEP-0277 § Comment Author security check: the (spoofable) `<author><uri>`
     * should match the server-stamped `publisher`. Returns true only when both
     * are known *and* disagree — a genuine impersonation signal for the UI.
     *
     * The XEP suggests also flagging when `publisher` is absent, but many
     * servers (e.g. Prosody) simply omit it from retrieve-items responses, so
     * flagging every backfilled comment would cry wolf. We treat "can't verify"
     * as unflagged rather than suspicious.
     * @returns {boolean}
     */
    getAuthorMismatch(): boolean;
}
import BaseMessage from '../../shared/message.js';
//# sourceMappingURL=message.d.ts.map