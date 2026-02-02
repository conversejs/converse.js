import { html } from 'lit';
import { api } from '@converse/headless';
import tplSpinner from 'templates/spinner.js';
import { __ } from 'i18n';
import { tplConnectionURLInput } from '../../controlbox/templates/loginform.js';
import tplSwitchForm from './switch_form.js';
import tplRegistrationForm from './registration_form.js';

/**
 * @param {import('../form.js').default} el
 */
function tplFormRequest(el) {
    const default_domain = api.settings.get('registration_domain');
    const i18n_cancel = __('Cancel');
    return html`
        <form id="converse-register" class="converse-form no-scrolling" @submit=${(ev) => el.onFormSubmission(ev)}>
            ${tplSpinner({ 'classes': 'hor_centered' })}
            ${default_domain
                ? ''
                : html`
                      <button
                          class="btn btn-secondary button-cancel hor_centered"
                          @click=${(ev) => el.renderProviderChoiceForm(ev)}
                      >
                          ${i18n_cancel}
                      </button>
                  `}
        </form>
    `;
}

/**
 * @param {import('../form.js').default} el
 */
function tplDomainInput(el) {
    const domain_placeholder = api.settings.get('domain_placeholder');
    const i18n_providers = __('Tip: A list of public XMPP providers is available');
    const i18n_providers_link = __('here');
    const href_providers = api.settings.get('providers_link');
    const providers = api.settings.get('registration_providers') || [];
    return html`
        <converse-autocomplete
            .list=${providers}
            filter="startswith"
            name="domain"
            placeholder="${domain_placeholder}"
            ?required=${true}
            .value=${el.domain || ''}
        ></converse-autocomplete>
        <p class="form-text text-muted">
            ${i18n_providers}
            <a href="${href_providers}" class="url" target="_blank" rel="noopener">${i18n_providers_link}</a>.
        </p>
        ${api.settings.get('show_connection_url_input') ? tplConnectionURLInput() : ''}
    `;
}

function tplFetchFormButtons() {
    const i18n_register = __('Fetch registration form');
    const i18n_existing_account = __('Already have a chat account?');
    const i18n_login = __('Go back to login');
    return html`
        <fieldset class="form-group buttons">
            <input class="btn btn-primary" type="submit" value="${i18n_register}" />
        </fieldset>
        <div class="switch-form">
            <p class="mb-1">${i18n_existing_account}</p>
            <a class="login-here toggle-register-login" href="#converse/login">${i18n_login}</a>
        </div>
    `;
}

/**
 * @param {import('../form.js').default} el
 */
function tplChooseProvider(el) {
    const default_domain = api.settings.get('registration_domain');
    const i18n_create_account = __('Create your account');
    const i18n_choose_provider = __('Please enter the XMPP provider to register with:');
    const show_form_buttons = !default_domain && el.status === CHOOSE_PROVIDER;

    return html`
        <form id="converse-register" class="converse-form" @submit=${(ev) => el.onFormSubmission(ev)}>
            <legend class="col-form-label">${i18n_create_account}</legend>
            <div class="pt-3">
                <label class="form-label">${i18n_choose_provider}</label>
                ${default_domain ? default_domain : tplDomainInput(el)}
            </div>
            ${show_form_buttons ? tplFetchFormButtons() : ''}
        </form>
    `;
}

const CHOOSE_PROVIDER = 0;
const FETCHING_FORM = 1;
const REGISTRATION_FORM = 2;
const REGISTRATION_FORM_ERROR = 3;

/**
 * @param {import('../form.js').default} el
 */
export default (el) => {
    return html`
        ${el.alert_message
            ? html`<div class="alert alert-${el.alert_type}" role="alert">${el.alert_message}</div>`
            : ''}
        ${el.status === CHOOSE_PROVIDER ? tplChooseProvider(el) : ''}
        ${el.status === FETCHING_FORM ? tplFormRequest(el) : ''}
        ${el.status === REGISTRATION_FORM ? tplRegistrationForm(el) : ''}
        ${el.status === REGISTRATION_FORM_ERROR ? tplSwitchForm() : ''}
    `;
};
