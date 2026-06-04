import { html } from 'lit';
import { api, u } from '@converse/headless';
import tplSpinner from 'templates/spinner.js';
import { __ } from 'i18n';
import tplSwitchForm from './switch_form.js';
import tplRegistrationForm from './registration_form.js';

/**
 * @param {import('../form.js').default} el
 */
function tplFormRequest(el) {
    const default_domain = api.settings.get('registration_domain');
    const i18n_cancel = __('Cancel');
    return html`
        <form
            id="converse-register"
            class="converse-form no-scrolling"
            @submit=${(/** @type {Event} */ ev) => el.onFormSubmission(ev)}
        >
            ${tplSpinner({ 'class': 'hor_centered' })}
            ${default_domain
                ? ''
                : html`
                      <button
                          class="btn btn-secondary button-cancel hor_centered"
                          @click=${(/** @type {Event} */ ev) => el.renderProviderChoiceForm(ev)}
                      >
                          ${i18n_cancel}
                      </button>
                  `}
        </form>
    `;
}

/**
 * Helper: format a "since" date string.
 * @param {string} dateStr
 * @returns {string}
 */
function formatSinceDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
        return dateStr;
    }
}

/**
 * Renders the expandable detail panel for a provider.
 * @param {import('../types.ts').XMPPProvider} provider
 * @returns {import('lit').TemplateResult}
 */
function tplProviderDetails(provider) {
    const compliance = provider.ratingXmppComplianceTester;
    const is_free = provider.freeOfCharge;
    const is_company = provider.organization === 'company' || provider.organization === 'commercial person';
    const professional_hosting = provider.professionalHosting;
    const has_password_reset = !u.isEmpty(provider.passwordReset);
    const has_legal_notice = !u.isEmpty(provider.legalNotice);
    const since = provider.since ? formatSinceDate(provider.since) : '';
    const archive_time = provider.maximumMessageArchiveManagementStorageTime;
    const upload_size = provider.maximumHttpFileUploadFileSize;
    const upload_time = provider.maximumHttpFileUploadStorageTime;

    return html`
        <div class="provider-details">
            ${compliance !== undefined && compliance !== null && compliance >= 0
                ? html`
                      <div class="provider-details__item">
                          <span class="provider-details__label">${__('XMPP Compliance')}:</span>
                          <span class="provider-details__value">${compliance}%</span>
                      </div>
                  `
                : ''}
            <div class="provider-details__item">
                <span class="provider-details__label">${__('Free of charge')}:</span>
                <span class="provider-details__value">${is_free ? __('Yes') : __('No')}</span>
            </div>
            <div class="provider-details__item">
                <span class="provider-details__label">${__('Company')}:</span>
                <span class="provider-details__value">${is_company ? __('Yes') : __('No')}</span>
            </div>
            <div class="provider-details__item">
                <span class="provider-details__label">${__('Professional hosting')}:</span>
                <span class="provider-details__value">${professional_hosting ? __('Yes') : __('No')}</span>
            </div>
            <div class="provider-details__item">
                <span class="provider-details__label">${__('Password reset')}:</span>
                <span class="provider-details__value">${has_password_reset ? __('Yes') : __('No')}</span>
            </div>
            ${has_legal_notice
                ? html`
                      <div class="provider-details__item">
                          <span class="provider-details__label">${__('Legal notice')}:</span>
                          <span class="provider-details__value">${__('Yes')}</span>
                      </div>
                  `
                : ''}
            ${since
                ? html`
                      <div class="provider-details__item">
                          <span class="provider-details__label">${__('Online since')}:</span>
                          <span class="provider-details__value">${since}</span>
                      </div>
                  `
                : ''}
            ${archive_time !== undefined && archive_time !== null
                ? html`
                      <div class="provider-details__item">
                          <span class="provider-details__label">${__('Message archive storage time')}:</span>
                          <span class="provider-details__value"
                              >${archive_time > 0 ? __('%1$s days', archive_time) : '-'}</span
                          >
                      </div>
                  `
                : ''}
            ${upload_size !== undefined && upload_size !== null
                ? html`
                      <div class="provider-details__item">
                          <span class="provider-details__label">${__('File upload size limit')}:</span>
                          <span class="provider-details__value">${upload_size > 0 ? `${upload_size} MB` : '-'}</span>
                      </div>
                  `
                : ''}
            ${upload_time !== undefined && upload_time !== null
                ? html`
                      <div class="provider-details__item">
                          <span class="provider-details__label">${__('File upload storage time')}:</span>
                          <span class="provider-details__value"
                              >${upload_time > 0 ? __('%1$s days', upload_time) : '-'}</span
                          >
                      </div>
                  `
                : ''}
        </div>
    `;
}

