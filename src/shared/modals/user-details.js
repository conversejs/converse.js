import { api } from "@converse/headless";
import { blockContact, removeContact, unblockContact } from 'plugins/rosterview/utils.js';
import BaseModal from "plugins/modal/modal.js";
import { __ } from 'i18n';
import { tplUserDetailsModal } from "./templates/user-details.js";

import './styles/user-details.scss';


export default class UserDetailsModal extends BaseModal {

    initialize () {
        super.initialize();
        this.model.rosterContactAdded.then(() => {
            this.registerContactEventHandlers();
            api.vcard.update(this.model.contact.vcard, true);
        });
        this.listenTo(this.model, 'change', this.render);

        if (this.model.contact !== undefined) {
            this.registerContactEventHandlers();
            // Refresh the vcard
            api.vcard.update(this.model.contact.vcard, true);
        }

        /**
         * Triggered once the UserDetailsModal has been initialized
         * @event _converse#userDetailsModalInitialized
         * @type {import('@converse/headless').ChatBox}
         * @example _converse.api.listen.on('userDetailsModalInitialized', (chatbox) => { ... });
         */
        api.trigger('userDetailsModalInitialized', this.model);
    }

    renderModal () {
        return tplUserDetailsModal(this);
    }

    getModalTitle () {
        return this.model.getDisplayName();
    }

    registerContactEventHandlers () {
        this.listenTo(this.model.contact, 'change', this.render);
        this.listenTo(this.model.contact.vcard, 'change', this.render);
        this.model.contact.on('destroy', () => {
            delete this.model.contact;
            this.render();
        });

        // Refresh the vcard
        api.vcard.update(this.model.contact.vcard, true);
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
