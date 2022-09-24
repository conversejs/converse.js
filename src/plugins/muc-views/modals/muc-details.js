import BaseModal from "plugins/modal/modal.js";
import tpl_muc_details from "./templates/muc-details.js";
import { __ } from 'i18n';
import { api } from "@converse/headless/core";

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
        return tpl_muc_details(this.model);
    }

    getModalTitle () { // eslint-disable-line class-methods-use-this
        return __('Groupchat info for %1$s', this.model.getDisplayName());
    }

}

api.elements.define('converse-muc-details-modal', MUCDetailsModal);
