import { html } from "lit";
import { api } from "@converse/headless";
import { __ } from "i18n";
import { getGroupsAutoCompleteList, getJIDsAutoCompleteList, getNamesAutoCompleteList } from "../../utils.js";
import "shared/autocomplete/index.js";

/**
 * @param {import('../add-contact.js').default} el
 */
export default (el) => {
    const i18n_add = __("Add");
    const i18n_contact_placeholder = __("name@example.org");
    const i18n_groups = __("Groups");
    const i18n_groups_help = __("Use commas to separate multiple values");
    const i18n_nickname = __("Name");
    const using_xhr = api.settings.get("xhr_user_search_url");
    const i18n_xmpp_address = using_xhr ? __("Search name or XMPP address") : __("XMPP Address");
    const error = el.model.get("error");

    return html` <div class="modal-body">
        ${error ? html`<div class="alert alert-danger" role="alert">${error}</div>` : ""}
        <form class="converse-form add-xmpp-contact" @submit=${(ev) => el.addContactFromForm(ev)}>
            <div class="mb-3">
                <label class="form-label clearfix" for="jid">${i18n_xmpp_address}:</label>
                ${using_xhr
                    ? html`<converse-autocomplete
                          .getAutoCompleteList=${getNamesAutoCompleteList}
                          position="below"
                          min_chars="2"
                          filter="contains"
                          ?required="${true}"
                          value="${el.model.get("jid") || ""}"
                          placeholder="${i18n_contact_placeholder}"
                          name="jid"
                      ></converse-autocomplete>`
                    : html`<converse-autocomplete
                          .list="${getJIDsAutoCompleteList()}"
                          .data="${(text, input) => `${input.slice(0, input.indexOf("@"))}@${text}`}"
                          position="below"
                          min_chars="2"
                          filter="startswith"
                          ?required="${!api.settings.get("xhr_user_search_url")}"
                          value="${el.model.get("jid") || ""}"
                          placeholder="${i18n_contact_placeholder}"
                          name="jid"
                      ></converse-autocomplete>`}
            </div>

            ${!using_xhr
                ? html`
                      <div class="mb-3">
                          <label class="form-label clearfix" for="name">${i18n_nickname}:</label>
                          <input
                              type="text"
                              name="name"
                              value="${el.model.get("nickname") || ""}"
                              class="form-control"
                          />
                      </div>
                  `
                : ""}

            <div class="mb-3">
                <label class="form-label clearfix" for="name">${i18n_groups}:</label>
                <div class="mb-1">
                    <small class="form-text text-muted">${i18n_groups_help}</small>
                </div>
                <converse-autocomplete .list=${getGroupsAutoCompleteList()} name="groups"></converse-autocomplete>
            </div>
            <button type="submit" class="btn btn-primary">${i18n_add}</button>
        </form>
    </div>`;
};
