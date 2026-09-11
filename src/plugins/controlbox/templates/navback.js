import { html } from 'lit';
import { __ } from 'i18n';
import { navigateToControlBox } from '../utils.js';

export default (jid) => {
    return html`<button
        type="button"
        class="btn btn--transparent chatbox-btn"
        title="${__('Back')}"
        aria-label="${__('Back')}"
        @click=${() => navigateToControlBox(jid)}
    >
        <converse-icon size="1em" class="fa fa-arrow-left"></converse-icon>
    </button>`;
};
