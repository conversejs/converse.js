import { html } from "lit-html";
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import { until } from 'lit-html/directives/until.js';
import converse from "@converse/headless/converse-core";
import xss from "xss/dist/xss";

const u = converse.env.utils;


export default (o) => {
    const subject = o.subject ? u.addHyperlinks(xss.filterXSS(o.subject.text, {'whiteList': {}})) : '';
    return html`
        <div class="chatbox-title">
            ${ (!o._converse.singleton) ? html`<div class="chatbox-navback"><i class="fa fa-arrow-left"></i></div>` : '' }
            <div class="chatbox-title__text" title="${ (o._converse.locked_muc_domain !== 'hidden') ? o.jid : '' }">${ o.title }</div>
            <div class="chatbox-title__buttons row no-gutters">
                ${ o.buttons.map(b => until(b, '')) }
            </div>
        </div>
        <p class="chat-head__desc">${unsafeHTML(subject)}</p>
    `;
}
