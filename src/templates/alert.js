import { html } from "lit";

export default (o) => html`<div class="alert ${o.type}" role="alert"><p>${o.message}</p></div>`
