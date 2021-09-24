import { _converse } from '@converse/headless/core.js';
import assignIn from 'lodash-es/assignIn';
import isEqual from "lodash-es/isEqual.js";
import isObject from 'lodash-es/isObject';
import log from '@converse/headless/log';
import pick from 'lodash-es/pick';
import u from '@converse/headless/utils/core';
import { DEFAULT_SETTINGS } from './constants.js';
import { Events } from '@converse/skeletor/src/events.js';
import { Model } from '@converse/skeletor/src/model.js';
import { initStorage } from '@converse/headless/utils/storage.js';

let app_settings;
let init_settings = {}; // Container for settings passed in via converse.initialize
let user_settings; // User settings, populated via api.users.settings

export function getAppSettings () {
    return app_settings;
}

export function initAppSettings (settings) {
    init_settings = settings;

    app_settings = {};
    Object.assign(app_settings, Events);

    // Allow only whitelisted settings to be overwritten via converse.initialize
    const allowed_settings = pick(settings, Object.keys(DEFAULT_SETTINGS));
    assignIn(app_settings, DEFAULT_SETTINGS, allowed_settings);
}

export function getInitSettings () {
    return init_settings;
}

export function getAppSetting (key) {
    if (Object.keys(DEFAULT_SETTINGS).includes(key)) {
        return app_settings[key];
    }
}

export function extendAppSettings (settings) {
    u.merge(DEFAULT_SETTINGS, settings);
    // When updating the settings, we need to avoid overwriting the
    // initialization_settings (i.e. the settings passed in via converse.initialize).
    const allowed_keys = Object.keys(pick(settings,Object.keys(DEFAULT_SETTINGS)));
    const allowed_site_settings = pick(init_settings, allowed_keys);
    const updated_settings = assignIn(pick(settings, allowed_keys), allowed_site_settings);
    u.merge(app_settings, updated_settings);
}

export function registerListener (name, func, context) {
    app_settings.on(name, func, context)
}

export function unregisterListener (name, func) {
    app_settings.off(name, func);
}

export function updateAppSettings (key, val) {
    if (key == null) return this; // eslint-disable-line no-eq-null

    let attrs;
    if (isObject(key)) {
        attrs = key;
    } else if (typeof key === 'string') {
        attrs = {};
        attrs[key] = val;
    }

    const allowed_keys = Object.keys(pick(attrs, Object.keys(DEFAULT_SETTINGS)));
    const changed = {};
    allowed_keys.forEach(k => {
        const val = attrs[k];
        if (!isEqual(app_settings[k], val)) {
            changed[k] = val;
            app_settings[k] = val;
        }
    });
    Object.keys(changed).forEach(k => app_settings.trigger('change:' + k, changed[k]));
    app_settings.trigger('change', changed);
}

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
