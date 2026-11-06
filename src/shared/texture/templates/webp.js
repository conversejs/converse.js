import { html } from 'lit';
import { getHyperlinkTemplate } from 'utils/html.js';
import 'shared/webp/component.js';

/**
 * @param {string} url
 * @param {boolean} hide_url
 * @param {Function} [onImgClick] - Called when a WebP rendered as a regular image is clicked
 * @param {Function} [onImgLoad] - Called when a WebP rendered as a regular image has loaded
 */
export default (url, hide_url, onImgClick, onImgLoad) =>
    html`<converse-webp
            autoplay
            noloop
            fallback="empty"
            src=${url}
            .onImgClick=${onImgClick}
            .onImgLoad=${onImgLoad}
        ></converse-webp>${hide_url ? '' : getHyperlinkTemplate(url)}`;
