import { html } from 'lit';
import { __ } from 'i18n';

const modal_close_button = html`<button type="button" class="btn btn-secondary" data-dismiss="modal">${__('Close')}</button>`;

export default () => {
    const i18n_modal_title = __('Jingle Call');
    return html`
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="muc-list-modal-label">${i18n_modal_title}</h5>
                </div>
                <div class="modal-body d-flex flex-column">
                    <span class="modal-alert"></span>
                    <ul class="available-chatrooms list-group">
                    </ul>
                </div>
                <div class="container text-center cl-2">
                <button type="button" class="btn btn-success">Audio Call</button>
                <button type="button" class="btn btn-primary">Video Call</button>
                </div>
                <div class="modal-footer">${modal_close_button}</div>
            </div>
        </div>
    `;
}
