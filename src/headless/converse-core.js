/**
 * @module converse-core
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { Collection } from "skeletor.js/src/collection";
import { Events } from 'skeletor.js/src/events.js';
import { Model } from 'skeletor.js/src/model.js';
import { Router } from 'skeletor.js/src/router.js';
import { __, i18n } from './i18n';
import { assignIn, debounce, invoke, isFunction, isObject, isString, pick } from 'lodash';
import 'strophe.js/src/websocket';
import './polyfill';
import * as strophe from 'strophe.js/src/core';
import _ from './lodash.noconflict';
import Storage from 'skeletor.js/src/storage.js';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import dayjs from 'dayjs';
import log from '@converse/headless/log';
import pluggable from 'pluggable.js/src/pluggable';
import sizzle from 'sizzle';
import stanza_utils from "@converse/headless/utils/stanza";
import u from '@converse/headless/utils/core';

const Strophe = strophe.default.Strophe;
const $build = strophe.default.$build;
const $iq = strophe.default.$iq;
const $msg = strophe.default.$msg;
const $pres = strophe.default.$pres;

dayjs.extend(advancedFormat);

// Add Strophe Namespaces
Strophe.addNamespace('CARBONS', 'urn:xmpp:carbons:2');
Strophe.addNamespace('CHATSTATES', 'http://jabber.org/protocol/chatstates');
Strophe.addNamespace('CSI', 'urn:xmpp:csi:0');
Strophe.addNamespace('DELAY', 'urn:xmpp:delay');
Strophe.addNamespace('FASTEN', 'urn:xmpp:fasten:0');
Strophe.addNamespace('FORWARD', 'urn:xmpp:forward:0');
Strophe.addNamespace('HINTS', 'urn:xmpp:hints');
Strophe.addNamespace('HTTPUPLOAD', 'urn:xmpp:http:upload:0');
Strophe.addNamespace('IDLE', 'urn:xmpp:idle:1');
Strophe.addNamespace('MAM', 'urn:xmpp:mam:2');
Strophe.addNamespace('MODERATE', 'urn:xmpp:message-moderate:0');
Strophe.addNamespace('NICK', 'http://jabber.org/protocol/nick');
Strophe.addNamespace('OMEMO', 'eu.siacs.conversations.axolotl');
Strophe.addNamespace('OUTOFBAND', 'jabber:x:oob');
Strophe.addNamespace('PUBSUB', 'http://jabber.org/protocol/pubsub');
Strophe.addNamespace('REGISTER', 'jabber:iq:register');
Strophe.addNamespace('RETRACT', 'urn:xmpp:message-retract:0');
Strophe.addNamespace('ROSTERX', 'http://jabber.org/protocol/rosterx');
Strophe.addNamespace('RSM', 'http://jabber.org/protocol/rsm');
Strophe.addNamespace('SID', 'urn:xmpp:sid:0');
Strophe.addNamespace('SPOILER', 'urn:xmpp:spoiler:0');
Strophe.addNamespace('STANZAS', 'urn:ietf:params:xml:ns:xmpp-stanzas');
Strophe.addNamespace('VCARD', 'vcard-temp');
Strophe.addNamespace('VCARDUPDATE', 'vcard-temp:x:update');
Strophe.addNamespace('XFORM', 'jabber:x:data');

// Use Mustache style syntax for variable interpolation
/* Configuration of Lodash templates (this config is distinct to the
 * config of requirejs-tpl in main.js). This one is for normal inline templates.
 */
_.templateSettings = {
    'escape': /\{\{\{([\s\S]+?)\}\}\}/g,
    'evaluate': /\{\[([\s\S]+?)\]\}/g,
    'interpolate': /\{\{([\s\S]+?)\}\}/g,
    'imports': { '_': _ }
};


/**
 * Custom error for indicating timeouts
 * @namespace _converse
 */
class TimeoutError extends Error {}


class IllegalMessage extends Error {}


// Setting wait to 59 instead of 60 to avoid timing conflicts with the
// webserver, which is often also set to 60 and might therefore sometimes
// return a 504 error page instead of passing through to the BOSH proxy.
const BOSH_WAIT = 59;

const PROMISES = [
    'afterResourceBinding',
    'connectionInitialized',
    'initialized',
    'pluginsInitialized',
];

// Core plugins are whitelisted automatically
// These are just the @converse/headless plugins, for the full converse,
// the other plugins are whitelisted in src/converse.js
const CORE_PLUGINS = [
    'converse-adhoc',
    'converse-bookmarks',
    'converse-bosh',
    'converse-caps',
    'converse-chatboxes',
    'converse-chat',
    'converse-disco',
    'converse-emoji',
    'converse-mam',
    'converse-muc',
    'converse-headlines',
    'converse-ping',
    'converse-pubsub',
    'converse-roster',
    'converse-rsm',
    'converse-smacks',
    'converse-status',
    'converse-vcard'
];


// Default configuration values
// ----------------------------
const DEFAULT_SETTINGS = {
    allow_non_roster_messaging: false,
    assets_path: '/dist',
    authentication: 'login', // Available values are "login", "prebind", "anonymous" and "external".
    auto_login: false, // Currently only used in connection with anonymous login
    auto_reconnect: true,
    blacklisted_plugins: [],
    connection_options: {},
    credentials_url: null, // URL from where login credentials can be fetched
    discover_connection_methods: true,
    geouri_regex: /https\:\/\/www.openstreetmap.org\/.*#map=[0-9]+\/([\-0-9.]+)\/([\-0-9.]+)\S*/g,
    geouri_replacement: 'https://www.openstreetmap.org/?mlat=$1&mlon=$2#map=18/$1/$2',
    idle_presence_timeout: 300, // Seconds after which an idle presence is sent
    i18n: 'en',
    jid: undefined,
    keepalive: true,
    loglevel: 'info',
    locales: [
        'af', 'ar', 'bg', 'ca', 'cs', 'de', 'eo', 'es', 'eu', 'en', 'fi', 'fr',
        'gl', 'he', 'hi', 'hu', 'id', 'it', 'ja', 'nb', 'nl', 'mr', 'oc',
        'pl', 'pt', 'pt_BR', 'ro', 'ru', 'tr', 'uk', 'vi', 'zh_CN', 'zh_TW'
    ],
    message_carbons: true,
    nickname: undefined,
    password: undefined,
    persistent_store: 'localStorage',
    rid: undefined,
    root: window.document,
    sid: undefined,
    singleton: false,
    strict_plugin_dependencies: false,
    trusted: true,
    view_mode: 'overlayed', // Choices are 'overlayed', 'fullscreen', 'mobile'
    websocket_url: undefined,
    whitelisted_plugins: []
};


/**
 * A private, closured object containing the private api (via {@link _converse.api})
 * as well as private methods and internal data-structures.
 * @global
 * @namespace _converse
 */
