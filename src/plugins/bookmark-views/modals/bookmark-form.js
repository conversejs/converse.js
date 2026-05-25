import { html } from 'lit';
import { api } from '@converse/headless';
import BaseModal from '../../modal/modal.js';
import '../components/bookmark-form.js';
import { __ } from 'i18n';

export default class BookmarkFormModal extends BaseModal {
    /**
     * @param {import('@converse/skeletor').ModelOptions} options
     */
    constructor(options) {
        super(options);
        this.jid = null;
    }

    renderModal() {
        return html` <converse-muc-bookmark-form class="muc-form-container" jid="${this.jid}">
        </converse-muc-bookmark-form>`;
    }

    getModalTitle() {
        return __('Bookmark');
    }
}

api.elements.define('converse-bookmark-form-modal', BookmarkFormModal);
