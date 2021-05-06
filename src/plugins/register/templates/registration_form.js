import { __ } from 'i18n';
import { api } from '@converse/headless/core';
import { html } from 'lit';

export default o => {
    const i18n_choose_provider = __('Choose a different provider');
    const i18n_has_account = __('Already have a chat account?');
    const i18n_legend = __('Account Registration:');
    const i18n_login = __('Log in here');
    const i18n_register = __('Register');
    const registration_domain = api.settings.get('registration_domain');

    return html`
        <form id="converse-register" class="converse-form">
            <legend class="col-form-label">${i18n_legend} ${o.domain}</legend>
            <p class="title">${o.title}</p>
            <p class="form-help instructions">${o.instructions}</p>
            <div class="form-errors hidden"></div>
            ${o.form_fields}

            <fieldset class="buttons form-group">
                ${o.fields
                    ? html`
                          <input type="submit" class="btn btn-primary" value="${i18n_register}" />
                      `
                    : ''}
                ${registration_domain
                    ? ''
                    : html`
                          <input
                              type="button"
                              class="btn btn-secondary button-cancel"
                              value="${i18n_choose_provider}"
                          />
                      `}
                <div class="switch-form">
                    <p>${i18n_has_account}</p>
                    <p><a class="login-here toggle-register-login" href="#converse/login">${i18n_login}</a></p>
                </div>
            </fieldset>
        </form>
    `;
};
