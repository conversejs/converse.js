import { _converse, api, converse } from '@converse/headless';
import app_api from './api.js';
import ConverseRoot from './root.js';
import { ensureElement } from './utils.js';
import { routeApp, syncAppToHash, clearAppRoutes } from './routing.js';
import { routeXMPPURI, registerProtocolHandlerIfEnabled } from './protocol-handler.js';
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
            // When true, reflect in-app navigation in `location.hash` so the browser
            // back/forward buttons and shareable/deep links work.
            enable_url_routing: false,
            // When true, ask the browser on login to route XEP-0147 `xmpp:` links to this Converse instance
            // Integrators who need to prompt from a user gesture (e.g. Firefox requires one) can instead call
            // `api.protocolHandler.register()` from a button.
            register_protocol_handler: false,
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
        api.listen.on('clearSession', clearAppRoutes);

        // XEP-0147 `xmpp:` links handed over by the browser's protocol handler.
        addEventListener('hashchange', routeXMPPURI);
        api.listen.on('connected', routeXMPPURI);
        api.listen.on('reconnected', routeXMPPURI);
        api.listen.on('connected', registerProtocolHandlerIfEnabled);

        // Only define the element now, otherwise it it's already in the DOM
        // before `converse.initialized` has been called it will render too
        // early.
        api.elements.define('converse-root', ConverseRoot);
    },
});
