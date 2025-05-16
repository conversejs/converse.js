import { html } from 'lit';
import { api } from '@converse/headless';
import { __ } from 'i18n';
import { CustomElement } from 'shared/components/element.js';
import './styles/toast.scss';

export default class Toast extends CustomElement {
    static get properties() {
        return {
            type: { type: String },
            name: { type: String },
            title: { type: String },
            body: { type: String },
        };
    }

    constructor() {
        super();
        this.name = '';
        this.body = '';
        this.header = '';
        this.type = 'info';
    }

    /**
     * @param {import('lit').PropertyValues} changed
     */
    updated(changed) {
        if (changed.get('type') !== 'danger') {
            this.timeoutId = setTimeout(() => this.hide(), 5000);
        } else {
            clearTimeout(this.timeoutId);
        }
    }

    render() {
        return html`<div class="toast show text-bg-${this.type}" role="alert" aria-live="assertive" aria-atomic="true">
            ${this.title
                ? html`<div class="toast-header">
                      <img src="/logo/conversejs-filled.svg" class="rounded me-2" alt="${__('Converse logo')}" />
                      <strong class="me-auto">${this.title ?? ''}</strong>
                      <button
                          @click="${this.hide}"
                          type="button"
                          class="btn-close"
                          aria-label="${__('Close')}"
                      ></button>
                  </div>`
                : ''}
            ${this.body
                ? html`<div class="d-flex justify-content-between toast-body__container">
                      <div class="toast-body w-100">${this.body ?? ''}</div>
                      ${!this.title
                          ? html`<button
                                @click="${this.hide}"
                                type="button"
                                class="btn centered"
                                aria-label="${__('Close')}"
                            >
                                <converse-icon size="1em" class="fa fa-times"></converse-icon>
                            </button>`
                          : ''}
                  </div>`
                : ''}
        </div>`;
    }

    /**
     * @param {MouseEvent} [ev]
     */
    hide(ev) {
        ev?.preventDefault();
        api.toast.remove(this.name);
    }
}

api.elements.define('converse-toast', Toast);
