import { _converse, api, converse } from '@converse/headless';
import app_api from './api.js';
import ConverseRoot from './root.js';
import { ensureElement } from './utils.js';
import './background.js';
import './app-container.js';

converse.plugins.add('converse-rootview', {
    initialize() {
        Object.assign(_converse.api, app_api);

        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        api.settings.extend({
            auto_insert: true,
            dark_theme: 'dracula',
            // Languages for which the UI is right-to-left
            rtl_langs: ['ar', 'fa', 'he', 'ug'],
            show_background: false,
            theme: 'classic',
        });

        api.listen.on('chatBoxesInitialized', ensureElement);

        // Only define the element now, otherwise it it's already in the DOM
        // before `converse.initialized` has been called it will render too
        // early.
        api.elements.define('converse-root', ConverseRoot);
    },
});
