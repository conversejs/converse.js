import { html } from "lit";
import { navigateToControlBox } from '../utils.js';

export default  (jid) => {
    return html`<converse-icon size="1em" class="fa fa-arrow-left" @click=${() => navigateToControlBox(jid)}></converse-icon>`
}
