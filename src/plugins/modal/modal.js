/**
 * @typedef {import('lit-html').TemplateResult} TemplateResult
 */
import bootstrap from "bootstrap.native";
import tplModal from './templates/modal.js';
import { ElementView } from '@converse/skeletor';
import { getOpenPromise } from '@converse/openpromise';


import './styles/_modal.scss';

class BaseModal extends ElementView {

    constructor (options) {
        super();
        this.model = null;
        this.className = 'modal';
        this.initialized = getOpenPromise();

        // Allow properties to be set via passed in options
        Object.assign(this, options);
        setTimeout(() => this.insertIntoDOM());

        this.addEventListener('hide.bs.modal', () => this.onHide(), false);
    }

    initialize () {
        this.modal = new bootstrap.Modal(this, {
            backdrop: true,
            keyboard: true
        });
        this.initialized.resolve();
        this.render()
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

    onHide () {
        this.modal.hide();
    }

    insertIntoDOM () {
        const container_el = document.querySelector("#converse-modals");
        container_el.insertAdjacentElement('beforeend', this);
    }

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
