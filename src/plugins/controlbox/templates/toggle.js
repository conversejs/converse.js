import { html } from 'lit';
import { __ } from 'i18n';
import { showControlBox } from '../utils.js';

/**
 * @param {import('../toggle').default} el
 */
export default (el) => {
    return html`<button
        type="button"
        class="btn toggle-controlbox ${el.model?.get('closed') ? '' : 'hidden'}"
        @click=${(ev) => showControlBox(ev)}
    >
        <span class="toggle-feedback">${__('Chat')}</span>
    </button>`;
};
