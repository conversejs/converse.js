import { __ } from 'i18n';
import { html } from 'lit';

export default () => {
    const i18n_has_account = __('Already have a chat account?');
    const i18n_login = __('Go back to login');
    return html`
        <div class="switch-form">
            <p class="mb-1">${i18n_has_account}</p>
            <a class="login-here toggle-register-login" href="#converse/login">${i18n_login}</a>
        </div>`;
}
