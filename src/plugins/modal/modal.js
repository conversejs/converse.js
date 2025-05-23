import { html } from 'lit';
import Modal from 'bootstrap/js/src/modal.js';
import { getOpenPromise } from '@converse/openpromise';
import { Model } from '@converse/skeletor';
import { CustomElement } from 'shared/components/element.js';
import { api, u } from '@converse/headless';
import { modal_close_button } from './templates/buttons.js';
import tplModal from './templates/modal.js';

import './styles/_modal.scss';

class BaseModal extends CustomElement {
    /**
     * @typedef {import('lit').TemplateResult} TemplateResult
     */

    static get properties() {
        return {
            model: { type: Model },
        };
    }

    /** @type {Modal} */
    #modal;

    /**
     * @param {Object} options
     */
    constructor(options) {
        super();
        this.model = null;
        this.className = u.isTestEnv() ? 'modal' : 'modal fade';
        this.tabIndex = -1;
        this.ariaHidden = 'true';

        this.onKeyDown = /** @param {KeyboardEvent} ev */ (ev) => {
            if (ev.key === 'Escape' && this.ariaHidden === 'false') {
                this.close();
            }
        };

        this.initialized = getOpenPromise();

        // Allow properties to be set via passed in options
        Object.assign(this, options);
        setTimeout(() => this.insertIntoDOM());

        this.addEventListener('shown.bs.modal', () => {
            this.ariaHidden = 'false';
        });
        this.addEventListener('hidden.bs.modal', () => {
            this.ariaHidden = 'true';
            api.modal.remove(this.nodeName.toLowerCase());
        });
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('keydown', this.onKeyDown);
    }

    disconnectedCallback() {
        window.removeEventListener('resize', this.onKeyDown);
        super.disconnectedCallback();
    }

    get modal() {
        if (!this.#modal) {
            this.#modal = new Modal(this, {
                backdrop: u.isTestEnv() ? false : true,
                keyboard: true,
            });
        }
        return this.#modal;
    }

    initialize() {
        this.requestUpdate();
        this.initialized.resolve();
    }

    /**
     * @returns {TemplateResult|string}
     */
    renderModal() {
        return '';
    }

    /**
     * @returns {TemplateResult|string}
     */
    renderModalFooter() {
        return html`<div class="modal-footer">${modal_close_button}</div>`;
    }

    render() {
        return tplModal(this);
    }

    /**
     * @returns {string|TemplateResult}
     */
    getModalTitle() {
        // Intended to be overwritten
        return '';
    }

    /**
     * @param {Event} [ev]
     */
    switchTab(ev) {
        ev?.stopPropagation();
        ev?.preventDefault();
        this.tab = /** @type {HTMLElement} */ (ev.target).getAttribute('data-name');
        this.requestUpdate();
    }

    close() {
        this.modal.hide();
    }

    insertIntoDOM() {
        const container_el = document.querySelector('#converse-modals');
        container_el.insertAdjacentElement('beforeend', this);
    }

    /**
     * @param {string} message
     * @param {'primary'|'secondary'|'danger'} type
     * @param {boolean} [is_ephemeral=true]
     */
    alert(message, type = 'primary', is_ephemeral = true) {
        this.model.set('alert', { message, type });
        if (is_ephemeral) {
            setTimeout(() => {
                this.model.set('alert', undefined);
            }, 5000);
        }
    }

    async show() {
        await this.initialized;
        this.modal.show();
        this.requestUpdate();
    }
}

export default BaseModal;
