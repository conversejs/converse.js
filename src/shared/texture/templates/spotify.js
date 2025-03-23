import { html } from "lit";
import { u } from "@converse/headless";

/**
 * @param {string} song_id - The ID of the song to embed.
 * @param {string} url - The URL to link to (if not hidden).
 * @param {boolean} hide_url - Flag to determine if the URL should be hidden.
 * @returns {import('lit').TemplateResult}
 */
export default (song_id, url, hide_url) => {
    const { hostname } = u.getURL(url);
    return html`<figure>
        <iframe
            style="border-radius:12px"
            src="https://open.spotify.com/embed/track/${song_id}"
            width="100%"
            height="352"
            frameborder="0"
            allowfullscreen=""
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
        ></iframe>
        ${hide_url ? "" : html`<a target="_blank" rel="noopener" title="${url}" href="${url}">${hostname}</a>`}
    </figure>`;
};
