import { html } from "lit-html";
import { until } from 'lit-html/directives/until.js';
import { __ } from '@converse/headless/i18n';
import avatar from "./avatar.js";

const i18n_profile = __('The User\'s Profile Image');

const avatar_data = {
    'alt_text': i18n_profile,
    'extra_classes': '',
    'height': 40,
    'width': 40,
}

export default (o) => {
    return html`
        <div class="chatbox-title">
            <div class="chatbox-title--row">
                ${ (!o._converse.singleton) ? html`<div class="chatbox-navback"><i class="fa fa-arrow-left"></i></div>` : '' }
                ${ (o.type !== o._converse.HEADLINES_TYPE) ? avatar(Object.assign({}, o, avatar_data)) : '' }
                <div class="chatbox-title__text" title="${o.jid}">
                    ${ o.url ? html`<a href="${o.url}" target="_blank" rel="noopener" class="user"> ${ o.display_name } </a>` : o.display_name }
                </div>
                <div class="chatbox-title__buttons row no-gutters">${ o.buttons.map(b => until(b, '')) }</div>
            </div>
            ${ o.status ? html`<p class="chat-head__desc">${ o.status }</p>` : '' }
        </div>
    `;
}
