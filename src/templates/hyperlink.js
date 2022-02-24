import { api } from  "@converse/headless/core";
import { html } from "lit";

function onClickXMPPURI (ev) {
    ev.preventDefault();
    api.rooms.open(ev.target.href);
}

export default (uri, url_text) => {
    let href_text = uri.normalizePath().toString();
    if (!uri._parts.protocol && !url_text.startsWith('http://') && !url_text.startsWith('https://')) {
        href_text = 'http://' + href_text;
    }
    if (uri._parts.protocol === 'xmpp' && uri._parts.query === 'join') {
        return html`
            <a target="_blank"
               rel="noopener"
               @click=${onClickXMPPURI}
               href="${href_text}">${url_text}</a>`;
    }
    return html`<a target="_blank" rel="noopener" href="${href_text}">${url_text}</a>`;
}
