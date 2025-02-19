import { __ } from "i18n";
import { getGroupsAutoCompleteList } from "../../utils.js";
import { html } from "lit";

/**
 * @param {import('../accept-contact-request.js').default} el
 */
export default (el) => {
    const i18n_add = __("Add");
    const i18n_group = __("Group");
    const i18n_nickname = __("Name");
    const error = el.model.get("error");

    return html` <div class="modal-body">
        ${error ? html`<div class="alert alert-danger" role="alert">${error}</div>` : ""}
        <form class="converse-form" @submit=${(ev) => el.acceptContactRequest(ev)}>
            <div class="mb-3">
                <label class="form-label clearfix" for="name">${i18n_nickname}:</label>
                <input type="text" name="name" value="${el.contact.vcard?.get('fullname') || ''}" class="form-control" />
            </div>
            <div class="mb-3">
                <label class="form-label clearfix" for="name">${i18n_group}:</label>
                <converse-autocomplete .list=${getGroupsAutoCompleteList()} name="group"></converse-autocomplete>
            </div>
            <button type="submit" class="btn btn-primary">${i18n_add}</button>
        </form>
    </div>`;
};
