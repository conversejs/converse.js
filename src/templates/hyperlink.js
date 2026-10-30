import { html } from "lit";
import { invitationToXMPPURI, isHandledXMPPURI } from "shared/xmpp-uri.js";
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

    // An invitation link from another client (xmpp.link and friends) is handled
    // like the `xmpp:` URI it wraps. The href stays the https one, so copying or
    // middle-clicking the link still gets the page.
    const xmpp_uri = invitationToXMPPURI(url);
    if (xmpp_uri && isHandledXMPPURI(xmpp_uri)) {
        const onClick = (/** @type {MouseEvent} */ ev) => {
            ev.preventDefault();
            dispatchXMPPURI(xmpp_uri);
        };
        return html`<a target="_blank" rel="noopener" @click="${onClick}" href="${url.href}">${url_text}</a>`;
    }
    return html`<a target="_blank" rel="noopener" href="${url.href}">${url_text}</a>`;
};
