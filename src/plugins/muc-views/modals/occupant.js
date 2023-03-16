import BaseModal from "plugins/modal/modal.js";
import tplOccupantModal from "./templates/occupant.js";
import { Model } from '@converse/skeletor/src/model.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";

const { u } = converse.env;

export default class OccupantModal extends BaseModal {

    constructor () {
        super();
        this.addEventListener("affiliationChanged", () => this.alert(__('Affiliation changed')));
        this.addEventListener("roleChanged", () => this.alert(__('role changed')));
    }

    initialize () {
        super.initialize()
        const model = this.model ?? this.message;
        this.listenTo(model, 'change', () => this.render());
        /**
         * Triggered once the OccupantModal has been initialized
         * @event _converse#occupantModalInitialized
         * @type { Object }
         * @example _converse.api.listen.on('occupantModalInitialized', data);
         */
        api.trigger('occupantModalInitialized', { 'model': this.model, 'message': this.message });
    }

    getVcard () {
        const model = this.model ?? this.message;
        if (model.vcard) {
            return model.vcard;
        }
        const jid = model?.get('jid') || model?.get('from');
        return jid ? _converse.vcards.get(jid) : null;
    }

    renderModal () {
        return tplOccupantModal(this);
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
        this.render();
    }
}

api.elements.define('converse-muc-occupant-modal', OccupantModal);
