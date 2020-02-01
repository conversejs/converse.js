import { html } from "lit-html";

export default (o) => html`<div class="alert ${o.type}" role="alert"><p>${o.message}</p></div>`
