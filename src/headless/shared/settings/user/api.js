import _converse from '../../_converse.js';
import { Model } from '@converse/skeletor/src/model.js';
import { initStorage } from '../../../utils/storage.js';

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
     * @example const settings = await api.user.settings.getModel();
     */
    getModel () {
        return getUserSettings();
    },

    /**
     * Get the value of a particular user setting.
     * @method _converse.api.user.settings.get
     * @param {string} key - The setting name
     * @param {*} [fallback] - An optional fallback value if the user setting is undefined
     * @returns {Promise} Promise which resolves with the value of the particular configuration setting.
     * @example api.user.settings.get("foo");
     */
    async get (key, fallback) {
        const user_settings = await getUserSettings();
        return user_settings.get(key) === undefined ? fallback : user_settings.get(key);
    },

    /**
     * Set one or many user settings.
     * @async
     * @method _converse.api.user.settings.set
     * @param {Object|string} key An object containing config settings or alternatively a string key
     * @param {string} [val] The value, if the previous parameter is a key
     * @example api.user.settings.set("foo", "bar");
     * @example
     * api.user.settings.set({
     *     "foo": "bar",
     *     "baz": "buz"
     * });
     */
    set (key, val) {
        if (key instanceof Object) {
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
     * @method api.user.settings.clear
     */
    clear () {
        return clearUserSettings();
    }
}

let user_settings; // User settings, populated via api.users.settings

/**
 * @async
 */
function initUserSettings () {
    if (!_converse.bare_jid) {
        const msg = "No JID to fetch user settings for";
        log.error(msg);
        throw Error(msg);
    }
    if (!user_settings?.fetched) {
        const id = `converse.user-settings.${_converse.bare_jid}`;
        user_settings = new Model({id});
        initStorage(user_settings, id);
        user_settings.fetched = user_settings.fetch({'promise': true});
    }
    return user_settings.fetched;
}

export async function getUserSettings () {
    await initUserSettings();
    return user_settings;
}

export async function updateUserSettings (data, options) {
    await initUserSettings();
    return user_settings.save(data, options);
}

export async function clearUserSettings () {
    await initUserSettings();
    return user_settings.clear();
}
