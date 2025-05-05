import { html } from 'lit';
import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';

export class ToastsContainer extends CustomElement {
    initialize() {
        super.initialize();
        api.listen.on('showToast', () => this.requestUpdate());
        api.listen.on('hideToast', () => this.requestUpdate());
    }

    render() {
        const toasts = api.toast.get();
        return html`${toasts.map(
            /** @param {import('./types').ToastProperties} toast */
            (toast) =>
                html`<converse-toast
                    name="${toast.name}"
                    title="${toast.title ?? ''}"
                    body="${toast.body ?? ''}"
                ></converse-toast>`
        )}`;
    }
}

api.elements.define('converse-toasts', ToastsContainer);

export default ToastsContainer;
