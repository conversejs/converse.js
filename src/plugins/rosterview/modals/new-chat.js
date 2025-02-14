import { _converse, api, log } from '@converse/headless';
import BaseModal from 'plugins/modal/modal.js';
import tplNewChat from './templates/new-chat.js';
import { __ } from 'i18n';

export default class NewChatModal extends BaseModal {
    initialize() {
        super.initialize();
        this.listenTo(this.model, 'change', () => this.requestUpdate());
        this.requestUpdate();
        this.addEventListener(
            'shown.bs.modal',
            () => /** @type {HTMLInputElement} */ (this.querySelector('input[name="jid"]'))?.focus(),
            false
        );
    }

    renderModal() {
        return tplNewChat(this);
    }

    getModalTitle() {
        return __('Start a new chat');
    }

    /**
     * @param {string} jid
     */
    validateSubmission(jid) {
        if (!jid || jid.split('@').filter((s) => !!s).length < 2) {
            this.model.set('error', __('Please enter a valid XMPP address'));
            return false;
        }
        this.model.set('error', null);
        return true;
    }

    /**
     * @param {HTMLFormElement} _form
     * @param {string} jid
     */
    async afterSubmission(_form, jid) {
        try {
            await api.chats.open(jid, {}, true);
        } catch (e) {
            log.error(e);
            this.model.set('error', __('Sorry, something went wrong'));
            return;
        }
        this.model.clear();
        this.modal.hide();
    }

    /**
     * @param {SubmitEvent} ev
     */
    async startChatFromForm(ev) {
        ev.preventDefault();
        const form = /** @type {HTMLFormElement} */ (ev.target);
        const data = new FormData(form);
        const jid = /** @type {string} */ (data.get('jid') || '').trim();

        if (this.validateSubmission(jid)) {
            this.afterSubmission(form, jid);
        }
    }
}

api.elements.define('converse-new-chat-modal', NewChatModal);
