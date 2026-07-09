/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import sizzle from 'sizzle';
import { Model } from '@converse/skeletor';
import { Strophe } from 'strophe.js';
import log from '@converse/log';
import api from '../../shared/api/index.js';
import ColorAwareModel from '../../shared/color.js';
import ModelWithContact from '../../shared/model-with-contact.js';
import ModelWithVCard from '../../shared/model-with-vcard.js';
import { BANNER_FETCH_TIMEOUT, MOVIM_BANNER_NODE } from './constants.js';

// One profile model per author, reused across profile-view opens: the model
// registers a long-lived listener on the (cached) vCard, so re-creating it on
// every open would leak. Cleared on logout via {@link clearProfiles}.
const profiles = new Map();

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
     * Get (creating + caching if necessary) the {@link MicroblogProfile} for an
     * author's bare JID.
     * @param {string} jid
     * @returns {MicroblogProfile}
     */
    static getProfile(jid) {
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
    static clearProfiles() {
        profiles.forEach((profile) => profile.stopListening());
        profiles.clear();
    }

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
    static parseBannerUrl(item) {
        if (!item) return null;

        const info = sizzle(`> metadata[xmlns="${Strophe.NS.AVATAR_METADATA}"] > info`, item).pop();
        const url = info?.getAttribute('url')?.trim();
        if (!url) return null;

        try {
            const { protocol } = new URL(url);
            if (protocol === 'https:' || protocol === 'http:') return url;
        } catch {
            // Not a valid absolute URL.
        }
        return null;
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
    fetchBanner() {
        this._banner_promise ??= this.#fetchBanner();
        return this._banner_promise;
    }

    async #fetchBanner() {
        try {
            const { items } = await api.pubsub.items.get(this.get('jid'), MOVIM_BANNER_NODE, {
                max_items: 1,
                timeout: BANNER_FETCH_TIMEOUT,
            });
            const url = MicroblogProfile.parseBannerUrl(items?.[0]);
            if (url) this.set('banner_url', url);
        } catch (e) {
            log.debug(`MicroblogProfile.fetchBanner: no banner for ${this.get('jid')}: ${e}`);
        }
    }
}

export default MicroblogProfile;
