import 'shared/components/message-versions.js';
import BaseModal from "plugins/modal/modal.js";
import { __ } from 'i18n';
import { html } from "lit";
import {api } from "@converse/headless/core";


export default class MessageVersionsModal extends BaseModal {

    renderModal () {
        return html`<converse-message-versions .model=${this.model}></converse-message-versions>`;
    }

    getModalTitle () { // eslint-disable-line class-methods-use-this
        return __('Message versions');
    }
}

api.elements.define('converse-message-versions-modal', MessageVersionsModal);
