import { html } from "lit";
import { until } from "lit/directives/until.js";
import { _converse, constants } from "@converse/headless";
import { __ } from "i18n";
import { getStandaloneButtons, getDropdownButtons } from "shared/chat/utils.js";

const { HEADLINES_TYPE } = constants;

/**
 * @param {import('../heading').default} el
 * @returns {import('lit').TemplateResult}
 */
export default (el) => {
    const { jid, status, type } = el.model.attributes;
    const heading_buttons_promise = el.getHeadingButtons();
    const showUserDetailsModal = /** @param {Event} ev */ (ev) => el.showUserDetailsModal(ev);

    const i18n_profile = __("The User's Profile Image");
    const display_name = el.model.getDisplayName();
    const avatar = html`<span title="${i18n_profile}">
        <converse-avatar
            .model=${el.model.contact || el.model}
            class="avatar chat-msg__avatar"
            name="${display_name}"
            nonce=${el.model.contact?.vcard?.get("vcard_updated")}
            height="40"
            width="40"
        ></converse-avatar
    ></span>`;

    return html`
        <div class="chatbox-title ${status ? "" : "chatbox-title--no-desc"}">
            <div class="chatbox-title--row">
                ${!_converse.api.settings.get("singleton")
                    ? html`<converse-controlbox-navback jid="${jid}"></converse-controlbox-navback>`
                    : ""}
                ${type !== HEADLINES_TYPE
                    ? html`<a class="show-msg-author-modal" @click=${showUserDetailsModal}>${avatar}</a>`
                    : ""}
                <div class="chatbox-title__text" title="${jid}" role="heading" aria-level="2">
                    ${type !== HEADLINES_TYPE
                        ? html`<a class="user show-msg-author-modal" @click=${showUserDetailsModal}>${display_name}</a>`
                        : display_name}
                </div>
            </div>
            <div class="chatbox-title__buttons btn-toolbar g-0">
                ${until(getStandaloneButtons(heading_buttons_promise), "")}
                ${until(getDropdownButtons(heading_buttons_promise), "")}
            </div>
        </div>
        ${status ? html`<p class="chat-head__desc">${status}</p>` : ""}
    `;
};
