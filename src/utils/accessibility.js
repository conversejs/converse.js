/**
 * @module accessibility
 * @description Utilidades para mejorar la accesibilidad de Converse.js
 * Functions for screen readers, focus management and keyboard navigation
 */

import { api } from '@converse/headless';

/**
 * ARIA live region to announce messages to screen readers
 */
let liveRegion = null;

/**
 * Initializes the ARIA live region for announcements
 */
export function initLiveRegion() {
    if (!liveRegion) {
        liveRegion = document.createElement('div');
        liveRegion.setAttribute('id', 'converse-live-region');
        liveRegion.setAttribute('role', 'log');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.setAttribute('aria-relevant', 'additions');
        liveRegion.style.position = 'absolute';
        liveRegion.style.left = '-10000px';
        liveRegion.style.width = '1px';
        liveRegion.style.height = '1px';
        liveRegion.style.overflow = 'hidden';
        document.body.appendChild(liveRegion);
    }
    return liveRegion;
}

/**
 * Anuncia un mensaje a lectores de pantalla
 * @param {string} message - El mensaje a anunciar
 * @param {('polite'|'assertive')} [priority='polite'] - Prioridad del anuncio
 * @param {number} [delay=100] - Retraso en ms antes de anunciar
 */
export function announceToScreenReader(message, priority = 'polite', delay = 100) {
    if (!message) return;
    
    const region = initLiveRegion();
    region.setAttribute('aria-live', priority);
    
    // Limpiar el contenido previo
    region.textContent = '';
    
    // Announce after a small delay to ensure the screen reader detects it
    setTimeout(() => {
        region.textContent = message;
        
        // Clear after 5 seconds
        setTimeout(() => {
            if (region.textContent === message) {
                region.textContent = '';
            }
        }, 5000);
    }, delay);
}

/**
 * Mueve el foco a un elemento de forma accesible
 * @param {HTMLElement} element - Elemento al que mover el foco
 * @param {Object} [options] - Opciones adicionales
 * @param {boolean} [options.preventScroll=false] - Prevent automatic scroll
 * @param {string} [options.announce] - Mensaje opcional a anunciar
 */
export function moveFocusTo(element, options = {}) {
    if (!element) return;
    
    const { preventScroll = false, announce } = options;
    
    // Asegurar que el elemento puede recibir foco
    if (!element.hasAttribute('tabindex') && !isNaturallyFocusable(element)) {
        element.setAttribute('tabindex', '-1');
    }
    
    element.focus({ preventScroll });
    
    if (announce) {
        announceToScreenReader(announce);
    }
}

/**
 * Verifica si un elemento es naturalmente enfocable
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isNaturallyFocusable(element) {
    const focusableTags = ['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'];
    return focusableTags.includes(element.tagName) && !element.hasAttribute('disabled');
}

/**
 * Obtiene todos los elementos enfocables dentro de un contenedor
 * @param {HTMLElement} container - Contenedor a buscar
 * @returns {HTMLElement[]}
 */
export function getFocusableElements(container) {
    const selector = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]'
    ].join(', ');
    
    return /** @type {HTMLElement[]} */ (Array.from(container.querySelectorAll(selector)))
        .filter(el => {
            // Excluir elementos ocultos
            const htmlEl = /** @type {HTMLElement} */ (el);
            const style = window.getComputedStyle(htmlEl);
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' &&
                   htmlEl.offsetParent !== null;
        });
}

/**
 * Creates a focus trap for modals and dialogs
 * @param {HTMLElement} container - Contenedor donde atrapar el foco
 * @returns {Function} Function to release the trap
 */
