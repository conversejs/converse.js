import { html } from 'lit';
import { getOpenPromise } from '@converse/openpromise';
import { Modal } from "bootstrap";
import { ElementView } from '@converse/skeletor';
import { u } from '@converse/headless';
import { modal_close_button } from "./templates/buttons.js";
import tplModal from './templates/modal.js';

import './styles/_modal.scss';

class BaseModal extends ElementView {
    /**
     * @typedef {import('lit').TemplateResult} TemplateResult
     */

    /**
     * @param {Object} options
     */
    constructor (options) {
        super();
        this.model = null;
        this.className = u.isTestEnv() ? 'modal' : 'modal fade';
        this.tabIndex = -1;
        this.ariaHidden = 'true';

        this.initialized = getOpenPromise();

        // Allow properties to be set via passed in options
        Object.assign(this, options);
        setTimeout(() => this.insertIntoDOM());

        this.addEventListener('shown.bs.modal', () => {
            this.ariaHidden = 'false';
        });
        this.addEventListener('hidden.bs.modal', () => {
            this.ariaHidden = 'true';
        });
    }

    initialize () {
        this.render()
        this.modal = new Modal(this, {
            backdrop: u.isTestEnv() ? false : true,
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

    /**
     * @param {Event} [ev]
     */
    switchTab (ev) {
        ev?.stopPropagation();
        ev?.preventDefault();
        this.tab = /** @type {HTMLElement} */(ev.target).getAttribute('data-name');
        this.render();
    }

    close () {
        this.modal.hide();
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