export const _converse = {
    log,
    'templates': {},
    'promises': {},

    STATUS_WEIGHTS: {
        'offline':      6,
        'unavailable':  5,
        'xa':           4,
        'away':         3,
        'dnd':          2,
        'chat':         1, // We currently don't differentiate between "chat" and "online"
        'online':       1
    },
    ANONYMOUS: 'anonymous',
    CLOSED: 'closed',
    EXTERNAL: 'external',
    LOGIN: 'login',
    LOGOUT: 'logout',
    OPENED: 'opened',
    PREBIND: 'prebind',

    STANZA_TIMEOUT: 10000,

    CONNECTION_STATUS: {
        0: 'ERROR',
        1: 'CONNECTING',
        2: 'CONNFAIL',
        3: 'AUTHENTICATING',
        4: 'AUTHFAIL',
        5: 'CONNECTED',
        6: 'DISCONNECTED',
        7: 'DISCONNECTING',
        8: 'ATTACHED',
        9: 'REDIRECT',
        10: 'RECONNECTING'
    },

    SUCCESS: 'success',
    FAILURE: 'failure',

    // Generated from css/images/user.svg
    DEFAULT_IMAGE_TYPE: 'image/svg+xml',
    DEFAULT_IMAGE: "PD94bWwgdmVyc2lvbj0iMS4wIj8+CjxzdmcgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiA8cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iIzU1NSIvPgogPGNpcmNsZSBjeD0iNjQiIGN5PSI0MSIgcj0iMjQiIGZpbGw9IiNmZmYiLz4KIDxwYXRoIGQ9Im0yOC41IDExMiB2LTEyIGMwLTEyIDEwLTI0IDI0LTI0IGgyMyBjMTQgMCAyNCAxMiAyNCAyNCB2MTIiIGZpbGw9IiNmZmYiLz4KPC9zdmc+Cg==",

    TIMEOUTS: {
        // Set as module attr so that we can override in tests.
        PAUSED: 10000,
        INACTIVE: 90000
    },

    // XEP-0085 Chat states
    // https://xmpp.org/extensions/xep-0085.html
    INACTIVE: 'inactive',
    ACTIVE: 'active',
    COMPOSING: 'composing',
    PAUSED: 'paused',
    GONE: 'gone',

    // Chat types
    PRIVATE_CHAT_TYPE: 'chatbox',
    CHATROOMS_TYPE: 'chatroom',
    HEADLINES_TYPE: 'headline',
    CONTROLBOX_TYPE: 'controlbox',

    default_connection_options: {'explicitResourceBinding': true},
    router: new Router(),

    TimeoutError: TimeoutError,
    IllegalMessage: IllegalMessage,

    isTestEnv: () => (Strophe.Connection.name === 'MockConnection'),

    /**
     * Translate the given string based on the current locale.
     * Handles all MUC presence stanzas.
     * @method __
     * @private
     * @memberOf _converse
     * @param { String } str - The string to translate
     */
     '__': __,

    /**
     * A no-op method which is used to signal to gettext that the passed in string
     * should be included in the pot translation file.
     *
     * In contrast to the double-underscore method, the triple underscore method
     * doesn't actually translate the strings.
     *
     * One reason for this method might be because we're using strings we cannot
     * send to the translation function because they require variable interpolation
     * and we don't yet have the variables at scan time.
     *
     * @method ___
     * @private
     * @memberOf _converse
     * @param { String } str
     */
    '___': str => str
}


_converse.VERSION_NAME = "v6.0.1dev";

Object.assign(_converse, Events);

// Make converse pluggable
pluggable.enable(_converse, '_converse', 'pluggable');


// Populated via the _converse.api.users.settings API
let user_settings;

function initUserSettings () {
    if (!_converse.bare_jid) {
        const msg = "No JID to fetch user settings for";
        log.error(msg);
        throw Error(msg);
    }
    if (!user_settings?.fetched) {
        const id = `converse.user-settings.${_converse.bare_jid}`;
        user_settings = new Model({id});
        user_settings.browserStorage = _converse.createStore(id);
        user_settings.fetched = user_settings.fetch({'promise': true});
    }
    return user_settings.fetched;
}


/**
 * ### The private API
 *
 * The private API methods are only accessible via the closured {@link _converse}
 * object, which is only available to plugins.
 *
 * These methods are kept private (i.e. not global) because they may return
 * sensitive data which should be kept off-limits to other 3rd-party scripts
 * that might be running in the page.
 *
 * @namespace _converse.api
 * @memberOf _converse
 */
