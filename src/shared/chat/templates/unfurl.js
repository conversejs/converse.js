import { html } from 'lit';
import log from '@converse/log';
import { u } from '@converse/headless';
import { isDomainAllowed } from 'utils/url.js';
import 'shared/texture/components/image.js';

/**
 * @param {string} image
 * @returns {boolean}
 */
function isValidImage(image) {
    return image && isDomainAllowed(image, 'allowed_image_domains') && u.isValidURL(image);
}

/**
 * @param {import('../unfurl').default} el
 * @param {(title: string) => import('lit').TemplateResult} wrapped_template
 */
function tplUrlWrapper(el, wrapped_template) {
    const image = el.image || '';
    const url = el.url || '';
    const title = el.title || '';
    return url && u.isValidURL(url) && !u.isGIFURL(image)
        ? html`<a href="${url}" target="_blank" rel="noopener">${wrapped_template(title)}</a>`
        : wrapped_template(title ?? '');
}

/**
 * @param {import('../unfurl').default} el
 */
function tplImage(el) {
    const image = el.image || '';
    const url = el.url || '';
    return html`<converse-image
        class="card-img-top hor_centered"
        href="${url}"
        src="${image}"
        .onImgLoad=${() => el.onImageLoad()}
    ></converse-image>`;
}
/**
 * @param {import('../unfurl').default} el
 */
export default (el) => {
    const description = el.description || '';
    const image = el.image || '';
    const title = el.title || '';
    const url = el.url || '';
    const show_image = isValidImage(image);
    const has_body_info = title || description || url;

    if ((show_image || has_body_info)) {
        return html`<div class="card card--unfurl">
            ${show_image ? tplImage(el) : ''}
            ${has_body_info
                ? html` <div class="card-body">
                      ${title
                          ? tplUrlWrapper(
                                el,
                                /** @param {string} title */ (title) => html`<h5 class="card-title">${title}</h5>`
                            )
                          : ''}
                      ${description
                          ? html`<p class="card-text">
                                <converse-texture text=${description}></converse-texture>
                            </p>`
                          : ''}
                      ${url && u.isValidURL(url)
                          ? html`<p class="card-text">
                                <a href="${url}" target="_blank" rel="noopener">${new URL(url).hostname}</a>
                            </p>`
                          : ''}
                  </div>`
                : ''}
        </div>`;
    } else {
        return '';
    }
};
