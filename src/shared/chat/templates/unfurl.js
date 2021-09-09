import { getURI, isAudioURL, isGIFURL, isVideoURL, isDomainAllowed } from '@converse/headless/utils/url.js';
import { html } from 'lit';


function isValidURL (url) {
    // We don't consider relative URLs as valid
    return !!getURI(url).host();
}

function isValidImage (image) {
    return image && isDomainAllowed(image, 'allowed_image_domains') && isValidURL(image);
}

function shouldHideMediaURL (o) {
    return isGIFURL(o.url) || isVideoURL(o.url) || isAudioURL(o.url);
}

const tpl_url_wrapper = (o, wrapped_template) =>
    (o.url && isValidURL(o.url) && !isGIFURL(o.url)) ?
        html`<a href="${o.url}" target="_blank" rel="noopener">${wrapped_template(o)}</a>` : wrapped_template(o);

const tpl_image = (o) => html`<converse-rich-text class="card-img-top" text="${o.image}" show_images ?hide_media_urls=${shouldHideMediaURL(o.url)} .onImgLoad=${o.onload}></converse-rich-text>`;

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
                ${ o.url ? html`<p class="card-text"><a href="${o.url}" target="_blank" rel="noopener">${getURI(o.url).domain()}</a></p>` : '' }
                </div>` : '' }
        </div>`;
    } else {
        return '';
    }
}