export const api = _converse.api = {
    /**
     * This grouping collects API functions related to the XMPP connection.
     *
     * @namespace _converse.api.connection
     * @memberOf _converse.api
     */
    connection: {
        /**
         * @method _converse.api.connection.connected
         * @memberOf _converse.api.connection
         * @returns {boolean} Whether there is an established connection or not.
         */
        connected () {
            return _converse?.connection?.connected && true;
        },

        /**
         * Terminates the connection.
         *
         * @method _converse.api.connection.disconnectkjjjkk
         * @memberOf _converse.api.connection
         */
        disconnect () {
            if (_converse.connection) {
                _converse.connection.disconnect();
            }
        },

        /**
         * Can be called once the XMPP connection has dropped and we want
         * to attempt reconnection.
         * Only needs to be called once, if reconnect fails Converse will
         * attempt to reconnect every two seconds, alternating between BOSH and
         * Websocket if URLs for both were provided.
         * @method reconnect
         * @memberOf _converse.api.connection
         */
        async reconnect () {
            const conn_status = _converse.connfeedback.get('connection_status');

            if (api.settings.get("authentication") === _converse.ANONYMOUS) {
                await tearDown();
                await clearSession();
            }
            if (conn_status === Strophe.Status.CONNFAIL) {
                // When reconnecting with a new transport, we call setUserJID
                // so that a new resource is generated, to avoid multiple
                // server-side sessions with the same resource.
                //
                // We also call `_proto._doDisconnect` so that connection event handlers
                // for the old transport are removed.
                if (api.connection.isType('websocket') && api.settings.get('bosh_service_url')) {
                    await _converse.setUserJID(_converse.bare_jid);
                    _converse.connection._proto._doDisconnect();
                    _converse.connection._proto = new Strophe.Bosh(_converse.connection);
                    _converse.connection.service = api.settings.get('bosh_service_url');
                } else if (api.connection.isType('bosh') && api.settings.get("websocket_url")) {
                    if (api.settings.get("authentication") === _converse.ANONYMOUS) {
                        // When reconnecting anonymously, we need to connect with only
                        // the domain, not the full JID that we had in our previous
                        // (now failed) session.
                        await _converse.setUserJID(api.settings.get("jid"));
                    } else {
                        await _converse.setUserJID(_converse.bare_jid);
                    }
                    _converse.connection._proto._doDisconnect();
                    _converse.connection._proto = new Strophe.Websocket(_converse.connection);
                    _converse.connection.service = api.settings.get("websocket_url");
                }
            }
            if (conn_status === Strophe.Status.AUTHFAIL && api.settings.get("authentication") === _converse.ANONYMOUS) {
                // When reconnecting anonymously, we need to connect with only
                // the domain, not the full JID that we had in our previous
                // (now failed) session.
                await _converse.setUserJID(api.settings.get("jid"));
            }

            if (_converse.connection.authenticated) {
                if (_converse.connection.reconnecting) {
                    debouncedReconnect();
                } else {
                    return reconnect();
                }
            } else {
                log.warn("Not attempting to reconnect because we're not authenticated");
            }
        },

        /**
         * Utility method to determine the type of connection we have
         * @method isType
         * @memberOf _converse.api.connection
         * @returns {boolean}
         */
        isType (type) {
            if (type.toLowerCase() === 'websocket') {
                return _converse.connection._proto instanceof Strophe.Websocket;
            } else if (type.toLowerCase() === 'bosh') {
                return _converse.connection._proto instanceof Strophe.Bosh;
            }
        }
    },

    /**
     * Lets you trigger events, which can be listened to via
     * {@link _converse.api.listen.on} or {@link _converse.api.listen.once}
     * (see [_converse.api.listen](http://localhost:8000/docs/html/api/-_converse.api.listen.html)).
     *
     * Some events also double as promises and can be waited on via {@link _converse.api.waitUntil}.
     *
     * @method _converse.api.trigger
     * @param {string} name - The event name
     * @param {...any} [argument] - Argument to be passed to the event handler
     * @param {object} [options]
     * @param {boolean} [options.synchronous] - Whether the event is synchronous or not.
     *  When a synchronous event is fired, a promise will be returned
     *  by {@link _converse.api.trigger} which resolves once all the
     *  event handlers' promises have been resolved.
     */
    async trigger (name) {
        const args = Array.from(arguments);
        const options = args.pop();
        if (options && options.synchronous) {
            const events = _converse._events[name] || [];
            await Promise.all(events.map(e => e.callback.apply(e.ctx, args.splice(1))));
        } else {
            _converse.trigger.apply(_converse, arguments);
        }
        const promise = _converse.promises[name];
        if (promise !== undefined) {
            promise.resolve();
        }
    },

    /**
     * Triggers a hook which can be intercepted by registered listeners via
     * {@link _converse.api.listen.on} or {@link _converse.api.listen.once}.
     * (see [_converse.api.listen](http://localhost:8000/docs/html/api/-_converse.api.listen.html)).
     * A hook is a special kind of event which allows you to intercept a data
     * structure in order to modify it, before passing it back.
     * @async
     * @method _converse.api.hook
     * @param {string} name - The hook name
     * @param {...any} context - The context to which the hook applies (could be for example, a {@link _converse.ChatBox)).
     * @param {...any} data - The data structure to be intercepted and * modified by the hook listeners.
     */
    hook (name, context, data) {
        const events = _converse._events[name] || [];
        if (events.length) {
            // Create a chain of promises, with each one feeding its output to
            // the next. The first input is a promise with the original data
            // sent to this hook.
            const o = events.reduce((o, e) => o.then(d => e.callback(context, d)), Promise.resolve(data));
            o.catch(e => {
                log.error(e)
                throw e;
            });
            return o;
        } else {
            return data;
        }
    },

    /**
     * This grouping collects API functions related to the current logged in user.
     *
     * @namespace _converse.api.user
     * @memberOf _converse.api
     */
    user: {
        /**
         * @method _converse.api.user.jid
         * @returns {string} The current user's full JID (Jabber ID)
         * @example _converse.api.user.jid())
         */
        jid () {
            return _converse.connection.jid;
        },

        /**
         * Logs the user in.
         *
         * If called without any parameters, Converse will try
         * to log the user in by calling the `prebind_url` or `credentials_url` depending
         * on whether prebinding is used or not.
         *
         * @method _converse.api.user.login
         * @param {string} [jid]
         * @param {string} [password]
         * @param {boolean} [automatic=false] - An internally used flag that indicates whether
         *  this method was called automatically once the connection has been
         *  initialized. It's used together with the `auto_login` configuration flag
         *  to determine whether Converse should try to log the user in if it
         *  fails to restore a previous auth'd session.
         */
        async login (jid, password, automatic=false) {
            if (jid || _converse.jid) {
                jid = await _converse.setUserJID(jid || _converse.jid);
            }

            // See whether there is a BOSH session to re-attach to
            const bosh_plugin = _converse.pluggable.plugins['converse-bosh'];
            if (bosh_plugin && bosh_plugin.enabled()) {
                if (await _converse.restoreBOSHSession()) {
                    return;
                } else if (api.settings.get("authentication") === _converse.PREBIND && (!automatic || api.settings.get("auto_login"))) {
                    return _converse.startNewPreboundBOSHSession();
                }
            }

            password = password || api.settings.get("password");
            const credentials = (jid && password) ? { jid, password } : null;
            attemptNonPreboundSession(credentials, automatic);
        },

        /**
         * Logs the user out of the current XMPP session.
         * @method _converse.api.user.logout
         * @example _converse.api.user.logout();
         */
        logout () {
            const promise = u.getResolveablePromise();
            const complete = () => {
                // Recreate all the promises
                Object.keys(_converse.promises).forEach(replacePromise);
                delete _converse.jid
                /**
                 * Triggered once the user has logged out.
                 * @event _converse#logout
                 */
                api.trigger('logout');
                promise.resolve();
            }

            _converse.setDisconnectionCause(_converse.LOGOUT, undefined, true);
            if (_converse.connection !== undefined) {
                api.listen.once('disconnected', () => complete());
                _converse.connection.disconnect();
            } else {
                complete();
            }
            return promise;
        },

        /**
         * API for accessing and setting user settings. User settings are
         * different from the application settings from {@link _converse.api.settings}
         * because they are per-user and set via user action.
         * @namespace _converse.api.user.settings
         * @memberOf _converse.api.user
         */
        settings: {
            /**
             * Returns the user settings model. Useful when you want to listen for change events.
             * @method _converse.api.user.settings.getModel
             * @returns {Promise<Model>}
             * @example const settings = await _converse.api.user.settings.getModel();
             */
            async getModel () {
                await initUserSettings();
                return user_settings;
            },

            /**
             * Get the value of a particular user setting.
             * @method _converse.api.user.settings.get
             * @param {String} key - hello world
             * @param {*} fallback - An optional fallback value if the user setting is undefined
             * @returns {Promise} Promise which resolves with the value of the particular configuration setting.
             * @example _converse.api.user.settings.get("foo");
             */
            async get (key, fallback) {
                await initUserSettings();
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
            async set (key, val) {
                await initUserSettings();
                if (isObject(key)) {
                    return user_settings.save(key, {'promise': true});
                } else {
                    const o = {};
                    o[key] = val;
                    return user_settings.save(o, {'promise': true});
                }
            },

            /**
             * Clears all the user settings
             * @method _converse.api.user.settings.clear
             */
            async clear () {
                await initUserSettings();
                user_settings.clear();
            }
        }
    },

    /**
     * This grouping allows access to the
     * [configuration settings](/docs/html/configuration.html#configuration-settings)
     * of Converse.
     *
     * @namespace _converse.api.settings
     * @memberOf _converse.api
     */
    settings: {
        /**
         * Allows new configuration settings to be specified, or new default values for
         * existing configuration settings to be specified.
         *
         * @method _converse.api.settings.update
         * @param {object} settings The configuration settings
         * @example
         * _converse.api.settings.update({
         *    'enable_foo': true
         * });
         *
         * // The user can then override the default value of the configuration setting when
         * // calling `converse.initialize`.
         * converse.initialize({
         *     'enable_foo': false
         * });
         */
        update (settings) {
            u.merge(DEFAULT_SETTINGS, settings);
            u.merge(_converse, settings);
            u.applySiteSettings(_converse, settings, site_settings);
        },

        /**
         * @method _converse.api.settings.get
         * @returns {*} Value of the particular configuration setting.
         * @example _converse.api.settings.get("play_sounds");
         */
        get (key) {
            if (Object.keys(DEFAULT_SETTINGS).includes(key)) {
                return _converse[key];
            }
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
            const o = {};
            if (isObject(key)) {
                assignIn(_converse, pick(key, Object.keys(DEFAULT_SETTINGS)));
                assignIn(_converse.settings, pick(key, Object.keys(DEFAULT_SETTINGS)));
            } else if (isString('string')) {
                o[key] = val;
                assignIn(_converse, pick(o, Object.keys(DEFAULT_SETTINGS)));
                assignIn(_converse.settings, pick(o, Object.keys(DEFAULT_SETTINGS)));
            }
        }
    },

    /**
     * Converse and its plugins trigger various events which you can listen to via the
     * {@link _converse.api.listen} namespace.
     *
     * Some of these events are also available as [ES2015 Promises](http://es6-features.org/#PromiseUsage)
     * although not all of them could logically act as promises, since some events
     * might be fired multpile times whereas promises are to be resolved (or
     * rejected) only once.
     *
     * Events which are also promises include:
     *
     * * [cachedRoster](/docs/html/events.html#cachedroster)
     * * [chatBoxesFetched](/docs/html/events.html#chatBoxesFetched)
     * * [pluginsInitialized](/docs/html/events.html#pluginsInitialized)
     * * [roster](/docs/html/events.html#roster)
     * * [rosterContactsFetched](/docs/html/events.html#rosterContactsFetched)
     * * [rosterGroupsFetched](/docs/html/events.html#rosterGroupsFetched)
     * * [rosterInitialized](/docs/html/events.html#rosterInitialized)
     * * [roomsPanelRendered](/docs/html/events.html#roomsPanelRendered)
     *
     * The various plugins might also provide promises, and they do this by using the
     * `promises.add` api method.
     *
     * @namespace _converse.api.promises
     * @memberOf _converse.api
     */
    promises: {
        /**
         * By calling `promises.add`, a new [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
         * is made available for other code or plugins to depend on via the
         * {@link _converse.api.waitUntil} method.
         *
         * Generally, it's the responsibility of the plugin which adds the promise to
         * also resolve it.
         *
         * This is done by calling {@link _converse.api.trigger}, which not only resolves the
         * promise, but also emits an event with the same name (which can be listened to
         * via {@link _converse.api.listen}).
         *
         * @method _converse.api.promises.add
         * @param {string|array} [name|names] The name or an array of names for the promise(s) to be added
         * @param {boolean} [replace=true] Whether this promise should be replaced with a new one when the user logs out.
         * @example _converse.api.promises.add('foo-completed');
         */
        add (promises, replace=true) {
            promises = Array.isArray(promises) ? promises : [promises];
            promises.forEach(name => {
                const promise = u.getResolveablePromise();
                promise.replace = replace;
                _converse.promises[name] = promise;
            });
        }
    },

    /**
     * Converse emits events to which you can subscribe to.
     *
     * The `listen` namespace exposes methods for creating event listeners
     * (aka handlers) for these events.
     *
     * @namespace _converse.api.listen
     * @memberOf _converse
     */
    listen: {
        /**
         * Lets you listen to an event exactly once.
         *
         * @method _converse.api.listen.once
         * @param {string} name The event's name
         * @param {function} callback The callback method to be called when the event is emitted.
         * @param {object} [context] The value of the `this` parameter for the callback.
         * @example _converse.api.listen.once('message', function (messageXML) { ... });
         */
        once: _converse.once.bind(_converse),

        /**
         * Lets you subscribe to an event.
         *
         * Every time the event fires, the callback method specified by `callback` will be called.
         *
         * @method _converse.api.listen.on
         * @param {string} name The event's name
         * @param {function} callback The callback method to be called when the event is emitted.
         * @param {object} [context] The value of the `this` parameter for the callback.
         * @example _converse.api.listen.on('message', function (messageXML) { ... });
         */
        on: _converse.on.bind(_converse),

        /**
         * To stop listening to an event, you can use the `not` method.
         *
         * Every time the event fires, the callback method specified by `callback` will be called.
         *
         * @method _converse.api.listen.not
         * @param {string} name The event's name
         * @param {function} callback The callback method that is to no longer be called when the event fires
         * @example _converse.api.listen.not('message', function (messageXML);
         */
        not: _converse.off.bind(_converse),

        /**
         * Subscribe to an incoming stanza
         * Every a matched stanza is received, the callback method specified by
         * `callback` will be called.
         * @method _converse.api.listen.stanza
         * @param {string} name The stanza's name
         * @param {object} options Matching options (e.g. 'ns' for namespace, 'type' for stanza type, also 'id' and 'from');
         * @param {function} handler The callback method to be called when the stanza appears
         */
        stanza (name, options, handler) {
            if (isFunction(options)) {
                handler = options;
                options = {};
            } else {
                options = options || {};
            }
            _converse.connection.addHandler(
                handler,
                options.ns,
                name,
                options.type,
                options.id,
                options.from,
                options
            );
        }
    },

    /**
     * Wait until a promise is resolved or until the passed in function returns
     * a truthy value.
     * @method _converse.api.waitUntil
     * @param {string|function} condition - The name of the promise to wait for,
     * or a function which should eventually return a truthy value.
     * @returns {Promise}
     */
    waitUntil (condition) {
        if (isFunction(condition)) {
            return u.waitUntil(condition);
        } else {
            const promise = _converse.promises[condition];
            if (promise === undefined) {
                return null;
            }
            return promise;
        }
    },

    /**
     * Allows you to send XML stanzas.
     * @method _converse.api.send
     * @example
     * const msg = converse.env.$msg({
     *     'from': 'juliet@example.com/balcony',
     *     'to': 'romeo@example.net',
     *     'type':'chat'
     * });
     * _converse.api.send(msg);
     */
    send (stanza) {
        if (!api.connection.connected()) {
            log.warn("Not sending stanza because we're not connected!");
            log.warn(Strophe.serialize(stanza));
            return;
        }
        if (isString(stanza)) {
            stanza = u.toStanza(stanza);
        }
        if (stanza.tagName === 'iq') {
            return api.sendIQ(stanza);
        } else {
            _converse.connection.send(stanza);
            api.trigger('send', stanza);
        }
    },

    /**
     * Send an IQ stanza and receive a promise
     * @method _converse.api.sendIQ
     * @param { XMLElement } stanza
     * @param { Integer } timeout
     * @param { Boolean } reject - Whether an error IQ should cause the promise
     *  to be rejected. If `false`, the promise will resolve instead of being rejected.
     * @returns {Promise} A promise which resolves when we receive a `result` stanza
     * or is rejected when we receive an `error` stanza.
     */
    sendIQ (stanza, timeout, reject=true) {
        timeout = timeout || _converse.STANZA_TIMEOUT;
        let promise;
        if (reject) {
            promise = new Promise((resolve, reject) => _converse.connection.sendIQ(stanza, resolve, reject, timeout));
            promise.catch(e => {
                if (e === null) {
                    throw new TimeoutError(
                        `Timeout error after ${timeout}ms for the following IQ stanza: ${Strophe.serialize(stanza)}`
                    );
                }
            });
        } else {
            promise = new Promise(resolve => _converse.connection.sendIQ(stanza, resolve, resolve, timeout));
        }
        api.trigger('send', stanza);
        return promise;
    }
};


function replacePromise (name) {
    const existing_promise = _converse.promises[name];
    if (!existing_promise) {
        throw new Error(`Tried to replace non-existing promise: ${name}`);
    }
    if (existing_promise.replace) {
        const promise = u.getResolveablePromise();
        promise.replace = existing_promise.replace;
        _converse.promises[name] = promise;
    } else {
        log.debug(`Not replacing promise "${name}"`);
    }
}

_converse.haveResumed = function () {
    if (_converse.api.connection.isType('bosh')) {
        return _converse.connfeedback.get('connection_status') === Strophe.Status.ATTACHED;
    } else {
        // XXX: Not binding means that the session was resumed.
        // This seems very fragile. Perhaps a better way is possible.
        return !_converse.connection.do_bind;
    }
}

_converse.isUniView = function () {
    /* We distinguish between UniView and MultiView instances.
     *
     * UniView means that only one chat is visible, even though there might be multiple ongoing chats.
     * MultiView means that multiple chats may be visible simultaneously.
     */
    return ['mobile', 'fullscreen', 'embedded'].includes(api.settings.get("view_mode"));
};


async function initSessionStorage () {
    await Storage.sessionStorageInitialized;
    _converse.storage = {
        'session': Storage.localForage.createInstance({
            'name': _converse.isTestEnv() ? 'converse-test-session' : 'converse-session',
            'description': 'sessionStorage instance',
            'driver': ['sessionStorageWrapper']
        })
    };
}


function initPersistentStorage () {
    if (_converse.config.get('storage') !== 'persistent') {
        return;
    }
    const config = {
        'name': _converse.isTestEnv() ? 'converse-test-persistent' : 'converse-persistent',
        'storeName': _converse.bare_jid
    }
    if (_converse.api.settings.get("persistent_store") === 'localStorage') {
        config['description'] = 'localStorage instance';
        config['driver'] = [Storage.localForage.LOCALSTORAGE];
    } else if (_converse.api.settings.get("persistent_store") === 'IndexedDB') {
        config['description'] = 'indexedDB instance';
        config['driver'] = [Storage.localForage.INDEXEDDB];
    }
    _converse.storage['persistent'] = Storage.localForage.createInstance(config);
}


_converse.createStore = function (id, storage) {
    const s = _converse.storage[storage ? storage : _converse.config.get('storage')];
    return new Storage(id, s);
}


function initPlugins () {
    // If initialize gets called a second time (e.g. during tests), then we
    // need to re-apply all plugins (for a new converse instance), and we
    // therefore need to clear this array that prevents plugins from being
    // initialized twice.
    // If initialize is called for the first time, then this array is empty
    // in any case.
    _converse.pluggable.initialized_plugins = [];
    const whitelist = CORE_PLUGINS.concat(_converse.api.settings.get("whitelisted_plugins"));

    if (_converse.api.settings.get("singleton")) {
        [
            'converse-bookmarks',
            'converse-controlbox',
            'converse-headline',
            'converse-register'
        ].forEach(name => _converse.api.settings.get("blacklisted_plugins").push(name));
    }

    _converse.pluggable.initializePlugins(
        { '_converse': _converse },
        whitelist,
        _converse.api.settings.get("blacklisted_plugins")
    );

    /**
     * Triggered once all plugins have been initialized. This is a useful event if you want to
     * register event handlers but would like your own handlers to be overridable by
     * plugins. In that case, you need to first wait until all plugins have been
     * initialized, so that their overrides are active. One example where this is used
     * is in [converse-notifications.js](https://github.com/jcbrand/converse.js/blob/master/src/converse-notification.js)`.
     *
     * Also available as an [ES2015 Promise](http://es6-features.org/#PromiseUsage)
     * which can be listened to with `_converse.api.waitUntil`.
     *
     * @event _converse#pluginsInitialized
     * @memberOf _converse
     * @example _converse.api.listen.on('pluginsInitialized', () => { ... });
     * @example _converse.api.waitUntil('pluginsInitialized').then(() => { ... });
     */
    _converse.api.trigger('pluginsInitialized');
}


function initClientConfig () {
    /* The client config refers to configuration of the client which is
     * independent of any particular user.
     * What this means is that config values need to persist across
     * user sessions.
     */
    const id = 'converse.client-config';
    _converse.config = new Model({
        'id': id,
        'trusted': _converse.api.settings.get("trusted") && true || false,
        'storage': _converse.api.settings.get("trusted") ? 'persistent' : 'session'
    });
    _converse.config.browserStorage = _converse.createStore(id, "session");
    _converse.config.fetch();
    /**
     * Triggered once the XMPP-client configuration has been initialized.
     * The client configuration is independent of any particular and its values
     * persist across user sessions.
     *
     * @event _converse#clientConfigInitialized
     * @example
     * _converse.api.listen.on('clientConfigInitialized', () => { ... });
     */
    _converse.api.trigger('clientConfigInitialized');
}


async function tearDown () {
    await _converse.api.trigger('beforeTearDown', {'synchronous': true});
    window.removeEventListener('click', _converse.onUserActivity);
    window.removeEventListener('focus', _converse.onUserActivity);
    window.removeEventListener('keypress', _converse.onUserActivity);
    window.removeEventListener('mousemove', _converse.onUserActivity);
    window.removeEventListener(_converse.unloadevent, _converse.onUserActivity);
    window.clearInterval(_converse.everySecondTrigger);
    _converse.api.trigger('afterTearDown');
    return _converse;
}


async function attemptNonPreboundSession (credentials, automatic) {
    if (_converse.api.settings.get("authentication") === _converse.LOGIN) {
        // XXX: If EITHER ``keepalive`` or ``auto_login`` is ``true`` and
        // ``authentication`` is set to ``login``, then Converse will try to log the user in,
        // since we don't have a way to distinguish between wether we're
        // restoring a previous session (``keepalive``) or whether we're
        // automatically setting up a new session (``auto_login``).
        // So we can't do the check (!automatic || _converse.api.settings.get("auto_login")) here.
        if (credentials) {
            connect(credentials);
        } else if (_converse.api.settings.get("credentials_url")) {
            // We give credentials_url preference, because
            // _converse.connection.pass might be an expired token.
            connect(await getLoginCredentials());
        } else if (_converse.jid && (_converse.api.settings.get("password") || _converse.connection.pass)) {
            connect();
        } else if (!_converse.isTestEnv() && 'credentials' in navigator) {
            connect(await getLoginCredentialsFromBrowser());
        } else {
            !_converse.isTestEnv() && log.warn("attemptNonPreboundSession: Couldn't find credentials to log in with");
        }
    } else if ([_converse.ANONYMOUS, _converse.EXTERNAL].includes(_converse.api.settings.get("authentication")) && (!automatic || _converse.api.settings.get("auto_login"))) {
        connect();
    }
}


function connect (credentials) {
    if ([_converse.ANONYMOUS, _converse.EXTERNAL].includes(_converse.api.settings.get("authentication"))) {
        if (!_converse.jid) {
            throw new Error("Config Error: when using anonymous login " +
                "you need to provide the server's domain via the 'jid' option. " +
                "Either when calling converse.initialize, or when calling " +
                "_converse.api.user.login.");
        }
        if (!_converse.connection.reconnecting) {
            _converse.connection.reset();
        }
        _converse.connection.connect(
            _converse.jid.toLowerCase(),
            null,
            _converse.onConnectStatusChanged,
            BOSH_WAIT
        );
    } else if (_converse.api.settings.get("authentication") === _converse.LOGIN) {
        const password = credentials ? credentials.password : (_converse.connection?.pass || _converse.api.settings.get("password"));
        if (!password) {
            if (_converse.api.settings.get("auto_login")) {
                throw new Error("autoLogin: If you use auto_login and "+
                    "authentication='login' then you also need to provide a password.");
            }
            _converse.setDisconnectionCause(Strophe.Status.AUTHFAIL, undefined, true);
            _converse.api.connection.disconnect();
            return;
        }
        if (!_converse.connection.reconnecting) {
            _converse.connection.reset();
        }
        _converse.connection.connect(_converse.jid, password, _converse.onConnectStatusChanged, BOSH_WAIT);
    }
}


async function reconnect () {
    log.debug('RECONNECTING: the connection has dropped, attempting to reconnect.');
    _converse.setConnectionStatus(
        Strophe.Status.RECONNECTING,
        __('The connection has dropped, attempting to reconnect.')
    );
    /**
     * Triggered when the connection has dropped, but Converse will attempt
     * to reconnect again.
     *
     * @event _converse#will-reconnect
     */
    _converse.api.trigger('will-reconnect');

    _converse.connection.reconnecting = true;
    await tearDown();
    return _converse.api.user.login();
}

const debouncedReconnect = debounce(reconnect, 2000);


_converse.shouldClearCache = () => (!_converse.config.get('trusted') || _converse.isTestEnv());


function clearSession  () {
    if (_converse.session !== undefined) {
        _converse.session.destroy();
        delete _converse.session;
    }
    if (_converse.shouldClearCache()) {
        _converse.api.user.settings.clear();
    }
    /**
     * Synchronouse event triggered once the user session has been cleared,
     * for example when the user has logged out or when Converse has
     * disconnected for some other reason.
     * @event _converse#clearSession
     */
    return _converse.api.trigger('clearSession', {'synchronous': true});
}


async function onDomainDiscovered (response) {
    const text = await response.text();
    const xrd = (new window.DOMParser()).parseFromString(text, "text/xml").firstElementChild;
    if (xrd.nodeName != "XRD" || xrd.namespaceURI != "http://docs.oasis-open.org/ns/xri/xrd-1.0") {
        return log.warn("Could not discover XEP-0156 connection methods");
    }
    const bosh_links = sizzle(`Link[rel="urn:xmpp:alt-connections:xbosh"]`, xrd);
    const ws_links = sizzle(`Link[rel="urn:xmpp:alt-connections:websocket"]`, xrd);
    const bosh_methods = bosh_links.map(el => el.getAttribute('href'));
    const ws_methods = ws_links.map(el => el.getAttribute('href'));
    // TODO: support multiple endpoints
    _converse.api.settings.set("websocket_url", ws_methods.pop());
    _converse.api.settings.set('bosh_service_url', bosh_methods.pop());
    if (bosh_methods.length === 0 && ws_methods.length === 0) {
        log.warn(
            "onDomainDiscovered: neither BOSH nor WebSocket connection methods have been specified with XEP-0156."
        );
    }
}


async function discoverConnectionMethods (domain) {
    // Use XEP-0156 to check whether this host advertises websocket or BOSH connection methods.
    const options = {
        'mode': 'cors',
        'headers': {
            'Accept': 'application/xrd+xml, text/xml'
        }
    };
    const url = `https://${domain}/.well-known/host-meta`;
    let response;
    try {
        response = await fetch(url, options);
    } catch (e) {
        log.error(`Failed to discover alternative connection methods at ${url}`);
        log.error(e);
        return;
    }
    if (response.status >= 200 && response.status < 400) {
        await onDomainDiscovered(response);
    } else {
        log.warn("Could not discover XEP-0156 connection methods");
    }
}


_converse.initConnection = async function (domain) {
    if (_converse.api.settings.get("discover_connection_methods")) {
        await discoverConnectionMethods(domain);
    }
    if (! _converse.api.settings.get('bosh_service_url')) {
        if (_converse.api.settings.get("authentication") === _converse.PREBIND) {
            throw new Error("authentication is set to 'prebind' but we don't have a BOSH connection");
        }
        if (! _converse.api.settings.get("websocket_url")) {
            throw new Error("initConnection: you must supply a value for either the bosh_service_url or websocket_url or both.");
        }
    }

    if (('WebSocket' in window || 'MozWebSocket' in window) && _converse.api.settings.get("websocket_url")) {
        _converse.connection = new Strophe.Connection(
            _converse.api.settings.get("websocket_url"),
            Object.assign(_converse.default_connection_options, _converse.api.settings.get("connection_options"))
        );
    } else if (_converse.api.settings.get('bosh_service_url')) {
        _converse.connection = new Strophe.Connection(
            _converse.api.settings.get('bosh_service_url'),
            Object.assign(
                _converse.default_connection_options,
                _converse.api.settings.get("connection_options"),
                {'keepalive': _converse.api.settings.get("keepalive")}
            )
        );
    } else {
        throw new Error("initConnection: this browser does not support "+
                        "websockets and bosh_service_url wasn't specified.");
    }
    setUpXMLLogging();
    /**
     * Triggered once the `Strophe.Connection` constructor has been initialized, which
     * will be responsible for managing the connection to the XMPP server.
     *
     * @event _converse#connectionInitialized
     */
    _converse.api.trigger('connectionInitialized');
}


async function initSession (jid) {
    const bare_jid = Strophe.getBareJidFromJid(jid).toLowerCase();
    const id = `converse.session-${bare_jid}`;
    if (!_converse.session || _converse.session.get('id') !== id) {
        _converse.session = new Model({id});
        _converse.session.browserStorage = _converse.createStore(id, "session");
        await new Promise(r => _converse.session.fetch({'success': r, 'error': r}));
        if (_converse.session.get('active')) {
            _converse.session.clear();
            _converse.session.save({id});
        }
        saveJIDtoSession(jid);
        initPersistentStorage();
        /**
         * Triggered once the user's session has been initialized. The session is a
         * cache which stores information about the user's current session.
         * @event _converse#userSessionInitialized
         * @memberOf _converse
         */
        _converse.api.trigger('userSessionInitialized');
    } else {
        saveJIDtoSession(jid);
    }
}


function saveJIDtoSession (jid) {
    jid = _converse.session.get('jid') || jid;
    if (_converse.api.settings.get("authentication") !== _converse.ANONYMOUS && !Strophe.getResourceFromJid(jid)) {
        jid = jid.toLowerCase() + _converse.generateResource();
    }
    _converse.jid = jid;
    _converse.bare_jid = Strophe.getBareJidFromJid(jid);
    _converse.resource = Strophe.getResourceFromJid(jid);
    _converse.domain = Strophe.getDomainFromJid(jid);
    _converse.session.save({
       'jid': jid,
       'bare_jid': _converse.bare_jid,
       'resource': _converse.resource,
       'domain': _converse.domain,
       'active': true
    });
    // Set JID on the connection object so that when we call `connection.bind`
    // the new resource is found by Strophe.js and sent to the XMPP server.
    _converse.connection.jid = jid;
}


/**
 * Stores the passed in JID for the current user, potentially creating a
 * resource if the JID is bare.
 *
 * Given that we can only create an XMPP connection if we know the domain of
 * the server connect to and we only know this once we know the JID, we also
 * call {@link _converse.initConnection } (if necessary) to make sure that the
 * connection is set up.
 *
 * @method _converse#setUserJID
 * @emits _converse#setUserJID
 * @params { String } jid
 */
_converse.setUserJID = async function (jid) {
    if (!_converse.connection || !u.isSameDomain(_converse.connection.jid, jid)) {
        const domain = Strophe.getDomainFromJid(jid)
        await _converse.initConnection(domain);
    }
    await initSession(jid);
    /**
     * Triggered whenever the user's JID has been updated
     * @event _converse#setUserJID
     */
    _converse.api.trigger('setUserJID');
    return jid;
}


function setUpXMLLogging () {
    const lmap = {}
    lmap[Strophe.LogLevel.DEBUG] = 'debug';
    lmap[Strophe.LogLevel.INFO] = 'info';
    lmap[Strophe.LogLevel.WARN] = 'warn';
    lmap[Strophe.LogLevel.ERROR] = 'error';
    lmap[Strophe.LogLevel.FATAL] = 'fatal';

    Strophe.log = (level, msg) => log.log(msg, lmap[level]);
    Strophe.error = (msg) => log.error(msg);

    _converse.connection.xmlInput = body => log.debug(body.outerHTML, 'color: darkgoldenrod');
    _converse.connection.xmlOutput = body => log.debug(body.outerHTML, 'color: darkcyan');
}

async function getLoginCredentials () {
    let credentials;
    let wait = 0;
    while (!credentials) {
        try {
            credentials = await fetchLoginCredentials(wait); // eslint-disable-line no-await-in-loop
        } catch (e) {
            log.error('Could not fetch login credentials');
            log.error(e);
        }
        // If unsuccessful, we wait 2 seconds between subsequent attempts to
        // fetch the credentials.
        wait = 2000;
    }
    return credentials;
}

async function getLoginCredentialsFromBrowser () {
    try {
        const creds = await navigator.credentials.get({'password': true});
        if (creds && creds.type == 'password' && u.isValidJID(creds.id)) {
            await _converse.setUserJID(creds.id);
            return {'jid': creds.id, 'password': creds.password};
        }
    } catch (e) {
        log.error(e);
    }
}


function cleanup () {
    // Make sure everything is reset in case this is a subsequent call to
    // convesre.initialize (happens during tests).
    _converse.router.history.stop();
    unregisterGlobalEventHandlers();
    delete _converse.controlboxtoggle;
    if (_converse.chatboxviews) {
        delete _converse.chatboxviews;
    }
    if (_converse.connection) {
        _converse.connection.reset();
    }
    _converse.stopListening();
    _converse.off();
}

_converse.generateResource = () => `/converse.js-${Math.floor(Math.random()*139749528).toString()}`;


/**
 * Callback method called by Strophe as the Strophe.Connection goes
 * through various states while establishing or tearing down a
 * connection.
 * @method _converse#onConnectStatusChanged
 * @private
 * @memberOf _converse
 */
_converse.onConnectStatusChanged = function (status, message) {
    log.debug(`Status changed to: ${_converse.CONNECTION_STATUS[status]}`);
    if (status === Strophe.Status.CONNECTED || status === Strophe.Status.ATTACHED) {
        _converse.setConnectionStatus(status);
        // By default we always want to send out an initial presence stanza.
        _converse.send_initial_presence = true;
        _converse.setDisconnectionCause();
        if (_converse.connection.reconnecting) {
            log.debug(status === Strophe.Status.CONNECTED ? 'Reconnected' : 'Reattached');
            onConnected(true);
        } else {
            log.debug(status === Strophe.Status.CONNECTED ? 'Connected' : 'Attached');
            if (_converse.connection.restored) {
                // No need to send an initial presence stanza when
                // we're restoring an existing session.
                _converse.send_initial_presence = false;
            }
            onConnected();
        }
    } else if (status === Strophe.Status.DISCONNECTED) {
        _converse.setDisconnectionCause(status, message);
        _converse.onDisconnected();
    } else if (status === Strophe.Status.BINDREQUIRED) {
        _converse.bindResource();
    } else if (status === Strophe.Status.ERROR) {
        _converse.setConnectionStatus(
            status,
            __('An error occurred while connecting to the chat server.')
        );
    } else if (status === Strophe.Status.CONNECTING) {
        _converse.setConnectionStatus(status);
    } else if (status === Strophe.Status.AUTHENTICATING) {
        _converse.setConnectionStatus(status);
    } else if (status === Strophe.Status.AUTHFAIL) {
        if (!message) {
            message = __('Your XMPP address and/or password is incorrect. Please try again.');
        }
        _converse.setConnectionStatus(status, message);
        _converse.setDisconnectionCause(status, message, true);
        _converse.onDisconnected();
    } else if (status === Strophe.Status.CONNFAIL) {
        let feedback = message;
        if (message === "host-unknown" || message == "remote-connection-failed") {
            feedback = __("Sorry, we could not connect to the XMPP host with domain: %1$s",
                `\"${Strophe.getDomainFromJid(_converse.connection.jid)}\"`);
        } else if (message !== undefined && message === Strophe?.ErrorCondition?.NO_AUTH_MECH) {
            feedback = __("The XMPP server did not offer a supported authentication mechanism");
        }
        _converse.setConnectionStatus(status, feedback);
        _converse.setDisconnectionCause(status, message);
    } else if (status === Strophe.Status.DISCONNECTING) {
        _converse.setDisconnectionCause(status, message);
    }
};


_converse.setConnectionStatus = function (connection_status, message) {
    _converse.connfeedback.set({
        'connection_status': connection_status,
        'message': message
    });
};


/**
 * Used to keep track of why we got disconnected, so that we can
 * decide on what the next appropriate action is (in onDisconnected)
 */
_converse.setDisconnectionCause = function (cause, reason, override) {
    if (cause === undefined) {
        delete _converse.disconnection_cause;
        delete _converse.disconnection_reason;
    } else if (_converse.disconnection_cause === undefined || override) {
        _converse.disconnection_cause = cause;
        _converse.disconnection_reason = reason;
    }
};


function enableCarbons () {
    /* Ask the XMPP server to enable Message Carbons
     * See XEP-0280 https://xmpp.org/extensions/xep-0280.html#enabling
     */
    if (!api.settings.get("message_carbons") || !_converse.session || _converse.session.get('carbons_enabled')) {
        return;
    }
    const carbons_iq = new Strophe.Builder('iq', {
        'from': _converse.connection.jid,
        'id': 'enablecarbons',
        'type': 'set'
      })
      .c('enable', {xmlns: Strophe.NS.CARBONS});
    _converse.connection.addHandler((iq) => {
        if (iq.querySelectorAll('error').length > 0) {
            log.warn('An error occurred while trying to enable message carbons.');
        } else {
            _converse.session.save({'carbons_enabled': true});
            log.debug('Message carbons have been enabled.');
        }
    }, null, "iq", null, "enablecarbons");
    _converse.connection.send(carbons_iq);
}


async function onConnected (reconnecting) {
    /* Called as soon as a new connection has been established, either
     * by logging in or by attaching to an existing BOSH session.
     */
    delete _converse.connection.reconnecting;
    _converse.connection.flush(); // Solves problem of returned PubSub BOSH response not received by browser
    await _converse.setUserJID(_converse.connection.jid);

    /**
     * Synchronous event triggered after we've sent an IQ to bind the
     * user's JID resource for this session.
     * @event _converse#afterResourceBinding
     */
    await api.trigger('afterResourceBinding', reconnecting, {'synchronous': true});
    enableCarbons();

    if (reconnecting) {
        /**
         * After the connection has dropped and converse.js has reconnected.
         * Any Strophe stanza handlers (as registered via `converse.listen.stanza`) will
         * have to be registered anew.
         * @event _converse#reconnected
         * @example _converse.api.listen.on('reconnected', () => { ... });
         */
        api.trigger('reconnected');
    } else {
        /**
         * Triggered once converse.js has been initialized.
         * See also {@link _converse#event:pluginsInitialized}.
         * @event _converse#initialized
         */
        api.trigger('initialized');
        /**
         * Triggered after the connection has been established and Converse
         * has got all its ducks in a row.
         * @event _converse#initialized
         */
        api.trigger('connected');
    }
}


async function finishDisconnection () {
    // Properly tear down the session so that it's possible to manually connect again.
    log.debug('DISCONNECTED');
    delete _converse.connection.reconnecting;
    _converse.connection.reset();
    tearDown();
    await clearSession();
    delete _converse.connection;
    /**
     * Triggered after converse.js has disconnected from the XMPP server.
     * @event _converse#disconnected
     * @memberOf _converse
     * @example _converse.api.listen.on('disconnected', () => { ... });
     */
    api.trigger('disconnected');
}


function fetchLoginCredentials (wait=0) {
    return new Promise(
        debounce((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', api.settings.get("credentials_url"), true);
            xhr.setRequestHeader('Accept', 'application/json, text/javascript');
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 400) {
                    const data = JSON.parse(xhr.responseText);
                    _converse.setUserJID(data.jid).then(() => {
                        resolve({
                            jid: data.jid,
                            password: data.password
                        });
                    });
                } else {
                    reject(new Error(`${xhr.status}: ${xhr.responseText}`));
                }
            };
            xhr.onerror = reject;
            xhr.send();
        }, wait)
    );
}


