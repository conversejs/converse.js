import { _converse, api, converse, u } from '@converse/headless';
import BaseModal from 'plugins/modal/modal.js';
import tplNewChat from './templates/new-chat.js';
import { __ } from 'i18n';

const { Strophe } = converse.env;

export default class NewChatModal extends BaseModal {
    initialize() {
        super.initialize();
        this.listenTo(this.model, 'change', () => this.requestUpdate());
        this.requestUpdate();
        this.addEventListener(
            'shown.bs.modal',
            () => /** @type {HTMLInputElement} */ (this.querySelector('input[name="jid"]'))?.focus(),
            false,
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
        if (!u.isValidJIDInput(jid)) {
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
    afterSubmission(_form, jid) {
        // The JID is validated synchronously in validateSubmission before we get
        // here, and the app-owned handler opens the chat, so there's nothing left to
        // await or recover from at this call site.
        api.trigger('openConversation', { view: 'chat', jid });
        this.model.set('error', null);
        this.modal.hide();
    }

    /**
     * @param {SubmitEvent} ev
     */
    async startChatFromForm(ev) {
        ev.preventDefault();
        const form = /** @type {HTMLFormElement} */ (ev.target);
        const data = new FormData(form);
        let jid = /** @type {string} */ (data.get('jid') || '').trim();

        // Append configured domain if user entered just a username
        jid = u.maybeAppendDomain(jid);

        if (this.validateSubmission(jid)) {
            this.afterSubmission(form, jid);
        }
    }
}

api.elements.define('converse-new-chat-modal', NewChatModal);
