/**
 * @module accessibility
 * @description Keyboard shortcuts
 */
import { api, converse } from '@converse/headless';
import { onKeyDown } from './keyboard-shortcuts.js';
import { removeLiveRegion } from './utils.js';
import './modal.js';

converse.plugins.add('converse-accessibility', {
    dependencies: ['converse-chatboxes', 'converse-muc'],

    initialize() {
        api.settings.extend({
            enable_keyboard_shortcuts: true,
        });

        document.addEventListener('keydown', onKeyDown);
        api.listen.on('cleanup', () => {
            document.removeEventListener('keydown', onKeyDown);
            removeLiveRegion();
        });
    },
});
