import URI from 'urijs';
import { AsyncDirective } from 'lit/async-directive.js';
import { converse } from '@converse/headless/core';
import { directive } from 'lit/directive.js';
import { html } from 'lit';

class ImageDirective extends AsyncDirective {
    render (src, href, onLoad, onClick) {
        return html`
            <a href="${href}" class="chat-image__link" target="_blank" rel="noopener"
                ><img
                    class="chat-image img-thumbnail"
                    src="${src}"
                    @click=${onClick}
                    @error=${() => this.onError(src, href, onLoad, onClick)}
                    @load=${onLoad}
            /></a>
        `;
    }

    onError (src, href, onLoad, onClick) {
        const u = converse.env.utils;
        if (u.isURLWithImageExtension(src)) {
            this.setValue(u.convertUrlToHyperlink(href));
        } else {
            // Before giving up and falling back to just rendering a hyperlink,
            // we attach `.png` and try one more time.
            // This works with some Imgur URLs
            const uri = new URI(src);
            const filename = uri.filename();
            uri.filename(`${filename}.png`);
            this.setValue(renderImage(uri.toString(), href, onLoad, onClick));
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
