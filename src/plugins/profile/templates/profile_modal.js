import "shared/components/image-picker.js";
import { __ } from "i18n";
import { _converse } from "@converse/headless";
import { html } from "lit";
import { shouldShowPasswordResetForm } from "../utils";

/**
 * @param {import('../modals/profile').default} el
 */
function tplOmemoPage(el) {
    return html` <div
        class="tab-pane ${el.tab === "omemo" ? "active" : ""}"
        id="omemo-tabpanel"
        role="tabpanel"
        aria-labelledby="omemo-tab"
    >
        ${el.tab === "omemo" ? html`<converse-omemo-profile></converse-omemo-profile>` : ""}
    </div>`;
}

/**
 * @param {import('../modals/profile').default} el
 */
export default (el) => {
    const o = { ...el.model.toJSON(), ...el.model.vcard?.toJSON() };
    const i18n_email = __("Email");
    const i18n_fullname = __("Full Name");
    const i18n_jid = __("XMPP Address");
    const i18n_nickname = __("Nickname");
    const i18n_role = __("Role");
    const i18n_save = __("Save and close");
    const i18n_role_help = __(
        "Use commas to separate multiple roles. Your roles are shown next to your name on your chat messages."
    );
    const i18n_url = __("URL");

    const i18n_omemo = __("OMEMO");
    const i18n_profile = __("Profile");
    const ii18n_reset_password = __("Reset Password");

    // Initialize navigation_tabs as a Map
    const navigation_tabs = new Map();

    navigation_tabs.set(
        "profile",
        html`<li role="presentation" class="nav-item">
            <a
                class="nav-link ${el.tab === "profile" ? "active" : ""}"
                id="profile-tab"
                href="#profile-tabpanel"
                aria-controls="profile-tabpanel"
                role="tab"
                @click="${(ev) => el.switchTab(ev)}"
                data-name="profile"
                data-toggle="tab"
                >${i18n_profile}</a
            >
        </li>`
    );

    if (shouldShowPasswordResetForm()) {
        navigation_tabs.set(
            "passwordreset",
            html`<li role="presentation" class="nav-item">
                <a
                    class="nav-link ${el.tab === "passwordreset" ? "active" : ""}"
                    id="passwordreset-tab"
                    href="#passwordreset-tabpanel"
                    aria-controls="passwordreset-tabpanel"
                    role="tab"
                    @click="${(ev) => el.switchTab(ev)}"
                    data-name="passwordreset"
                    data-toggle="tab"
                    >${ii18n_reset_password}</a
                >
            </li>`
        );
    }

    if (_converse.pluggable.plugins["converse-omemo"]?.enabled(_converse)) {
        navigation_tabs.set(
            "omemo",
            html`<li role="presentation" class="nav-item">
                <a
                    class="nav-link ${el.tab === "omemo" ? "active" : ""}"
                    id="omemo-tab"
                    href="#omemo-tabpanel"
                    aria-controls="omemo-tabpanel"
                    role="tab"
                    @click="${(ev) => el.switchTab(ev)}"
                    data-name="omemo"
                    data-toggle="tab"
                    >${i18n_omemo}</a
                >
            </li>`
        );
    }

    return html`
        ${
            navigation_tabs.size
                ? html`<ul class="nav nav-pills justify-content-center">
                      ${Array.from(navigation_tabs.values())}
                  </ul>`
                : ""
        }
        <div class="tab-content">
            <div class="tab-pane ${el.tab === "profile" ? "active" : ""}" id="profile-tabpanel" role="tabpanel" aria-labelledby="profile-tab">
                <form class="converse-form converse-form--modal" action="#" @submit=${(ev) => el.onFormSubmitted(ev)}>
                    <div class="row py-2">
                        <div class="col-auto">
                            <converse-image-picker .model=${el.model} width="128" height="128"></converse-image-picker>
                        </div>
                        <div class="col">
                            <div class="px-3">
                                <label class="col-form-label">${i18n_jid}:</label>
                                <div>${o.jid}</div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label for="vcard-fullname" class="col-form-label">${i18n_fullname}:</label>
                        <input id="vcard-fullname" type="text" class="form-control" name="fn" value="${o.fullname || ""}"/>
                    </div>
                    <div>
                        <label for="vcard-nickname" class="col-form-label">${i18n_nickname}:</label>
                        <input id="vcard-nickname" type="text" class="form-control" name="nickname" value="${o.nickname || ""}"/>
                    </div>
                    <div>
                        <label for="vcard-url" class="col-form-label">${i18n_url}:</label>
                        <input id="vcard-url" type="url" class="form-control" name="url" value="${o.url || ""}"/>
                    </div>
                    <div>
                        <label for="vcard-email" class="col-form-label">${i18n_email}:</label>
                        <input id="vcard-email" type="email" class="form-control" name="email" value="${o.email || ""}"/>
                    </div>
                    <div>
                        <label for="vcard-role" class="col-form-label">${i18n_role}:</label>
                        <input id="vcard-role" type="text" class="form-control" name="role" value="${o.role || ""}" aria-describedby="vcard-role-help"/>
                        <small id="vcard-role-help" class="form-text text-muted">${i18n_role_help}</small>
                    </div>
                    <hr/>
                    <div>
                        <button type="submit" class="save-form btn btn-primary">${i18n_save}</button>
                    </div>
                </form>
            </div>
            ${
                navigation_tabs.get("passwordreset")
                    ? html` <div
                          class="tab-pane ${el.tab === "passwordreset" ? "active" : ""}"
                          id="passwordreset-tabpanel"
                          role="tabpanel"
                          aria-labelledby="passwordreset-tab"
                      >
                          ${el.tab === "passwordreset"
                              ? html`<converse-change-password-form></converse-change-password-form>`
                              : ""}
                      </div>`
                    : ""
            }
            ${navigation_tabs.get("omemo") ? tplOmemoPage(el) : ""}
        </div>
    </div>`;
};
