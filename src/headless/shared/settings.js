import _converse from '@converse/headless/shared/_converse';
import assignIn from 'lodash/assignIn';
import isObject from 'lodash/isObject';
import log from '@converse/headless/log';
import pick from 'lodash/pick';
import u from '@converse/headless/utils/core';
import { Model } from '@converse/skeletor/src/model.js';
import { createStore } from '@converse/headless/shared/utils.js';

let init_settings = {}; // Container for settings passed in via converse.initialize
let app_settings = {};
let user_settings; // User settings, populated via api.users.settings

// Default configuration values
// ----------------------------
export const DEFAULT_SETTINGS = {
    allow_non_roster_messaging: false,
    assets_path: '/dist',
    authentication: 'login', // Available values are "login", "prebind", "anonymous" and "external".
    auto_login: false, // Currently only used in connection with anonymous login
    auto_reconnect: true,
    blacklisted_plugins: [],
    clear_cache_on_logout: false,
    connection_options: {},
    credentials_url: null, // URL from where login credentials can be fetched
    discover_connection_methods: true,
    geouri_regex: /https\:\/\/www.openstreetmap.org\/.*#map=[0-9]+\/([\-0-9.]+)\/([\-0-9.]+)\S*/g,
    geouri_replacement: 'https://www.openstreetmap.org/?mlat=$1&mlon=$2#map=18/$1/$2',
    i18n: undefined,
    idle_presence_timeout: 300, // Seconds after which an idle presence is sent
    jid: undefined,
    keepalive: true,
    loglevel: 'info',
    locales: [
        'af', 'ar', 'bg', 'ca', 'cs', 'da', 'de', 'el', 'eo', 'es', 'eu', 'en', 'fa', 'fi', 'fr',
        'gl', 'he', 'hi', 'hu', 'id', 'it', 'ja', 'lt', 'nb', 'nl', 'mr', 'oc',
        'pl', 'pt', 'pt_BR', 'ro', 'ru', 'sv', 'th', 'tr', 'uk', 'vi', 'zh_CN', 'zh_TW'
    ],
    nickname: undefined,
    password: undefined,
    persistent_store: 'localStorage',
    rid: undefined,
    root: window.document,
    sid: undefined,
    singleton: false,
    strict_plugin_dependencies: false,
    view_mode: 'overlayed', // Choices are 'overlayed', 'fullscreen', 'mobile'
    websocket_url: undefined,
    whitelisted_plugins: []
};


export function getAppSettings () {
    return app_settings;
}

export function initAppSettings (settings) {
    init_settings = settings;
    app_settings = {};
    // Allow only whitelisted settings to be overwritten via converse.initialize
    const allowed_settings = pick(settings, Object.keys(DEFAULT_SETTINGS));
    assignIn(_converse, DEFAULT_SETTINGS, allowed_settings); // FIXME: remove
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
    u.merge(_converse, updated_settings); // FIXME: remove
}

export function updateAppSettings (key, val) {
    const o = {};
    if (isObject(key)) {
        assignIn(_converse, pick(key, Object.keys(DEFAULT_SETTINGS))); // FIXME: remove
        assignIn(app_settings, pick(key, Object.keys(DEFAULT_SETTINGS)));
    } else if (typeof key === 'string') {
        o[key] = val;
        assignIn(_converse, pick(o, Object.keys(DEFAULT_SETTINGS))); // FIXME: remove
        assignIn(app_settings, pick(o, Object.keys(DEFAULT_SETTINGS)));
    }
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
        user_settings.browserStorage = createStore(id);
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
