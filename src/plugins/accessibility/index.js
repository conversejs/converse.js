/**
 * @module accessibility
 * @description Keyboard shortcuts and screen reader announcements
 */
import { api, converse } from '@converse/headless';
import { onKeyDown } from './keyboard-shortcuts.js';
import { announceMessage, removeLiveRegion } from './utils.js';
import './modal.js';

converse.plugins.add('converse-accessibility', {
    dependencies: ['converse-chatboxes', 'converse-muc', 'converse-notification'],

    initialize() {
        api.settings.extend({
            enable_keyboard_shortcuts: true,
            enable_screen_reader_announcements: true,
        });

        document.addEventListener('keydown', onKeyDown);
        api.listen.on('messageNotification', announceMessage);
        api.listen.on('cleanup', () => {
            document.removeEventListener('keydown', onKeyDown);
            removeLiveRegion();
        });
    },
});
