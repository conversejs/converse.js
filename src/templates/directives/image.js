import { converse } from "@converse/headless/converse-core";
import { directive, html } from "lit-html";


export const renderImage = directive((url, onLoad, onClick) => part => {
    function onError () {
        const u = converse.env.utils;
        if (u.isURLWithImageExtension(url)) {
            part.setValue(u.convertUrlToHyperlink(url));
            part.commit();
        } else {
            // Before giving up and falling back to just rendering a hyperlink,
            // we attach `.png` and try one more time.
            // This works with some Imgur URLs
            part.setValue(renderImage(`${url}.png`, onLoad, onClick));
            part.commit();
        }
    }
    part.setValue(
        html`<a href="${url}"
                class="chat-image__link"
                target="_blank"
                rel="noopener"
            ><img class="chat-image img-thumbnail" src="${url}" @click=${onClick} @error=${onError} @load=${onLoad}/></a>`
    );
});
