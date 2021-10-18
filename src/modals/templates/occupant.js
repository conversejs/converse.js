import { html } from "lit";
import { modal_close_button, modal_header_close_button } from "plugins/modal/templates/buttons.js"
import { renderAvatar } from 'shared/directives/avatar';


export default (o) => {
    return html`
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="user-details-modal-label">${o.display_name}</h5>
                    ${modal_header_close_button}
                </div>
                <div class="modal-body">
                    ${renderAvatar(o.avatar_data)}
                </div>
                <div class="modal-footer">
                    ${modal_close_button}
                </div>
            </div>
        </div>
    `;
}
