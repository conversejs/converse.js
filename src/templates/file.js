import { html } from "lit-html";

export default (o) => html`<a target="_blank" rel="noopener" href="${o.url}">${o.label_download}</a>`;
