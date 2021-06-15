import { html } from "lit";

export default (o={}) => {
    if (o.classes?.includes('hor_centered')) {
        return html`<div class="spinner__container"><span class="spinner fa fa-spinner centered ${o.classes || ''}"/></div>`
    } else {
        return html`<span class="spinner fa fa-spinner centered ${o.classes || ''}"/>`
    }
}
