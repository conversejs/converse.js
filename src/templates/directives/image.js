import { converse } from "@converse/headless/converse-core";
import { directive, html } from "lit-html";


export const renderImage = directive((url, onLoad, onClick) => part => {
    function onError () {
        part.setValue(converse.env.utils.convertUrlToHyperlink(url));
        part.commit();
    }
    part.setValue(
        html`<a href="${url}"
                class="chat-image__link"
                target="_blank"
                rel="noopener"
            ><img class="chat-image img-thumbnail" src="${url}" @click=${onClick} @error=${onError} @load=${onLoad}/></a>`
    );
});
