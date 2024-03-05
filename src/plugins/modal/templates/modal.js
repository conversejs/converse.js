import tplAlertComponent from "./modal-alert.js";
import { html } from "lit";
import { modal_header_close_button } from "./buttons.js";


/**
 * @param {import ('../modal').default} el
 */
export default (el) => {
    const alert = el.model?.get('alert');
    const level = el.model?.get('level') ?? '';
    return html`
        <div class="modal-dialog" role="document" role="dialog">
            <div class="modal-content">
                <div class="modal-header ${level}">
                    <h5 class="modal-title">${el.getModalTitle()}</h5>
                    ${modal_header_close_button}
                </div>
                <div class="modal-body">
                    <span class="modal-alert">
                        ${ alert ? tplAlertComponent({'type': `alert-${alert.type}`, 'message': alert.message}) :  ''}
                    </span>
                    ${ el.renderModal() }
                </div>
                ${ el.renderModalFooter() }
            </div>
        </div>
    `;
}