_converse.saveWindowState = function (ev) {
    // XXX: eventually we should be able to just use
    // document.visibilityState (when we drop support for older
    // browsers).
    let state;
    const event_map = {
        'focus': "visible",
        'focusin': "visible",
        'pageshow': "visible",
        'blur': "hidden",
        'focusout': "hidden",
        'pagehide': "hidden"
    };
    ev = ev || document.createEvent('Events');
    if (ev.type in event_map) {
        state = event_map[ev.type];
    } else {
        state = document.hidden ? "hidden" : "visible";
    }
    _converse.windowState = state;
    /**
        * Triggered when window state has changed.
        * Used to determine when a user left the page and when came back.
        * @event _converse#windowStateChanged
        * @type { object }
        * @property{ string } state - Either "hidden" or "visible"
        * @example _converse.api.listen.on('windowStateChanged', obj => { ... });
        */
    api.trigger('windowStateChanged', {state});
}


function registerGlobalEventHandlers () {
    document.addEventListener("visibilitychange", _converse.saveWindowState);
    _converse.saveWindowState({'type': document.hidden ? "blur" : "focus"}); // Set initial state
    /**
     * Called once Converse has registered its global event handlers
     * (for events such as window resize or unload).
     * Plugins can listen to this event as cue to register their own
     * global event handlers.
     * @event _converse#registeredGlobalEventHandlers
     * @example _converse.api.listen.on('registeredGlobalEventHandlers', () => { ... });
     */
    api.trigger('registeredGlobalEventHandlers');
}


