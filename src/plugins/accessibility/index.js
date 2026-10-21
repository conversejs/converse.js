/**
 * @module accessibility
 * @description Accessibility plugin for Converse.js
 * Improves the experience for screen reader and keyboard users
 */

import { _converse, api, converse } from '@converse/headless';
import { __ } from 'i18n';
import { initAccessibilityAPI } from '../../utils/accessibility.js';
import {
    announceToScreenReader,
    announceNewMessage,
    announceStatusChange,
    initLiveRegion,
} from '../../utils/accessibility.js';
import { initKeyboardShortcuts } from './keyboard-shortcuts.js';
import './modal.js';
import './settings-panel.js';
import '../../shared/components/screen-reader-announcer.js';

converse.plugins.add('converse-accessibility', {
    dependencies: ['converse-chatboxes', 'converse-roster', 'converse-muc'],

    initialize() {
        // Plugin configuration
        api.settings.extend({
            /**
             * Enables enhanced accessibility features
             * @type {boolean}
             */
            enable_accessibility: true,

            /**
             * Enables keyboard shortcuts
             * @type {boolean}
             */
            enable_keyboard_shortcuts: true,

            /**
             * Enables screen reader announcements
             * @type {boolean}
             */
            enable_screen_reader_announcements: true,

            /**
             * Announce new messages automatically
             * @type {boolean}
             */
            announce_new_messages: true,

            /**
             * Announce contact status changes
             * @type {boolean}
             */
            announce_status_changes: true,

            /**
             * High contrast mode
             * @type {boolean|'auto'}
             */
            high_contrast_mode: 'auto',
        });

        // Initialize only if enabled
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
    },
});

/**
 * Initializes the accessibility features
 */
function initializeAccessibility() {
    // Initialize the accessibility API
    initAccessibilityAPI();

    // Initialize live region
    initLiveRegion();

    // Initialize keyboard shortcuts
    if (api.settings.get('enable_keyboard_shortcuts')) {
        initKeyboardShortcuts();
    }

    // Set up listeners for announcements
    if (api.settings.get('enable_screen_reader_announcements')) {
        setupScreenReaderAnnouncements();
    }

    // Apply high contrast improvements if needed
    applyHighContrastMode();

    // Announce that the application is ready
    announceToScreenReader(
        __('Converse.js loaded. Press Alt+Shift+H to see the available keyboard shortcuts.'),
        'polite',
        2000,
    );
}

/**
 * Sets up screen reader announcements
 */
function setupScreenReaderAnnouncements() {
    const announce_new_messages = api.settings.get('announce_new_messages');
    const announce_status_changes = api.settings.get('announce_status_changes');

    // Announce new messages
    if (announce_new_messages) {
        api.listen.on('message', (data) => {
            const { chatbox, stanza } = data;
            // Body-less messages (e.g. chat states) have no chatbox
            if (!chatbox || !stanza) return;

            const body = stanza.querySelector('body')?.textContent;
            if (!body) return;

            const is_current = _converse.state.chatboxviews.get(chatbox.get('jid'))?.model === chatbox;

            // Only announce incoming messages
            if (stanza.getAttribute('from') !== _converse.session.get('jid')) {
                announceNewMessage(
                    {
                        sender_name: chatbox.getDisplayName(),
                        body,
                        type: chatbox.get('type'),
                    },
                    is_current,
                );
            }
        });
    }

    // Announce status changes
    if (announce_status_changes) {
        api.listen.on('statusChanged', (status) => {
            const contact = _converse.state.roster?.get(status.from);
            if (contact) {
                announceStatusChange(status.show, contact.getDisplayName());
            }
        });
    }

    // Announce when someone joins or leaves a room
    api.listen.on('chatRoomPresence', (data) => {
        const { presence } = data;
        const from = presence.getAttribute('from');
        const nick = presence.querySelector('nick')?.textContent;
        const type = presence.getAttribute('type');

        if (type === 'unavailable') {
            announceToScreenReader(__('%1$s has left the room', nick || from));
        } else {
            announceToScreenReader(__('%1$s has joined the room', nick || from));
        }
    });

    // Announce errors
    api.listen.on('chatBoxClosed', (chatbox) => {
        announceToScreenReader(__('Chat with %1$s closed', chatbox.getDisplayName()));
    });
}

/**
 * Applies high contrast mode if needed
 */
function applyHighContrastMode() {
    const mode = api.settings.get('high_contrast_mode');

    if (mode === 'auto') {
        // Detect if the system is in high contrast mode
        const mediaQuery = window.matchMedia('(prefers-contrast: high)');

        if (mediaQuery.matches) {
            document.body.classList.add('converse-high-contrast');
        }

        // Listen for changes
        mediaQuery.addEventListener('change', (e) => {
            document.body.classList.toggle('converse-high-contrast', e.matches);
        });
    } else if (mode === true) {
        document.body.classList.add('converse-high-contrast');
    }
}

/**
 * Keyboard shortcuts help modal
 */
export function showKeyboardShortcutsModal() {
    const shortcuts = [
        { key: 'Alt+Shift+H', description: __('Show/hide this help'), context: __('Global') },
        { key: 'Alt+Shift+C', description: __('Focus composition area'), context: __('Global') },
        { key: 'Alt+Shift+L', description: __('Focus chats list'), context: __('Global') },
        { key: 'Alt+Shift+M', description: __('Go to last message'), context: __('Global') },
        { key: 'Alt+Shift+N', description: __('Next unread chat'), context: __('Global') },
        { key: 'Alt+Shift+S', description: __('Search contacts'), context: __('Global') },
        { key: 'Escape', description: __('Close modal'), context: __('Global') },
        { key: 'Ctrl+Enter', description: __('Send message'), context: __('Composer') },
        { key: 'Alt+Shift+E', description: __('Insert emoji'), context: __('Composer') },
        { key: 'Alt+Shift+F', description: __('Attach file'), context: __('Composer') },
        { key: 'Alt+↑', description: __('Previous message'), context: __('Messages') },
        { key: 'Alt+↓', description: __('Next message'), context: __('Messages') },
        { key: 'Alt+Shift+R', description: __('Reply to message'), context: __('Messages') },
    ];

    api.modal.show('converse-keyboard-shortcuts-modal', { shortcuts });
}

export default {
    initializeAccessibility,
    setupScreenReaderAnnouncements,
    applyHighContrastMode,
    showKeyboardShortcutsModal,
};
