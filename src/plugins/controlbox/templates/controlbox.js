/**
 * @typedef {import('../controlbox').default} ControlBoxView
 */
import tplSpinner from 'templates/spinner.js';
import { _converse, api, converse, constants } from '@converse/headless';
import { html } from 'lit';

const { Strophe } = converse.env;
const { ANONYMOUS } = constants;

/**
 * @param {ControlBoxView} el
 */
function whenNotConnected(el) {
    const connection_status = _converse.state.connfeedback.get('connection_status');
    if ([Strophe.Status.RECONNECTING, Strophe.Status.CONNECTING].includes(connection_status)) {
        return tplSpinner();
    }
    if (el.model.get('active-form') === 'register') {
        return html`<converse-register-panel></converse-register-panel>`;
    }
    return html`<converse-login-form
        id="converse-login-panel"
        class="controlbox-pane fade-in row g-0"
    ></converse-login-form>`;
}

/**
 * @param {ControlBoxView} el
 */
export default (el) => {
    const sticky_controlbox = api.settings.get('sticky_controlbox');

    return html` <div class="flyout box-flyout">
        <converse-dragresize></converse-dragresize>
        <div class="chat-head controlbox-head">
            ${sticky_controlbox
                ? ''
                : html`
                      <a class="chatbox-btn close-chatbox-button" @click=${(ev) => el.close(ev)}>
                          <converse-icon class="fa fa-times" size="1em"></converse-icon>
                      </a>
                  `}
        </div>
        <div class="controlbox-panes">
            <div class="controlbox-pane">
                ${el.model.get('connected')
                    ? html` <converse-user-profile></converse-user-profile>
                          <converse-headlines-feeds-list class="controlbox-section"></converse-headlines-feeds-list>
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
        </div>
    </div>`;
};
