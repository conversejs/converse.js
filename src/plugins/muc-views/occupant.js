import { Model } from '@converse/skeletor';
import { _converse, api, converse } from "@converse/headless";
import { CustomElement } from 'shared/components/element.js';
import tplMUCOccupant from "./templates/muc-occupant.js";

const { u } = converse.env;

import './styles/muc-occupant.scss';


export default class MUCOccupant extends CustomElement {

    constructor () {
        super();
        this.muc_jid = null;
        this.occupant_id = null;
    }

    static get properties () {
        return {
            muc_jid: { type: String },
            occupant_id: { type: String }
        }
    }

    initialize() {
        super.initialize()
        const { chatboxes } = _converse.state;
        this.muc = chatboxes.get(this.muc_jid);
        this.muc.initialized.then(() => this.requestUpdate());
        this.model = this.muc.occupants.get(this.occupant_id);
    }

    render () {
        return tplMUCOccupant(this);
    }

    getVcard () {
        const model = this.model;
        if (model.vcard) {
            return model.vcard;
        }
        const jid = model?.get('jid') || model?.get('from');
        return jid ? _converse.state.vcards.get(jid) : null;
    }

    addToContacts () {
        const model = this.model;
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

api.elements.define('converse-muc-occupant', MUCOccupant);
