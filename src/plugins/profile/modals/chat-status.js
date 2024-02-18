import BaseModal from 'plugins/modal/modal.js';
import tplChatStatusModal from '../templates/chat-status-modal.js';
import { __ } from 'i18n';
import { api, converse } from '@converse/headless';

const u = converse.env.utils;

export default class ChatStatusModal extends BaseModal {
    initialize () {
        super.initialize();
        this.render();
        this.addEventListener(
            'shown.bs.modal',
            () => {
                /** @type {HTMLInputElement} */ (this.querySelector('input[name="status_message"]')).focus();
            },
            false
        );
    }

    renderModal () {
        return tplChatStatusModal(this);
    }

    getModalTitle () {
        // eslint-disable-line class-methods-use-this
        return __('Change chat status');
    }

    clearStatusMessage (ev) {
        if (ev && ev.preventDefault) {
            ev.preventDefault();
            u.hideElement(this.querySelector('.clear-input'));
        }
        const roster_filter = /** @type {HTMLInputElement} */ (this.querySelector('input[name="status_message"]'));
        roster_filter.value = '';
    }

    onFormSubmitted (ev) {
        ev.preventDefault();
        const data = new FormData(ev.target);
        this.model.save({
            'status_message': data.get('status_message'),
            'status': data.get('chat_status'),
        });
        this.modal.hide();
    }
}

api.elements.define('converse-chat-status-modal', ChatStatusModal);
