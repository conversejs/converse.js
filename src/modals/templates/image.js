import { html } from "lit";
import { __ } from 'i18n';
import { modal_close_button, modal_header_close_button } from "plugins/modal/templates/buttons.js"


export default (o) => {
    return html`
        <div class="modal-dialog fit-content" role="document">
            <div class="modal-content fit-content">
                <div class="modal-header">
                    <h4 class="modal-title" id="message-versions-modal-label">${__('Image: ')}<a target="_blank" rel="noopener" href="${o.src}">${o.src}</a></h4>
                    ${modal_header_close_button}
                </div>
                <div class="modal-body modal-body--image fit-content">
                    <img class="chat-image" src="${o.src}" @load=${o.onload}>
                </div>
                <div class="modal-footer">${modal_close_button}</div>
            </div>
        </div>`;
}
