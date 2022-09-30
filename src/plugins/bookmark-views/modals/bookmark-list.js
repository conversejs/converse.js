import '../components/bookmarks-list.js';
import BaseModal from "plugins/modal/modal.js";
import { html } from "lit";
import { __ } from 'i18n';
import { api } from "@converse/headless/core";

export default class BookmarkListModal extends BaseModal {

    renderModal () { // eslint-disable-line class-methods-use-this
        return html`<converse-bookmarks></converse-bookmarks>`;
    }

    getModalTitle () { // eslint-disable-line class-methods-use-this
        return __('Bookmarks');
    }
}

api.elements.define('converse-bookmark-list-modal', BookmarkListModal);
