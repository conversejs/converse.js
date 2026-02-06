import { html } from 'lit';
import { api } from '@converse/headless';
import tplSpinner from 'templates/spinner.js';
import { __ } from 'i18n';
import { tplConnectionURLInput } from '../../controlbox/templates/loginform.js';
import tplSwitchForm from './switch_form.js';
import tplRegistrationForm from './registration_form.js';

/**
 * Fetches XMPP providers from XMPP Providers API
 * Returns providers in categories A and B
 * @returns {Promise<Array<{domain: string, name: string, category: string}>>}
 */
async function getXMPPProviders() {
    try {
        const response = await fetch('https://invent.kde.org/melvo/xmpp-providers/-/raw/master/providers.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Filter providers by category A or B
        const providers = [];
        for (const [domain, info] of Object.entries(data)) {
            if (info.category === 'A' || info.category === 'B') {
                providers.push({
                    domain: domain,
                    name: info.name || domain,
                    category: info.category
                });
            }
        }
        
        // Sort by category (A first) then by name
        providers.sort((a, b) => {
            if (a.category !== b.category) {
                return a.category.localeCompare(b.category);
            }
            return a.name.localeCompare(b.name);
        });
        
        return providers;
    } catch (error) {
        console.error('Error fetching XMPP providers:', error);
        return [];
    }
}

/**
 * Returns a function that provides autocomplete suggestions
 * @param {Array} providers - List of XMPP providers
 * @returns {Function}
 */
function getAutoCompleteList(providers) {
    return (query) => {
        const q = query.toLowerCase();
        return providers.filter(p => 
            p.domain.toLowerCase().includes(q) || 
            p.name.toLowerCase().includes(q)
        ).map(p => ({
            label: `${p.name} (${p.domain}) [${p.category}]`,
            value: p.domain
        }));
    };
}

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
    
    // Get autocomplete list function
    const acList = el.providers ? getAutoCompleteList(el.providers) : () => [];
    
    return html`
        <converse-autocomplete
            .getAutoCompleteList="${acList}"
            .data="${(item) => item}"
            .validate="${(value) => value ? '' : __('Please enter a domain')}"
            placeholder="${domain_placeholder}"
            name="domain"
            value="${el.domain}"
            filter="startswith"
            min_chars="1"
            @autocomplete-select="${(ev) => { el.domain = ev.detail.suggestion.value; }}"
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

export { getXMPPProviders };
