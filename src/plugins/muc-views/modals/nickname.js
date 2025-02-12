import { html } from 'lit';
import { api } from "@converse/headless";
import { __ } from 'i18n';
import BaseModal from "plugins/modal/modal.js";

export default class MUCNicknameModal extends BaseModal {

    renderModal () {
        return html`<converse-muc-nickname-form jid="${this.model.get('jid')}"></converse-muc-nickname-form>`;
    }

    getModalTitle () {
        return __('Change your nickname');
    }
}

api.elements.define('converse-muc-nickname-modal', MUCNicknameModal);