function unregisterGlobalEventHandlers () {
    document.removeEventListener("visibilitychange", _converse.saveWindowState);
    api.trigger('unregisteredGlobalEventHandlers');
}


/**
 * Gets called once strophe's status reaches Strophe.Status.DISCONNECTED.
 * Will either start a teardown process for converse.js or attempt
 * to reconnect.
 * @method onDisconnected
 * @private
 * @memberOf _converse
 */
_converse.onDisconnected = function () {
    const reason = _converse.disconnection_reason;
    if (_converse.disconnection_cause === Strophe.Status.AUTHFAIL) {
        if (api.settings.get("auto_reconnect") &&
            (api.settings.get("credentials_url") || api.settings.get("authentication") === _converse.ANONYMOUS)) {
            /**
             * If `credentials_url` is set, we reconnect, because we might
             * be receiving expirable tokens from the credentials_url.
             *
             * If `authentication` is anonymous, we reconnect because we
             * might have tried to attach with stale BOSH session tokens
             * or with a cached JID and password
             */
            return api.connection.reconnect();
        } else {
            return finishDisconnection();
        }
    } else if (_converse.disconnection_cause === _converse.LOGOUT ||
            (reason !== undefined && reason === Strophe?.ErrorCondition.NO_AUTH_MECH) ||
            reason === "host-unknown" ||
            reason === "remote-connection-failed" ||
            !api.settings.get("auto_reconnect")) {
        return finishDisconnection();
    }
    api.connection.reconnect();
};


