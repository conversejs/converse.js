import { _converse, api, log } from '@converse/headless';
import { ObservableElement } from 'shared/components/observable.js';
import tplRequestingContact from './templates/requesting_contact.js';
import tplRosterItem from './templates/roster_item.js';
import tplUnsavedContact from './templates/unsaved_contact.js';
import { __ } from 'i18n';
import { blockContact, declineContactRequest, removeContact } from './utils.js';

export default class RosterContactView extends ObservableElement {
    /**
     * @typedef {import('shared/components/types').ObservableProperty} ObservableProperty
     */

    constructor() {
        super();
        this.model = null;
        /** Whether this contact advertises a XEP-0472 social feed (resolved async). */
        this.can_follow = false;
        this.observable = /** @type {ObservableProperty} */ ('once');
    }

    static get properties() {
        return {
            ...super.properties,
            model: { type: Object },
        };
    }

    initialize() {
        this.listenTo(this.model, 'change', () => this.requestUpdate());
        this.listenTo(this.model, 'highlight', () => this.requestUpdate());
        this.listenTo(this.model, 'vcard:add', () => this.requestUpdate());
        this.listenTo(this.model, 'vcard:change', () => this.requestUpdate());
        this.listenTo(this.model, 'presence:change', () => this.requestUpdate());
        this.updateFollowable();
    }

    /**
     * Resolve (asynchronously, via cached disco/caps) whether this contact has a
     * social feed that can be followed, then re-render so the Follow toggle
     * appears once known.
     */
    async updateFollowable() {
        const jid = this.model?.get('jid');
        if (!jid || !api.microblog) return;
        try {
            const can_follow = await api.microblog.canFollow(jid);
            if (can_follow !== this.can_follow) {
                this.can_follow = can_follow;
                this.requestUpdate();
            }
        } catch (e) {
            log.error(e);
        }
    }

    /**
     * Follow or unfollow this contact's social feed (XEP-0277/0472 over
     * XEP-0330), toggling on the current follow state.
     * @param {MouseEvent} ev
     */
    async toggleFollow(ev) {
        ev?.preventDefault?.();
        const jid = this.model.get('jid');
        if (api.microblog.isFollowing(jid)) {
            await api.microblog.unfollow(jid);
        } else {
            await api.microblog.follow(jid);
        }
        this.requestUpdate();
    }

    render() {
        if (this.model instanceof _converse.exports.RosterContact) {
            if (this.model.get('requesting') === true) {
                return tplRequestingContact(this);
            } else if (!this.model.get('subscription')) {
                return tplUnsavedContact(this);
            }
        }
        return tplRosterItem(this);
    }

    /**
     * @param {MouseEvent} ev
     */
    openChat(ev) {
        ev?.preventDefault?.();
        api.chats.open(this.model.get('jid'), {}, true);
    }

    /**
     * @param {MouseEvent} ev
     */
    addContact(ev) {
        ev?.preventDefault?.();
        api.modal.show('converse-add-contact-modal', { contact: this.model }, ev);
    }

    /**
     * @param {MouseEvent} ev
     */
    async removeContact(ev) {
        ev?.preventDefault?.();
        await removeContact(this.model, true);
    }

    /**
     * @param {MouseEvent} ev
     */
    async showUserDetailsModal(ev) {
        ev?.preventDefault?.();
        ev.preventDefault();
        if (this.model instanceof _converse.exports.Profile) {
            api.modal.show('converse-profile-modal', { model: this.model }, ev);
        } else {
            api.modal.show('converse-user-details-modal', { model: this.model }, ev);
        }
    }

    /**
     * @param {MouseEvent} ev
     */
    async blockContact(ev) {
        ev?.preventDefault?.();
        await blockContact(this.model);
    }

    /**
     * @param {MouseEvent} ev
     */
    async acceptRequest(ev) {
        ev?.preventDefault?.();
        api.modal.show('converse-accept-contact-request-modal', { contact: this.model }, ev);
    }

    /**
     * @param {MouseEvent} ev
     */
    async declineRequest(ev) {
        ev?.preventDefault?.();
        declineContactRequest(this.model);
    }
}

api.elements.define('converse-roster-contact', RosterContactView);
