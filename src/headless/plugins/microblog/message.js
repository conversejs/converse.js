/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { Strophe } from 'strophe.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import BaseMessage from '../../shared/message.js';
import { MICROBLOG_TYPE } from './constants.js';

/**
 * Represents a single microblog post (a parsed Atom entry).
 * Extends {@link BaseMessage} to inherit vCard/contact/colour awareness.
 * @extends {BaseMessage}
 */
class PubSubMessage extends BaseMessage {
    defaults() {
        return Object.assign(super.defaults(), {
            type: MICROBLOG_TYPE,
        });
    }

    initialize() {
        super.initialize();
        this.setContact();
        this.setReposter();
        this.setAuthorName();
    }

    /**
     * Resolve the post's author to an *existing* roster contact (or our own
     * profile for own posts) and expose it as `this.contact`. Unlike chat
     * messages we pass `create: false` since a social feed may have many authors
     * who aren't contacts, and we don't want to inject them into the roster.
     * The author avatar is rendered from the vCard cache regardless
     * (see {@link getVCardJID}).
     * @returns {Promise<void>}
     */
    async setContact() {
        const jid = this.getAuthorJID();
        if (jid) await this.setModelContact(Strophe.getBareJidFromJid(jid), { create: false });
    }

    /**
     * The bare JID whose vCard represents this post's author. Consulted by
     * {@link getVCardForModel} so a post resolves its avatar from the vCard cache
     * (never the roster) — authors who aren't contacts still show an avatar.
     * @returns {string|undefined}
     */
    getVCardJID() {
        const jid = this.getAuthorJID();
        return jid ? Strophe.getBareJidFromJid(jid) : undefined;
    }

    /**
     * The bare JID of the account that *reposted* this post into the feed (the
     * server-stamped publisher). This is distinct from {@link getAuthorJID},
     * which — for a repost — names the *original* author. Returns undefined when
     * the post isn't a repost.
     * @returns {string|undefined}
     */
    getReposterJID() {
        if (!this.get('is_repost')) return undefined;
        const jid = this.get('publisher') || this.get('from');
        return jid ? Strophe.getBareJidFromJid(jid) : undefined;
    }

    /**
     * The reposter's cached vCard (or null), resolved lazily by
     * {@link setReposter}. Used only to put a name on the "… reposted" line.
     * @returns {import('../vcard/vcard').default|null}
     */
    get reposterVCard() {
        return this._reposter_vcard ?? null;
    }

    /**
     * Resolve the reposter's vCard from the cache
     * No-op for non-reposts and for our own reposts (which are labeled "you").
     * @returns {Promise<void>}
     */
    async setReposter() {
        if (this.get('is_mine')) return;
        const jid = this.getReposterJID();
        if (!jid) return;
        await api.waitUntil('VCardsInitialized');
        const { vcards } = _converse.state;
        const vcard = vcards.get(jid) || vcards.create({ jid }, { lazy_load: true });
        this._reposter_vcard = vcard;
        vcard?.on('change', () => this.trigger('vcard:change'));
        this.trigger('vcard:change');
    }

    /**
     * The reposter's display name from their vCard, falling back to their bare
     * JID. Only meaningful for a repost that isn't our own.
     * @returns {string|undefined}
     */
    getReposterName() {
        const jid = this.getReposterJID();
        if (!jid) return undefined;
        return this._reposter_vcard?.getDisplayName() || jid;
    }

    /**
     * Give the author a human name even when the post carries no Atom `<author><name>`.
     * @returns {Promise<void>}
     */
    async setAuthorName() {
        const vcard = await this.getVCard();
        if (!vcard) return;
        const sync = () => {
            if (this.contact) return; // a roster contact's nickname wins
            const name = vcard.get('nickname') || vcard.get('fullname');
            if (name) this.set('nickname', name);
        };
        sync();
        this.listenTo(vcard, 'change', sync);
    }

    /**
     * Persist each post to the collection's store as an offline cache. The
     * PubSub node stays the source of truth; this just avoids an empty feed on
     * reload before the server responds.
     */
    get autoSync() {
        return true;
    }

    /**
     * Derived display values, recomputed automatically when their deps change.
     * @returns {import('@converse/skeletor').ComputedProperties<this>}
     */
    get computed() {
        return {
            displayName: {
                deps: ['author_name', 'nickname', 'author_jid', 'publisher', 'from'],
                // Prefer the post's self-declared author name, then the resolved
                // contact/vCard nickname, and only fall back to the bare JID when
                // no human name is known (see setAuthorName / setModelContact).
                fn: (m) =>
                    m.get('author_name') ||
                    m.get('nickname') ||
                    m.get('author_jid') ||
                    m.get('publisher') ||
                    m.get('from') ||
                    '',
            },
            // Whether the logged-in user published this post (replaces the legacy
            // `sender: 'me'|'them'` flag). Authorship is the publisher's, not the
            // atom:author's, which for a repost is the *original* author.
            is_mine: {
                deps: ['publisher', 'from'],
                fn: (m) => {
                    const jid = m.get('publisher') || m.get('from');
                    const bare_jid = _converse.session?.get('bare_jid');
                    return !!jid && !!bare_jid && Strophe.getBareJidFromJid(jid) === bare_jid;
                },
            },
        };
    }

    /**
     * @returns {string}
     */
    getDisplayName() {
        return this.get('displayName');
    }

    /**
     * The author whose feed/JID this post is attributed to (the original author
     * for a repost, otherwise the publisher).
     * @returns {string|undefined}
     */
    getAuthorJID() {
        return this.get('via_jid') || this.get('author_jid') || this.get('publisher') || this.get('from');
    }

    /**
     * Colour the post by its *displayed* author, so every post from the same
     * author shares a colour and the name colour matches the avatar. Overrides
     * {@link ColorAwareModel}'s default, which would key on `from` — the
     * *reposter* for a repost, not the original author shown in the header.
     * @returns {string}
     */
    getIdentifier() {
        return this.getAuthorJID() || super.getIdentifier();
    }
}

export default PubSubMessage;
