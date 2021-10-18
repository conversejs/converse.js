import 'shared/components/message-versions.js';
import { __ } from 'i18n';
import { html } from "lit";
import { modal_close_button, modal_header_close_button } from "plugins/modal/templates/buttons.js"


export default (model) => html`
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h4 class="modal-title" id="message-versions-modal-label">${__('Message versions')}</h4>
                ${modal_header_close_button}
            </div>
            <div class="modal-body">
                <converse-message-versions .model=${model}></converse-message-versions>
            </div>
            <div class="modal-footer">${modal_close_button}</div>
        </div>
    </div>
`;
