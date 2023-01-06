import 'shared/components/image.js';
import { getURL, isGIFURL, isDomainAllowed } from '@converse/headless/utils/url.js';
import { html } from 'lit';

function isValidImage (image) {
    return image && isDomainAllowed(image, 'allowed_image_domains') && (getURL(image) instanceof URL);
}

const tpl_url_wrapper = (o, wrapped_template) =>
    o.url && !isGIFURL(o.image)
        ? html`<a href="${o.url}" target="_blank" rel="noopener">${wrapped_template(o)}</a>`
        : wrapped_template(o);

const tpl_image = o =>
    html`<converse-image class="card-img-top hor_centered" href="${o.url}" src="${o.image}" .onImgLoad=${o.onload}></converse-image>`;

export default o => {
    const show_image = isValidImage(o.image);
    const has_body_info = o.title || o.description || o.url;
    if (show_image || has_body_info) {
        return html`<div class="card card--unfurl">
            ${show_image ? tpl_image(o) : ''}
            ${has_body_info
                ? html` <div class="card-body">
                      ${o.title ? tpl_url_wrapper(o, o => html`<h5 class="card-title">${o.title}</h5>`) : ''}
                      ${o.description
                          ? html`<p class="card-text">
                                <converse-rich-text text=${o.description}></converse-rich-text>
                            </p>`
                          : ''}
                      ${o.url
                          ? html`<p class="card-text">
                                <a href="${o.url}" target="_blank" rel="noopener">${getURL(o.url).host}</a>
                            </p>`
                          : ''}
                  </div>`
                : ''}
        </div>`;
    } else {
        return '';
    }
};
