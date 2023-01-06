import { AsyncDirective } from 'lit/async-directive.js';
import { directive } from 'lit/directive.js';
import { getHyperlinkTemplate } from 'utils/html.js';
import { html } from 'lit';
import { isURLWithImageExtension } from '@converse/headless/utils/url.js';


class ImageDirective extends AsyncDirective {

    render (src, href, onLoad, onClick) {
        return href ?
            html`<a href="${href}" class="chat-image__link" target="_blank" rel="noopener">${ this.renderImage(src, href, onLoad, onClick) }</a>` :
            this.renderImage(src, href, onLoad, onClick);
    }

    renderImage (src, href, onLoad, onClick) {
        return html`<img class="chat-image img-thumbnail"
                loading="lazy"
                src="${src}"
                @click=${onClick}
                @error=${() => this.onError(src, href, onLoad, onClick)}
                @load=${onLoad}/></a>`;
    }

    onError (src, href, onLoad, onClick) {
        if (isURLWithImageExtension(src)) {
            href && this.setValue(getHyperlinkTemplate(href));
        } else {
            // Before giving up and falling back to just rendering a hyperlink,
            // we attach `.png` and try one more time.
            // This works with some Imgur URLs
            const url = new URL(src);
            const filename = url.pathname.split('/').pop();
            const new_url = new URL(`./${filename}.png`, src);
            this.setValue(renderImage(new_url.toString(), href, onLoad, onClick));
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
