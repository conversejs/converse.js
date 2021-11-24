import { __ } from 'i18n';
import { _converse } from '@converse/headless/core';
import { getHeadingDropdownItem, getHeadingStandaloneButton } from 'plugins/chatview/utils.js';
import { html } from "lit";
import { until } from 'lit/directives/until.js';


async function getStandaloneButtons (promise) {
    const heading_btns = await promise;
    const standalone_btns = heading_btns.filter(b => b.standalone);
    return standalone_btns.map(b => getHeadingStandaloneButton(b))
}

async function getDropdownButtons (promise) {
    const heading_btns = await promise;
    const dropdown_btns = heading_btns.filter(b => !b.standalone);
    return dropdown_btns.map(b => getHeadingDropdownItem(b));
}

export default (o) => {
    const i18n_profile = __("The User's Profile Image");
    const avatar = html`<span title="${i18n_profile}">
        <converse-avatar
            class="avatar chat-msg__avatar"
            .data=${o.model.vcard?.attributes}
            nonce=${o.model.vcard?.get('vcard_updated')}
            height="40" width="40"></converse-avatar></span>`;
    const display_name = o.model.getDisplayName();

    const tpl_dropdown_btns = () => getDropdownButtons(o.heading_buttons_promise)
        .then(btns => btns.length ? html`<converse-dropdown class="dropleft" color="var(--chat-head-text-color)" .items=${btns}></converse-dropdown>` : '');

    const tpl_standalone_btns = () => getStandaloneButtons(o.heading_buttons_promise)
        .then(btns => btns.reverse().map(b => until(b, '')));

    return html`
        <div class="chatbox-title ${ o.status ? '' :  "chatbox-title--no-desc"}">
            <div class="chatbox-title--row">
                ${ (!_converse.api.settings.get("singleton")) ?  html`<converse-controlbox-navback jid="${o.jid}"></converse-controlbox-navback>` : '' }
                ${ (o.type !== _converse.HEADLINES_TYPE) ? html`<a class="show-msg-author-modal" @click=${o.showUserDetailsModal}>${ avatar }</a>` : '' }
                <div class="chatbox-title__text" title="${o.jid}">
                    ${ (o.type !== _converse.HEADLINES_TYPE) ? html`<a class="user show-msg-author-modal" @click=${o.showUserDetailsModal}>${ display_name }</a>` : display_name }
                </div>
            </div>
            <div class="chatbox-title__buttons row no-gutters">
                ${ until(tpl_dropdown_btns(), '') }
                ${ until(tpl_standalone_btns(), '') }
            </div>
        </div>
        ${ o.status ? html`<p class="chat-head__desc">${ o.status }</p>` : '' }
    `;
}