_converse.bindResource = async function () {
    /**
     * Synchronous event triggered before we send an IQ to bind the user's
     * JID resource for this session.
     * @event _converse#beforeResourceBinding
     */
    await api.trigger('beforeResourceBinding', {'synchronous': true});
    _converse.connection.bind();
};


_converse.ConnectionFeedback = Model.extend({
    defaults: {
        'connection_status': Strophe.Status.DISCONNECTED,
        'message': ''
    },
    initialize () {
        this.on('change', () => api.trigger('connfeedback', _converse.connfeedback));
    }
});


async function initLocale () {
    if (_converse.isTestEnv()) {
        _converse.locale = 'en';
    } else {
        try {
            _converse.locale = i18n.getLocale(api.settings.get('i18n'), api.settings.get("locales"));
            await i18n.fetchTranslations(_converse);
        } catch (e) {
            log.fatal(e.message);
            _converse.locale = 'en';
        }
    }
}


let site_settings;

function initSettings (settings) {
    _converse.settings = {};
    assignIn(_converse.settings, DEFAULT_SETTINGS);
    // Allow only whitelisted configuration attributes to be overwritten
    assignIn(_converse.settings, pick(settings, Object.keys(DEFAULT_SETTINGS)));
    assignIn(_converse, _converse.settings);
    site_settings = settings;
}


