import { html } from 'lit';
import { api } from '@converse/headless';
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
 * Helper: check if an object has any keys (non-empty).
 * @param {Object|undefined|null} obj
 * @returns {boolean}
 */
function hasKeys(obj) {
    return obj !== null && obj !== undefined && typeof obj === 'object' && Object.keys(obj).length > 0;
}

/**
 * Renders the expandable detail panel for a provider.
 * @param {import('../types.ts').XMPPProvider} provider
 * @returns {import('lit').TemplateResult}
 */
function tplProviderDetails(provider) {
    const is_free = provider.freeOfCharge;
    const is_company = provider.organization === 'company' || provider.organization === 'commercial person';
    const professional_hosting = provider.professionalHosting;
    const has_password_reset = hasKeys(provider.passwordReset);
    const has_legal_notice = hasKeys(provider.legalNotice);
    const since = provider.since ? formatSinceDate(provider.since) : '';
    const archive_time = provider.maximumMessageArchiveManagementStorageTime;
    const upload_size = provider.maximumHttpFileUploadFileSize;
    const upload_time = provider.maximumHttpFileUploadStorageTime;

    return html`
        <div class="provider-details">
            <div class="provider-details__item">
                <span class="provider-details__label">${__('Free')}:</span>
                <span class="provider-details__value">${is_free ? __('Yes') : __('No')}</span>
            </div>
            <div class="provider-details__item">
                <span class="provider-details__label">${__('Company')}:</span>
                <span class="provider-details__value">${is_company ? __('Yes') : __('No')}</span>
            </div>
            <div class="provider-details__item">
                <span class="provider-details__label">${__('Professional hosted')}:</span>
                <span class="provider-details__value">${professional_hosting ? __('Yes') : __('No')}</span>
            </div>
            <div class="provider-details__item">
                <span class="provider-details__label">${__('Password reset')}:</span>
                <span class="provider-details__value">${has_password_reset ? __('Yes') : __('No')}</span>
            </div>
            ${has_legal_notice ? html`
                <div class="provider-details__item">
                    <span class="provider-details__label">${__('Legal notice')}:</span>
                    <span class="provider-details__value">${__('Yes')}</span>
                </div>
            ` : ''}
            ${since ? html`
                <div class="provider-details__item">
                    <span class="provider-details__label">${__('Online since')}:</span>
                    <span class="provider-details__value">${since}</span>
                </div>
            ` : ''}
            ${archive_time !== undefined && archive_time !== null ? html`
                <div class="provider-details__item">
                    <span class="provider-details__label">${__('Message archive storage time')}:</span>
                    <span class="provider-details__value">${archive_time > 0 ? __('%1$s days', archive_time) : '-'}</span>
                </div>
            ` : ''}
            ${upload_size !== undefined && upload_size !== null ? html`
                <div class="provider-details__item">
                    <span class="provider-details__label">${__('File upload size limit')}:</span>
                    <span class="provider-details__value">${upload_size > 0 ? `${upload_size} MB` : '-'}</span>
                </div>
            ` : ''}
            ${upload_time !== undefined && upload_time !== null ? html`
                <div class="provider-details__item">
                    <span class="provider-details__label">${__('File upload storage time')}:</span>
                    <span class="provider-details__value">${upload_time > 0 ? __('%1$s days', upload_time) : '-'}</span>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Renders a single provider row in the provider list.
 * @param {import('../types.ts').XMPPProvider} provider
 * @param {import('../form.js').default} el
 * @returns {import('lit').TemplateResult}
 */
function tplProviderRow(provider, el) {
    const category = provider.category || '';
    const compliance = provider.ratingXmppComplianceTester;
    const isExpanded = el.expanded_provider === provider.jid;

    const categoryClass = category === 'A'
        ? 'badge-category-a'
        : category === 'B'
            ? 'badge-category-b'
            : 'badge-category-other';

    return html`
        <div class="provider-row-wrapper">
            <div class="provider-row ${isExpanded ? 'provider-row--expanded' : ''}"
                 @click=${(ev) => el.onToggleProviderDetails(ev, provider.jid)}>
                <span class="provider-row__chevron">
                    <converse-icon class="fa ${isExpanded ? 'fa-caret-down' : 'fa-caret-right'}" size="1em"></converse-icon>
                </span>
                <span class="provider-row__jid">${provider.jid}</span>
                <span class="provider-row__badge ${categoryClass}">${category}</span>
                ${compliance !== undefined && compliance !== null && compliance >= 0
                    ? html`<span class="provider-row__compliance ${compliance === 100 ? 'compliance-full' : ''}"
                          >${compliance}%</span>`
                    : ''}
                ${provider.category === 'B' && hasKeys(provider.registrationWebPage)
                    ? html`<a class="provider-row__register-btn"
                              href="${Object.values(provider.registrationWebPage)[0]}"
                              target="_blank" rel="noopener"
                              @click=${(ev) => ev.stopPropagation()}>
                        <converse-icon class="fa fa-user-plus" size="0.85em"></converse-icon>
                        ${__('Register')}
                    </a>`
                    : html`<button type="button" class="provider-row__register-btn"
                            @click=${(ev) => { ev.stopPropagation(); el.onProviderSelected(provider.jid); }}>
                        <converse-icon class="fa fa-user-plus" size="0.85em"></converse-icon>
                        ${__('Register')}
                    </button>`
                }
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
    const categoryClass = category === 'A'
        ? 'badge-category-a'
        : category === 'B'
            ? 'badge-category-b'
            : 'badge-category-other';

    return html`
        <div class="provider-category">
            <div class="provider-category__header">
                <span class="provider-category__title">${__('Category')}</span>
                <span class="provider-category__badge ${categoryClass}">${category}</span>
            </div>
            <p class="provider-category__desc">${description}</p>
            <div class="provider-category__list">
                ${providers.map(p => tplProviderRow(p, el))}
            </div>
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

    const catA = providers.filter(p => p.category === 'A');
    const catB = providers.filter(p => p.category === 'B');

    return html`
        <div class="xmpp-providers-list">
            ${tplCategorySection(
                'A',
                __('With these providers you can register directly inside this app.'),
                catA,
                el
            )}
            ${tplCategorySection(
                'B',
                __('For these providers, you\'ll need to register externally via a web page.'),
                catB,
                el
            )}
        </div>
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
            <form id="converse-register" class="converse-form" @submit=${(ev) => el.onFormSubmission(ev)}>
                <legend class="col-form-label">${i18n_create_account}</legend>
                <div class="pt-3">${default_domain}</div>
            </form>
        `;
    }

    // If xmpp_providers_url is not set, show the legacy domain input form
    if (!xmpp_providers_url) {
        const i18n_providers = __('Tip: A list of public XMPP providers is available');
        const i18n_providers_link = __('here');
        const i18n_register = __('Fetch registration form');
        const domain_placeholder = api.settings.get('domain_placeholder');
        return html`
            <form id="converse-register" class="converse-form" @submit=${(ev) => el.onFormSubmission(ev)}>
                <legend class="col-form-label">${i18n_create_account}</legend>
                <div class="form-group">
                    <label for="reg-domain">${__('Please enter the XMPP provider to register with:')}</label>
                    <input class="form-control" required="required" type="text" name="domain"
                           placeholder="${domain_placeholder}">
                    <p class="form-text text-muted">${i18n_providers}
                        <a href="${href_providers}" class="url" target="_blank" rel="noopener">${i18n_providers_link}</a>.
                    </p>
                </div>
                ${api.settings.get('show_connection_url_input')
                    ? html`
                        <div class="form-group">
                            <label for="reg-connection-url">${__('Connection URL')}</label>
                            <input class="form-control" id="reg-connection-url" type="text" name="connection-url"
                                   placeholder="${__('e.g. https://example.org/http-bind')}">
                        </div>`
                    : ''}
                <input class="btn btn-primary" type="submit" value="${i18n_register}">
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
                : tplSpinner({ 'classes': 'hor_centered' })}
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
