import tplSwitchForm from './switch_form.js';
import { __ } from 'i18n';
import { api } from '@converse/headless/core';
import { html } from 'lit';

export default (el) => {
    const i18n_choose_provider = __('Choose a different provider');
    const i18n_legend = __('Account Registration:');
    const i18n_register = __('Register');
    const registration_domain = api.settings.get('registration_domain');

    return html`
        <form id="converse-register" class="converse-form" @submit=${ev => el.onFormSubmission(ev)}>
            <legend class="col-form-label">${i18n_legend} ${el.domain}</legend>
            <p class="title">${el.title}</p>
            <p class="form-help instructions">${el.instructions}</p>
            <div class="form-errors hidden"></div>
            ${el.form_fields}

            <fieldset class="buttons form-group">
                ${el.fields
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
                              @click=${ev => el.renderProviderChoiceForm(ev)}
                          />
                      `}
                ${ tplSwitchForm() }
            </fieldset>
        </form>
    `;
};
