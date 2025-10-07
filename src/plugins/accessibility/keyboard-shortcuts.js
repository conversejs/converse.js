/**
 * @module accessibility/keyboard-shortcuts
 * @description Keyboard shortcut system to improve accessible navigation
 */

import { api, _converse, constants } from '@converse/headless';
import { __ } from 'i18n';
import { announceToScreenReader, moveFocusTo } from '../../utils/accessibility.js';

const { KEYCODES } = constants;

/**
 * @typedef {Object} KeyboardShortcut
 * @property {string} key - Key combination
 * @property {string} description - Shortcut description
 * @property {Function} handler - Manejador del atajo
 * @property {string} [context] - Contexto donde aplica el atajo
 */

/**
 * Atajos de teclado globales del sistema
 * @type {Map<string, KeyboardShortcut>}
 */
const globalShortcuts = new Map();

/**
 * Atajos de teclado contextuales
 * @type {Map<string, Map<string, KeyboardShortcut>>}
 */
const contextualShortcuts = new Map();

/**
 * Estado del modal de ayuda
 */
let helpModalVisible = false;

/**
 * Inicializa los atajos de teclado predeterminados
 */
export function initDefaultShortcuts() {
    // Atajos globales
    registerShortcut({
        key: 'Alt+Shift+H',
        description: __('Mostrar ayuda de atajos de teclado'),
        handler: showKeyboardShortcutsHelp
    });

    registerShortcut({
        key: 'Alt+Shift+C',
        description: __('Focus message composition area'),
        handler: focusMessageComposer
    });

    registerShortcut({
        key: 'Alt+Shift+L',
        description: __('Enfocar la lista de chats'),
        handler: focusChatList
    });

    registerShortcut({
        key: 'Alt+Shift+M',
        description: __('Focus last message'),
        handler: focusLastMessage
    });

    registerShortcut({
        key: 'Alt+Shift+N',
        description: __('Go to next chat with unread messages'),
        handler: focusNextUnreadChat
    });

    registerShortcut({
        key: 'Alt+Shift+P',
        description: __('Ir al chat anterior'),
        handler: focusPreviousChat
    });

    registerShortcut({
        key: 'Alt+Shift+S',
        description: __('Buscar contactos'),
        handler: focusContactSearch
    });

    registerShortcut({
        key: 'Escape',
        description: __('Close modal or open dialog'),
        handler: closeCurrentModal
    });

    // Atajos contextuales para el compositor de mensajes
    registerShortcut({
        key: 'Ctrl+Enter',
        description: __('Enviar mensaje'),
        context: 'message-composer',
        handler: sendMessage
    });

    registerShortcut({
        key: 'Alt+Shift+E',
        description: __('Insertar emoji'),
        context: 'message-composer',
        handler: toggleEmojiPicker
    });

    registerShortcut({
        key: 'Alt+Shift+F',
        description: __('Adjuntar archivo'),
        context: 'message-composer',
        handler: triggerFileUpload
    });

    // Shortcuts for message navigation
    registerShortcut({
        key: 'Alt+ArrowUp',
        description: __('Previous message'),
        context: 'chat-messages',
        handler: focusPreviousMessage
    });

    registerShortcut({
        key: 'Alt+ArrowDown',
        description: __('Next message'),
        context: 'chat-messages',
        handler: focusNextMessage
    });

    registerShortcut({
        key: 'Alt+Shift+R',
        description: __('Reply to focused message'),
        context: 'chat-messages',
        handler: replyToMessage
    });
}

/**
 * Registra un atajo de teclado
 * @param {KeyboardShortcut} shortcut
 */
export function registerShortcut(shortcut) {
    const { key, context } = shortcut;
    
    if (context) {
        if (!contextualShortcuts.has(context)) {
            contextualShortcuts.set(context, new Map());
        }
        contextualShortcuts.get(context).set(key, shortcut);
    } else {
        globalShortcuts.set(key, shortcut);
    }
}

/**
 * Desregistra un atajo de teclado
 * @param {string} key
 * @param {string} [context]
 */
export function unregisterShortcut(key, context) {
    if (context) {
        contextualShortcuts.get(context)?.delete(key);
    } else {
        globalShortcuts.delete(key);
    }
}

/**
 * Maneja eventos de teclado
 * @param {KeyboardEvent} event
 */
export function handleKeyboardEvent(event) {
    // Ignore if we are in a text field (except for specific shortcuts)
    const target = /** @type {HTMLElement} */ (event.target);
    const isTextField = ['INPUT', 'TEXTAREA'].includes(target.tagName);
    
    const key = getKeyString(event);
    
    // Verificar contexto actual
    const context = getCurrentContext(target);
    
    // Buscar atajo contextual primero
    if (context) {
        const contextShortcuts = contextualShortcuts.get(context);
        const shortcut = contextShortcuts?.get(key);
        
        if (shortcut) {
            event.preventDefault();
            shortcut.handler(event);
            return;
        }
    }
    
    // Luego buscar atajo global (excepto en campos de texto)
    if (!isTextField || key.includes('Alt+') || key.includes('Ctrl+')) {
        const shortcut = globalShortcuts.get(key);
        
        if (shortcut) {
            event.preventDefault();
            shortcut.handler(event);
        }
    }
}

