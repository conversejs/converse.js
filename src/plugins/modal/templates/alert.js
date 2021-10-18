import { html } from "lit";
import { modal_header_close_button } from "./buttons.js"


export default (o) => html`
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header ${o.level}">
              <h5 class="modal-title">${o.title}</h5>
              ${modal_header_close_button}
            </div>
            <div class="modal-body">
              <span class="modal-alert"></span>
              ${ o.messages.map(message => html`<p>${message}</p>`) }
            </div>
        </div>
    </div>`;
