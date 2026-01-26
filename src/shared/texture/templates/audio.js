import { html } from "lit";

import "../components/audio-player.js";

/**
 * Renders an accessible audio player for the given URL.
 * The audio player uses custom controls that work with screen readers.
 * @param {string} url - The URL of the audio file
 * @param {boolean} [hide_url] - Whether to hide the URL link
 * @param {string} [title] - Optional title for the audio
 */
export default (url, hide_url, title) => {
    return html`<converse-audio-player
        src="${url}"
        title="${title || ""}"
        ?hide_url="${hide_url}"
    ></converse-audio-player>`;
};
