import { _converse, converse, api, log } from '@converse/headless';
import BaseModal from 'plugins/modal/modal.js';
import tplAddContactModal from './templates/add-contact.js';
import { __ } from 'i18n';

const { Strophe } = converse.env;

import './styles/add-contact.scss';

export default class AddContactModal extends BaseModal {
    constructor() {
        super();
        this.contact = null;
        this.provider_domains = [];
    }

    initialize() {
        super.initialize();
        this.listenTo(this.contact, 'change', () => this.requestUpdate());
        this.fetchProviderDomains().finally(() => this.requestUpdate());
        this.requestUpdate();
        this.addEventListener(
            'shown.bs.modal',
            () => /** @type {HTMLInputElement} */ (this.querySelector('input[name="jid"]'))?.focus(),
            false
        );
    }

    renderModal() {
        return tplAddContactModal(this);
    }

    /**
     * @param {unknown} payload
     */
    #extractProviderDomains(payload) {
        const domains = new Set();
        const addDomain = (value) => {
            if (typeof value !== 'string') {
                return;
            }
            const domain = value.trim().toLowerCase();
            if (domain && !domain.includes(' ')) {
                domains.add(domain);
            }
        };

        const collect = (node) => {
            if (Array.isArray(node)) {
                node.forEach(collect);
                return;
            }
            if (!node || typeof node !== 'object') {
                return;
            }
            addDomain(node.domain);
            addDomain(node.jid);
            collect(node.providers);
            collect(node.items);
            collect(node.entries);
        };

        collect(payload?.A ?? payload?.a ?? payload);
        collect(payload?.B ?? payload?.b ?? []);
        return Array.from(domains).sort();
    }

    async fetchProviderDomains() {
        const url = api.settings.get('providers_data_url');
        if (!url) {
            return;
        }

        try {
            const response = await fetch(url);
            if (!response.ok) {
                return;
            }
            const payload = await response.json();
            this.provider_domains = this.#extractProviderDomains(payload);
        } catch {
            log.warn('Could not fetch XMPP provider domain list');
        }
    }

    getJIDDomainAutoCompleteList() {
        return [...new Set([...this.provider_domains, ...this.getRosterDomainAutoCompleteList()])];
    }

    getRosterDomainAutoCompleteList() {
        return _converse.state.roster
            ? [...new Set([..._converse.state.roster.map((item) => Strophe.getDomainFromJid(item.get('jid'))), _converse.session.get('domain')].filter(Boolean))]
            : [];
    }

    getModalTitle() {
        return __('Add a Contact');
    }

    /**
     * @param {string} jid
     */
    validateSubmission(jid) {
        if (!jid || jid.split('@').filter((s) => !!s).length < 2) {
            this.alert(__('Please enter a valid XMPP address'), 'danger', false);
            return false;
        } else if (!this.contact && _converse.state.roster.get(Strophe.getBareJidFromJid(jid))) {
            this.alert(__('This contact has already been added'), 'danger', false);
            return false;
        }
        this.alert(null); // Clear the alert
        return true;
    }

    /**
     * @param {string} jid
     * @param {string} name
     * @param {string[]} groups
     */
    async afterSubmission(jid, name, groups) {
        api.contacts.add({ jid, name, groups }).catch((e) => {
            log.error(e);
            api.toast.show('contact-add-error', {
                type: 'danger',
                body: __('Sorry, something went wrong while adding the contact'),
            });
            return;
        });
        api.chats.open(jid, {}, true);
        this.alert(null); // clear alert
        api.toast.show('contact-added', { type: 'success', body: __('Contact added successfully') });
        this.modal.hide();
    }

    /**
     * @param {Event} ev
     */
    async addContactFromForm(ev) {
        ev.preventDefault();
        const form = /** @type {HTMLFormElement} */ (ev.target);
        const data = new FormData(form);
        let jid = /** @type {string} */ (data.get('jid') || '').trim();

        let name;
        if (api.settings.get('xhr_user_search_url')) {
            // In this case, the value of `jid` is something like `John Doe <john@chat.com>`
            // So we want to get `name` which is `John Doe` and reset `jid` to
            // what's inside the arrow brackets, so in this case
            // `john@chat.com`.
            const match = jid.match(/^(.*) <(.*)>$/);
            if (match) {
                name = match[1].trim();
                jid = match[2].trim();
            } else {
                this.alert(
                    __(
                        'Invalid value for the name and XMPP address. Please use the format "Name <username@example.org>".'
                    ),
                    'danger',
                    false
                );
                return;
            }
        } else {
            name = /** @type {string} */ (data.get('name') || '').trim();
        }

        if (this.validateSubmission(jid)) {
            const groups =
                /** @type {string} */ (data.get('groups'))
                    ?.split(',')
                    .map((g) => g.trim())
                    .filter((g) => g) || [];
            this.afterSubmission(jid, name, groups);
            form.reset();
        }
    }
}

api.elements.define('converse-add-contact-modal', AddContactModal);
