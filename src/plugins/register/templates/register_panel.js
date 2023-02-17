import tplRegistrationForm from './registration_form.js';
import tplSpinner from 'templates/spinner.js';
import tplSwitchForm from './switch_form.js';
import { __ } from 'i18n';
import { api } from '@converse/headless/core';
import { html } from 'lit';

const tplFormRequest = (el) => {
    const default_domain = api.settings.get('registration_domain');
    const i18n_cancel = __('Cancel');
    return html`
        <form id="converse-register" class="converse-form no-scrolling" @submit=${ev => el.onFormSubmission(ev)}>
            ${tplSpinner({ 'classes': 'hor_centered' })}
            ${default_domain
                ? ''
                : html`
                    <button class="btn btn-secondary button-cancel hor_centered"
                            @click=${ev => el.renderProviderChoiceForm(ev)}>${i18n_cancel}</button>
                  `}
        </form>
    `;
};

const tplDomainInput = () => {
    const domain_placeholder = api.settings.get('domain_placeholder');
    const i18n_providers = __('Tip: A list of public XMPP providers is available');
    const i18n_providers_link = __('here');
    const href_providers = api.settings.get('providers_link');
    return html`
        <input class="form-control" required="required" type="text" name="domain" placeholder="${domain_placeholder}" />
        <p class="form-text text-muted">
            ${i18n_providers}
            <a href="${href_providers}" class="url" target="_blank" rel="noopener">${i18n_providers_link}</a>.
        </p>
    `;
};

const tplFetchFormButtons = () => {
    const i18n_register = __('Fetch registration form');
    const i18n_existing_account = __('Already have a chat account?');
    const i18n_login = __('Log in here');
    return html`
        <fieldset class="form-group buttons">
            <input class="btn btn-primary" type="submit" value="${i18n_register}" />
        </fieldset>
        <div class="switch-form">
            <p>${i18n_existing_account}</p>
            <p><a class="login-here toggle-register-login" href="#converse/login">${i18n_login}</a></p>
        </div>
    `;
};

const tplChooseProvider = (el) => {
    const default_domain = api.settings.get('registration_domain');
    const i18n_create_account = __('Create your account');
    const i18n_choose_provider = __('Please enter the XMPP provider to register with:');
    const show_form_buttons = !default_domain && el.status === CHOOSE_PROVIDER;

    return html`
        <form id="converse-register" class="converse-form" @submit=${ev => el.onFormSubmission(ev)}>
            <legend class="col-form-label">${i18n_create_account}</legend>
            <div class="form-group">
                <label>${i18n_choose_provider}</label>

                ${default_domain ? default_domain : tplDomainInput()}
            </div>
            ${show_form_buttons ? tplFetchFormButtons() : ''}
        </form>
    `;
};

const CHOOSE_PROVIDER = 0;
const FETCHING_FORM = 1;
const REGISTRATION_FORM = 2;
const REGISTRATION_FORM_ERROR = 3;

export default (el) => {
    return html`
        <converse-brand-logo></converse-brand-logo>
        ${ el.alert_message ? html`<div class="alert alert-${el.alert_type}" role="alert">${el.alert_message}</div>` : '' }
        ${el.status === CHOOSE_PROVIDER ? tplChooseProvider(el) : ''}
        ${el.status === FETCHING_FORM ? tplFormRequest(el) : ''}
        ${el.status === REGISTRATION_FORM ? tplRegistrationForm(el) : ''}
        ${el.status === REGISTRATION_FORM_ERROR ? tplSwitchForm() : '' }
    `;
};
