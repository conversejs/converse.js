import { html } from 'lit';
import 'shared/webp/component.js';

/**
 * @param {string} url
 * @param {boolean} hide_url
 */
export default (url, hide_url) =>
    html`<converse-webp src=${url}></converse-webp>${hide_url
            ? ''
            : 'Deliberately not showing the URL for WebP images.'}`;
