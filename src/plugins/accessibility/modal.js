/**
 * @module accessibility/modal
 * @description Modal that lists the available keyboard shortcuts
 */
import { html } from 'lit';
import { api } from '@converse/headless';
import { __ } from 'i18n';
import BaseModal from 'plugins/modal/modal.js';
import { getShortcuts } from './keyboard-shortcuts.js';

export default class KeyboardShortcutsModal extends BaseModal {
    getModalTitle() {
        return __('Keyboard shortcuts');
    }

    renderModal() {
        return html`
            <ul class="list-group">
                ${getShortcuts().map(
                    (s) => html`
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            <span>${s.description}</span>
                            <kbd>${s.label}</kbd>
                        </li>
                    `,
                )}
            </ul>
        `;
    }
}

api.elements.define('converse-keyboard-shortcuts-modal', KeyboardShortcutsModal);
