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
         * @returns {import('./types').App}
         */
        getActive() {
            const name = _converse.state.session.get('active_app') ?? 'chat';
            const apps_array = Array.from(apps.values());
            return apps_array.find((app) => app.name === name) || apps_array[0];
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
