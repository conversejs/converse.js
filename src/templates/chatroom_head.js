import '../components/dropdown.js';
import { __ } from '../i18n';
import { html } from "lit-html";
import { until } from 'lit-html/directives/until.js';
import { converse } from "@converse/headless/converse-core";

const u = converse.env.utils;


const tpl_standalone_btns = (o) => o.standalone_btns.reverse().map(b => until(b, ''));


export default (o) => {
    const i18n_hide_topic = __('Hide the groupchat topic');
    const i18n_bookmarked = __('This groupchat is bookmarked');
    const subject = o.subject ? u.addHyperlinks(o.subject.text) : '';
    const show_subject = (subject && !o.subject_hidden);
    return html`
        <div class="chatbox-title ${ show_subject ? '' :  "chatbox-title--no-desc"}">
            ${ (!o._converse.api.settings.get("singleton")) ? html`<div class="chatbox-navback"><i class="fa fa-arrow-left"></i></div>` : '' }
            <div class="chatbox-title__text" title="${ (o._converse.locked_muc_domain !== 'hidden') ? o.jid : '' }">${ o.title }
                ${ (o.bookmarked) ? html`<i class="fa fa-bookmark chatbox-title__text--bookmarked" title="${i18n_bookmarked}"></i>` : '' }
            </div>
            <div class="chatbox-title__buttons row no-gutters">
                ${ o.standalone_btns.length ? tpl_standalone_btns(o) : '' }
                ${ o.dropdown_btns.length ? html`<converse-dropdown .items=${o.dropdown_btns}></converse-dropdown>` : '' }
            </div>
        </div>
        ${ show_subject ? html`<p class="chat-head__desc" title="${i18n_hide_topic}">${subject}</p>` : '' }
    `;
}
