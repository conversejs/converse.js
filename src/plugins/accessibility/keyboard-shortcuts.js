/**
 * @module accessibility/keyboard-shortcuts
 * @description Keyboard shortcut system to improve accessible navigation
 */

import { api, _converse } from '@converse/headless';
import { __ } from 'i18n';
import { announceToScreenReader, moveFocusTo } from '../../utils/accessibility.js';

/**
 * @typedef {Object} KeyboardShortcut
 * @property {string} key - Key combination
 * @property {string} description - Shortcut description
 * @property {Function} handler - Shortcut handler
 * @property {string} [context] - Context in which the shortcut applies
 */

/**
 * Global keyboard shortcuts
 * @type {Map<string, KeyboardShortcut>}
 */
const globalShortcuts = new Map();

/**
 * Contextual keyboard shortcuts
 * @type {Map<string, Map<string, KeyboardShortcut>>}
 */
const contextualShortcuts = new Map();

/**
 * Help modal state
 */
let helpModalVisible = false;

/**
 * Initializes the default keyboard shortcuts
 */
export function initDefaultShortcuts() {
    // Global shortcuts
    registerShortcut({
        key: 'Alt+Shift+H',
        description: __('Show keyboard shortcuts help'),
        handler: showKeyboardShortcutsHelp,
    });

    registerShortcut({
        key: 'Alt+Shift+C',
        description: __('Focus message composition area'),
        handler: focusMessageComposer,
    });

    registerShortcut({
        key: 'Alt+Shift+L',
        description: __('Focus the chats list'),
        handler: focusChatList,
    });

    registerShortcut({
        key: 'Alt+Shift+M',
        description: __('Focus last message'),
        handler: focusLastMessage,
    });

    registerShortcut({
        key: 'Alt+Shift+N',
        description: __('Go to next chat with unread messages'),
        handler: focusNextUnreadChat,
    });

    registerShortcut({
        key: 'Alt+Shift+P',
        description: __('Go to previous chat'),
        handler: focusPreviousChat,
    });

    registerShortcut({
        key: 'Alt+Shift+S',
        description: __('Search contacts'),
        handler: focusContactSearch,
    });

    registerShortcut({
        key: 'Escape',
        description: __('Close modal or open dialog'),
        handler: closeCurrentModal,
    });

    // Contextual shortcuts for the message composer
    registerShortcut({
        key: 'Ctrl+Enter',
        description: __('Send message'),
        context: 'message-composer',
        handler: sendMessage,
    });

    registerShortcut({
        key: 'Alt+Shift+E',
        description: __('Insert emoji'),
        context: 'message-composer',
        handler: toggleEmojiPicker,
    });

    registerShortcut({
        key: 'Alt+Shift+F',
        description: __('Attach file'),
        context: 'message-composer',
        handler: triggerFileUpload,
    });

    // Shortcuts for message navigation
    registerShortcut({
        key: 'Alt+ArrowUp',
        description: __('Previous message'),
        context: 'chat-messages',
        handler: focusPreviousMessage,
    });

    registerShortcut({
        key: 'Alt+ArrowDown',
        description: __('Next message'),
        context: 'chat-messages',
        handler: focusNextMessage,
    });

    registerShortcut({
        key: 'Alt+Shift+R',
        description: __('Reply to focused message'),
        context: 'chat-messages',
        handler: replyToMessage,
    });
}

/**
 * Registers a keyboard shortcut
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
 * Unregisters a keyboard shortcut
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
 * Handles keyboard events
 * @param {KeyboardEvent} event
 */
export function handleKeyboardEvent(event) {
    // Ignore if we are in a text field (except for specific shortcuts)
    const target = /** @type {HTMLElement} */ (event.target);
    const isTextField = ['INPUT', 'TEXTAREA'].includes(target.tagName);

    const key = getKeyString(event);

    // Check the current context
    const context = getCurrentContext(target);

    // Look for a contextual shortcut first
    if (context) {
        const contextShortcuts = contextualShortcuts.get(context);
        const shortcut = contextShortcuts?.get(key);

        if (shortcut) {
            event.preventDefault();
            shortcut.handler(event);
            return;
        }
    }

    // Then look for a global shortcut (except in text fields)
    if (!isTextField || key.includes('Alt+') || key.includes('Ctrl+')) {
        const shortcut = globalShortcuts.get(key);

        if (shortcut) {
            event.preventDefault();
            shortcut.handler(event);
        }
    }
}

/**
 * Converts a KeyboardEvent into a key string
 * @param {KeyboardEvent} event
 * @returns {string}
 */
function getKeyString(event) {
    const parts = [];

    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');

    // Normalize key names
    const key = event.key === ' ' ? 'Space' : event.key;
    parts.push(key);

    return parts.join('+');
}

/**
 * Gets the current context based on the focused element
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
 * Shows the shortcuts help modal
 */
