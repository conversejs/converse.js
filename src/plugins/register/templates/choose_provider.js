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
 * @param {import('../utils.js').XMPPProvider} provider
 * @returns {import('lit').TemplateResult}
 */
function tplProviderDetails(provider) {
    const isFree = provider.freeOfCharge;
    const isCompany = provider.organization === 'company' || provider.organization === 'commercial person';
    const professionalHosting = provider.professionalHosting;
    const hasPasswordReset = hasKeys(provider.passwordReset);
    const hasLegalNotice = hasKeys(provider.legalNotice);
    const since = provider.since ? formatSinceDate(provider.since) : '';
    const archiveTime = provider.maximumMessageArchiveManagementStorageTime;
    const uploadSize = provider.maximumHttpFileUploadFileSize;
    const uploadTime = provider.maximumHttpFileUploadStorageTime;

    return html`
        <div class="provider-details">
            <div class="provider-details__item">
                <span class="provider-details__label">${__('Free')}:</span>
                <span class="provider-details__value">${isFree ? __('Yes') : __('No')}</span>
            </div>
            <div class="provider-details__item">
                <span class="provider-details__label">${__('Company')}:</span>
                <span class="provider-details__value">${isCompany ? __('Yes') : __('No')}</span>
            </div>
            <div class="provider-details__item">
                <span class="provider-details__label">${__('Professional hosted')}:</span>
                <span class="provider-details__value">${professionalHosting ? __('Yes') : __('No')}</span>
            </div>
            <div class="provider-details__item">
                <span class="provider-details__label">${__('Password reset')}:</span>
                <span class="provider-details__value">${hasPasswordReset ? __('Yes') : __('No')}</span>
            </div>
            ${hasLegalNotice ? html`
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
            ${archiveTime !== undefined && archiveTime !== null ? html`
                <div class="provider-details__item">
                    <span class="provider-details__label">${__('Message archive storage time')}:</span>
                    <span class="provider-details__value">${archiveTime > 0 ? __('%1$s days', archiveTime) : '-'}</span>
                </div>
            ` : ''}
            ${uploadSize !== undefined && uploadSize !== null ? html`
                <div class="provider-details__item">
                    <span class="provider-details__label">${__('File upload size limit')}:</span>
                    <span class="provider-details__value">${uploadSize > 0 ? `${uploadSize} MB` : '-'}</span>
                </div>
            ` : ''}
            ${uploadTime !== undefined && uploadTime !== null ? html`
                <div class="provider-details__item">
                    <span class="provider-details__label">${__('File upload storage time')}:</span>
                    <span class="provider-details__value">${uploadTime > 0 ? __('%1$s days', uploadTime) : '-'}</span>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Renders a single provider row in the provider list.
 * @param {import('../utils.js').XMPPProvider} provider
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
                <button type="button" class="provider-row__register-btn"
                        @click=${(ev) => { ev.stopPropagation(); el.onProviderSelected(provider.jid); }}>
                    <converse-icon class="fa fa-user-plus" size="0.85em"></converse-icon>
                    ${__('Register')}
                </button>
            </div>
            ${isExpanded ? tplProviderDetails(provider) : ''}
        </div>
    `;
}

/**
 * Renders a category section with its providers.
 * @param {string} category
 * @param {string} description
 * @param {import('../utils.js').XMPPProvider[]} providers
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
                __('Providers in this category have the best properties, allow you to register via an app and are free of charge.'),
                catA,
                el
            )}
            ${tplCategorySection(
                'B',
                __('Providers in this category have the best properties but may only allow you to register via a web page.'),
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
    const i18n_create_account = __('Create your account');
    const i18n_choose_provider = __('Choose an XMPP provider to register with:');
    const has_providers = el.xmpp_providers?.length > 0;
    const href_providers = api.settings.get('providers_link');
    const i18n_browse_all = __('Browse all providers');
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
