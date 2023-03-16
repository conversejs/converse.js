import { __ } from 'i18n';
import { html } from 'lit';

export default () => {
    const i18n_has_account = __('Already have a chat account?');
    const i18n_login = __('Log in here');
    return html`
        <div class="switch-form">
            <p>${i18n_has_account}</p>
            <p><a class="login-here toggle-register-login" href="#converse/login">${i18n_login}</a></p>
        </div>`;
}
