import { html } from "lit";
import { api } from "@converse/headless";
import { __ } from 'i18n';
import { showControlBox } from '../utils.js';

/**
 * @param {import('../toggle').default} el
 */
export default (el) => {
    const i18n_toggle = api.connection.connected() ? __('Chat Contacts') : __('Toggle chat');
    return html`<button type="button"
            class="btn toggle-controlbox ${el.model?.get('closed') ? '' : 'hidden'}"
            @click=${(ev) => showControlBox(ev)}>
        <span class="toggle-feedback">${i18n_toggle}</span>
    </button>`;
}
