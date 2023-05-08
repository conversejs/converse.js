import BaseModal from 'plugins/modal/modal.js';
import log from '@converse/headless/log';
import { tplUserDetailsModal, tplFooter } from './templates/edit-user-details.js';
import { __ } from 'i18n';
import { api, converse } from '@converse/headless/core';

const u = converse.env.utils;

export default class EditUserDetailsModal extends BaseModal {
    initialize() {
        super.initialize();
        this.model.rosterContactAdded.then(() => this.registerContactEventHandlers());
        this.listenTo(this.model, 'change', this.render);
        this.registerContactEventHandlers();
        /**
         * Triggered once the UserDetailsModal has been initialized
         * @event _converse#userDetailsModalInitialized
         * @type { _converse.ChatBox }
         * @example _converse.api.listen.on('userDetailsModalInitialized', (chatbox) => { ... });
         */
        api.trigger('userDetailsModalInitialized', this.model);
    }

    renderModal() {
        return tplUserDetailsModal(this);
    }

    renderModalFooter() {
        return tplFooter(this);
    }

    getModalTitle() {
        return this.model.getDisplayName();
    }

    registerContactEventHandlers() {
        if (this.model.contact !== undefined) {
            this.listenTo(this.model.contact, 'change', this.render);
            this.listenTo(this.model.contact.vcard, 'change', this.render);
            this.model.contact.on('destroy', () => {
                delete this.model.contact;
                this.render();
            });
        }
    }

    afterSubmission(_form, jid, name, group) {
        if (group && !Array.isArray(group)) {
            group = [group];
        }
        _converse.roster.sendContactAddIQ(jid, name, group);
        this.modal.hide();
    }

    applyContactChanges(ev) {
        ev.preventDefault();
        const data = new FormData(ev.target);
        this.afterSubmission(ev.target, this.model.contact.vcard.attributes.jid, data.get('name'), data.get('group'));
    }
}
api.elements.define('converse-edit-user-details-modal', EditUserDetailsModal);
