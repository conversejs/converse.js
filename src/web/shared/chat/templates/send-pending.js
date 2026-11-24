import { html } from 'lit';
import { __ } from 'i18n';

/**
 * Shows that a message hasn't been sent yet, because it was written while
 * offline, and lets the user take it back before it's sent.
 * @param {import('../message').default} el
 */
export default (el) => {
    const i18n_pending = __('Not sent yet');
    const i18n_title = __('This message will be sent once you are connected again');
    const i18n_discard = __('Discard');

    return html`<div class="chat-msg__send-pending small">
        <span class="chat-msg__send-pending-status" title="${i18n_title}">
            <converse-icon class="fa fa-clock" color="var(--subdued-color)" size="0.9em"></converse-icon>
            <span class="chat-msg__send-pending-text">${i18n_pending}</span>
        </span>
        <button type="button" class="chat-msg__send-action" @click=${el.onDiscardSendClicked}>${i18n_discard}</button>
    </div>`;
};
