import { _converse } from '@converse/headless/core';
import { html } from "lit";
import { until } from 'lit/directives/until.js';
import { getHeadingDropdownItem, getHeadingStandaloneButton } from 'plugins/chatview/utils.js';


export default (o) => {
    const standalone_btns_promise = o.heading_buttons_promise.then(
        btns => btns
            .filter(b => b.standalone)
            .map(b => getHeadingStandaloneButton(b))
            .reverse()
            .map(b => until(b, '')));

    const dropdown_btns_promise = o.heading_buttons_promise.then(
        btns => {
            const dropdown_btns = btns
                .filter(b => !b.standalone)
                .map(b => getHeadingDropdownItem(b));
            return dropdown_btns.length ? html`<converse-dropdown class="dropleft" .items=${dropdown_btns}></converse-dropdown>` : '';
        }
    );

    return html`
        <div class="chatbox-title ${ o.status ? '' :  "chatbox-title--no-desc"}">
            <div class="chatbox-title--row">
                ${ (!_converse.api.settings.get("singleton")) ?  html`<converse-controlbox-navback jid="${o.jid}"></converse-controlbox-navback>` : '' }
                <div class="chatbox-title__text" title="${o.jid}">${ o.display_name }</div>
            </div>
            <div class="chatbox-title__buttons row no-gutters">
                ${ until(dropdown_btns_promise, '') }
                ${ until(standalone_btns_promise, '') }
            </div>
        </div>
        ${ o.status ? html`<p class="chat-head__desc">${ o.status }</p>` : '' }
    `;
}
