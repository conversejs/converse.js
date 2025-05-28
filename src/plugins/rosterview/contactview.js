import { _converse, api } from '@converse/headless';
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
