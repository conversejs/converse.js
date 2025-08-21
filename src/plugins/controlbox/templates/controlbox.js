import { html, nothing } from 'lit';
import { _converse, api, converse } from '@converse/headless';
import { getChatStyle } from 'shared/chat/utils.js';

const { Strophe } = converse.env;

/**
 * @param {import('../controlbox').default} el
 */
function whenNotConnected(el) {
    const is_fullscreen = api.settings.get('view_mode') === 'fullscreen';
    const connection_status = _converse.state.connfeedback.get('connection_status');
    const connecting = [Strophe.Status.RECONNECTING, Strophe.Status.CONNECTING, Strophe.Status.CONNECTED].includes(
        connection_status
    );
    const view_mode = api.settings.get('view_mode');
    const show_bg = api.settings.get('show_background');

    return html`
        ${show_bg && view_mode === 'fullscreen' ? html`<converse-bg></converse-bg>` : ''}
        <converse-controlbox-buttons class="controlbox-padded"></converse-controlbox-buttons>
        <div class="controlbox-pane d-flex flex-column justify-content-between">
            ${connecting
                ? html`<converse-spinner class="vertically-centered fade-in"></converse-spinner>`
                : el.model.get('active-form') === 'register'
                  ? html`${is_fullscreen ? html`<converse-controlbox-navbar></converse-controlbox-navbar>` : ''}
                        <converse-brand-logo></converse-brand-logo>
                        <converse-registration-form class="fade-in rounded"></converse-registration-form>
                        ${is_fullscreen ? html`<converse-footer></converse-footer>` : ''} `
                  : html`${is_fullscreen ? html`<converse-controlbox-navbar></converse-controlbox-navbar>` : ''}
                        <converse-brand-logo></converse-brand-logo>
                        <converse-login-form class="fade-in rounded"></converse-login-form>
                        ${is_fullscreen ? html`<converse-footer></converse-footer>` : ''} `}
        </div>
    `;
}

/**
 * @param {import('../controlbox').default} el
 */
export default (el) => {
    const style = getChatStyle(el.model);
    const { renderControlbox } = api.apps.getActive();
    return html`<div class="flyout box-flyout" style="${style || nothing}">
        ${api.settings.get('view_mode') === 'overlayed' ? html`<converse-dragresize></converse-dragresize>` : ''}
        ${el.model.get('connected')
            ? html`<converse-user-profile></converse-user-profile>
                  <div class="controlbox-pane">${renderControlbox()}</div>`
            : whenNotConnected(el)}
    </div>`;
};
