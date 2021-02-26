import { _converse } from '@converse/headless/core';
import { html } from "lit-html";
import { renderAvatar } from 'templates/directives/avatar.js';
import { until } from 'lit-html/directives/until.js';


export default (o) => {
    const tpl_standalone_btns = (o) => o.standalone_btns.reverse().map(b => until(b, ''));

    const avatar = html`<span class="mr-2">${renderAvatar(o.avatar_data)}</span>`;

    return html`
        <div class="chatbox-title ${ o.status ? '' :  "chatbox-title--no-desc"}">
            <div class="chatbox-title--row">
                ${ (!_converse.api.settings.get("singleton")) ? html`<div class="chatbox-navback"><i class="fa fa-arrow-left"></i></div>` : '' }
                ${ (o.type !== _converse.HEADLINES_TYPE) ? html`<a class="show-msg-author-modal" @click=${o.showUserDetailsModal}>${ avatar }</a>` : '' }
                <div class="chatbox-title__text" title="${o.jid}">
                    ${ (o.type !== _converse.HEADLINES_TYPE) ? html`<a class="user show-msg-author-modal" @click=${o.showUserDetailsModal}>${ o.display_name }</a>` : o.display_name }
                </div>
            </div>
            <div class="chatbox-title__buttons row no-gutters">
                ${ o.dropdown_btns.length ? html`<converse-dropdown .items=${o.dropdown_btns}></converse-dropdown>` : '' }
                ${ o.standalone_btns.length ? tpl_standalone_btns(o) : '' }
            </div>
        </div>
        ${ o.status ? html`<p class="chat-head__desc">${ o.status }</p>` : '' }
    `;
}
