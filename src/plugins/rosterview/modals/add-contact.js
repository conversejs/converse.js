import { Strophe } from 'strophe.js';
import { _converse, api, log } from '@converse/headless';
import 'shared/autocomplete/index.js';
import BaseModal from 'plugins/modal/modal.js';
import tplAddContactModal from './templates/add-contact.js';
import { __ } from 'i18n';
import { getNamesAutoCompleteList } from '../utils.js';

export default class AddContactModal extends BaseModal {
    initialize () {
        super.initialize();
        this.listenTo(this.model, 'change', () => this.requestUpdate());
        this.requestUpdate();
        this.addEventListener(
            'shown.bs.modal',
            () => /** @type {HTMLInputElement} */ (this.querySelector('input[name="jid"]'))?.focus(),
            false
        );
    }

    renderModal () {
        return tplAddContactModal(this);
    }

    getModalTitle () {
        return __('Add a Contact');
    }

    /**
     * @param {string} jid
     */
    validateSubmission (jid) {
        if (!jid || jid.split('@').filter((s) => !!s).length < 2) {
            this.model.set('error', __('Please enter a valid XMPP address'));
            return false;
        } else if (_converse.state.roster.get(Strophe.getBareJidFromJid(jid))) {
            this.model.set('error', __('This contact has already been added'));
            return false;
        }
        this.model.set('error', null);
        return true;
    }

    /**
     * @param {HTMLFormElement} _form
     * @param {string} jid
     * @param {string} name
     * @param {FormDataEntryValue} group
     */
    async afterSubmission (_form, jid, name, group) {
        try {
            await api.contacts.add({ jid, name, groups: Array.isArray(group) ? group : [group] });
        } catch (e) {
            log.error(e);
            this.model.set('error', __('Sorry, something went wrong'));
            return;
        }
        this.model.clear();
        this.modal.hide();
    }

    /**
     * @param {Event} ev
     */
    async addContactFromForm (ev) {
        ev.preventDefault();
        const form = /** @type {HTMLFormElement} */(ev.target);
        const data = new FormData(form);
        let name = /** @type {string} */ (data.get('name') || '').trim();
        let jid = /** @type {string} */ (data.get('jid') || '').trim();

        if (!jid && typeof api.settings.get('xhr_user_search_url') === 'string') {
            const list = await getNamesAutoCompleteList(name);
            if (list.length !== 1) {
                this.model.set('error', __('Sorry, could not find a contact with that name'));
                this.requestUpdate();
                return;
            }
            jid = list[0].value;
            name = list[0].label;
        }

        if (this.validateSubmission(jid)) {
            this.afterSubmission(form, jid, name, data.get('group'));
        }
    }
}

api.elements.define('converse-add-contact-modal', AddContactModal);
