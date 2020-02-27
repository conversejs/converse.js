import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';
import { until } from 'lit-html/directives/until.js';
import avatar from "./avatar.js";

const i18n_profile = __('The User\'s Profile Image');

const avatar_data = {
    'alt_text': i18n_profile,
    'extra_classes': '',
    'height': 40,
    'width': 40,
}

const tpl_standalone_btns = (o) => o.standalone_btns.reverse().map(b => until(b, ''));


export default (o) => {
    return html`
        <div class="chatbox-title ${ o.status ? '' :  "chatbox-title--no-desc"}">
            <div class="chatbox-title--row">
                ${ (!o._converse.singleton) ? html`<div class="chatbox-navback"><i class="fa fa-arrow-left"></i></div>` : '' }
                ${ (o.type !== o._converse.HEADLINES_TYPE) ? avatar(Object.assign({}, o, avatar_data)) : '' }
                <div class="chatbox-title__text" title="${o.jid}">
                    ${ o.url ? html`<a href="${o.url}" target="_blank" rel="noopener" class="user">${o.display_name}</a>` : o.display_name}
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
