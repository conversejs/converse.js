import { Model } from '@converse/skeletor';
import { _converse, api, converse } from "@converse/headless";
import { __ } from 'i18n';
import BaseModal from "plugins/modal/modal.js";
import tplOccupantModal from "./templates/occupant.js";

const { u } = converse.env;

export default class OccupantModal extends BaseModal {

    constructor (options) {
        super();
        this.message = options.message;
        this.addEventListener("affiliationChanged", () => this.alert(__('Affiliation changed')));
        this.addEventListener("roleChanged", () => this.alert(__('role changed')));
    }

    initialize () {
        super.initialize()
        const model = this.model ?? this.message;
        this.listenTo(model, 'change', () => this.requestUpdate());
        /**
         * Triggered once the OccupantModal has been initialized
         * @event _converse#occupantModalInitialized
         * @type { Object }
         * @example _converse.api.listen.on('occupantModalInitialized', data);
         */
        api.trigger('occupantModalInitialized', { 'model': this.model, 'message': this.message });
    }

    renderModal () {
        return tplOccupantModal(this);
    }

    /**
     * @param {MouseEvent} ev
     */
    openChat (ev) {
        ev.preventDefault();
        api.chats.open(this.model.get('jid'), {}, true);
        this.close();
    }

    getVcard () {
        const model = this.model ?? this.message;
        if (model.vcard) {
            return model.vcard;
        }
        const jid = model?.get('jid') || model?.get('from');
        return jid ? _converse.state.vcards.get(jid) : null;
    }

    getModalTitle () {
        const model = this.model ?? this.message;
        return model?.getDisplayName();
    }

    addToContacts () {
        const model = this.model ?? this.message;
        const jid = model.get('jid');
        if (jid) api.modal.show('converse-add-contact-modal', {'model': new Model({ jid })});
    }

    toggleForm (ev) {
        const toggle = u.ancestor(ev.target, '.toggle-form');
        const form = toggle.getAttribute('data-form');

        if (form === 'row-form') {
            this.show_role_form = !this.show_role_form;
        } else {
            this.show_affiliation_form = !this.show_affiliation_form;
        }
        this.requestUpdate();
    }
}

api.elements.define('converse-muc-occupant-modal', OccupantModal);
