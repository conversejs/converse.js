import { api } from '@converse/headless';
import BaseModal from 'plugins/modal/modal.js';
import { html } from 'lit';
import { __ } from 'i18n';
import '../components/bookmarks-list.js';

export default class BookmarkListModal extends BaseModal {
    renderModal() {
        return html`<converse-bookmarks></converse-bookmarks>`;
    }

    getModalTitle() {
        return __('Bookmarks');
    }
}

api.elements.define('converse-bookmark-list-modal', BookmarkListModal);
