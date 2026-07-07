/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { Model } from '@converse/skeletor';
import { Strophe } from 'strophe.js';
import ColorAwareModel from '../../shared/color.js';
import ModelWithContact from '../../shared/model-with-contact.js';
import ModelWithVCard from '../../shared/model-with-vcard.js';

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
class MicroblogProfile extends ModelWithVCard(ModelWithContact(ColorAwareModel(Model))) {
    get idAttribute() {
        return 'jid';
    }

    initialize() {
        super.initialize();
        // Resolve to an *existing* roster contact (or our own profile) so its
        // nickname wins for the display name, but never inject the author into
        // the roster — a feed's authors aren't necessarily contacts.
        this.setModelContact(this.get('jid'), { create: false });
    }

    /**
     * The bare JID whose vCard represents this author, so the avatar resolves
     * from the vCard cache like a post's does (see {@link getVCardForModel}).
     * @returns {string|undefined}
     */
    getVCardJID() {
        return this.get('jid');
    }

    /**
     * The author's display name: the roster nickname wins (set by
     * {@link setModelContact}), then the vCard's name, and only then the bare
     * JID as a last resort.
     * @returns {string}
     */
    getDisplayName() {
        return this.get('nickname') || this.vcard?.getDisplayName?.() || this.get('jid');
    }
}

// One profile model per author, reused across profile-view opens: the model
// registers a long-lived listener on the (cached) vCard, so re-creating it on
// every open would leak. Cleared on logout via {@link clearProfiles}.
const profiles = new Map();

/**
 * Get (creating + caching if necessary) the {@link MicroblogProfile} for an
 * author's bare JID.
 * @param {string} jid
 * @returns {MicroblogProfile}
 */
export function getProfile(jid) {
    const bare_jid = Strophe.getBareJidFromJid(jid);
    let profile = profiles.get(bare_jid);
    if (!profile) {
        profile = new MicroblogProfile({ jid: bare_jid });
        profiles.set(bare_jid, profile);
    }
    return profile;
}

/**
 * Drop every cached profile and its listeners (on logout / session clear).
 */
export function clearProfiles() {
    profiles.forEach((profile) => profile.stopListening());
    profiles.clear();
}

export default MicroblogProfile;
