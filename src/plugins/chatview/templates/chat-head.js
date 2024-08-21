import { html } from "lit";
import { until } from 'lit/directives/until.js';
import { _converse, constants } from '@converse/headless';
import { __ } from 'i18n';
import { getStandaloneButtons, getDropdownButtons } from 'shared/chat/utils.js';

const { HEADLINES_TYPE } = constants;

export default (o) => {
    const i18n_profile = __("The User's Profile Image");
    const display_name = o.model.getDisplayName();
    const avatar = html`<span title="${i18n_profile}">
        <converse-avatar
            .model=${o.model.contact || o.model}
            class="avatar chat-msg__avatar"
            name="${display_name}"
            nonce=${o.model.contact?.vcard?.get('vcard_updated')}
            height="40" width="40"></converse-avatar></span>`;

    return html`
        <div class="chatbox-title ${ o.status ? '' :  "chatbox-title--no-desc"}">
            <div class="chatbox-title--row">
                ${ (!_converse.api.settings.get("singleton")) ?  html`<converse-controlbox-navback jid="${o.jid}"></converse-controlbox-navback>` : '' }
                ${ (o.type !== HEADLINES_TYPE) ? html`<a class="show-msg-author-modal" @click=${o.showUserDetailsModal}>${ avatar }</a>` : '' }
                <div class="chatbox-title__text" title="${o.jid}" role="heading" aria-level="2">
                    ${ (o.type !== HEADLINES_TYPE) ? html`<a class="user show-msg-author-modal" @click=${o.showUserDetailsModal}>${ display_name }</a>` : display_name }
                </div>
            </div>
            <div class="chatbox-title__buttons btn-toolbar g-0">
                ${ until(getDropdownButtons(o.heading_buttons_promise), '') }
                ${ until(getStandaloneButtons(o.heading_buttons_promise), '') }
            </div>
        </div>
        ${ o.status ? html`<p class="chat-head__desc">${ o.status }</p>` : '' }
    `;
}
