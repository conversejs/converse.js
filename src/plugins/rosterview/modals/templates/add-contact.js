import { __ } from "i18n";
import { api } from "@converse/headless";
import { getGroupsAutoCompleteList, getJIDsAutoCompleteList, getNamesAutoCompleteList } from "../../utils.js";
import { html } from "lit";
import { FILTER_STARTSWITH } from "shared/autocomplete/utils";

/**
 * @param {import('../add-contact.js').default} el
 */
export default (el) => {
    const i18n_add = __("Add");
    const i18n_contact_placeholder = __("name@example.org");
    const i18n_groups = __("Groups");
    const i18n_groups_help = __("Use commas to separate multiple values");
    const i18n_nickname = __("Name");
    const i18n_xmpp_address = __("XMPP Address");
    const error = el.model.get("error");

    return html` <div class="modal-body">
        ${error ? html`<div class="alert alert-danger" role="alert">${error}</div>` : ""}
        <form class="converse-form add-xmpp-contact" @submit=${(ev) => el.addContactFromForm(ev)}>
            <div class="mb-3">
                <label class="form-label clearfix" for="jid">${i18n_xmpp_address}:</label>
                ${api.settings.get("autocomplete_add_contact")
                    ? html`<converse-autocomplete
                          .list=${getJIDsAutoCompleteList()}
                          .data=${(text, input) => `${input.slice(0, input.indexOf("@"))}@${text}`}
                          position="below"
                          filter=${FILTER_STARTSWITH}
                          ?required=${!api.settings.get("xhr_user_search_url")}
                          value="${el.model.get("jid") || ""}"
                          placeholder="${i18n_contact_placeholder}"
                          name="jid"
                      ></converse-autocomplete>`
                    : html`<input
                          type="text"
                          name="jid"
                          ?required=${!api.settings.get("xhr_user_search_url")}
                          value="${el.model.get("jid") || ""}"
                          class="form-control"
                          placeholder="${i18n_contact_placeholder}"
                      />`}
            </div>

            <div class="mb-3">
                <label class="form-label clearfix" for="name">${i18n_nickname}:</label>
                ${api.settings.get("autocomplete_add_contact") &&
                typeof api.settings.get("xhr_user_search_url") === "string"
                    ? html`<converse-autocomplete
                          .getAutoCompleteList=${(query) => getNamesAutoCompleteList(query, "fullname")}
                          filter=${FILTER_STARTSWITH}
                          value="${el.model.get("nickname") || ""}"
                          name="name"
                      ></converse-autocomplete>`
                    : html`<input
                          type="text"
                          name="name"
                          value="${el.model.get("nickname") || ""}"
                          class="form-control"
                      />`}
            </div>
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
