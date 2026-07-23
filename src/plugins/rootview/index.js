import { _converse, api, converse } from '@converse/headless';
import app_api from './api.js';
import ConverseRoot from './root.js';
import { ensureElement } from './utils.js';
import { routeApp, syncAppToHash } from './routing.js';
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
            apps: ['chat', 'social'], // Apps offered in the switcher
            auto_insert: true,
            dark_theme: 'dracula',
            // When true, reflect in-app navigation (the active app, and the Social
            // app's profile/post/hashtag views) in `location.hash` so the browser
            // back/forward buttons and shareable/deep links work. Off by default so
            // an embedded Converse never writes to the host page's URL.
            enable_url_routing: false,
            // Languages for which the UI is right-to-left
            rtl_langs: ['ar', 'fa', 'he', 'ug'],
            show_background: false,
            theme: 'classic',
        });

        api.listen.on('chatBoxesInitialized', ensureElement);

        // Optional URL routing for the app switcher (no-ops unless
        // `enable_url_routing`). The Social app wires its own sub-routes.
        addEventListener('hashchange', routeApp);
        api.listen.on('connected', routeApp);
        api.listen.on('reconnected', routeApp);
        api.listen.on('appSwitch', syncAppToHash);

        // Only define the element now, otherwise it it's already in the DOM
        // before `converse.initialized` has been called it will render too
        // early.
        api.elements.define('converse-root', ConverseRoot);
    },
});
