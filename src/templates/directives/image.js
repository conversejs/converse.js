import { converse } from "@converse/headless/converse-core";
import { directive, html } from "lit-html";


/**
 * lit-html directive which attempts to render an <img> element from a URL.
 * It will fall back to rendering an <a> element if it can't.
 *
 * @param { String } src - The value that will be assigned to the `src` attribute of the `<img>` element.
 * @param { String } href - The value that will be assigned to the `href` attribute of the `<img>` element.
 * @param { Function } onLoad - A callback function to be called once the image has loaded.
 * @param { Function } onClick - A callback function to be called once the image has been clicked.
*/
export const renderImage = directive((src, href, onLoad, onClick) => part => {
    function onError () {
        const u = converse.env.utils;
        if (u.isURLWithImageExtension(src)) {
            part.setValue(u.convertUrlToHyperlink(href));
            part.commit();
        } else {
            // Before giving up and falling back to just rendering a hyperlink,
            // we attach `.png` and try one more time.
            // This works with some Imgur URLs
            part.setValue(renderImage(`${src}.png`, href, onLoad, onClick));
            part.commit();
        }
    }
    part.setValue(
        html`<a href="${href}"
                class="chat-image__link"
                target="_blank"
                rel="noopener"
            ><img class="chat-image img-thumbnail" src="${src}" @click=${onClick} @error=${onError} @load=${onLoad}/></a>`
    );
});
