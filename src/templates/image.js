import { html } from "lit-html";

export default (o) => html`<a href="${o.url}" class="chat-image__link" target="_blank" rel="noopener"><img class="chat-image img-thumbnail" src="${o.url}"/></a>`;
