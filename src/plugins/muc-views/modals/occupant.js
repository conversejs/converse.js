import BaseModal from "plugins/modal/modal.js";
import tpl_occupant_modal from "./templates/occupant.js";
import { _converse, api } from "@converse/headless/core";


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
        const model = this.model ?? this.message;
        const jid = model?.get('jid');
        const vcard = this.getVcard();
        const nick = model.get('nick');
        const occupant_id = model.get('occupant_id');
        const role = this.model?.get('role');
        const affiliation = this.model?.get('affiliation');
        const hats = this.model?.get('hats')?.length ? this.model.get('hats') : null;
        return tpl_occupant_modal({ jid, vcard, nick, occupant_id, role, affiliation, hats });
    }

    getModalTitle () { // eslint-disable-line class-methods-use-this
        const model = this.model ?? this.message;
        return model?.getDisplayName();
    }
}

api.elements.define('converse-muc-occupant-modal', OccupantModal);
