import ConverseRoot from './root.js';
import ConverseBackground from './background.js';
import { api, converse } from '@converse/headless';
import { ensureElement } from './utils.js';


converse.plugins.add('converse-rootview', {

    initialize () {
        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        api.settings.extend({
            auto_insert: true,
            dark_theme: 'dracula',
            rtl_langs: ["ar", "fa", "he", "ur"],
            show_background: false,
            theme: 'classic',
        });

        api.listen.on('chatBoxesInitialized', ensureElement);

        // Only define the element now, otherwise it it's already in the DOM
        // before `converse.initialized` has been called it will render too
        // early.
        api.elements.define('converse-root', ConverseRoot);
    }
});
