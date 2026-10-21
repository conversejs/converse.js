/**
 * @module accessibility
 * @description Utilities for improving the accessibility of Converse.js
 * Functions for screen readers, focus management and keyboard navigation
 */

import { api } from '@converse/headless';
import { __ } from 'i18n';

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
 * Announces a message to screen readers
 * @param {string} message - The message to announce
 * @param {('polite'|'assertive')} [priority='polite'] - Announcement priority
 * @param {number} [delay=100] - Delay in ms before announcing
 */
export function announceToScreenReader(message, priority = 'polite', delay = 100) {
    if (!message) return;

    const region = initLiveRegion();
    region.setAttribute('aria-live', priority);

    // Clear the previous content
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
 * Moves focus to an element accessibly
 * @param {HTMLElement} element - Element to move focus to
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.preventScroll=false] - Prevent automatic scroll
 * @param {string} [options.announce] - Optional message to announce
 */
export function moveFocusTo(element, options = {}) {
    if (!element) return;

    const { preventScroll = false, announce } = options;

    // Make sure the element can receive focus
    if (!element.hasAttribute('tabindex') && !isNaturallyFocusable(element)) {
        element.setAttribute('tabindex', '-1');
    }

    element.focus({ preventScroll });

    if (announce) {
        announceToScreenReader(announce);
    }
}

/**
 * Checks whether an element is natively focusable
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isNaturallyFocusable(element) {
    const focusableTags = ['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'];
    return focusableTags.includes(element.tagName) && !element.hasAttribute('disabled');
}

/**
 * Gets all focusable elements within a container
 * @param {HTMLElement} container - Container to search
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
        '[contenteditable="true"]',
    ].join(', ');

    return /** @type {HTMLElement[]} */ (Array.from(container.querySelectorAll(selector))).filter((el) => {
        // Exclude hidden elements
        const htmlEl = /** @type {HTMLElement} */ (el);
        const style = window.getComputedStyle(htmlEl);
        return style.display !== 'none' && style.visibility !== 'hidden' && htmlEl.offsetParent !== null;
    });
}

/**
 * Creates a focus trap for modals and dialogs
 * @param {HTMLElement} container - Container to trap focus in
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

    // Move focus to the first element
    firstElement.focus();

    // Return function to release the trap
    return () => {
        container.removeEventListener('keydown', handleKeyDown);
    };
}

/**
 * Generates a unique ID for ARIA associations
 * @param {string} prefix - Prefix for the ID
 * @returns {string}
 */
export function generateAriaId(prefix = 'aria') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Handles keyboard navigation in a list
 * @param {KeyboardEvent} event
 * @param {HTMLElement[]} items - List of elements
 * @param {number} currentIndex - Current index
 * @param {Object} [options] - Options
 * @returns {number|null} New index or null if no change
 */
export function handleListNavigation(event, items, currentIndex, options = {}) {
    const {
        orientation = 'vertical', // 'vertical' | 'horizontal'
        wrap = true,
        onSelect = null,
    } = options;

    const keys =
        orientation === 'vertical' ? { prev: 'ArrowUp', next: 'ArrowDown' } : { prev: 'ArrowLeft', next: 'ArrowRight' };

    let newIndex = currentIndex;

    switch (event.key) {
        case keys.prev:
            event.preventDefault();
            newIndex = currentIndex > 0 ? currentIndex - 1 : wrap ? items.length - 1 : 0;
            break;

        case keys.next:
            event.preventDefault();
            newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : wrap ? 0 : items.length - 1;
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
 * Formats relative time accessibly
 * @param {string} timestamp - ISO timestamp
 * @returns {string}
 */
export function getAccessibleTimeDescription(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return __('a moment ago');
    if (diffMins < 60) return diffMins === 1 ? __('1 minute ago') : __('%1$s minutes ago', diffMins);
    if (diffHours < 24) return diffHours === 1 ? __('1 hour ago') : __('%1$s hours ago', diffHours);
    if (diffDays < 7) return diffDays === 1 ? __('1 day ago') : __('%1$s days ago', diffDays);

    return time.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Creates an accessible description for a message
 * @param {Object} message - Message object
 * @returns {string}
 */
export function getAccessibleMessageDescription(message) {
    const sender = message.sender || __('Unknown user');
    const time = getAccessibleTimeDescription(message.time);
    const type = message.type || __('message');
    const hasAttachment = message.file ? `, ${__('with attachment')}` : '';
    const isEdited = message.edited ? `, ${__('edited')}` : '';

    return `${sender}, ${type}, ${time}${hasAttachment}${isEdited}`;
}

/**
 * Handles announcing new messages
 * @param {Object} message - Message object
 * @param {boolean} [isCurrentChat=false] - Whether the message belongs to the current chat
 */
export function announceNewMessage(message, isCurrentChat = false) {
    const sender = message.sender_name || message.sender || __('User');
    const preview = message.body ? message.body.substring(0, 100) : '';

    if (isCurrentChat) {
        // Current chat - more detailed announcement
        announceToScreenReader(__('New message from %1$s: %2$s', sender, preview), 'polite');
    } else {
        // Another chat - brief announcement
        announceToScreenReader(__('New message from %1$s', sender), 'polite');
    }
}

/**
 * Handles announcing status changes
 * @param {string} status - The user's status
 * @param {string} [userName] - The user's name
 */
export function announceStatusChange(status, userName = __('User')) {
    const statusMessages = {
        'online': __('online'),
        'away': __('away'),
        'dnd': __('do not disturb'),
        'offline': __('offline'),
        'xa': __('extended away'),
    };

    const statusText = statusMessages[status] || status;
    announceToScreenReader(__('%1$s is %2$s', userName, statusText));
}

/**
 * Sets up accessible keyboard shortcuts
 * @param {Object} shortcuts - Object of shortcuts {key: handler}
 * @returns {Function} Function to unregister the shortcuts
 */
export function registerKeyboardShortcuts(shortcuts) {
    const handleKeyDown = (event) => {
        // Ignore if we are in an input field
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
    const isHighContrast =
        computedStyle.borderColor !== 'rgb(255, 255, 255)' && computedStyle.borderColor !== 'rgba(0, 0, 0, 0)';

    document.body.removeChild(testElement);
    return isHighContrast;
}

/**
 * API hooks for plugins
 */
export function initAccessibilityAPI() {
    // Register the functions on the Converse API
    Object.assign(api, {
        accessibility: {
            announce: announceToScreenReader,
            moveFocus: moveFocusTo,
            trapFocus,
            getFocusableElements,
            announceNewMessage,
            announceStatusChange,
            registerShortcuts: registerKeyboardShortcuts,
            isHighContrastMode,
        },
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
    initAccessibilityAPI,
};
