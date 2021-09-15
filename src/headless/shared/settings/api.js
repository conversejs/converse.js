import isObject from 'lodash-es/isObject';
import log from '@converse/headless/log.js';
import {
    clearUserSettings,
    extendAppSettings,
    getAppSetting,
    getUserSettings,
    registerListener,
    unregisterListener,
    updateAppSettings,
    updateUserSettings,
} from '@converse/headless/shared/settings/utils.js';

/**
 * This grouping allows access to the
 * [configuration settings](/docs/html/configuration.html#configuration-settings)
 * of Converse.
 *
 * @namespace _converse.api.settings
 * @memberOf _converse.api
 */
export const settings_api = {
    /**
     * Allows new configuration settings to be specified, or new default values for
     * existing configuration settings to be specified.
     *
     * Note, calling this method *after* converse.initialize has been
     * called will *not* change the initialization settings provided via
     * `converse.initialize`.
     *
     * @method _converse.api.settings.extend
     * @param {object} settings The configuration settings
     * @example
     * _converse.api.settings.extend({
     *    'enable_foo': true
     * });
     *
     * // The user can then override the default value of the configuration setting when
     * // calling `converse.initialize`.
     * converse.initialize({
     *     'enable_foo': false
     * });
     */
    extend (settings) {
        return extendAppSettings(settings);
    },

    update (settings) {
        log.warn(
            'The api.settings.update method has been deprecated and will be removed. ' +
                'Please use api.settings.extend instead.'
        );
        return this.extend(settings);
    },

    /**
     * @method _converse.api.settings.get
     * @returns {*} Value of the particular configuration setting.
     * @example _converse.api.settings.get("play_sounds");
     */
    get (key) {
        return getAppSetting(key);
    },

    /**
     * Set one or many configuration settings.
     *
     * Note, this is not an alternative to calling {@link converse.initialize}, which still needs
     * to be called. Generally, you'd use this method after Converse is already
     * running and you want to change the configuration on-the-fly.
     *
     * @method _converse.api.settings.set
     * @param {Object} [settings] An object containing configuration settings.
     * @param {string} [key] Alternatively to passing in an object, you can pass in a key and a value.
     * @param {string} [value]
     * @example _converse.api.settings.set("play_sounds", true);
     * @example
     * _converse.api.settings.set({
     *     "play_sounds": true,
     *     "hide_offline_users": true
     * });
     */
    set (key, val) {
        updateAppSettings(key, val);
    },

    /**
     * The `listen` namespace exposes methods for creating event listeners
     * (aka handlers) for events related to settings.
     *
     * @namespace _converse.api.settings.listen
     * @memberOf _converse.api.settings
     */
    listen: {
        /**
         * Register an event listener for the passed in event.
         * @method _converse.api.settings.listen.on
         * @param { ('change') } name - The name of the event to listen for.
         *  Currently there is only the 'change' event.
         * @param { Function } handler - The event handler function
         * @param { Object } [context] - The context of the `this` attribute of the
         *  handler function.
         * @example _converse.api.settings.listen.on('change', callback);
         */
        on (name, handler, context) {
            registerListener(name, handler, context);
        },

        /**
         * To stop listening to an event, you can use the `not` method.
         * @method _converse.api.settings.listen.not
         * @param { String } name The event's name
         * @param { Function } callback The callback method that is to no longer be called when the event fires
         * @example _converse.api.settings.listen.not('change', callback);
         */
        not (name, handler) {
            unregisterListener(name, handler);
        }
    }
};


/**
 * API for accessing and setting user settings. User settings are
 * different from the application settings from {@link _converse.api.settings}
 * because they are per-user and set via user action.
 * @namespace _converse.api.user.settings
 * @memberOf _converse.api.user
 */
export const user_settings_api = {
    /**
     * Returns the user settings model. Useful when you want to listen for change events.
     * @async
     * @method _converse.api.user.settings.getModel
     * @returns {Promise<Model>}
     * @example const settings = await _converse.api.user.settings.getModel();
     */
    getModel () {
        return getUserSettings();
    },

    /**
     * Get the value of a particular user setting.
     * @method _converse.api.user.settings.get
     * @param {String} key - The setting name
     * @param {*} [fallback] - An optional fallback value if the user setting is undefined
     * @returns {Promise} Promise which resolves with the value of the particular configuration setting.
     * @example _converse.api.user.settings.get("foo");
     */
    async get (key, fallback) {
        const user_settings = await getUserSettings();
        return user_settings.get(key) === undefined ? fallback : user_settings.get(key);
    },

    /**
     * Set one or many user settings.
     * @async
     * @method _converse.api.user.settings.set
     * @param {Object} [settings] An object containing configuration settings.
     * @param {string} [key] Alternatively to passing in an object, you can pass in a key and a value.
     * @param {string} [value]
     * @example _converse.api.user.settings.set("foo", "bar");
     * @example
     * _converse.api.user.settings.set({
     *     "foo": "bar",
     *     "baz": "buz"
     * });
     */
    set (key, val) {
        if (isObject(key)) {
            return updateUserSettings(key, {'promise': true});
        } else {
            const o = {};
            o[key] = val;
            return updateUserSettings(o, {'promise': true});
        }
    },

    /**
     * Clears all the user settings
     * @async
     * @method _converse.api.user.settings.clear
     */
    clear () {
        return clearUserSettings();
    }
}
