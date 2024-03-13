import 'shared/autocomplete/index.js';
import BaseModal from 'plugins/modal/modal.js';
import tplAddContactModal from './templates/add-contact.js';
import { Strophe } from 'strophe.js';
import { __ } from 'i18n';
import { _converse, api } from '@converse/headless';
import { getNamesAutoCompleteList } from '@converse/headless/plugins/roster/utils.js';

export default class AddContactModal extends BaseModal {
    initialize () {
        super.initialize();
        this.listenTo(this.model, 'change', () => this.render());
        this.render();
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
        // eslint-disable-line class-methods-use-this
        return __('Add a Contact');
    }

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

    afterSubmission (_form, jid, name, group) {
        if (group && !Array.isArray(group)) {
            group = [group];
        }
        _converse.state.roster.addAndSubscribe(jid, name, group);
        this.model.clear();
        this.modal.hide();
    }

    async addContactFromForm (ev) {
        ev.preventDefault();
        const data = new FormData(ev.target);
        let name = /** @type {string} */ (data.get('name') || '').trim();
        let jid = /** @type {string} */ (data.get('jid') || '').trim();

        if (!jid && typeof api.settings.get('xhr_user_search_url') === 'string') {
            const list = await getNamesAutoCompleteList(name);
            if (list.length !== 1) {
                this.model.set('error', __('Sorry, could not find a contact with that name'));
                this.render();
                return;
            }
            jid = list[0].value;
            name = list[0].label;
        }

        if (this.validateSubmission(jid)) {
            this.afterSubmission(ev.target, jid, name, data.get('group'));
        }
    }
}

api.elements.define('converse-add-contact-modal', AddContactModal);
