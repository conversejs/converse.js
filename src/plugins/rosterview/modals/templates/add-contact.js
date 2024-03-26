import { __ } from 'i18n';
import { api } from '@converse/headless';
import {
    getGroupsAutoCompleteList,
    getJIDsAutoCompleteList,
    getNamesAutoCompleteList
} from '../../utils.js';
import { html } from "lit";
import { FILTER_STARTSWITH } from 'shared/autocomplete/utils';


export default (el) => {
    const i18n_add = __('Add');
    const i18n_contact_placeholder = __('name@example.org');
    const i18n_group = __('Group');
    const i18n_nickname = __('Name');
    const i18n_xmpp_address = __('XMPP Address');
    const error = el.model.get('error');

    return html`
        <form class="converse-form add-xmpp-contact" @submit=${ev => el.addContactFromForm(ev)}>
            <div class="modal-body">
                <span class="modal-alert"></span>
                <div class="form-group add-xmpp-contact__jid">
                    <label class="clearfix" for="jid">${i18n_xmpp_address}:</label>
                    ${api.settings.get('autocomplete_add_contact') ?
                        html`<converse-autocomplete
                            .list=${getJIDsAutoCompleteList()}
                            .data=${(text, input) => `${input.slice(0, input.indexOf("@"))}@${text}`}
                            position="below"
                            filter=${FILTER_STARTSWITH}
                            ?required=${(!api.settings.get('xhr_user_search_url'))}
                            value="${el.model.get('jid') || ''}"
                            placeholder="${i18n_contact_placeholder}"
                            name="jid"></converse-autocomplete>` :

                        html`<input type="text" name="jid"
                            ?required=${(!api.settings.get('xhr_user_search_url'))}
                            value="${el.model.get('jid') || ''}"
                            class="form-control"
                            placeholder="${i18n_contact_placeholder}"/>`
                    }
                </div>

                <div class="form-group add-xmpp-contact__name">
                    <label class="clearfix" for="name">${i18n_nickname}:</label>
                    ${api.settings.get('autocomplete_add_contact') && typeof api.settings.get('xhr_user_search_url') === 'string' ?
                        html`<converse-autocomplete
                            .getAutoCompleteList=${getNamesAutoCompleteList}
                            filter=${FILTER_STARTSWITH}
                            value="${el.model.get('nickname') || ''}"
                            placeholder="${i18n_contact_placeholder}"
                            name="name"></converse-autocomplete>` :

                        html`<input type="text" name="name"
                            value="${el.model.get('nickname') || ''}"
                            class="form-control"
                            placeholder="${i18n_contact_placeholder}"/>`
                    }
                </div>
                <div class="form-group add-xmpp-contact__group">
                    <label class="clearfix" for="name">${i18n_group}:</label>
                    <converse-autocomplete
                        .list=${getGroupsAutoCompleteList()}
                        name="group"></converse-autocomplete>
                </div>
                ${error ? html`<div class="form-group"><div style="display: block" class="invalid-feedback">${error}</div></div>` : ''}
                <button type="submit" class="btn btn-primary">${i18n_add}</button>
            </div>
        </form>`;
}
