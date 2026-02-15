import { html } from 'lit';
import { api } from '@converse/headless';
import { __ } from 'i18n';
import { getGroupsAutoCompleteList, getNamesAutoCompleteList } from '../../utils.js';
import 'shared/autocomplete/index.js';

/**
 * @param {import('../add-contact.js').default} el
 */
export default (el) => {
    const i18n_add = __('Add');
    const i18n_contact_placeholder = __('name@example.org');
    const i18n_groups = __('Groups');
    const i18n_groups_help = __('Use commas to separate multiple values');
    const i18n_nickname = __('Name');
    const using_xhr = api.settings.get('xhr_user_search_url');
    const i18n_xmpp_address = __('XMPP Address');
    const i18n_search_or_address = using_xhr ? __('Search name or XMPP address') : i18n_xmpp_address;

    return html`<div class="modal-body">
        <form class="converse-form add-xmpp-contact" @submit=${(ev) => el.addContactFromForm(ev)}>
            ${el.contact
                ? html`<input type="hidden" name="jid" value="${el.contact.get('jid')}" />`
                : html`<div class="mb-3">
                      <label class="form-label clearfix" for="jid">${i18n_search_or_address}:</label>
                      ${using_xhr
                          ? html`<converse-autocomplete
                                .getAutoCompleteList=${getNamesAutoCompleteList}
                                position="below"
                                min_chars="2"
                                filter="contains"
                                ?required="${true}"
                                value="${el.state.get('jid') || ''}"
                                placeholder="${i18n_contact_placeholder}"
                                name="jid"
                            ></converse-autocomplete>`
                          : html`<converse-autocomplete
                                .list="${el.getJIDDomainAutoCompleteList()}"
                                .data="${(text, input) => `${input.slice(0, input.indexOf('@'))}@${text}`}"
                                position="below"
                                min_chars="2"
                                filter="startswith"
                                ?required="${!api.settings.get('xhr_user_search_url')}"
                                value="${el.state.get('jid') || ''}"
                                placeholder="${i18n_contact_placeholder}"
                                name="jid"
                            ></converse-autocomplete>`}
                  </div>`}

            ${!using_xhr
                ? html`
                      <div class="mb-3">
                          <label class="form-label clearfix" for="name">${i18n_nickname}:</label>
                          <input
                              type="text"
                              name="name"
                              value="${el.state.get('nickname') || ''}"
                              class="form-control"
                          />
                      </div>
                  `
                : ''}

            <div class="mb-3">
                <label class="form-label clearfix" for="name">${i18n_groups}:</label>
                <div class="mb-1">
                    <small class="form-text text-muted">${i18n_groups_help}</small>
                </div>
                <converse-autocomplete .list=${getGroupsAutoCompleteList()} name="groups"></converse-autocomplete>
            </div>

            ${el.contact
                ? html`<div class="mb-3 d-flex justify-content-between">
                      <label class="form-label clearfix w-100" for="jid-display"
                          >${i18n_xmpp_address}:</label
                      >
                      <p class="form-control-plaintext text-end" id="jid-display">
                          ${el.contact.get('jid')}
                      </p>
                  </div>`
                : ''}

            <button type="submit" class="btn btn-primary">${i18n_add}</button>
        </form>
    </div>`;
};
