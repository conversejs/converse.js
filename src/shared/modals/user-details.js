import { api, _converse } from '@converse/headless';
import { blockContact, declineContactRequest, removeContact, unblockContact } from 'plugins/rosterview/utils.js';
import BaseModal from 'plugins/modal/modal.js';
import { __ } from 'i18n';
import { tplUserDetailsModal } from './templates/user-details.js';

import './styles/user-details.scss';

export default class UserDetailsModal extends BaseModal {
    constructor(options) {
        super(options);
        this.tab = 'profile';
    }

    initialize() {
        super.initialize();
        this.addListeners();
        /**
         * Triggered once the UserDetailsModal has been initialized
         * @event _converse#userDetailsModalInitialized
         * @type {import('@converse/headless').ChatBox}
         * @example _converse.api.listen.on('userDetailsModalInitialized', (chatbox) => { ... });
         */
        api.trigger('userDetailsModalInitialized', this.model);
    }

    addListeners() {
        this.listenTo(this.model, 'change', () => this.requestUpdate());

        if (this.model instanceof _converse.exports.ChatBox) {
            this.model.rosterContactAdded.then(() => this.registerContactEventHandlers(this.model.contact));
            if (this.model.contact !== undefined) {
                this.registerContactEventHandlers(this.model.contact);
            }
        } else {
            this.registerContactEventHandlers(this.model);
        }
    }

    getContact() {
        if (this.model instanceof _converse.exports.ChatBox) {
            return this.model.contact;
        } else {
            return this.model;
        }
    }

    /**
     * @param {Map<string, any>} changed
     */
    shouldUpdate(changed) {
        if (changed.has('model') && this.model) {
            this.stopListening();
            this.addListeners();
            this.tab = 'profile';
            this.requestUpdate();
        }
        return true;
    }

    renderModal() {
        return tplUserDetailsModal(this);
    }

    getModalTitle() {
        return this.model.getDisplayName();
    }

    /**
     * @param {import('@converse/headless/types/plugins/roster/contact').default} contact
     */
    registerContactEventHandlers(contact) {
        this.listenTo(contact, 'change', () => this.requestUpdate());
        this.listenTo(contact, 'destroy', () => this.close());
        this.listenTo(contact.vcard, 'change', () => this.requestUpdate());
        if (contact.vcard) {
            // Refresh the vcard
            api.vcard.update(contact.vcard, true);
        }
    }

    /**
     * @param {MouseEvent} ev
     */
    async addContact(ev) {
        ev?.preventDefault?.();
        this.modal.hide();
        api.modal.show('converse-add-contact-modal', { contact: this.model }, ev);
    }

    /**
     * @param {MouseEvent} ev
     */
    async updateContact(ev) {
        ev?.preventDefault?.();
        const form = /** @type {HTMLFormElement} */ (ev.target);
        const data = new FormData(form);
        const name = /** @type {string} */ (data.get('name') || '').trim();
        const groups = /** @type {string} */ (data.get('groups'))?.split(',').map((g) => g.trim()) || [];
        this.getContact().update({
            nickname: name,
            groups,
        });
        this.modal.hide();
    }

    /**
     * @param {MouseEvent} ev
     */
    async removeContact(ev) {
        ev?.preventDefault?.();
        setTimeout(() => removeContact(this.getContact()), 1);
        this.modal.hide();
    }

    /**
     * @param {MouseEvent} ev
     */
    async blockContact(ev) {
        ev?.preventDefault?.();
        setTimeout(() => blockContact(this.getContact()), 1);
        this.modal.hide();
    }

    /**
     * @param {MouseEvent} ev
     */
    async unblockContact(ev) {
        ev?.preventDefault?.();
        setTimeout(() => unblockContact(this.getContact()), 1);
        this.modal.hide();
    }

    /**
     * @param {MouseEvent} ev
     */
    async acceptContactRequest(ev) {
        ev?.preventDefault?.();
        setTimeout(() => {
            api.modal.show(
                'converse-accept-contact-request-modal',
                { contact: this.getContact() },
                ev
            );
        });
        this.modal.hide();
    }

    /**
     * @param {MouseEvent} ev
     */
    async declineContactRequest(ev) {
        ev?.preventDefault?.();
        setTimeout(() => declineContactRequest(this.getContact()));
        this.modal.hide();
    }
}

api.elements.define('converse-user-details-modal', UserDetailsModal);
