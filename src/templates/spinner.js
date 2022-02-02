import { html } from "lit";

export default (o={}) => {
    if (o.classes?.includes('hor_centered')) {
        return html`<div class="spinner__container"><converse-icon size="1em" class="fa fa-spinner spinner centered ${o.classes || ''}"></converse-icon></div>`
    } else {
        return html`<converse-icon size="1em" class="fa fa-spinner spinner centered ${o.classes || ''}"></converse-icon>`
    }
}
