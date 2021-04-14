import { html } from "lit";
import { navigateToControlBox } from '../utils.js';

export default  (jid) => {
    return html`<i class="fa fa-arrow-left" @click=${() => navigateToControlBox(jid)}></i>`
}
