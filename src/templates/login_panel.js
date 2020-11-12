import tpl_spinner from './spinner.js';
import { __ } from '../i18n';
import { _converse, api } from "@converse/headless/converse-core";
import { html } from "lit-html";


const trust_checkbox = (checked) => {
    const i18n_hint_trusted = __(
        'To improve performance, we cache your data in this browser. '+
        'Uncheck this box if this is a public computer or if you want your data to be deleted when you log out. '+
        'It\'s important that you explicitly log out, otherwise not all cached data might be deleted. '+
        'Please note, when using an untrusted device, OMEMO encryption is NOT available.')
    const i18n_trusted = __('This is a trusted device');
    return html`
        <div class="form-group form-check login-trusted">
            <input id="converse-login-trusted" type="checkbox" class="form-check-input" name="trusted" ?checked=${checked}>
            <label for="converse-login-trusted" class="form-check-label login-trusted__desc">${i18n_trusted}</label>
            <i class="fa fa-info-circle" data-toggle="popover"
                data-title="Trusted device?"
                data-content="${i18n_hint_trusted}"></i>
        </div>
    `;
}

const password_input = () => {
    const i18n_password = __('Password');
    return html`
        <div class="form-group">
            <label for="converse-login-password">${i18n_password}</label>
            <input id="converse-login-password" class="form-control" required="required" type="password" name="password" placeholder="${i18n_password}"/>
        </div>
    `;
}

const register_link = () => {
    const i18n_create_account = __("Create an account");
    const i18n_hint_no_account = __("Don't have a chat account?");
    return html`
        <fieldset class="switch-form">
            <p>${i18n_hint_no_account}</p>
            <p><a class="register-account toggle-register-login" href="#converse/register">${i18n_create_account}</a></p>
        </fieldset>
    `;
}

const show_register_link = () => {
    return _converse.allow_registration &&
        !api.settings.get("auto_login") &&
        _converse.pluggable.plugins['converse-register'].enabled(_converse);
}


const auth_fields = (o) => {
    const i18n_login = __('Log in');
    const i18n_xmpp_address = __("XMPP Address");
    return html`
        <div class="form-group">
            <label for="converse-login-jid">${i18n_xmpp_address}:</label>
            <input id="converse-login-jid"
                ?autofocus=${api.settings.get('auto_focus') ? true : false}
                required
                class="form-control"
                type="text"
                name="jid"
                placeholder="${o.placeholder_username}"/>
        </div>
        ${ (o.authentication !== o.EXTERNAL) ? password_input() : '' }
        ${ o.show_trust_checkbox ? trust_checkbox(o.show_trust_checkbox === 'off' ? false : true) : '' }
        <fieldset class="buttons">
            <input class="btn btn-primary" type="submit" value="${i18n_login}"/>
        </fieldset>
        ${ show_register_link() ? register_link(o) : '' }
    `;
}


const form_fields = (o) => {
    const i18n_disconnected = __('Disconnected');
    const i18n_anon_login = __('Click here to log in anonymously');
    return html`
        ${ (o.authentication == o.LOGIN || o.authentication == o.EXTERNAL) ? auth_fields(o) : '' }
        ${ o.authentication == o.ANONYMOUS ? html`<input class="btn btn-primary login-anon" type="submit" value="${i18n_anon_login}">` : '' }
        ${ o.authentication == o.PREBIND ? html`<p>${i18n_disconnected}</p>` : '' }
    `;
}


export default (o) => html`
    <converse-brand-heading></converse-brand-heading>
    <form id="converse-login" class="converse-form" method="post">
        <div class="conn-feedback fade-in ${ !o.conn_feedback_subject ? 'hidden' : o.conn_feedback_class }">
            <p class="feedback-subject">${ o.conn_feedback_subject }</p>
            <p class="feedback-message ${ !o.conn_feedback_message ? 'hidden' : '' }">${o.conn_feedback_message}</p>
        </div>
        ${ (_converse.CONNECTION_STATUS[o.connection_status] === 'CONNECTING') ? tpl_spinner({'classes': 'hor_centered'}) : form_fields(o) }
    </form>
`;
