import { html } from 'lit-element';
import { converse } from "@converse/headless/core";
const u = converse.env.utils;

export default (o) => {
    return html`<div class="card card--unfurl">
        ${ o.image && u.isImageDomainAllowed(o.image) ? html`<a href="${o.url}" target="_blank" rel="noopener"><img class="card-img-top" src="${o.image}" @load=${o.onload}/></a>` : '' }
        <div class="card-body">
            <a href="${o.url}" target="_blank" rel="noopener"><h5 class="card-title">${o.title}</h5></a>
            <p class="card-text">${u.addHyperlinks(o.description)}</p>
        </div>
    </div>`;
}
