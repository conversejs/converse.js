import tpl_alert_component from "./modal-alert.js";
import { html } from "lit";
import { modal_close_button, modal_header_close_button } from "plugins/modal/templates/buttons.js";


export default (el) => {
    const alert = el.model?.get('alert');
    const level = el.model?.get('level') ?? '';
    return html`
        <div class="modal-dialog" role="document" tabindex="-1" role="dialog" aria-hidden="true">
            <div class="modal-content">
                <div class="modal-header ${level}">
                    <h5 class="modal-title">${el.getModalTitle()}</h5>
                    ${modal_header_close_button}
                </div>
                <div class="modal-body">
                    <span class="modal-alert">
                        ${ alert ? tpl_alert_component({'type': `alert-${alert.type}`, 'message': alert.message}) :  ''}
                    </span>
                    ${ el.renderModal?.() ?? '' }
                </div>
                ${ el.renderModalFooter?.() ?? html`<div class="modal-footer">${ modal_close_button }</div>` }
            </div>
        </div>
    `;
}
