import { html } from 'lit';
import { getURL } from '../utils.js';

/**
 * @param {string} url
 * @param {boolean} [hide_url]
 */
export default (url, hide_url) => {
    const { hostname } = getURL(url);
    return html`<figure>
        <video controls preload="metadata" src="${url}"></video>
        ${hide_url || !hostname
            ? ''
            : html`<a target="_blank" rel="noopener" title="${url}" href="${url}">${hostname}</a>`}
    </figure>`;
};
