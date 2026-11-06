import { html } from "lit";
import { invitationToXMPPURI, isHandledXMPPURI } from "shared/xmpp-uri.js";
import { dispatchXMPPURI } from "shared/xmpp-uri-dispatch.js";

/**
 * The `xmpp:` URI a link is handled in-app as: a handled XEP-0147 `xmpp:` URI
 * (join a room, open a chat, add a contact, ...), or an invitation link from
 * another client (xmpp.link and friends) for the `xmpp:` URI it wraps.
 * @param {URL} url
 * @returns {string|null}
 */
function getHandledXMPPURI(url) {
    const xmpp_uri = url.protocol === "xmpp:" ? url.href : invitationToXMPPURI(url);
    return xmpp_uri && isHandledXMPPURI(xmpp_uri) ? xmpp_uri : null;
}

/**
 * A click with a modifier key or another button asks the browser for something
 * else (a new tab or window, a download), so it's left to the browser, which
 * then gets the invitation page or the OS handler.
 * @param {MouseEvent} ev
 */
function onClickXMPPURI(ev) {
    if (ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;

    const xmpp_uri = getHandledXMPPURI(new URL(/** @type {HTMLAnchorElement} */ (ev.currentTarget).href));
    if (!xmpp_uri) return;

    ev.preventDefault();
    dispatchXMPPURI(xmpp_uri);
}

/**
 * @param {URL} url - The url object containing the link information.
 * @param {string} url_text - The text to display for the link.
 * @returns {import("lit").TemplateResult} The HTML template for the link.
 */
export default (url, url_text) => {
    // A link handled in-app keeps its original href, so copying it still gets
    // the invitation page or the `xmpp:` URI. Every other link opens in a new
    // tab as before.
    if (getHandledXMPPURI(url)) {
        return html`<a target="_blank" rel="noopener" @click="${onClickXMPPURI}" href="${url.href}">${url_text}</a>`;
    }
    return html`<a target="_blank" rel="noopener" href="${url.href}">${url_text}</a>`;
};
