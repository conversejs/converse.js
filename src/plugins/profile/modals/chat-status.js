import { api, converse } from '@converse/headless';
import BaseModal from 'plugins/modal/modal.js';
import { __ } from 'i18n';
import tplChatStatusModal from '../templates/chat-status-modal.js';

import './styles/chat-status-modal.scss';

const u = converse.env.utils;

export default class ChatStatusModal extends BaseModal {
    initialize() {
        super.initialize();
        this.requestUpdate();
        this.addEventListener(
            'shown.bs.modal',
            () => {
                /** @type {HTMLInputElement} */ (this.querySelector('input[name="status_message"]')).focus();
            },
            false
        );
    }

    renderModal() {
        return tplChatStatusModal(this);
    }

    getModalTitle() {
        return __('Change chat status');
    }

    /**
     * @param {MouseEvent} ev
     */
    clearStatusMessage(ev) {
        if (ev && ev.preventDefault) {
            ev.preventDefault();
            u.hideElement(this.querySelector('.clear-input'));
        }
        const roster_filter = /** @type {HTMLInputElement} */ (this.querySelector('input[name="status_message"]'));
        roster_filter.value = '';
    }

    /**
     * @param {SubmitEvent} ev
     */
    onFormSubmitted(ev) {
        ev.preventDefault();
        const data = new FormData(/** @type {HTMLFormElement} */ (ev.target));
        let show, presence;
        const chat_status = data.get('chat_status');
        if (chat_status === 'online') {
            presence = 'online';
        } else {
            show = chat_status;
        }
        this.model.save({
            status_message: data.get('status_message'),
            presence,
            show,
        });
        this.close();
    }
}

api.elements.define('converse-chat-status-modal', ChatStatusModal);
