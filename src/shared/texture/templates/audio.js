import { html } from "lit";
import { u } from "@converse/headless";

import "../styles/audio.scss";

/**
 * @param {string} url
 * @param {boolean} [hide_url]
 * @param {string} [title]
 */
export default (url, hide_url, title) => {
    const { hostname } = u.getURL(url);
    const label = title || (hostname ? `Audio from ${hostname}` : 'Audio');
    return html`<figure class="audio-element" role="group" aria-label="${label}">
        ${title || !hide_url
            ? html`<figcaption>
                  ${title ? html`${title}</br>` : ""}
                  ${hide_url
                      ? ""
                      : html`<a target="_blank" rel="noopener" title="${url}" href="${url}">${hostname}</a>`}
              </figcaption>`
            : ""}
        <audio controls preload="metadata" src="${url}" aria-label="${label}" tabindex="0"></audio>
    </figure>`;
};