/**
 * Looks up the best translated URL from a locale-keyed object.
 * Uses the i18n setting, falls back to 'en', then to the first available value.
 * @param {{ [key: string]: string }|undefined|null} url_map
 * @returns {string}
 */
function getLocalizedURL(url_map) {
    if (u.isEmpty(url_map)) return '';
    const locale = api.settings.get('i18n');
    const lang = locale ? locale.split('-')[0].toLowerCase() : 'en';
    return url_map[lang] || url_map['en'] || Object.values(url_map)[0] || '';
}

/**
 * Renders a single provider row in the provider list.
 * @param {import('../types.ts').XMPPProvider} provider
 * @param {import('../form.js').default} el
 * @returns {import('lit').TemplateResult}
 */
function tplProviderRow(provider, el) {
    const category = provider.category || '';
    const isExpanded = el.expanded_provider === provider.jid;

    const categoryClass =
        category === 'A' ? 'badge-category-a' : category === 'B' ? 'badge-category-b' : 'badge-category-other';

    return html`
        <div class="provider-row-wrapper">
            <div
                class="provider-row ${isExpanded ? 'provider-row--expanded' : ''}"
                @click=${(/** @type {Event} */ ev) => el.onToggleProviderDetails(ev, provider.jid)}
            >
                <span class="provider-row__chevron">
                    <converse-icon
                        class="fa ${isExpanded ? 'fa-caret-down' : 'fa-caret-right'}"
                        size="1em"
                    ></converse-icon>
                </span>
                <span class="provider-row__jid">${provider.jid}</span>
                <span class="provider-row__badge ${categoryClass}">${category}</span>
                ${provider.category === 'B' && !u.isEmpty(provider.registrationWebPage)
                    ? html`<a
                          class="provider-row__register-btn"
                          href="${getLocalizedURL(provider.registrationWebPage)}"
                          target="_blank"
                          rel="noopener"
                      >
                          <converse-icon class="fa fa-user-plus" size="0.85em"></converse-icon>
                          ${__('Register')}
                      </a>`
                    : html`<button
                          type="button"
                          class="provider-row__register-btn"
                          @click=${(/** @type {Event} */ ev) => {
                              ev.stopPropagation();
                              el.onProviderSelected(provider.jid);
                          }}
                      >
                          <converse-icon class="fa fa-user-plus" size="0.85em"></converse-icon>
                          ${__('Register')}
                      </button>`}
            </div>
            ${isExpanded ? tplProviderDetails(provider) : ''}
        </div>
    `;
}

/**
 * Renders a category section with its providers.
 * @param {string} category
 * @param {string} description
 * @param {import('../types.ts').XMPPProvider[]} providers
 * @param {import('../form.js').default} el
 * @returns {import('lit').TemplateResult|string}
 */
function tplCategorySection(category, description, providers, el) {
    if (!providers.length) return '';
    const categoryClass =
        category === 'A' ? 'badge-category-a' : category === 'B' ? 'badge-category-b' : 'badge-category-other';

    return html`
        <div class="provider-category">
            <div class="provider-category__header">
                <span class="provider-category__title">${__('Category')}</span>
                <span class="provider-category__badge ${categoryClass}">${category}</span>
            </div>
            <p class="provider-category__desc">${description}</p>
            <div class="provider-category__list">${providers.map((p) => tplProviderRow(p, el))}</div>
        </div>
    `;
}

/**
 * Renders the full provider list grouped by category.
 * @param {import('../form.js').default} el
 * @returns {import('lit').TemplateResult|string}
 */
function tplProviderList(el) {
    const providers = el.xmpp_providers || [];
    if (!providers.length) return '';

    const catA = /** @type {import('../types.ts').XMPPProvider[]} */ (/** @type {unknown} */ (providers)).filter(
        (p) => p.category === 'A',
    );
    const catB = /** @type {import('../types.ts').XMPPProvider[]} */ (/** @type {unknown} */ (providers)).filter(
        (p) => p.category === 'B',
    );

    return html`
        <div class="xmpp-providers-list">
            ${tplCategorySection('A', __('With these providers you can register directly inside this app.'), catA, el)}
            ${tplCategorySection(
                'B',
                __("For these providers, you'll need to register externally via a web page."),
                catB,
                el,
            )}
        </div>
    `;
}

