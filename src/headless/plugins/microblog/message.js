/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { Strophe } from 'strophe.js';
import _converse from '../../shared/_converse.js';
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
                deps: ['author_name', 'author_jid', 'publisher', 'from'],
                fn: (m) => m.get('author_name') || m.get('author_jid') || m.get('publisher') || m.get('from') || '',
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
}

export default PubSubMessage;