export function trapFocus(container) {
    const focusableElements = getFocusableElements(container);
    if (focusableElements.length === 0) return () => {};
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    const handleKeyDown = (e) => {
        if (e.key !== 'Tab') return;
        
        if (e.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            // Tab
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    };
    
    container.addEventListener('keydown', handleKeyDown);
    
    // Mover foco al primer elemento
    firstElement.focus();
    
    // Return function to release the trap
    return () => {
        container.removeEventListener('keydown', handleKeyDown);
    };
}

/**
 * Generates a unique ID for ARIA associations
 * @param {string} prefix - Prefijo para el ID
 * @returns {string}
 */
export function generateAriaId(prefix = 'aria') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Handles keyboard navigation in a list
 * @param {KeyboardEvent} event
 * @param {HTMLElement[]} items - Lista de elementos
 * @param {number} currentIndex - Current index
 * @param {Object} [options] - Opciones
 * @returns {number|null} New index or null if no change
 */
export function handleListNavigation(event, items, currentIndex, options = {}) {
    const {
        orientation = 'vertical', // 'vertical' | 'horizontal'
        wrap = true,
        onSelect = null
    } = options;
    
    const keys = orientation === 'vertical' 
        ? { prev: 'ArrowUp', next: 'ArrowDown' }
        : { prev: 'ArrowLeft', next: 'ArrowRight' };
    
    let newIndex = currentIndex;
    
    switch (event.key) {
        case keys.prev:
            event.preventDefault();
            newIndex = currentIndex > 0 ? currentIndex - 1 : (wrap ? items.length - 1 : 0);
            break;
            
        case keys.next:
            event.preventDefault();
            newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : (wrap ? 0 : items.length - 1);
            break;
            
        case 'Home':
            event.preventDefault();
            newIndex = 0;
            break;
            
        case 'End':
            event.preventDefault();
            newIndex = items.length - 1;
            break;
            
        case 'Enter':
        case ' ':
            if (onSelect) {
                event.preventDefault();
                onSelect(items[currentIndex], currentIndex);
                return null;
            }
            break;
            
        default:
            return null;
    }
    
    if (newIndex !== currentIndex && items[newIndex]) {
        items[newIndex].focus();
        return newIndex;
    }
    
    return null;
}

/**
 * Formatea tiempo relativo de forma accesible
 * @param {string} timestamp - Timestamp ISO
 * @returns {string}
 */
export function getAccessibleTimeDescription(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'hace un momento';
    if (diffMins < 60) return `hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return time.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Creates an accessible description for a message
 * @param {Object} message - Objeto del mensaje
 * @returns {string}
 */
export function getAccessibleMessageDescription(message) {
    const sender = message.sender || 'Usuario desconocido';
    const time = getAccessibleTimeDescription(message.time);
    const type = message.type || 'mensaje';
    const hasAttachment = message.file ? ', con archivo adjunto' : '';
    const isEdited = message.edited ? ', editado' : '';
    
    return `${sender}, ${type}, ${time}${hasAttachment}${isEdited}`;
}

/**
 * Maneja el anuncio de nuevos mensajes
 * @param {Object} message - Objeto del mensaje
 * @param {boolean} [isCurrentChat=false] - Si el mensaje es del chat actual
 */
export function announceNewMessage(message, isCurrentChat = false) {
    const sender = message.sender_name || message.sender || 'Usuario';
    const preview = message.body ? message.body.substring(0, 100) : '';
    
    if (isCurrentChat) {
        // Current chat - more detailed announcement
        announceToScreenReader(
            `Nuevo mensaje de ${sender}: ${preview}`,
            'polite'
        );
    } else {
        // Otro chat - anuncio breve
        announceToScreenReader(
            `Nuevo mensaje de ${sender}`,
            'polite'
        );
    }
}

/**
 * Maneja el anuncio de cambios de estado
 * @param {string} status - Estado del usuario
 * @param {string} [userName] - Nombre del usuario
 */
export function announceStatusChange(status, userName = 'Usuario') {
    const statusMessages = {
        'online': 'online',
        'away': 'ausente',
        'dnd': 'no molestar',
        'offline': 'desconectado',
        'xa': 'ausente extendido'
    };
    
    const statusText = statusMessages[status] || status;
    announceToScreenReader(`${userName} is ${statusText}`);
}

/**
 * Configura atajos de teclado accesibles
 * @param {Object} shortcuts - Objeto con atajos {key: handler}
 * @returns {Function} Function to unregister the shortcuts
 */
export function registerKeyboardShortcuts(shortcuts) {
    const handleKeyDown = (event) => {
        // Ignorar si estamos en un campo de entrada
        if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
            return;
        }
        
        const key = getShortcutKey(event);
        const handler = shortcuts[key];
        
        if (handler) {
            event.preventDefault();
            handler(event);
        }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
        document.removeEventListener('keydown', handleKeyDown);
    };
}

/**
 * Gets the key representation for shortcuts
 * @param {KeyboardEvent} event
 * @returns {string}
 */
function getShortcutKey(event) {
    const modifiers = [];
    if (event.ctrlKey) modifiers.push('Ctrl');
    if (event.altKey) modifiers.push('Alt');
    if (event.shiftKey) modifiers.push('Shift');
    if (event.metaKey) modifiers.push('Meta');
    
    modifiers.push(event.key);
    return modifiers.join('+');
}

/**
 * Verifies if high contrast mode is enabled
 * @returns {boolean}
 */
export function isHighContrastMode() {
    const testElement = document.createElement('div');
    testElement.style.cssText = 'border: 1px solid; border-color: ButtonFace; position: absolute;';
    document.body.appendChild(testElement);
    
    const computedStyle = window.getComputedStyle(testElement);
    const isHighContrast = computedStyle.borderColor !== 'rgb(255, 255, 255)' && 
                          computedStyle.borderColor !== 'rgba(0, 0, 0, 0)';
    
    document.body.removeChild(testElement);
    return isHighContrast;
}

/**
 * Hooks del API para plugins
 */
export function initAccessibilityAPI() {
    // Registrar funciones en el API de Converse
    Object.assign(api, {
        accessibility: {
            announce: announceToScreenReader,
            moveFocus: moveFocusTo,
            trapFocus,
            getFocusableElements,
            announceNewMessage,
            announceStatusChange,
            registerShortcuts: registerKeyboardShortcuts,
            isHighContrastMode
        }
    });
}

export default {
    initLiveRegion,
    announceToScreenReader,
    moveFocusTo,
    getFocusableElements,
    trapFocus,
    generateAriaId,
    handleListNavigation,
    getAccessibleTimeDescription,
    getAccessibleMessageDescription,
    announceNewMessage,
    announceStatusChange,
    registerKeyboardShortcuts,
    isHighContrastMode,
    initAccessibilityAPI
};
