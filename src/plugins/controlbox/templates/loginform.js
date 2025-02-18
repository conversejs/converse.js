import { html } from 'lit';
import { _converse, api, constants } from '@converse/headless';
import 'shared/components/brand-heading.js';
import tplSpinner from 'templates/spinner.js';
import { REPORTABLE_STATUSES, PRETTY_CONNECTION_STATUS, CONNECTION_STATUS_CSS_CLASS } from '../constants.js';
import { __ } from 'i18n';

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
        <div class="form-check login-trusted">
            <input
                id="converse-login-trusted"
                type="checkbox"
                class="form-check-input p-1 me-1"
                name="trusted"
                ?checked=${checked}
            />
            <label for="converse-login-trusted" class="form-check-label login-trusted__desc">${i18n_trusted}</label>
            <button type="button" class="btn p-0"
                data-toggle="popover"
                title="${i18n_hint_trusted}"
                data-content="${i18n_hint_trusted}">
                <converse-icon class="fa fa-info-circle" size="1.2em"></converse-icon>
            </button>
        </div>
    `;
};

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
};

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
};

function tplRegisterLink() {
    const i18n_create_account = __('Create an account');
    const i18n_hint_no_account = __("Don't have a chat account?");
    return html`
        <fieldset class="switch-form">
            <p>${i18n_hint_no_account}</p>
            <p>
                <a class="register-account toggle-register-login" href="#converse/register">${i18n_create_account}</a>
            </p>
        </fieldset>
    `;
};

function tplShowRegisterLink() {
    return (
        api.settings.get('allow_registration') &&
        !api.settings.get('auto_login') &&
        _converse.pluggable.plugins['converse-register'].enabled(_converse)
    );
};

function tplAuthFields() {
    const authentication = api.settings.get('authentication');
    const i18n_login = __('Log in');
    const i18n_xmpp_address = __('XMPP Address');
    const locked_domain = api.settings.get('locked_domain');
    const default_domain = api.settings.get('default_domain');
    const placeholder_username = ((locked_domain || default_domain) && __('Username')) || __('user@domain');
    const show_trust_checkbox = api.settings.get('allow_user_trust_override');

    return html`
        <fieldset class="form-group">
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
        </fieldset>
        <fieldset class="form-group buttons">
            <input class="btn btn-primary" type="submit" value="${i18n_login}" />
        </fieldset>
        ${tplShowRegisterLink() ? tplRegisterLink() : ''}
    `;
};

function tplFormFields() {
    const authentication = api.settings.get('authentication');
    const i18n_disconnected = __('Disconnected');
    const i18n_anon_login = __('Click here to log in anonymously');
    return html`
        ${authentication == LOGIN || authentication == EXTERNAL ? tplAuthFields() : ''}
        ${authentication == ANONYMOUS
            ? html`<input class="btn btn-primary login-anon" type="submit" value="${i18n_anon_login}" />`
            : ''}
        ${authentication == PREBIND ? html`<p>${i18n_disconnected}</p>` : ''}
    `;
};

/**
 * @param {import('../loginform.js').default} el
 */
export default (el) => {
    const { connfeedback } = _converse.state;
    const connection_status = connfeedback.get('connection_status');
    let feedback_class, pretty_status;
    if (REPORTABLE_STATUSES.includes(connection_status)) {
        pretty_status = PRETTY_CONNECTION_STATUS[connection_status];
        feedback_class = CONNECTION_STATUS_CSS_CLASS[connection_status];
    }
    const conn_feedback_message = connfeedback.get('message');
    return html` <converse-brand-heading></converse-brand-heading>
        <form id="converse-login" class="converse-form" method="post" @submit=${el.onLoginFormSubmitted}>
            <div class="conn-feedback fade-in ${!pretty_status ? 'hidden' : feedback_class}">
                <p class="feedback-subject">${pretty_status}</p>
                <p class="feedback-message ${!conn_feedback_message ? 'hidden' : ''}">${conn_feedback_message}</p>
            </div>
            ${CONNECTION_STATUS[connection_status] === 'CONNECTING'
                ? tplSpinner()
                : tplFormFields()}
        </form>`;
};
