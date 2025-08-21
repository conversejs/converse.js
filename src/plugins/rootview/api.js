import { api } from '@converse/headless';

const apps = new Map();

function setCurrentAppInactive() {
    const currentApp = apps_api.apps.getActive();
    if (currentApp) {
        apps.set(currentApp.name, {
            ...currentApp,
            active: false,
        });
    }
}

const apps_api = {
    apps: {
        /**
         * @param {import('./types').App} app
         */
        add(app) {
            if (!app.name) throw new Error("Can't add app without a name");
            if (app.active) setCurrentAppInactive();
            apps.set(app.name, app);
        },

        /**
         * @returns {import('./types').App}
         */
        getActive() {
            return Array.from(apps.values()).find((app) => app.active);
        },

        /**
         * @param {string} name
         */
        switch(name) {
            if (apps.has(name)) {
                setCurrentAppInactive();
                apps.set(name, {
                    ...apps.get(name),
                    active: true,
                });
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
