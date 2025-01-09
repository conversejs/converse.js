import { __ } from 'i18n';
import { html } from 'lit';

/**
 * @param {import('../new-chat.js').default} el
 */
export default (el) => {
    const i18n_start_chat = __('Start Chat');
    const i18n_xmpp_address = __('XMPP Address');
    const error = el.model.get('error');

    return html` <div class="modal-body">
        ${error ? html`<div class="alert alert-danger" role="alert">${error}</div>` : ''}
        <form @submit=${/** @param {SubmitEvent} ev */(ev) => el.startChatFromForm(ev)}>
            <div class="mb-3">
                <label class="form-label" for="jid">${i18n_xmpp_address}</label>
                <input type="text" name="jid" class="form-control" required />
            </div>
            <button type="submit" class="btn btn-primary">${i18n_start_chat}</button>
        </form>
    </div>`;
};
