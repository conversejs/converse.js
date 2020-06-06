import { html } from "lit-html";

export default (o) => html`
    ${ o.show_call_button ? html`<li class="toggle-call fa fa-phone" title="${o.label_start_call}"></li>` : '' }

    ${ o.show_occupants_toggle ?
            html` <li class="toggle-occupants float-right fa ${ o.hidden_occupants ? `fa-angle-double-left` : `fa-angle-double-right` }"
                      title="${o.label_hide_occupants}"></li>` : '' }

    ${ o.message_limit ? html`<li class="message-limit font-weight-bold float-right" title="${o.label_message_limit}">${o.message_limit}</li>` :  '' }
`;