function showKeyboardShortcutsHelp() {
    if (helpModalVisible) {
        closeKeyboardShortcutsHelp();
        return;
    }

    const shortcuts = [];

    // Add global shortcuts
    globalShortcuts.forEach((shortcut) => {
        shortcuts.push({
            key: shortcut.key,
            description: shortcut.description,
            context: __('Global'),
        });
    });

    // Add contextual shortcuts
    contextualShortcuts.forEach((contextMap, context) => {
        contextMap.forEach((shortcut) => {
            shortcuts.push({
                key: shortcut.key,
                description: shortcut.description,
                context: context,
            });
        });
    });

    api.modal.show('converse-keyboard-shortcuts-modal', { shortcuts });
    helpModalVisible = true;
    announceToScreenReader(__('Keyboard shortcuts help opened'));
}

/**
 * Closes the help modal
 */
function closeKeyboardShortcutsHelp() {
    api.modal.close();
    helpModalVisible = false;
}

/**
 * Focuses the message composer
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
            announce: __('Message composition area focused'),
        });
    }
}

/**
 * Focuses the chats list
 */
function focusChatList() {
    const chatList = document.querySelector('#converse-roster');
    if (chatList) {
        const firstChat = /** @type {HTMLElement} */ (chatList.querySelector('.list-item'));
        if (firstChat) {
            moveFocusTo(firstChat, {
                announce: __('Chat list focused'),
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
            announce: __('Last message focused'),
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
        announce: __('Chat with unread messages'),
    });

    // Open the chat
    chats[nextIndex].click();
}

/**
 * Goes to the previous chat
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
            announce: __('Contact search'),
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
 * Toggles the emoji picker
 */
function toggleEmojiPicker() {
    const activeChat = getActiveChat();
    if (!activeChat) return;

    const emojiButton = /** @type {HTMLElement} */ (activeChat.querySelector('.toggle-emojis'));
    if (emojiButton) {
        emojiButton.click();
        announceToScreenReader(__('Emoji picker'));
    }
}

/**
 * Triggers a file upload
 */
function triggerFileUpload() {
    const activeChat = getActiveChat();
    if (!activeChat) return;

    const fileInput = /** @type {HTMLInputElement} */ (activeChat.querySelector('input[type="file"]'));
    if (fileInput) {
        fileInput.click();
        announceToScreenReader(__('File picker'));
    }
}

/**
 * Focuses the previous message
 */
function focusPreviousMessage() {
    const currentMessage = document.activeElement?.closest('.chat-msg');
    if (!currentMessage) {
        focusLastMessage();
        return;
    }

    // Find all messages in the history
    const messageHistory = currentMessage.closest('converse-message-history');
    if (!messageHistory) return;

    const messages = /** @type {HTMLElement[]} */ (Array.from(messageHistory.querySelectorAll('.chat-msg')));
    const currentIndex = messages.indexOf(/** @type {HTMLElement} */ (currentMessage));

    if (currentIndex > 0) {
        const prevMessage = messages[currentIndex - 1];
        moveFocusTo(prevMessage);

        // Announce the message
        const ariaLabel = prevMessage.getAttribute('aria-label');
        if (ariaLabel) {
            announceToScreenReader(ariaLabel, 'polite', 100);
        }
    }
}

/**
 * Focuses the next message
 */
function focusNextMessage() {
    const currentMessage = document.activeElement?.closest('.chat-msg');
    if (!currentMessage) return;

    // Find all messages in the history
    const messageHistory = currentMessage.closest('converse-message-history');
    if (!messageHistory) return;

    const messages = /** @type {HTMLElement[]} */ (Array.from(messageHistory.querySelectorAll('.chat-msg')));
    const currentIndex = messages.indexOf(/** @type {HTMLElement} */ (currentMessage));

    if (currentIndex < messages.length - 1) {
        const nextMessage = messages[currentIndex + 1];
        moveFocusTo(nextMessage);

        // Announce the message
        const ariaLabel = nextMessage.getAttribute('aria-label');
        if (ariaLabel) {
            announceToScreenReader(ariaLabel, 'polite', 100);
        }
    }
}

/**
 * Replies to the focused message
 */
function replyToMessage() {
    const currentMessage = document.activeElement?.closest('.chat-msg');
    if (!currentMessage) return;

    const quoteButton = /** @type {HTMLElement} */ (currentMessage.querySelector('.chat-msg__action-quote'));
    if (quoteButton) {
        quoteButton.click();
        announceToScreenReader(__('Replying to message'));
    }
}

/**
 * Gets the active chat
 * @returns {HTMLElement|null}
 */
function getActiveChat() {
    return document.querySelector('.chatbox:not(.hidden)');
}

/**
 * Initializes the keyboard shortcuts system
 */
export function initKeyboardShortcuts() {
    initDefaultShortcuts();
    document.addEventListener('keydown', handleKeyboardEvent);

    // Announce that shortcuts are available
    announceToScreenReader(__('Keyboard shortcuts enabled. Press Alt+Shift+H to see the help'), 'polite', 2000);
}

/**
 * Disables the keyboard shortcuts system
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
    handleKeyboardEvent,
};
