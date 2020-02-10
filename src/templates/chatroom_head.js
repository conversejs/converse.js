import '../components/dropdown.js';
import { __ } from '@converse/headless/i18n';
import { html } from "lit-html";
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import { until } from 'lit-html/directives/until.js';
import converse from "@converse/headless/converse-core";
import xss from "xss/dist/xss";

const u = converse.env.utils;
const i18n_hide_topic = __('Hide the groupchat topic');


const tpl_standalone_btns = (o) => o.standalone_btns.reverse().map(b => until(b, ''));


export default (o) => {
    const subject = o.subject ? u.addHyperlinks(xss.filterXSS(o.subject.text, {'whiteList': {}})) : '';
    const show_subject = (subject && !o.hide_subject);
    return html`
        <div class="chatbox-title ${ show_subject ? '' :  "chatbox-title--no-desc"}">
            ${ (o._converse.standalone) ? html`<div class="chatbox-navback"><i class="fa fa-arrow-left"></i></div>` : '' }
            <div class="chatbox-title__text" title="${ (o._converse.locked_muc_domain !== 'hidden') ? o.jid : '' }">${ o.title }
                ${ (o.bookmarked) ? html`<i class="fa fa-bookmark"></i>` : '' }
            </div>
            <div class="chatbox-title__buttons row no-gutters">
                ${ o.standalone_btns.length ? tpl_standalone_btns(o) : '' }
                ${ o.dropdown_btns.length ? html`<converse-dropdown .items=${o.dropdown_btns}></converse-dropdown>` : '' }
            </div>
        </div>
        ${ show_subject ? html`<p class="chat-head__desc" title="${i18n_hide_topic}">${unsafeHTML(subject)}</p>` : '' }
    `;
}
