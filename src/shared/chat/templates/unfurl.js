import { u } from '@converse/headless';
import 'shared/components/image.js';
import { isDomainAllowed } from 'utils/url.js';
import { html } from 'lit';

const { getURI, isGIFURL } = u;

/**
 * @param {string} url
 */
function isValidURL (url) {
    // We don't consider relative URLs as valid
    return !!getURI(url).host();
}

function isValidImage (image) {
    return image && isDomainAllowed(image, 'allowed_image_domains') && isValidURL(image);
}

const tplUrlWrapper = (o, wrapped_template) =>
    o.url && isValidURL(o.url) && !isGIFURL(o.image)
        ? html`<a href="${o.url}" target="_blank" rel="noopener">${wrapped_template(o)}</a>`
        : wrapped_template(o);

const tplImage = o =>
    html`<converse-image class="card-img-top hor_centered" href="${o.url}" src="${o.image}" .onImgLoad=${o.onload}></converse-image>`;

export default o => {
    const show_image = isValidImage(o.image);
    const has_body_info = o.title || o.description || o.url;
    if (show_image || has_body_info) {
        return html`<div class="card card--unfurl">
            ${show_image ? tplImage(o) : ''}
            ${has_body_info
                ? html` <div class="card-body">
                      ${o.title ? tplUrlWrapper(o, o => html`<h5 class="card-title">${o.title}</h5>`) : ''}
                      ${o.description
                          ? html`<p class="card-text">
                                <converse-texture text=${o.description}></converse-texture>
                            </p>`
                          : ''}
                      ${o.url
                          ? html`<p class="card-text">
                                <a href="${o.url}" target="_blank" rel="noopener">${getURI(o.url).domain()}</a>
                            </p>`
                          : ''}
                  </div>`
                : ''}
        </div>`;
    } else {
        return '';
    }
};
