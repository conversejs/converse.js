import { html } from 'lit';
import { __ } from 'i18n';
import { getSendErrorMessages } from 'plugins/omemo-views/utils.js';

/**
 * Shows a message that could not be sent, with the reason and the actions that
 * let the user try again or drop it. A failed encrypted message can also be sent
 * in the clear, but only after the user confirms that.
 * @param {import('../message').default} el
 */
export default (el) => {
    const i18n_retry = __('Retry');
    const i18n_send_unencrypted = __('Send without encryption');
    const i18n_discard = __('Discard');
    const [reason] = getSendErrorMessages(el.model.get('send_error_code'));

    return html`<div class="chat-msg__send-failed text-danger small">
        <span class="chat-msg__send-failed-reason">${reason}</span>
        <button type="button" class="btn btn-sm btn-link p-0 ms-2" @click=${el.onRetrySendClicked}>
            ${i18n_retry}
        </button>
        ${
            el.model.get('is_encrypted')
                ? html`<button type="button" class="btn btn-sm btn-link p-0 ms-2" @click=${el.onSendUnencryptedClicked}>
                      ${i18n_send_unencrypted}
                  </button>`
                : ''
        }
        <button type="button" class="btn btn-sm btn-link p-0 ms-2" @click=${el.onDiscardSendClicked}>
            ${i18n_discard}
        </button>
    </div>`;
};
