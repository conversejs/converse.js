import log from '@converse/headless/log';
import { api } from  "@converse/headless/core";
import { html } from "lit";

function onClickXMPPURI (ev) {
    ev.preventDefault();
    api.rooms.open(ev.target.href);
}

export default (uri, url_text) => {
    let normalized_url;
    try {
        normalized_url = uri.normalize()._string;
    } catch (e) {
        log.error(e);
        return url_text;
    }
    const pretty_url = uri._parts.urn ? normalized_url : uri.readable();
    const visible_url = url_text || pretty_url;
    if (!uri._parts.protocol && !normalized_url.startsWith('http://') && !normalized_url.startsWith('https://')) {
        normalized_url = 'http://' + normalized_url;
    }
    if (uri._parts.protocol === 'xmpp' && uri._parts.query === 'join') {
        return html`
            <a target="_blank"
               rel="noopener"
               @click=${onClickXMPPURI}
               href="${normalized_url}">${visible_url}</a>`;
    }
    return html`<a target="_blank" rel="noopener" href="${normalized_url}">${visible_url}</a>`;
}
