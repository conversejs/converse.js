import { api } from "@converse/headless";
import { html } from "lit";

/**
 * @param {MouseEvent} ev
 */
function onClickXMPPURI(ev) {
    ev.preventDefault();
    api.rooms.open(/** @type {HTMLAnchorElement} */ (ev.target).href);
}

/**
 * @param {URL} url - The url object containing the link information.
 * @param {string} url_text - The text to display for the link.
 * @returns {import("lit").TemplateResult} The HTML template for the link.
 */
export default (url, url_text) => {
    if (url.protocol === "xmpp:" && url.searchParams.get("join") != null) { // eslint-disable-line no-eq-null
        return html` <a target="_blank" rel="noopener" @click="${onClickXMPPURI}" href="${url.href}">${url_text}</a>`;
    }
    return html`<a target="_blank" rel="noopener" href="${url.href}">${url_text}</a>`;
};
