import { html } from 'lit';
import 'shared/webp/component.js';

/**
 * @param {string} url
 * @param {boolean} hide_url
 */
export default (url, hide_url) =>
    html`<converse-webp autoplay noloop fallback="empty" src=${url}></converse-webp>${hide_url
            ? ''
            : html`<a target="_blank" rel="noopener" href="${url}">${url}</a>`}`;