/**
 * Renders the free-text "enter a provider domain manually" fields, shared
 * between the legacy domain-input form and the disclosure beneath the
 * categorized provider list.
 * @returns {import('lit').TemplateResult}
 */
function tplManualDomainFields() {
    const href_providers = api.settings.get('providers_link');
    const domain_placeholder = api.settings.get('domain_placeholder');
    const i18n_providers = __('Tip: A list of public XMPP providers is available');
    const i18n_providers_link = __('here');
    const i18n_register = __('Fetch registration form');
    return html`
        <div class="form-group">
            <label for="reg-domain">${__('Please enter the XMPP provider to register with:')}</label>
            <input
                class="form-control"
                required="required"
                type="text"
                name="domain"
                placeholder="${domain_placeholder}"
            />
            <p class="form-text text-muted">
                ${i18n_providers}
                <a href="${href_providers}" class="url" target="_blank" rel="noopener">${i18n_providers_link}</a>.
            </p>
        </div>
        ${api.settings.get('show_connection_url_input')
            ? html` <div class="form-group">
                  <label for="reg-connection-url">${__('Connection URL')}</label>
                  <input
                      class="form-control"
                      id="reg-connection-url"
                      type="text"
                      name="connection-url"
                      placeholder="${__('e.g. https://example.org/http-bind')}"
                  />
              </div>`
            : ''}
        <input class="btn btn-primary" type="submit" value="${i18n_register}" />
    `;
}

/**
 * @param {import('../form.js').default} el
 */
function tplChooseProvider(el) {
    const default_domain = api.settings.get('registration_domain');
    const xmpp_providers_url = api.settings.get('xmpp_providers_url');
    const i18n_create_account = __('Create your account');
    const href_providers = api.settings.get('providers_link');
    const i18n_existing_account = __('Already have a chat account?');
    const i18n_login = __('Go back to login');

    if (default_domain) {
        return html`
            <form
                id="converse-register"
                class="converse-form"
                @submit=${(/** @type {Event} */ ev) => el.onFormSubmission(ev)}
            >
                <legend class="col-form-label">${i18n_create_account}</legend>
                <div class="pt-3">${default_domain}</div>
            </form>
        `;
    }

    // If xmpp_providers_url is not set, show the legacy domain input form
    if (!xmpp_providers_url) {
        return html`
            <form
                id="converse-register"
                class="converse-form"
                @submit=${(/** @type {Event} */ ev) => el.onFormSubmission(ev)}
            >
                <legend class="col-form-label">${i18n_create_account}</legend>
                ${tplManualDomainFields()}
                <div class="switch-form">
                    <p class="mb-1">${i18n_existing_account}</p>
                    <a class="login-here toggle-register-login" href="#converse/login">${i18n_login}</a>
                </div>
            </form>
        `;
    }

    // Show the categorized provider list
    const i18n_choose_provider = __('Choose an XMPP provider to register with:');
    const has_providers = el.xmpp_providers?.length > 0;
    const i18n_browse_all = __('Browse all providers');
    const show_manual = el.show_manual_registration_domain;
    const i18n_manual_prompt = __("Don't see your provider?");
    const i18n_manual_toggle = show_manual ? __('Hide manual entry') : __('Enter a provider manually');

    return html`
        <div id="converse-register" class="converse-form">
            <legend class="col-form-label">${i18n_create_account}</legend>
            <p class="provider-list-section__label">${i18n_choose_provider}</p>
            ${has_providers
                ? html`
                      ${tplProviderList(el)}
                      <p class="provider-list-section__footer">
                          <a href="${href_providers}" class="url" target="_blank" rel="noopener">${i18n_browse_all}</a>
                      </p>
                  `
                : tplSpinner({ 'class': 'hor_centered' })}
            <div class="manual-registration-domain">
                <p class="manual-registration-domain__toggle">
                    ${i18n_manual_prompt}
                    <a
                        href="#"
                        class="url"
                        aria-expanded="${show_manual}"
                        @click=${(/** @type {Event} */ ev) => el.toggleManualRegistrationDomain(ev)}
                        >${i18n_manual_toggle}</a
                    >
                </p>
                ${show_manual
                    ? html`<form
                          class="converse-form manual-registration-domain__form"
                          @submit=${(/** @type {Event} */ ev) => el.onFormSubmission(ev)}
                      >
                          ${tplManualDomainFields()}
                      </form>`
                    : ''}
            </div>
            <div class="switch-form">
                <p class="mb-1">${i18n_existing_account}</p>
                <a class="login-here toggle-register-login" href="#converse/login">${i18n_login}</a>
            </div>
        </div>
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
