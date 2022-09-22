import '../modtools.js';
import BaseModal from "plugins/modal/modal.js";
import { __ } from 'i18n';
import { api } from "@converse/headless/core";
import { html } from 'lit';

export default class ModeratorToolsModal extends BaseModal {

    constructor (options) {
        super(options);
        this.id = "converse-modtools-modal";
    }

    renderModal () {
        return html`<converse-modtools jid=${this.jid} affiliation=${this.affiliation}></converse-modtools>`;
    }

    getModalTitle () { // eslint-disable-line class-methods-use-this
        return __('Moderator Tools');
    }

}

api.elements.define('converse-modtools-modal', ModeratorToolsModal);
