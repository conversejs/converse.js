import { html } from 'lit';
import { AsyncDirective } from 'lit/async-directive.js';
import { directive } from 'lit/directive.js';
import { getHyperlinkTemplate } from 'utils/html.js';
import { isURLWithImageExtension } from '../utils';

class ImageDirective extends AsyncDirective {
    /**
     * @param {string} src - The source URL of the image.
     * @param {string} [href] - The optional hyperlink for the image.
     * @param {Function} [onLoad] - Callback function to be called once the image has loaded.
     * @param {Function} [onClick] - Callback function to be called once the image has been clicked.
     * @returns {import('lit').TemplateResult}
     */
    render(src, href, onLoad, onClick) {
        return href
            ? html`<a href="${href}" class="chat-image__link" target="_blank" rel="noopener"
                  >${this.renderImage(src, href, onLoad, onClick)}</a
              >`
            : this.renderImage(src, href, onLoad, onClick);
    }

    /**
     * @param {string} src - The source URL of the image.
     * @param {string} [href] - The optional hyperlink for the image.
     * @param {Function} [onLoad] - Callback function to be called once the image has loaded.
     * @param {Function} [onClick] - Callback function to be called once the image has been clicked.
     * @returns {import('lit').TemplateResult}
     */
    renderImage(src, href, onLoad, onClick) {
        return html`<img class="chat-image img-thumbnail"
                    loading="lazy"
                    src="${src}"
                    @click=${onClick}
                    @error=${() => this.onError(src, href, onLoad, onClick)}
                    @load="${onLoad}"/></a>`;
    }

    /**
     * Handles errors that occur during image loading.
     * @param {string} src - The source URL of the image that failed to load.
     * @param {string} [href] - The optional hyperlink for the image.
     * @param {Function} [onLoad] - Callback function to be called once the image has loaded.
     * @param {Function} [onClick] - Callback function to be called once the image has been clicked.
     */
    onError(src, href, onLoad, onClick) {
        if (!this.isConnected) {
            return href ? getHyperlinkTemplate(href) : html`<span>Image failed to load</span>`;
        }

        if (isURLWithImageExtension(src)) {
            href && this.setValue(getHyperlinkTemplate(href));
        } else {
            try {
                const url = new URL(src);
                const filename = url.pathname.split('/').pop();
                if (filename) {
                    const new_filename = `${filename}.png`;
                    url.pathname = url.pathname.replace(filename, new_filename);
                    this.setValue(renderImage(url.toString(), href, onLoad, onClick));
                }
            } catch (error) {
                console.error('Invalid URL:', src);
                return href ? getHyperlinkTemplate(href) : html`<span>Image failed to load</span>`;
            }
        }
    }
}

/**
 * lit directive which attempts to render an <img> element from a URL.
 * It will fall back to rendering an <a> element if it can't.
 *
 * @param { String } src - The value that will be assigned to the `src` attribute of the `<img>` element.
 * @param { String } href - The value that will be assigned to the `href` attribute of the `<img>` element.
 * @param { Function } onLoad - A callback function to be called once the image has loaded.
 * @param { Function } onClick - A callback function to be called once the image has been clicked.
 */
export const renderImage = directive(ImageDirective);
