import { api } from "@converse/headless";
import { blockContact, removeContact, unblockContact } from 'plugins/rosterview/utils.js';
import BaseModal from "plugins/modal/modal.js";
import { __ } from 'i18n';
import { tplUserDetailsModal } from "./templates/user-details.js";

import './styles/user-details.scss';


export default class UserDetailsModal extends BaseModal {

    constructor (options) {
        super(options);
        this.tab = 'profile';
    }

    initialize () {
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

        this.model.rosterContactAdded.then(() => this.registerContactEventHandlers());

        if (this.model.contact !== undefined) {
            this.registerContactEventHandlers();
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

    renderModal () {
        return tplUserDetailsModal(this);
    }

    getModalTitle () {
        return this.model.getDisplayName();
    }

    registerContactEventHandlers () {
        this.listenTo(this.model.contact, 'change', () => this.requestUpdate());
        this.listenTo(this.model.contact.vcard, 'change', () => this.requestUpdate());
        this.model.contact.on('destroy', () => {
            delete this.model.contact;
            this.close();
        });

        // Refresh the vcard
        api.vcard.update(this.model.contact.vcard, true);
    }

    /**
     * @param {MouseEvent} ev
     */
    async updateContact(ev) {
        ev?.preventDefault?.();
        const form = /** @type {HTMLFormElement} */ (ev.target);
        const data = new FormData(form);
        const name = /** @type {string} */ (data.get("name") || "").trim();
        const groups = /** @type {string} */(data.get('groups'))?.split(',').map((g) => g.trim()) || [];
        this.model.contact.save({
            nickname: name,
            groups,
        });
        this.modal.hide();
    }

    /**
     * @param {MouseEvent} ev
     */
    async removeContact (ev) {
        ev?.preventDefault?.();
        setTimeout(() => removeContact(this.model.contact), 1);
        this.modal.hide();
    }

    /**
     * @param {MouseEvent} ev
     */
    async blockContact(ev) {
        ev?.preventDefault?.();
        setTimeout(() => blockContact(this.model.contact), 1);
        this.modal.hide();
    }

    /**
     * @param {MouseEvent} ev
     */
    async unblockContact(ev) {
        ev?.preventDefault?.();
        setTimeout(() => unblockContact(this.model.contact), 1);
        this.modal.hide();
    }
}

api.elements.define('converse-user-details-modal', UserDetailsModal);
