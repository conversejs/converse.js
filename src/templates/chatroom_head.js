import '../components/dropdown.js';
import { html } from "lit-html";
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import { until } from 'lit-html/directives/until.js';
import { __ } from '@converse/headless/i18n';
import converse from "@converse/headless/converse-core";
import xss from "xss/dist/xss";

const u = converse.env.utils;
const i18n_hide_topic = __('Hide the groupchat topic');


async function getNavDropdownItem (promise_or_data) {
    const data = await promise_or_data;
    return html`<a href="#" class="dropdown-item" @click=${data.handler} title="${data.i18n_title}"><i class="fa ${data.icon_class}"></i>${data.i18n_title}</a>`;
}


const muc_head_dropdown = (o) => html`
    <div class="dropleft">
        <button type="button" class="btn btn--transparent" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
            <i class="fa fa-bars only-icon"></i>
        </button>
        <div class="dropdown-menu">
            ${ o.buttons.map(b => until(getNavDropdownItem(b), '')) }
        </div>
    </div>
`;


export default (o) => {
    const subject = o.subject ? u.addHyperlinks(xss.filterXSS(o.subject.text, {'whiteList': {}})) : '';
    const show_subject = (subject && !o.hide_subject);
    return html`
        <div class="chatbox-title ${ show_subject ? '' :  "chatbox-title--no-desc"}">
            ${ (o._converse.singleton) ? html`<div class="chatbox-navback"><i class="fa fa-arrow-left"></i></div>` : '' }
            <div class="chatbox-title__text" title="${ (o._converse.locked_muc_domain !== 'hidden') ? o.jid : '' }">${ o.title }</div>
            <converse-dropdown .contents=${muc_head_dropdown(o)}></converse-dropdown>
        </div>
        ${ show_subject ? html`<p class="chat-head__desc" title="${i18n_hide_topic}">${unsafeHTML(subject)}</p>` : '' }
    `;
}
