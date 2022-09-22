import './form.js';
import BaseModal from "plugins/modal/modal.js";
import { html } from "lit";
import { __ } from 'i18n';
import { api } from "@converse/headless/core";

export default class BookmarkFormModal extends BaseModal {

    renderModal () {
        return html`
            <converse-muc-bookmark-form class="muc-form-container" jid="${this.jid}">
            </converse-muc-bookmark-form>`;
    }

    getModalTitle () { // eslint-disable-line class-methods-use-this
        return __('Bookmark');
    }
}

api.elements.define('converse-bookmark-form-modal', BookmarkFormModal);
