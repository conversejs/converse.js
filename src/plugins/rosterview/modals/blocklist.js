import { html } from 'lit';
import { _converse, api } from '@converse/headless';
import BaseModal from 'plugins/modal/modal.js';
import tplBlocklist from './templates/blocklist.js';
import { __ } from 'i18n';

export default class BlockListModal extends BaseModal {
    static get properties() {
        return {
            ...super.properties,
            filter_text: { type: String },
        };
    }

    constructor() {
        super();
        this.filter_text = '';
    }

    async initialize() {
        super.initialize();
        this.blocklist = await api.blocklist.get();
        this.listenTo(this.blocklist, 'add', () => this.requestUpdate());
        this.listenTo(this.blocklist, 'remove', () => this.requestUpdate());
        this.listenTo(this.blocklist, 'change', () => this.requestUpdate());
        this.addEventListener(
            'shown.bs.modal',
            () => {
                /** @type {HTMLInputElement} */ (this.querySelector('input[name="blocklist_filter"]'))?.focus();
            },
            false
        );
        this.requestUpdate();
    }

    renderModal() {
        if (this.blocklist) {
            return tplBlocklist(this);
        } else {
            return html`<converse-spinner></converse-spinner>`;
        }
    }

    getModalTitle() {
        return __('Blocklist');
    }

    /**
     * @param {MouseEvent} ev
     */
    async unblockUsers(ev) {
        ev.preventDefault();
        const form = /** @type {HTMLFormElement} */ (ev.target);
        const data = new FormData(form);
        const jids = [...data.entries()].filter((e) => e[1] === 'on').map((e) => e[0]);
        await api.blocklist.remove(jids);
        const body =
            jids.length > 1
                ? __('Successfully unblocked %1$s XMPP addresses', jids.length)
                : __('Successfully unblocked one XMPP address');
        api.toast.show('blocked', {
            type: 'success',
            body,
        });
    }

    /**
     * @param {MouseEvent} ev
     */
    toggleSelectAll(ev) {
        const value = /** @type {HTMLInputElement} */ (ev.target).checked;
        const checkboxes = /** @type {NodeListOf<HTMLInputElement>} */ (
            this.querySelectorAll('input[type="checkbox"]')
        );
        checkboxes.forEach((cb) => (cb.checked = value));
    }
}

api.elements.define('converse-blocklist-modal', BlockListModal);
