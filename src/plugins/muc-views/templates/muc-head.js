import 'shared/components/dropdown.js';
import 'shared/components/rich-text.js';
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless/core";
import { html } from "lit";
import { until } from 'lit/directives/until.js';

const tpl_standalone_btns = (o) => o.standalone_btns.reverse().map(b => until(b, ''));

export default (o) => {
    const i18n_hide_topic = __('Hide the groupchat topic');
    const i18n_bookmarked = __('This groupchat is bookmarked');
    const subject = o.subject ? o.subject.text : '';
    const show_subject = (subject && !o.subject_hidden);
    return html`
        <div class="chatbox-title ${ show_subject ? '' :  "chatbox-title--no-desc"}">
            ${ (!_converse.api.settings.get("singleton")) ?  html`<converse-controlbox-navback jid="${o.jid}"></converse-controlbox-navback>` : '' }
            <div class="chatbox-title__text" title="${ (api.settings.get('locked_muc_domain') !== 'hidden') ? o.jid : '' }">${ o.title }
                ${ (o.bookmarked) ? html`<i class="fa fa-bookmark chatbox-title__text--bookmarked" title="${i18n_bookmarked}"></i>` : '' }
            </div>
            <div class="chatbox-title__buttons row no-gutters">
                ${ o.standalone_btns.length ? tpl_standalone_btns(o) : '' }
                ${ o.dropdown_btns.length ? html`<converse-dropdown class="dropleft" color="var(--chatroom-head-color)" .items=${o.dropdown_btns}></converse-dropdown>` : '' }
            </div>
        </div>
        ${ show_subject ? html`<p class="chat-head__desc" title="${i18n_hide_topic}">
            <converse-rich-text text=${subject} render_styling></converse-rich-text>
          </p>` : '' }
    `;
}
