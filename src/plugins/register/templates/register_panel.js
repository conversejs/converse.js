import tpl_registration_form from './registration_form.js';
import tpl_spinner from 'templates/spinner.js';
import { __ } from 'i18n';
import { api } from '@converse/headless/core';
import { html } from 'lit';

const tpl_form_request = () => {
    const default_domain = api.settings.get('registration_domain');
    const i18n_fetch_form = __("Hold tight, we're fetching the registration form…");
    const i18n_cancel = __('Cancel');
    return html`
        <form id="converse-register" class="converse-form no-scrolling">
            ${tpl_spinner({ 'classes': 'hor_centered' })}
            <p class="info">${i18n_fetch_form}</p>
            ${default_domain
                ? ''
                : html`
                      <button class="btn btn-secondary button-cancel hor_centered">${i18n_cancel}</button>
                  `}
        </form>
    `;
};

const tpl_domain_input = () => {
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

const tpl_fetch_form_buttons = () => {
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

const tpl_choose_provider = () => {
    const default_domain = api.settings.get('registration_domain');
    const i18n_create_account = __('Create your account');
    const i18n_choose_provider = __('Please enter the XMPP provider to register with:');
    return html`
        <form id="converse-register" class="converse-form">
            <legend class="col-form-label">${i18n_create_account}</legend>
            <div class="form-group">
                <label>${i18n_choose_provider}</label>
                <div class="form-errors hidden"></div>
                ${default_domain ? default_domain : tpl_domain_input()}
            </div>
            ${default_domain ? '' : tpl_fetch_form_buttons()}
        </form>
    `;
};

const CHOOSE_PROVIDER = 0;
const FETCHING_FORM = 1;
const REGISTRATION_FORM = 2;

export default o => {
    return html`
        <converse-brand-logo></converse-brand-logo>
        ${o.model.get('registration_status') === CHOOSE_PROVIDER ? tpl_choose_provider() : ''}
        ${o.model.get('registration_status') === FETCHING_FORM ? tpl_form_request(o) : ''}
        ${o.model.get('registration_status') === REGISTRATION_FORM ? tpl_registration_form(o) : ''}
    `;
};
