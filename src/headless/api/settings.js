import log from '@converse/headless/log.js';
import { getAppSetting, extendAppSettings, updateAppSettings } from '@converse/headless/shared/settings';

/**
 * This grouping allows access to the
 * [configuration settings](/docs/html/configuration.html#configuration-settings)
 * of Converse.
 *
 * @namespace _converse.api.settings
 * @memberOf _converse.api
 */
export default {
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
};
