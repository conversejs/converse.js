import { __ } from 'i18n';
import { html } from "lit";
import { modal_header_close_button } from "plugins/modal/templates/buttons.js"

export default (o) => {
    const i18n_moderator_tools = __('Moderator Tools');
    return html`
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="converse-modtools-modal-label">${i18n_moderator_tools}</h5>
                    ${modal_header_close_button}
                </div>
                <div class="modal-body d-flex flex-column">
                    <converse-modtools jid=${o.jid} affiliation=${o.affiliation}></converse-modtools>
                </div>
            </div>
        </div>`;
}
