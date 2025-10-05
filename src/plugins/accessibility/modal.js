/**
 * @module accessibility/modal
 * @description Modal para mostrar los atajos de teclado disponibles
 */

import { html } from 'lit';
import { api } from '@converse/headless';
import { __ } from 'i18n';
import BaseModal from 'plugins/modal/modal.js';
import 'shared/components/icons.js';

export default class KeyboardShortcutsModal extends BaseModal {
    
    initialize() {
        super.initialize();
        this.shortcuts = this.model.get('shortcuts') || [];
    }
    
    renderModal() {
        const grouped = this.groupShortcutsByContext();
        
        return html`
            <div class="modal-dialog modal-lg" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h4 class="modal-title" id="keyboard-shortcuts-modal-label">
                            <converse-icon 
                                class="fa fa-keyboard" 
                                size="1.2em"
                                aria-hidden="true"
                            ></converse-icon>
                            ${__('Atajos de teclado')}
                        </h4>
                        <button 
                            type="button" 
                            class="btn-close" 
                            data-bs-dismiss="modal" 
                            aria-label="${__('Cerrar')}"
                        ></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted">
                            ${__('Use estos atajos de teclado para navegar más rápidamente por la aplicación.')}
                        </p>
                        
                        ${Object.keys(grouped).map(context => html`
                            <div class="shortcuts-section mb-4">
                                <h5 class="text-primary mb-3">
                                    ${context}
                                </h5>
                                <div class="list-group">
                                    ${grouped[context].map(shortcut => html`
                                        <div class="list-group-item d-flex justify-content-between align-items-center">
                                            <span class="shortcut-description">
                                                ${shortcut.description}
                                            </span>
                                            <kbd class="shortcut-key">
                                                ${this.formatShortcutKey(shortcut.key)}
                                            </kbd>
                                        </div>
                                    `)}
                                </div>
                            </div>
                        `)}
                        
                        <div class="alert alert-info mt-4" role="status">
                            <converse-icon 
                                class="fa fa-info-circle" 
                                size="1em"
                                aria-hidden="true"
                            ></converse-icon>
                            ${__('Consejo: Puede volver a abrir esta ayuda en cualquier momento presionando Alt+Shift+H')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button 
                            type="button" 
                            class="btn btn-primary" 
                            data-bs-dismiss="modal"
                        >
                            ${__('Entendido')}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    groupShortcutsByContext() {
        const grouped = {};
        
        this.shortcuts.forEach(shortcut => {
            const context = shortcut.context || __('General');
            if (!grouped[context]) {
                grouped[context] = [];
            }
            grouped[context].push(shortcut);
        });
        
        return grouped;
    }
    
    formatShortcutKey(key) {
        // Reemplazar símbolos con representaciones más legibles
        return key
            .replace(/\+/g, ' + ')
            .replace('Alt', '⎇ Alt')
            .replace('Ctrl', '⌃ Ctrl')
            .replace('Shift', '⇧ Shift')
            .replace('Meta', '⌘ Meta')
            .replace('ArrowUp', '↑')
            .replace('ArrowDown', '↓')
            .replace('ArrowLeft', '←')
            .replace('ArrowRight', '→')
            .replace('Enter', '↵ Enter')
            .replace('Space', '␣ Espacio');
    }
}

api.elements.define('converse-keyboard-shortcuts-modal', KeyboardShortcutsModal);
