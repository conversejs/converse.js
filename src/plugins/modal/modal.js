/**
 * @typedef {import('lit-html').TemplateResult} TemplateResult
 */
import { getOpenPromise } from '@converse/openpromise';
import { Modal } from "bootstrap.native";
import { ElementView } from '@converse/skeletor';
import { modal_close_button } from "./templates/buttons.js";
import tplModal from './templates/modal.js';

import './styles/_modal.scss';
import {html} from 'lit-html';

class BaseModal extends ElementView {

    constructor (options) {
        super();
        this.model = null;
        this.className = 'modal fade';
        this.tabIndex = -1;
        this.ariaHidden = 'true';

        this.initialized = getOpenPromise();

        // Allow properties to be set via passed in options
        Object.assign(this, options);
        setTimeout(() => this.insertIntoDOM());
    }

    initialize () {
        this.render()
        this.modal = new Modal(this, {
            backdrop: true,
            keyboard: true
        });
        this.initialized.resolve();
    }

    /**
     * @returns {TemplateResult|string}
     */
    renderModal () {
        return '';
    }

    /**
     * @returns {TemplateResult|string}
     */
    renderModalFooter() {
        return html`<div class="modal-footer">${ modal_close_button }</div>`;
    }

    toHTML () {
        return tplModal(this);
    }

    /**
     * @returns {string|TemplateResult}
     */
    getModalTitle () {
        // Intended to be overwritten
        return '';
    }

    switchTab (ev) {
        ev?.stopPropagation();
        ev?.preventDefault();
        this.tab = ev.target.getAttribute('data-name');
        this.render();
    }

    insertIntoDOM () {
        const container_el = document.querySelector("#converse-modals");
        container_el.insertAdjacentElement('beforeend', this);
    }

    /**
     * @param {string} message
     * @param {'primary'|'secondary'|'danger'} type
     */
    alert (message, type='primary') {
        this.model.set('alert', { message, type });
        setTimeout(() => {
            this.model.set('alert', undefined);
        }, 5000);
    }

    async show () {
        await this.initialized;
        this.modal.show();
        this.render();
    }
}

export default BaseModal;
