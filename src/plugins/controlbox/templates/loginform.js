import { html } from 'lit';
import { _converse, api, constants } from '@converse/headless';
import tplSpinner from 'templates/spinner.js';
import { CONNECTION_STATUS_CSS_CLASS } from '../constants.js';
import { __ } from 'i18n';
import 'shared/components/brand-heading.js';
import 'shared/components/footer.js';

const { ANONYMOUS, EXTERNAL, LOGIN, PREBIND, CONNECTION_STATUS } = constants;

/**
 * @param {boolean} checked
 */
function tplTrustCheckbox(checked) {
    const i18n_hint_trusted = __(
        'To improve performance, we cache your data in this browser. ' +
            'Uncheck this box if this is a public computer or if you want your data to be deleted when you log out. ' +
            "It's important that you explicitly log out, otherwise not all cached data might be deleted. " +
            'Please note, when using an untrusted device, OMEMO encryption is NOT available.'
    );
    const i18n_trusted = __('This is a trusted device');
    return html`
        <div class="form-check mb-2 login-trusted">
            <input
                id="converse-login-trusted"
                type="checkbox"
                class="form-check-input"
                name="trusted"
                ?checked=${checked}
            />
            <label for="converse-login-trusted" class="form-check-label login-trusted__desc">${i18n_trusted}</label>
            <converse-popover title="${__('Info')}" text="${i18n_hint_trusted}"></converse-popover>
        </div>
    `;
}

export function tplConnectionURLInput() {
    const i18n_connection_url = __('Connection URL');
    const i18n_form_help = __('HTTP or websocket URL that is used to connect to your XMPP server');
    const i18n_placeholder = __('e.g. wss://example.org/xmpp-websocket');
    return html`
        <div class="mb-3 fade-in">
            <label for="converse-conn-url" class="form-label">${i18n_connection_url}</label>
            <p class="form-help instructions">${i18n_form_help}</p>
            <input
                required
                id="converse-conn-url"
                class="form-control"
                type="url"
                name="connection-url"
                placeholder="${i18n_placeholder}"
            />
        </div>
    `;
}

function tplPasswordInput() {
    const i18n_password = __('Password');
    return html`
        <div class="mb-3">
            <label for="converse-login-password" class="form-label">${i18n_password}</label>
            <input
                id="converse-login-password"
                class="form-control"
                required="required"
                value="${api.settings.get('password') ?? ''}"
                type="password"
                name="password"
                placeholder="${i18n_password}"
            />
        </div>
    `;
}

function tplRegisterLink() {
    const i18n_create_account = __('Create an account');
    const i18n_hint_no_account = __("Don't have a chat account?");
    return html`
        <div class="mt-3 text-center switch-form">
            <p class="mb-1">${i18n_hint_no_account}</p>
            <a class="register-account toggle-register-login" href="#converse/register">${i18n_create_account}</a>
        </div>
    `;
}

function tplShowRegisterLink() {
    return (
        api.settings.get('allow_registration') &&
        !api.settings.get('auto_login') &&
        _converse.pluggable.plugins['converse-register'].enabled(_converse)
    );
}

function tplAuthFields() {
    const authentication = api.settings.get('authentication');
    const i18n_login = __('Log in');
    const i18n_xmpp_address = __('XMPP Address');
    const locked_domain = api.settings.get('locked_domain');
    const default_domain = api.settings.get('default_domain');
    const placeholder_username = ((locked_domain || default_domain) && __('Username')) || __('user@domain');
    const show_trust_checkbox = api.settings.get('allow_user_trust_override');

    return html`
        <div class="mb-3">
            <label for="converse-login-jid" class="form-label">${i18n_xmpp_address}:</label>
            <input
                id="converse-login-jid"
                ?autofocus=${api.settings.get('auto_focus') ? true : false}
                value="${api.settings.get('jid') ?? ''}"
                required
                class="form-control"
                type="text"
                name="jid"
                placeholder="${placeholder_username}"
            />
        </div>
        ${authentication !== EXTERNAL ? tplPasswordInput() : ''}
        ${api.settings.get('show_connection_url_input') ? tplConnectionURLInput() : ''}
        ${show_trust_checkbox ? tplTrustCheckbox(show_trust_checkbox === 'off' ? false : true) : ''}
        <div class="text-center mb-3">
            <button class="btn btn-primary px-5 mx-auto" type="submit">${i18n_login}</button>
        </div>
        ${tplShowRegisterLink() ? tplRegisterLink() : ''}
    `;
}

function tplFormFields() {
    const authentication = api.settings.get('authentication');
    const i18n_disconnected = __('Disconnected');
    const i18n_anon_login = __('Click here to log in anonymously');
    return html`
        ${authentication == LOGIN || authentication == EXTERNAL ? tplAuthFields() : ''}
        ${authentication == ANONYMOUS
            ? html`<div class="text-center mb-3">
                  <button class="btn btn-primary login-anon px-5 mx-auto" type="submit">${i18n_anon_login}</button>
              </div>`
            : ''}
        ${authentication == PREBIND ? html`<p class="alert alert-warning">${i18n_disconnected}</p>` : ''}
    `;
}

/**
 * @param {import('../loginform.js').default} el
 */
export default (el) => {
    const { connfeedback } = _converse.state;
    const connection_status = connfeedback.get('connection_status');
    const feedback_class = CONNECTION_STATUS_CSS_CLASS?.[connection_status] ?? 'none';
    const conn_feedback_message = connfeedback.get('message');
    return html`<form id="converse-login" class="converse-form" method="post" @submit=${el.onLoginFormSubmitted}>
        <div
            class="alert ${`alert-${feedback_class}`} conn-feedback mb-3 ${!conn_feedback_message ? 'd-none' : ''}"
            role="alert"
        >
            <span class="feedback-message">${conn_feedback_message}</span>
        </div>
        ${['CONNECTED', 'CONNECTING', 'AUTHENTICATING', 'RECONNECTING'].includes(CONNECTION_STATUS[connection_status])
            ? html`<div class="text-center my-3">${tplSpinner()}</div>`
            : tplFormFields()}
    </form>`;
};