/**
 * Convierte un KeyboardEvent en string de tecla
 * @param {KeyboardEvent} event
 * @returns {string}
 */
function getKeyString(event) {
    const parts = [];
    
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');
    
    // Normalizar nombres de teclas
    const key = event.key === ' ' ? 'Space' : event.key;
    parts.push(key);
    
    return parts.join('+');
}

/**
 * Obtiene el contexto actual basado en el elemento enfocado
 * @param {HTMLElement} element
 * @returns {string|null}
 */
function getCurrentContext(element) {
    if (element.classList.contains('chat-textarea')) {
        return 'message-composer';
    }
    
    if (element.closest('.chat-content')) {
        return 'chat-messages';
    }
    
    if (element.closest('.list-container.roster-contacts')) {
        return 'contacts-list';
    }
    
    return null;
}

// ===== Handler implementation =====

/**
 * Muestra el modal de ayuda de atajos
 */
function showKeyboardShortcutsHelp() {
    if (helpModalVisible) {
        closeKeyboardShortcutsHelp();
        return;
    }
    
    const shortcuts = [];
    
    // Agregar atajos globales
    globalShortcuts.forEach((shortcut) => {
        shortcuts.push({
            key: shortcut.key,
            description: shortcut.description,
            context: __('Global')
        });
    });
    
    // Agregar atajos contextuales
    contextualShortcuts.forEach((contextMap, context) => {
        contextMap.forEach((shortcut) => {
            shortcuts.push({
                key: shortcut.key,
                description: shortcut.description,
                context: context
            });
        });
    });
    
    api.modal.show('converse-keyboard-shortcuts-modal', { shortcuts });
    helpModalVisible = true;
    announceToScreenReader(__('Ayuda de atajos de teclado abierta'));
}

/**
 * Cierra el modal de ayuda
 */
function closeKeyboardShortcutsHelp() {
    api.modal.close();
    helpModalVisible = false;
}

/**
 * Enfoca el compositor de mensajes
 */
function focusMessageComposer() {
    const activeChat = getActiveChat();
    if (!activeChat) {
        announceToScreenReader(__('No active chat'));
        return;
    }
    
    const textarea = /** @type {HTMLElement} */ (activeChat.querySelector('.chat-textarea'));
    if (textarea) {
        moveFocusTo(textarea, { 
            announce: __('Message composition area focused') 
        });
    }
}

/**
 * Enfoca la lista de chats
 */
function focusChatList() {
    const chatList = document.querySelector('#converse-roster');
    if (chatList) {
        const firstChat = /** @type {HTMLElement} */ (chatList.querySelector('.list-item'));
        if (firstChat) {
            moveFocusTo(firstChat, {
                announce: __('Chat list focused')
            });
        }
    } else {
        announceToScreenReader(__('Chat list not available'));
    }
}

/**
 * Focuses the last message
 */
function focusLastMessage() {
    const activeChat = getActiveChat();
    if (!activeChat) return;
    
    const messages = activeChat.querySelectorAll('.chat-msg');
    if (messages.length > 0) {
        const lastMessage = /** @type {HTMLElement} */ (messages[messages.length - 1]);
        moveFocusTo(lastMessage, {
            announce: __('Last message focused')
        });
    }
}

/**
 * Goes to the next chat with unread messages
 */
function focusNextUnreadChat() {
    const chats = /** @type {HTMLElement[]} */ (Array.from(document.querySelectorAll('.list-item.unread-msgs')));
    
    if (chats.length === 0) {
        announceToScreenReader(__('No chats with unread messages'));
        return;
    }
    
    const currentFocus = document.activeElement;
    const currentIndex = chats.indexOf(/** @type {HTMLElement} */ (currentFocus));
    const nextIndex = (currentIndex + 1) % chats.length;
    
    moveFocusTo(chats[nextIndex], {
        announce: __('Chat with unread messages')
    });
    
    // Abrir el chat
    chats[nextIndex].click();
}

/**
 * Va al chat anterior
 */
function focusPreviousChat() {
    const chats = /** @type {HTMLElement[]} */ (Array.from(document.querySelectorAll('.list-item')));
    
    if (chats.length === 0) return;
    
    const currentFocus = document.activeElement;
    const currentIndex = chats.indexOf(/** @type {HTMLElement} */ (currentFocus));
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : chats.length - 1;
    
    moveFocusTo(chats[prevIndex]);
}

/**
 * Focuses the contact search field
 */
