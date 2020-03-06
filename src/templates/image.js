import { html } from "lit-html";

export default (o) => html`<a href="${o.url}" target="_blank" rel="noopener"><img class="chat-image img-thumbnail" src="${o.url}"/></a>`;
