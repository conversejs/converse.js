import { html } from 'lit';
import { getURL } from '../utils.js';

import '../styles/audio.scss';

/**
 * @param {string} url
 * @param {boolean} [hide_url]
 * @param {string} [title]
 */
export default (url, hide_url, title) => {
    const { hostname } = getURL(url);
    return html`<figure class="audio-element">
        ${title || !hide_url
            ? html`<figcaption>
                  ${title ? html`${title}</br>` : ''}
                  ${hide_url
                      ? ''
                      : html`<a target="_blank" rel="noopener" title="${url}" href="${url}">${hostname}</a>`}
              </figcaption>`
            : ''}
        <audio controls src="${url}"></audio>
    </figure>`;
};
