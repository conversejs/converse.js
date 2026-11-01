/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Modal that lists the registered keyboard shortcuts
 */
import { html } from 'lit';
import { api } from '@converse/headless';
import { __ } from 'i18n';
import BaseModal from 'plugins/modal/modal.js';

export default class KeyboardShortcutsModal extends BaseModal {
    getModalTitle() {
        return __('Keyboard shortcuts');
    }

    renderModal() {
        /** @type {Map<string, import('./types').KeyboardShortcut[]>} */
        const groups = new Map();
        api.shortcuts.get().forEach((s) => groups.set(s.group, [...(groups.get(s.group) ?? []), s]));
        return html`
            ${[...groups].map(
                ([group, shortcuts]) => html`
                    <h6 class="mt-3">${group}</h6>
                    <ul class="list-group">
                        ${shortcuts.map(
                            (s) => html`
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    <span>${s.description}</span>
                                    <kbd>${s.label}</kbd>
                                </li>
                            `,
                        )}
                    </ul>
                `,
            )}
        `;
    }
}

api.elements.define('converse-keyboard-shortcuts-modal', KeyboardShortcutsModal);
