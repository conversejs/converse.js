import { html } from "lit-html";

export default (o={}) => html`<span class="spinner fa fa-spinner centered ${o.classes || ''}"/>`
