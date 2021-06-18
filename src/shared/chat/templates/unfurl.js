import { converse } from "@converse/headless/core";
import { getURI } from 'utils/html.js';
import { html } from 'lit';
const u = converse.env.utils;

function isValidURL (url) {
    // We don't consider relative URLs as valid
    return !!getURI(url).host();
}

function isValidImage (image) {
    return image && u.isImageDomainAllowed(image) && isValidURL(image);
}

const tpl_url_wrapper = (o, wrapped_template) =>
    (o.url && isValidURL(o.url)) ?
        html`<a href="${o.url}" target="_blank" rel="noopener">${wrapped_template(o)}</a>` : wrapped_template(o);

const tpl_image = (o) => html`<img class="card-img-top" src="${o.image}" @load=${o.onload}/>`;

export default (o) => {
    const valid_image = isValidImage(o.image);
    const has_body_info = o.title || o.description || o.url;
    if (valid_image || has_body_info) {
        return html`<div class="card card--unfurl">
            ${ valid_image ? tpl_url_wrapper(o, tpl_image) : '' }
            ${ has_body_info ? html`
                <div class="card-body">
                ${ o.title ? tpl_url_wrapper(o, o => html`<h5 class="card-title">${o.title}</h5>`) : ''}
                ${ o.description ? html`<p class="card-text"><converse-rich-text text=${o.description}></converse-rich-text></p>` : '' }
                ${ o.url ? html`<p class="card-text"><a href="${o.url}" target="_blank" rel="noopener">${u.getURI(o.url).domain()}</a></p>` : '' }
                </div>` : '' }
        </div>`;
    } else {
        return '';
    }
}
