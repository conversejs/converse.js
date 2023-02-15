import BaseModal from "plugins/modal/modal.js";
import tplOccupantModal from "./templates/occupant.js";
import { _converse, api } from "@converse/headless/core";
import { Model } from '@converse/skeletor/src/model.js';

export default class OccupantModal extends BaseModal {

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
        if (jid) {
            api.modal.show('converse-add-contact-modal', {'model': new Model({ jid })});
        }
    }
}

api.elements.define('converse-muc-occupant-modal', OccupantModal);
