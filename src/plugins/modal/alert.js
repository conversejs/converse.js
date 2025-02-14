import BaseModal from "plugins/modal/modal.js";
import tplAlertModal from "./templates/alert.js";
import { api } from "@converse/headless";


export default class Alert extends BaseModal {

    initialize () {
        super.initialize();
        this.listenTo(this.model, 'change', () => this.requestUpdate())
        this.addEventListener('hide.bs.modal', () => this.remove(), false);
    }

    renderModal () {
        return tplAlertModal(this.model.toJSON());
    }

    getModalTitle () {
        return this.model.get('title');
    }
}

api.elements.define('converse-alert-modal', Alert);
