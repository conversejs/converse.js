import { __ } from 'i18n';
import { html } from "lit";
import { modal_header_close_button } from "plugins/modal/templates/buttons.js"

export default (modal) => {
    const jid = modal.model.get('jid');
    const i18n_heading = __('Change your nickname');
    return html`
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="converse-modtools-modal-label">
                        ${i18n_heading}</h5>
                    ${modal_header_close_button}
                </div>
                <div class="modal-body d-flex flex-column">
                    <converse-muc-nickname-form jid="${jid}"></converse-muc-nickname-form>
                </div>
            </div>
        </div>`;
}
