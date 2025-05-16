import { __ } from 'i18n';
import { getGroupsAutoCompleteList } from '../../utils.js';
import { html } from 'lit';

/**
 * @param {import('../accept-contact-request.js').default} el
 */
export default (el) => {
    const i18n_accept = __('Accept');
    const i18n_groups = __('Groups');
    const i18n_groups_help = __('Use commas to separate multiple values');
    const i18n_nickname = __('Name');
    const i18n_xmpp_address = __('XMPP Address');
    const error = el.model.get('error');

    return html` <div class="modal-body">
        ${error ? html`<div class="alert alert-danger" role="alert">${error}</div>` : ''}
        <form class="converse-form" @submit=${(ev) => el.acceptContactRequest(ev)}>
            <div class="mb-3">
                <label class="form-label clearfix" for="name">${i18n_nickname}:</label>
                <input
                    type="text"
                    name="name"
                    value="${el.contact.vcard?.get('fullname') || ''}"
                    class="form-control"
                />
            </div>
            <div class="mb-3">
                <label class="form-label clearfix" for="name">${i18n_groups}:</label>
                <div class="mb-1">
                    <small class="form-text text-muted">${i18n_groups_help}</small>
                </div>
                <converse-autocomplete .list=${getGroupsAutoCompleteList()} name="groups"></converse-autocomplete>
            </div>

            <div class="mb-3 d-flex justify-content-between">
                <label class="form-label clearfix w-100" for="jid-display">${i18n_xmpp_address}:</label>
                <p class="form-control-plaintext text-end" id="jid-display">${el.contact.get('jid')}</p>
            </div>

            <button type="submit" class="btn btn-primary">${i18n_accept}</button>
        </form>
    </div>`;
};
