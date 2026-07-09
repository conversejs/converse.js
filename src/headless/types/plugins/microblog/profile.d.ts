export default MicroblogProfile;
/**
 * A microblog author's profile: the person behind a feed (their avatar, display
 * name and colour), independent of whether they've posted or are a roster
 * contact. Backs the Social app's profile-view header.
 *
 * It's the same vCard/contact/colour-aware composition a {@link PubSubMessage}
 * uses, minus the post scaffolding, so the header resolves an author's avatar
 * from the vCard cache exactly like a timeline post does — non-contacts
 * included (see {@link getVCardJID}). It is *not* persisted: the feed and the
 * vCard cache are the sources of truth; this is a transient view model.
 *
 * @extends {Model}
 */
declare class MicroblogProfile extends Model<import("@converse/skeletor").ModelAttributes> {
    /**
     * Get (creating + caching if necessary) the {@link MicroblogProfile} for an
     * author's bare JID.
     * @param {string} jid
     * @returns {MicroblogProfile}
     */
    static getProfile(jid: string): MicroblogProfile;
    /**
     * Drop every cached profile and its listeners (on logout / session clear).
     */
    static clearProfiles(): void;
    /**
     * Extract a banner image URL from a `urn:xmpp:movim-banner:0` item. Movim stores
     * the banner in the XEP-0084 avatar-metadata format *by reference*:
     * `<metadata xmlns="urn:xmpp:avatar:metadata"><info url="…"/></metadata>`.
     *
     * The URL is author-controlled and ends up as an `<img src>`, so only an
     * absolute `http(s)` URL is accepted.
     * @param {Element} [item]
     * @returns {string|null}
     */
    static parseBannerUrl(item?: Element): string | null;
    constructor(attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
    initialize(): void;
    /**
     * The bare JID whose vCard represents this author, so the avatar resolves
     * from the vCard cache like a post's does (see {@link getVCardForModel}).
     * @returns {string|undefined}
     */
    getVCardJID(): string | undefined;
    /**
     * The author's display name: the roster nickname wins (set by
     * {@link setModelContact}), then the vCard's name, and only then the bare
     * JID as a last resort.
     * @returns {string}
     */
    getDisplayName(): string;
    /**
     * Fetch the author's profile banner (a wide header image) from their
     * `urn:xmpp:movim-banner:0` PEP node and, if present, set `banner_url` so the
     * profile header renders it. Best-effort and reactive: absence, an
     * unreadable node (a presence-restricted banner, like the feed itself), or a
     * malformed item simply leaves the header banner-less.
     *
     * Deduplicated and cached for the model's lifetime: the profile model is
     * reused across profile-view opens, so this fetches at most once per author
     * per session.
     * @returns {Promise<void>}
     */
    fetchBanner(): Promise<void>;
    #private;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=profile.d.ts.map