function setUnloadEvent () {
    if ('onpagehide' in window) {
        // Pagehide gets thrown in more cases than unload. Specifically it
        // gets thrown when the page is cached and not just
        // closed/destroyed. It's the only viable event on mobile Safari.
        // https://www.webkit.org/blog/516/webkit-page-cache-ii-the-unload-event/
        _converse.unloadevent = 'pagehide';
    } else if ('onbeforeunload' in window) {
        _converse.unloadevent = 'beforeunload';
    } else if ('onunload' in window) {
        _converse.unloadevent = 'unload';
    }
}

export const converse = window.converse;


/**
 * ### The Public API
 *
 * This namespace contains public API methods which are are
 * accessible on the global `converse` object.
 * They are public, because any JavaScript in the
 * page can call them. Public methods therefore don’t expose any sensitive
 * or closured data. To do that, you’ll need to create a plugin, which has
 * access to the private API method.
 *
 * @global
 * @namespace converse
 */
Object.assign(converse, {

    CHAT_STATES: ['active', 'composing', 'gone', 'inactive', 'paused'],

    keycodes: {
        TAB: 9,
        ENTER: 13,
        SHIFT: 16,
        CTRL: 17,
        ALT: 18,
        ESCAPE: 27,
        LEFT_ARROW: 37,
        UP_ARROW: 38,
        RIGHT_ARROW: 39,
        DOWN_ARROW: 40,
        FORWARD_SLASH: 47,
        AT: 50,
        META: 91,
        META_RIGHT: 93
    },

    /**
     * Public API method which initializes Converse.
     * This method must always be called when using Converse.
     * @async
     * @memberOf converse
     * @method initialize
     * @param {object} config A map of [configuration-settings](https://conversejs.org/docs/html/configuration.html#configuration-settings).
     * @example
     * converse.initialize({
     *     auto_list_rooms: false,
     *     auto_subscribe: false,
     *     bosh_service_url: 'https://bind.example.com',
     *     hide_muc_server: false,
     *     i18n: 'en',
     *     play_sounds: true,
     *     show_controlbox_by_default: true,
     *     debug: false,
     *     roster_groups: true
     * });
     */
    async initialize (settings) {
        cleanup();
        PROMISES.forEach(name => api.promises.add(name));
        setUnloadEvent();
        initSettings(settings);
        _converse.strict_plugin_dependencies = settings.strict_plugin_dependencies; // Needed by pluggable.js
        log.setLogLevel(api.settings.get("loglevel"));

        if (api.settings.get("authentication") === _converse.ANONYMOUS) {
            if (api.settings.get("auto_login") && !api.settings.get('jid')) {
                throw new Error("Config Error: you need to provide the server's " +
                      "domain via the 'jid' option when using anonymous " +
                      "authentication with auto_login.");
            }
        }
        _converse.router.route(
            /^converse\?loglevel=(debug|info|warn|error|fatal)$/, 'loglevel',
            l => log.setLogLevel(l)
        );
        initLocale();
        _converse.connfeedback = new _converse.ConnectionFeedback();

        /* When reloading the page:
         * For new sessions, we need to send out a presence stanza to notify
         * the server/network that we're online.
         * When re-attaching to an existing session we don't need to again send out a presence stanza,
         * because it's as if "we never left" (see onConnectStatusChanged).
         * https://github.com/conversejs/converse.js/issues/521
         */
        _converse.send_initial_presence = true;

        await initSessionStorage();
        initClientConfig();
        initPlugins();
        registerGlobalEventHandlers();

        !History.started && _converse.router.history.start();

        if (api.settings.get("idle_presence_timeout") > 0) {
            api.listen.on('addClientFeatures', () => api.disco.own.features.add(Strophe.NS.IDLE));
        }

        const plugins = _converse.pluggable.plugins
        if (api.settings.get("auto_login") || api.settings.get("keepalive") && invoke(plugins['converse-bosh'], 'enabled')) {
            await api.user.login(null, null, true);
        }

        if (_converse.isTestEnv()) {
            return _converse;
        }
    },

    /**
     * Exposes methods for adding and removing plugins. You'll need to write a plugin
     * if you want to have access to the private API methods defined further down below.
     *
     * For more information on plugins, read the documentation on [writing a plugin](/docs/html/plugin_development.html).
     * @namespace plugins
     * @memberOf converse
     */
    plugins: {
        /**
         * Registers a new plugin.
         * @method converse.plugins.add
         * @param {string} name The name of the plugin
         * @param {object} plugin The plugin object
         * @example
         *  const plugin = {
         *      initialize: function () {
         *          // Gets called as soon as the plugin has been loaded.
         *
         *          // Inside this method, you have access to the private
         *          // API via `_covnerse.api`.
         *
         *          // The private _converse object contains the core logic
         *          // and data-structures of Converse.
         *      }
         *  }
         *  converse.plugins.add('myplugin', plugin);
         */
        add (name, plugin) {
            plugin.__name__ = name;
            if (_converse.pluggable.plugins[name] !== undefined) {
                throw new TypeError(
                    `Error: plugin with name "${name}" has already been ` + 'registered!'
                );
            } else {
                _converse.pluggable.plugins[name] = plugin;
            }
        }

    },
    /**
     * Utility methods and globals from bundled 3rd party libraries.
     * @memberOf converse
     *
     * @property {function} converse.env.$build    - Creates a Strophe.Builder, for creating stanza objects.
     * @property {function} converse.env.$iq       - Creates a Strophe.Builder with an <iq/> element as the root.
     * @property {function} converse.env.$msg      - Creates a Strophe.Builder with an <message/> element as the root.
     * @property {function} converse.env.$pres     - Creates a Strophe.Builder with an <presence/> element as the root.
     * @property {function} converse.env.Promise   - The Promise implementation used by Converse.
     * @property {function} converse.env.Strophe   - The [Strophe](http://strophe.im/strophejs) XMPP library used by Converse.
     * @property {object} converse.env._           - The instance of [lodash](http://lodash.com) used by Converse.
     * @property {function} converse.env.f         - And instance of Lodash with its methods wrapped to produce immutable auto-curried iteratee-first data-last methods.
     * @property {object} converse.env.dayjs       - [DayJS](https://github.com/iamkun/dayjs) date manipulation library.
     * @property {function} converse.env.sizzle    - [Sizzle](https://sizzlejs.com) CSS selector engine.
     * @property {object} converse.env.utils       - Module containing common utility methods used by Converse.
     */
    'env': { $build, $iq, $msg, $pres, Model, Collection, Promise, Strophe, _, dayjs, log, sizzle, stanza_utils, u, 'utils': u }
});

/**
 * Once Converse.js has loaded, it'll dispatch a custom event with the name `converse-loaded`.
 * You can listen for this event in order to be informed as soon as converse.js has been
 * loaded and parsed, which would mean it's safe to call `converse.initialize`.
 * @event converse-loaded
 * @example window.addEventListener('converse-loaded', () => converse.initialize());
 */
window.dispatchEvent(new CustomEvent('converse-loaded'));
