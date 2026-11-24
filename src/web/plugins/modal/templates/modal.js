import { html } from 'lit';
import { __ } from 'i18n';
import { modal_header_close_button } from './buttons.js';

/**
 * @param {string} type
 * @param {'danger'|'warning'|'info'} message
 */
function tplAlert(type, message) {
    return html`<div class="alert alert-${type}" role="alert">${message}</div>`;
}

/**
 * @param {import ('../modal').default} el
 */
export default (el) => {
    const alert = el.state?.get('alert');
    const level = el.state?.get('level') ?? '';
    const i18n_offline = __(
        'You are offline. This needs a connection, so it has to wait until you are connected again.',
    );
    return html`
        <div class="modal-dialog" role="document" role="dialog">
            <div class="modal-content">
                <div class="modal-header ${level}">
                    <h5 class="modal-title">${el.getModalTitle()}</h5>
                    ${modal_header_close_button}
                </div>
                <div class="modal-body">
                    ${el.needsConnection() ? tplAlert('warning', i18n_offline) : ''}
                    ${alert ? tplAlert(alert.type, alert.message) : ''} ${el.renderModal()}
                </div>
                ${el.renderModalFooter()}
            </div>
        </div>
    `;
};
