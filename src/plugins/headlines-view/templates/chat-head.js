import { _converse } from '@converse/headless/core';
import { html } from "lit";
import { until } from 'lit/directives/until.js';
import { getStandaloneButtons, getDropdownButtons } from 'shared/chat/utils.js';


export default (o) => {
    return html`
        <div class="chatbox-title ${ o.status ? '' :  "chatbox-title--no-desc"}">
            <div class="chatbox-title--row">
                ${ (!_converse.api.settings.get("singleton")) ?  html`<converse-controlbox-navback jid="${o.jid}"></converse-controlbox-navback>` : '' }
                <div class="chatbox-title__text" title="${o.jid}">${ o.display_name }</div>
            </div>
            <div class="chatbox-title__buttons row no-gutters">
                ${ until(getDropdownButtons(o.heading_buttons_promise), '') }
                ${ until(getStandaloneButtons(o.heading_buttons_promise), '') }
            </div>
        </div>
        ${ o.status ? html`<p class="chat-head__desc">${ o.status }</p>` : '' }
    `;
}
