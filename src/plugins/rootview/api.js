import { _converse, api } from '@converse/headless';
import { getTheme, isDarkTheme } from './utils.js';
import { registerProtocolHandler } from './protocol-handler.js';

const apps = new Map();

const apps_api = {
    protocolHandler: {
        /**
         * Ask the browser to route `xmpp:` links (XEP-0147) to this Converse
         * instance.
         *
         * Setting `register_protocol_handler` does this on login, but Firefox
         * only honours the request during a user gesture, so call this from a
         * click handler if you want it to work there.
         *
         * @returns {boolean} Whether the browser accepted the call.
         * @example _converse.api.protocolHandler.register();
         */
        register() {
            return registerProtocolHandler();
        },
    },

    theme: {
        /**
         * The theme currently in force, which is the `dark_theme` setting when
         * the user's system asks for a dark colour scheme, and the `theme`
         * setting otherwise.
         * @returns {string}
         */
        get() {
            return getTheme();
        },

        /**
         * Whether the theme currently in force is a dark one.
         *
         * Answered from the theme's own `color-scheme` declaration, so a
         * third-party theme is treated the same as a bundled one and Converse
         * never has to keep a list of theme names.
         *
         * @param {Element} [el] - The element to resolve the theme against.
         *  Defaults to `converse-root`.
         * @returns {boolean}
         */
        isDark(el) {
            return isDarkTheme(el);
        },
    },

    apps: {
        /**
         * @param {import('./types').App} app
         */
        add(app) {
            if (!app.name) throw new Error("Can't add app without a name");
            if (!api.settings.get('apps')?.includes(app.name)) return;

            apps.set(app.name, app);
        },

        /**
         * Returns all registered apps, or a single app by name.
         * @param {string} [name]
         * @returns {import('./types').App[]|import('./types').App|null}
         */
        get(name) {
            if (name) return apps.get(name) ?? null;

            return Array.from(apps.values());
        },

        /**
         * @returns {import('./types').App}
         */
        getActive() {
            const apps_array = Array.from(apps.values());
            const primary_app = apps_array.find((app) => app.primary) ?? apps_array[0];

            // The app switcher is a fullscreen-only feature. In the "overlayed"
            // and "embedded" view modes, Converse is just the (primary) chat app.
            if (api.settings.get('view_mode') !== 'fullscreen') return primary_app;

            const name = _converse.state.session.get('active_app');
            return apps_array.find((app) => app.name === name) ?? primary_app;
        },

        /**
         * @param {string} name
         */
        switch(name) {
            if (apps.has(name)) {
                _converse.state.session.save('active_app', name);
                const app = apps.get(name);
                /**
                 * Triggered when switching to a different app
                 * @event _converse#appSwitch
                 * @type {import('./types').App}
                 * @example _converse.api.listen.on('appSwitch', (app) => { ... });
                 */
                api.trigger('appSwitch', app);
                return app;
            }
            return null;
        },
    },
};

export default apps_api;
