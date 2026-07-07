/**
 * Get (creating + caching if necessary) the {@link MicroblogProfile} for an
 * author's bare JID.
 * @param {string} jid
 * @returns {MicroblogProfile}
 */
export function getProfile(jid: string): MicroblogProfile;
/**
 * Drop every cached profile and its listeners (on logout / session clear).
 */
export function clearProfiles(): void;
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
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=profile.d.ts.map