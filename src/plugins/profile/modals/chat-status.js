import BaseModal from "plugins/modal/modal.js";
import tpl_chat_status_modal from "../templates/chat-status-modal.js";
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";

const u = converse.env.utils;


export default class ChatStatusModal extends BaseModal {

    initialize () {
        super.initialize();
        this.render();
        this.addEventListener('shown.bs.modal', () => {
            this.querySelector('input[name="status_message"]').focus();
        }, false);
    }

    renderModal () {
        return tpl_chat_status_modal(this);
    }

    getModalTitle () { // eslint-disable-line class-methods-use-this
        return __('Change chat status');
    }

    clearStatusMessage (ev) {
        if (ev && ev.preventDefault) {
            ev.preventDefault();
            u.hideElement(this.querySelector('.clear-input'));
        }
        const roster_filter = this.querySelector('input[name="status_message"]');
        roster_filter.value = '';
    }

    onFormSubmitted (ev) {
        ev.preventDefault();
        const data = new FormData(ev.target);
        this.model.save({
            'status_message': data.get('status_message'),
            'status': data.get('chat_status')
        });
        this.modal.hide();
    }
}

_converse.ChatStatusModal = ChatStatusModal;

api.elements.define('converse-chat-status-modal', ChatStatusModal);
