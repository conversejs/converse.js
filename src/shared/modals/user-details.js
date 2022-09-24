import BaseModal from "plugins/modal/modal.js";
import log from "@converse/headless/log";
import { tpl_user_details_modal, tpl_footer } from "./templates/user-details.js";
import { __ } from 'i18n';
import { api, converse } from "@converse/headless/core";
import { removeContact } from 'plugins/rosterview/utils.js';

const u = converse.env.utils;


export default class UserDetailsModal extends BaseModal {

    initialize () {
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

    renderModal () {
        return tpl_user_details_modal(this);
    }

    renderModalFooter () {
        return tpl_footer(this);
    }

    getModalTitle () {
        return this.model.getDisplayName();
    }

    registerContactEventHandlers () {
        if (this.model.contact !== undefined) {
            this.listenTo(this.model.contact, 'change', this.render);
            this.listenTo(this.model.contact.vcard, 'change', this.render);
            this.model.contact.on('destroy', () => {
                delete this.model.contact;
                this.render();
            });
        }
    }

    async refreshContact (ev) {
        if (ev && ev.preventDefault) { ev.preventDefault(); }
        const refresh_icon = this.el.querySelector('.fa-refresh');
        u.addClass('fa-spin', refresh_icon);
        try {
            await api.vcard.update(this.model.contact.vcard, true);
        } catch (e) {
            log.fatal(e);
            this.alert(__('Sorry, something went wrong while trying to refresh'), 'danger');
        }
        u.removeClass('fa-spin', refresh_icon);
    }

    async removeContact (ev) {
        ev?.preventDefault?.();
        if (!api.settings.get('allow_contact_removal')) { return; }
        const result = await api.confirm(__("Are you sure you want to remove this contact?"));
        if (result) {
            // XXX: The `dismissHandler` in bootstrap.native tries to
            // reference the remove button after it's been cleared from
            // the DOM, so we delay removing the contact to give it time.
            setTimeout(() => removeContact(this.model.contact), 1);
            this.modal.hide();
        }
    }
}

api.elements.define('converse-user-details-modal', UserDetailsModal);
