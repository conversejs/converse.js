import { html } from 'lit';
import { __ } from 'i18n';
import { _converse, api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';

class RegisterLink extends CustomElement {
    render() {
        const i18n_create_account = __('Create an account');
        const i18n_hint_no_account = __("Don't have a chat account?");
        return this.shouldShow()
            ? html`
                  <div class="mt-3 text-center switch-form">
                      <p class="mb-1">${i18n_hint_no_account}</p>
                      <a class="register-account toggle-register-login" href="#converse/register"
                          >${i18n_create_account}</a
                      >
                  </div>
              `
            : '';
    }

    shouldShow() {
        return (
            api.settings.get('allow_registration') &&
            !api.settings.get('auto_login') &&
            _converse.pluggable.plugins['converse-register'].enabled(_converse)
        );
    }
}

api.elements.define('converse-register-link', RegisterLink);

export default RegisterLink;
