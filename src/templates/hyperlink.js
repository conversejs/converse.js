import { api } from  "@converse/headless/core";
import { getURL } from '@converse/headless/utils/url.js';
import { html } from "lit";

function onClickXMPPURI (ev) {
    ev.preventDefault();
    api.rooms.open(ev.target.href);
}

export default (url_text) => {
    const href_text = getURL(url_text) ? url_text : 'http://' + url_text;
    const url = getURL(href_text);
    if (url.protocol === 'xmpp:' && url.search === '?join') {
        return html`
            <a target="_blank"
               rel="noopener"
               @click=${onClickXMPPURI}
               href="${href_text}">${url_text}</a>`;
    }
    return html`<a target="_blank" rel="noopener" href="${href_text}">${url_text}</a>`;
}
