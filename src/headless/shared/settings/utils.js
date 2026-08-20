import isEqual from 'lodash-es/isEqual.js';
import pick from 'lodash-es/pick.js';
import { EventEmitter } from '@converse/skeletor';
import { DEFAULT_SETTINGS } from './constants.js';
import { normalizeSettings } from './schema.js';
import { merge } from '../../utils/object.js';

let app_settings;
let init_settings = {}; // Container for settings passed in via converse.initialize

/**
 * Settings whose user-provided value is *deep-merged* onto the default (and onto
 * the current value, for `api.settings.set`) instead of replacing it wholesale.
 * Opt in per setting via the `deep_merge` option of `api.settings.extend`.
 *
 * Only suitable for plain-object settings: array, function, RegExp or DOM-node
 * values can't be structured-cloned/merged and fall back to replace semantics.
 * @type {Set<string>}
 */
const deep_merge_settings = new Set();

/** @param {unknown} o */
function isPlainObject(o) {
    return o !== null && typeof o === 'object' && !Array.isArray(o);
}

/**
 * Deep-merge `override` onto a *clone* of `base`, returning a new object so the
 * default (or current) value is never mutated. Falls back to returning
 * `override` when either side isn't a plain object, preserving replace semantics.
 * @param {*} base
 * @param {*} override
 * @returns {*}
 */
function deepMergeSetting(base, override) {
    if (!isPlainObject(base) || !isPlainObject(override)) return override;
    const merged = structuredClone(base);
    merge(merged, override);
    return merged;
}

class AppSettings extends EventEmitter(Object) {}

export function getAppSettings() {
    return app_settings;
}

export function initAppSettings(settings) {
    init_settings = settings;

    app_settings = new AppSettings();

    // Allow only whitelisted settings to be overwritten via converse.initialize
    const allowed_settings = normalizeSettings(pick(settings, Object.keys(DEFAULT_SETTINGS)));
    Object.assign(app_settings, DEFAULT_SETTINGS);
    for (const [k, v] of Object.entries(allowed_settings)) {
        // Deep-merge keys keep the default's unspecified sub-keys; the rest replace.
        app_settings[k] = deep_merge_settings.has(k) ? deepMergeSetting(DEFAULT_SETTINGS[k], v) : v;
    }
}

export function getInitSettings() {
    return init_settings;
}

export function getAppSetting(key) {
    if (app_settings && Object.keys(DEFAULT_SETTINGS).includes(key)) {
        return app_settings[key];
    }
}

/**
 * @param {Object} settings - New settings (or new defaults for existing settings).
 * @param {Object} [options]
 * @param {string[]} [options.deep_merge] - Keys whose user-provided object value
 *  should be deep-merged onto the default instead of replacing it wholesale. The
 *  setting must be a plain object (see {@link deepMergeSetting}).
 */
export function extendAppSettings(settings, options = {}) {
    options.deep_merge?.forEach((k) => deep_merge_settings.add(k));

    merge(DEFAULT_SETTINGS, settings);
    // When updating the settings, we need to avoid overwriting the
    // initialization_settings (i.e. the settings passed in via converse.initialize).
    const allowed_keys = Object.keys(settings).filter((k) => k in DEFAULT_SETTINGS);
    const allowed_site_settings = pick(init_settings, allowed_keys);
    const combined = {};
    for (const k of allowed_keys) {
        if (!(k in allowed_site_settings)) {
            combined[k] = settings[k]; // No site override: use the (new) default.
        } else if (deep_merge_settings.has(k)) {
            // Deep-merge the site override onto the default so unspecified
            // sub-keys keep their default value instead of being dropped.
            combined[k] = deepMergeSetting(DEFAULT_SETTINGS[k], allowed_site_settings[k]);
        } else {
            combined[k] = allowed_site_settings[k]; // Site override replaces the default.
        }
    }
    const updated_settings = normalizeSettings(combined);
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

    attrs = normalizeSettings(attrs);
    const allowed_keys = Object.keys(attrs).filter((k) => k in DEFAULT_SETTINGS);
    const changed = {};
    allowed_keys.forEach((k) => {
        // Deep-merge settings patch their current value; everything else replaces it.
        const new_val = deep_merge_settings.has(k) ? deepMergeSetting(app_settings[k], attrs[k]) : attrs[k];
        if (!isEqual(app_settings[k], new_val)) {
            changed[k] = new_val;
            app_settings[k] = new_val;
        }
    });
    Object.keys(changed).forEach((k) => app_settings.trigger('change:' + k, changed[k]));
    app_settings.trigger('change', changed);
}