function focusContactSearch() {
    const searchField = /** @type {HTMLElement} */ (document.querySelector('.roster-filter'));
    if (searchField) {
        moveFocusTo(searchField, {
            announce: __('Contact search')
        });
    }
}

/**
 * Closes the current modal or dialog
 * @param {KeyboardEvent} event
 */
function closeCurrentModal(event) {
    const modal = document.querySelector('.modal.show');
    if (modal) {
        event.preventDefault();
        api.modal.close();
        announceToScreenReader(__('Dialog closed'));
    }
}

/**
 * Sends the current message
 */
function sendMessage() {
    const activeChat = getActiveChat();
    if (!activeChat) return;
    
    const form = activeChat.querySelector('.sendXMPPMessage');
    if (form) {
        const submitBtn = /** @type {HTMLElement} */ (form.querySelector('[type="submit"]'));
        submitBtn?.click();
    }
}

/**
 * Alterna el selector de emoji
 */
function toggleEmojiPicker() {
    const activeChat = getActiveChat();
    if (!activeChat) return;
    
    const emojiButton = /** @type {HTMLElement} */ (activeChat.querySelector('.toggle-emojis'));
    if (emojiButton) {
        emojiButton.click();
        announceToScreenReader(__('Selector de emoji'));
    }
}

/**
 * Activa la carga de archivo
 */
function triggerFileUpload() {
    const activeChat = getActiveChat();
    if (!activeChat) return;
    
    const fileInput = /** @type {HTMLInputElement} */ (activeChat.querySelector('input[type="file"]'));
    if (fileInput) {
        fileInput.click();
        announceToScreenReader(__('Selector de archivo'));
    }
}

/**
 * Enfoca el mensaje anterior
 */
function focusPreviousMessage() {
    const currentMessage = document.activeElement?.closest('.chat-msg');
    if (!currentMessage) {
        focusLastMessage();
        return;
    }
    
    // Buscar todos los mensajes en el historial
    const messageHistory = currentMessage.closest('converse-message-history');
    if (!messageHistory) return;
    
    const messages = /** @type {HTMLElement[]} */ (Array.from(messageHistory.querySelectorAll('.chat-msg')));
    const currentIndex = messages.indexOf(/** @type {HTMLElement} */ (currentMessage));
    
    if (currentIndex > 0) {
        const prevMessage = messages[currentIndex - 1];
        moveFocusTo(prevMessage);
        
        // Anunciar el mensaje
        const ariaLabel = prevMessage.getAttribute('aria-label');
        if (ariaLabel) {
            announceToScreenReader(ariaLabel, 'polite', 100);
        }
    }
}

/**
 * Enfoca el siguiente mensaje
 */
function focusNextMessage() {
    const currentMessage = document.activeElement?.closest('.chat-msg');
    if (!currentMessage) return;
    
    // Buscar todos los mensajes en el historial
    const messageHistory = currentMessage.closest('converse-message-history');
    if (!messageHistory) return;
    
    const messages = /** @type {HTMLElement[]} */ (Array.from(messageHistory.querySelectorAll('.chat-msg')));
    const currentIndex = messages.indexOf(/** @type {HTMLElement} */ (currentMessage));
    
    if (currentIndex < messages.length - 1) {
        const nextMessage = messages[currentIndex + 1];
        moveFocusTo(nextMessage);
        
        // Anunciar el mensaje
        const ariaLabel = nextMessage.getAttribute('aria-label');
        if (ariaLabel) {
            announceToScreenReader(ariaLabel, 'polite', 100);
        }
    }
}

/**
 * Responde al mensaje enfocado
 */
function replyToMessage() {
    const currentMessage = document.activeElement?.closest('.chat-msg');
    if (!currentMessage) return;
    
    const quoteButton = /** @type {HTMLElement} */ (currentMessage.querySelector('.chat-msg__action-quote'));
    if (quoteButton) {
        quoteButton.click();
        announceToScreenReader(__('Respondiendo al mensaje'));
    }
}

/**
 * Obtiene el chat activo
 * @returns {HTMLElement|null}
 */
function getActiveChat() {
    return document.querySelector('.chatbox:not(.hidden)');
}

/**
 * Inicializa el sistema de atajos de teclado
 */
export function initKeyboardShortcuts() {
    initDefaultShortcuts();
    document.addEventListener('keydown', handleKeyboardEvent);
    
    // Announce that shortcuts are available
    announceToScreenReader(
        __('Atajos de teclado habilitados. Presione Alt+Shift+H para ver la ayuda'),
        'polite',
        2000
    );
}

/**
 * Deshabilita el sistema de atajos de teclado
 */
export function disableKeyboardShortcuts() {
    document.removeEventListener('keydown', handleKeyboardEvent);
    globalShortcuts.clear();
    contextualShortcuts.clear();
}

export default {
    initKeyboardShortcuts,
    disableKeyboardShortcuts,
    registerShortcut,
    unregisterShortcut,
    handleKeyboardEvent
};
