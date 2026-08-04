import { html } from "lit";
import { isHandledXMPPURI } from "shared/xmpp-uri.js";
import { dispatchXMPPURI } from "shared/xmpp-uri-dispatch.js";

/**
 * @param {MouseEvent} ev
 */
function onClickXMPPURI(ev) {
    ev.preventDefault();
    dispatchXMPPURI(/** @type {HTMLAnchorElement} */ (ev.currentTarget).href);
}

/**
 * @param {URL} url - The url object containing the link information.
 * @param {string} url_text - The text to display for the link.
 * @returns {import("lit").TemplateResult} The HTML template for the link.
 */
export default (url, url_text) => {
    // A handled XEP-0147 `xmpp:` URI (join a room, open a chat, add a contact, ...)
    // is dispatched in-app; every other link opens in a new tab as before.
    if (url.protocol === "xmpp:" && isHandledXMPPURI(url.href)) {
        return html` <a target="_blank" rel="noopener" @click="${onClickXMPPURI}" href="${url.href}">${url_text}</a>`;
    }
    return html`<a target="_blank" rel="noopener" href="${url.href}">${url_text}</a>`;
};
