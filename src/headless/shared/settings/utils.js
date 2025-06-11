import isEqual from 'lodash-es/isEqual.js';
import pick from 'lodash-es/pick';
import { EventEmitter } from '@converse/skeletor';
import { DEFAULT_SETTINGS } from './constants.js';
import { merge } from '../../utils/object.js';

let app_settings;
let init_settings = {}; // Container for settings passed in via converse.initialize

class AppSettings extends EventEmitter(Object) {}

export function getAppSettings() {
    return app_settings;
}

export function initAppSettings(settings) {
    init_settings = settings;

    app_settings = new AppSettings();

    // Allow only whitelisted settings to be overwritten via converse.initialize
    const allowed_settings = pick(settings, Object.keys(DEFAULT_SETTINGS));
    Object.assign(app_settings, DEFAULT_SETTINGS, allowed_settings);
}

export function getInitSettings() {
    return init_settings;
}

export function getAppSetting(key) {
    if (Object.keys(DEFAULT_SETTINGS).includes(key)) {
        return app_settings[key];
    }
}

export function extendAppSettings(settings) {
    merge(DEFAULT_SETTINGS, settings);
    // When updating the settings, we need to avoid overwriting the
    // initialization_settings (i.e. the settings passed in via converse.initialize).
    const allowed_keys = Object.keys(settings).filter((k) => k in DEFAULT_SETTINGS);
    const allowed_site_settings = pick(init_settings, allowed_keys);
    const updated_settings = Object.assign(pick(settings, allowed_keys), allowed_site_settings);
    merge(app_settings, updated_settings);
}

/**
 * @param {string} name
 * @param {Function} func
 * @param {any} context
 */
export function registerListener(name, func, context) {
    app_settings.on(name, func, context);
}

/**
 * @param {string} name
 * @param {Function} func
 */
export function unregisterListener(name, func) {
    app_settings.off(name, func);
}

/**
 * @param {Object|string} key An object containing config settings or alternatively a string key
 * @param {string} [val] The value, if the previous parameter is a key
 */
export function updateAppSettings(key, val) {
    if (key == null) return this; // eslint-disable-line no-eq-null

    let attrs;
    if (key instanceof Object) {
        attrs = key;
    } else if (typeof key === 'string') {
        attrs = {};
        attrs[key] = val;
    }

    const allowed_keys = Object.keys(attrs).filter((k) => k in DEFAULT_SETTINGS);
    const changed = {};
    allowed_keys.forEach((k) => {
        const val = attrs[k];
        if (!isEqual(app_settings[k], val)) {
            changed[k] = val;
            app_settings[k] = val;
        }
    });
    Object.keys(changed).forEach((k) => app_settings.trigger('change:' + k, changed[k]));
    app_settings.trigger('change', changed);
}
