import BaseModal from "plugins/modal/modal.js";
import tplMUCDetails from "./templates/muc-details.js";
import { __ } from 'i18n';
import { api } from "@converse/headless";

import '../styles/muc-details-modal.scss';


export default class MUCDetailsModal extends BaseModal {

    initialize () {
        super.initialize();
        this.listenTo(this.model, 'change', () => this.render());
        this.listenTo(this.model.features, 'change', () => this.render());
        this.listenTo(this.model.occupants, 'add', () => this.render());
        this.listenTo(this.model.occupants, 'change', () => this.render());
    }

    renderModal () {
        return tplMUCDetails(this.model);
    }

    getModalTitle () {
        return __('Groupchat info');
    }

}

api.elements.define('converse-muc-details-modal', MUCDetailsModal);
