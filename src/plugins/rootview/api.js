import { _converse, api } from '@converse/headless';

const apps = new Map();

const apps_api = {
    apps: {
        /**
         * @param {import('./types').App} app
         */
        add(app) {
            if (!app.name) throw new Error("Can't add app without a name");
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
