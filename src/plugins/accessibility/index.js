/**
 * @module accessibility
 * @description Plugin de accesibilidad para Converse.js
 * Mejora la experiencia para usuarios de lectores de pantalla y teclado
 */

import { _converse, api, converse } from '@converse/headless';
import { __ } from 'i18n';
import { initAccessibilityAPI } from '../../utils/accessibility.js';
import { 
    announceToScreenReader, 
    announceNewMessage,
    announceStatusChange,
    initLiveRegion 
} from '../../utils/accessibility.js';
import { initKeyboardShortcuts } from './keyboard-shortcuts.js';
import './modal.js';
import './settings-panel.js';
import '../../shared/components/screen-reader-announcer.js';

converse.plugins.add('converse-accessibility', {
    
    dependencies: ['converse-chatboxes', 'converse-roster', 'converse-muc'],
    
    initialize() {
        // Configuración del plugin
        api.settings.extend({
            /**
             * Habilita funciones de accesibilidad mejoradas
             * @type {boolean}
             */
            enable_accessibility: true,
            
            /**
             * Habilita atajos de teclado
             * @type {boolean}
             */
            enable_keyboard_shortcuts: true,
            
            /**
             * Habilita anuncios para lectores de pantalla
             * @type {boolean}
             */
            enable_screen_reader_announcements: true,
            
            /**
             * Anunciar nuevos mensajes automáticamente
             * @type {boolean}
             */
            announce_new_messages: true,
            
            /**
             * Anunciar cambios de estado de contactos
             * @type {boolean}
             */
            announce_status_changes: true,
            
            /**
             * Modo de alto contraste
             * @type {boolean|'auto'}
             */
            high_contrast_mode: 'auto'
        });
        
        // Inicializar solo si está habilitado
        api.listen.on('connected', () => {
            if (api.settings.get('enable_accessibility')) {
                initializeAccessibility();
            }
        });
        
        api.listen.on('reconnected', () => {
            if (api.settings.get('enable_accessibility')) {
                initializeAccessibility();
            }
        });
    }
});

/**
 * Inicializa las funciones de accesibilidad
 */
function initializeAccessibility() {
    // Inicializar API de accesibilidad
    initAccessibilityAPI();
    
    // Inicializar región live
    initLiveRegion();
    
    // Inicializar atajos de teclado
    if (api.settings.get('enable_keyboard_shortcuts')) {
        initKeyboardShortcuts();
    }
    
    // Configurar listeners para anuncios
    if (api.settings.get('enable_screen_reader_announcements')) {
        setupScreenReaderAnnouncements();
    }
    
    // Aplicar mejoras de alto contraste si es necesario
    applyHighContrastMode();
    
    // Anunciar que la aplicación está lista
    announceToScreenReader(
        __('Converse.js cargado. Presione Alt+Shift+H para ver los atajos de teclado disponibles.'),
        'polite',
        2000
    );
}

/**
 * Configura los anuncios para lectores de pantalla
 */
function setupScreenReaderAnnouncements() {
    const announce_new_messages = api.settings.get('announce_new_messages');
    const announce_status_changes = api.settings.get('announce_status_changes');
    
    // Anunciar nuevos mensajes
    if (announce_new_messages) {
        api.listen.on('message', (data) => {
            const { chatbox, stanza } = data;
            const is_current = _converse.state.chatboxviews.get(chatbox.get('jid'))?.model === chatbox;
            
            // Solo anunciar mensajes entrantes
            if (stanza.getAttribute('from') !== _converse.session.get('jid')) {
                announceNewMessage({
                    sender_name: chatbox.getDisplayName(),
                    body: stanza.querySelector('body')?.textContent,
                    type: chatbox.get('type')
                }, is_current);
            }
        });
    }
    
    // Anunciar cambios de estado
    if (announce_status_changes) {
        api.listen.on('statusChanged', (status) => {
            const contact = _converse.state.roster?.get(status.from);
            if (contact) {
                announceStatusChange(status.show, contact.getDisplayName());
            }
        });
    }
    
    // Anunciar cuando se une/sale alguien de una sala
    api.listen.on('chatRoomPresence', (data) => {
        const { presence, room } = data;
        const from = presence.getAttribute('from');
        const nick = presence.querySelector('nick')?.textContent;
        const type = presence.getAttribute('type');
        
        if (type === 'unavailable') {
            announceToScreenReader(
                __('%1$s ha salido de la sala', nick || from)
            );
        } else {
            announceToScreenReader(
                __('%1$s se ha unido a la sala', nick || from)
            );
        }
    });
    
    // Anunciar errores
    api.listen.on('chatBoxClosed', (chatbox) => {
        announceToScreenReader(
            __('Chat con %1$s cerrado', chatbox.getDisplayName())
        );
    });
}

/**
 * Aplica el modo de alto contraste si es necesario
 */
function applyHighContrastMode() {
    const mode = api.settings.get('high_contrast_mode');
    
    if (mode === 'auto') {
        // Detectar si el sistema está en modo de alto contraste
        const mediaQuery = window.matchMedia('(prefers-contrast: high)');
        
        if (mediaQuery.matches) {
            document.body.classList.add('converse-high-contrast');
        }
        
        // Escuchar cambios
        mediaQuery.addEventListener('change', (e) => {
            document.body.classList.toggle('converse-high-contrast', e.matches);
        });
    } else if (mode === true) {
        document.body.classList.add('converse-high-contrast');
    }
}

/**
 * Modal de ayuda de atajos de teclado
 */
export function showKeyboardShortcutsModal() {
    const shortcuts = [
        { key: 'Alt+Shift+H', description: __('Mostrar/ocultar esta ayuda'), context: __('Global') },
        { key: 'Alt+Shift+C', description: __('Enfocar área de composición'), context: __('Global') },
        { key: 'Alt+Shift+L', description: __('Enfocar lista de chats'), context: __('Global') },
        { key: 'Alt+Shift+M', description: __('Ir al último mensaje'), context: __('Global') },
        { key: 'Alt+Shift+N', description: __('Siguiente chat no leído'), context: __('Global') },
        { key: 'Alt+Shift+S', description: __('Buscar contactos'), context: __('Global') },
        { key: 'Escape', description: __('Cerrar modal'), context: __('Global') },
        { key: 'Ctrl+Enter', description: __('Enviar mensaje'), context: __('Compositor') },
        { key: 'Alt+Shift+E', description: __('Insertar emoji'), context: __('Compositor') },
        { key: 'Alt+Shift+F', description: __('Adjuntar archivo'), context: __('Compositor') },
        { key: 'Alt+↑', description: __('Mensaje anterior'), context: __('Mensajes') },
        { key: 'Alt+↓', description: __('Mensaje siguiente'), context: __('Mensajes') },
        { key: 'Alt+Shift+R', description: __('Responder mensaje'), context: __('Mensajes') }
    ];
    
    api.modal.show('converse-keyboard-shortcuts-modal', { shortcuts });
}

export default {
    initializeAccessibility,
    setupScreenReaderAnnouncements,
    applyHighContrastMode,
    showKeyboardShortcutsModal
};
