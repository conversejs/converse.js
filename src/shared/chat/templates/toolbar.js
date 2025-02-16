import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import { __ } from 'i18n';
import { api } from '@converse/headless';

function tplSendButton() {
    const i18n_send_message = __('Send the message');
    return html`<button type="submit" class="btn send-button" data-action="sendMessage" title="${i18n_send_message}">
        <converse-icon color="var(--background-color)" class="fa fa-paper-plane" size="1em"></converse-icon>
    </button>`;
}

/**
 * @param {import('../toolbar').ChatToolbar} el
 */
export default (el) => {
    const message_limit = api.settings.get('message_limit');
    return html`
        <span class="btn-group toolbar-buttons">${until(el.getButtons(), '')}</span>
        <span>
            ${ message_limit ? html`<converse-message-limit-indicator .model="${el.model}"/>` : '' }
            ${el.show_send_button ? tplSendButton() : ''}
        </span>
    `;
};
