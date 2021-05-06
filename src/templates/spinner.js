import { html } from "lit";

export default (o={}) => html`<span class="spinner fa fa-spinner centered ${o.classes || ''}"/>`
