import tplSpinner from 'templates/spinner.js';
import { _converse, api, converse, constants } from '@converse/headless';
import { html } from 'lit';

const { Strophe } = converse.env;
const { ANONYMOUS } = constants;

/**
 * @param {import('../controlbox').default} el
 */
function whenNotConnected(el) {
    const connection_status = _converse.state.connfeedback.get('connection_status');
    if ([Strophe.Status.RECONNECTING, Strophe.Status.CONNECTING].includes(connection_status)) {
        return tplSpinner({class: 'vertically-centered'});
    }
    if (el.model.get('active-form') === 'register') {
        return html`<converse-registration-form></converse-registration-form>`;
    }
    return html`<converse-login-form
        id="converse-login-panel"
        class="controlbox-pane fade-in"
    ></converse-login-form>`;
}

/**
 * @param {import('../controlbox').default} el
 */
export default (el) => {
    return html` <div class="flyout box-flyout">
        <converse-dragresize></converse-dragresize>
        ${
            el.model.get('connected') ?
                html`<converse-user-profile></converse-user-profile>` :
                html`<converse-controlbox-buttons class="controlbox-padded"></converse-controlbox-buttons>`
        }
        <div class="controlbox-pane">
            ${el.model.get('connected')
                ? html`<converse-headlines-feeds-list class="controlbox-section"></converse-headlines-feeds-list>
                        <div id="chatrooms" class="controlbox-section">
                            <converse-rooms-list></converse-rooms-list>
                        </div>
                        ${api.settings.get('authentication') === ANONYMOUS
                            ? ''
                            : html`<div id="converse-roster" class="controlbox-section">
                                <converse-roster></converse-roster>
                            </div>`}`
                : whenNotConnected(el)}
        </div>
    </div>`;
};
