// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

import { $build, $iq, $msg, $pres, SHA1, Strophe } from "strophe.js";
import Backbone from "backbone";
import BrowserStorage from "backbone.browserStorage";
import Promise from "es6-promise/dist/es6-promise.auto";
import _ from "./lodash.noconflict";
import f from "./lodash.fp";
import i18n from "./i18n";
import moment from "moment";
import pluggable from "pluggable.js/dist/pluggable";
import polyfill from "./polyfill";
import sizzle from "sizzle";
import u from "@converse/headless/utils/core";

Backbone = Backbone.noConflict();

// Strophe globals
const b64_sha1 = SHA1.b64_sha1;

// Add Strophe Namespaces
Strophe.addNamespace('CARBONS', 'urn:xmpp:carbons:2');
Strophe.addNamespace('CHATSTATES', 'http://jabber.org/protocol/chatstates');
Strophe.addNamespace('CSI', 'urn:xmpp:csi:0');
Strophe.addNamespace('DELAY', 'urn:xmpp:delay');
Strophe.addNamespace('FORWARD', 'urn:xmpp:forward:0');
Strophe.addNamespace('HINTS', 'urn:xmpp:hints');
Strophe.addNamespace('HTTPUPLOAD', 'urn:xmpp:http:upload:0');
Strophe.addNamespace('IDLE', 'urn:xmpp:idle:1');
Strophe.addNamespace('MAM', 'urn:xmpp:mam:2');
Strophe.addNamespace('NICK', 'http://jabber.org/protocol/nick');
Strophe.addNamespace('OMEMO', "eu.siacs.conversations.axolotl");
Strophe.addNamespace('OUTOFBAND', 'jabber:x:oob');
Strophe.addNamespace('PUBSUB', 'http://jabber.org/protocol/pubsub');
Strophe.addNamespace('REGISTER', 'jabber:iq:register');
Strophe.addNamespace('ROSTERX', 'http://jabber.org/protocol/rosterx');
Strophe.addNamespace('RSM', 'http://jabber.org/protocol/rsm');
Strophe.addNamespace('SID', 'urn:xmpp:sid:0');
Strophe.addNamespace('SPOILER', 'urn:xmpp:spoiler:0');
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

// Setting wait to 59 instead of 60 to avoid timing conflicts with the
// webserver, which is often also set to 60 and might therefore sometimes
// return a 504 error page instead of passing through to the BOSH proxy.
const BOSH_WAIT = 59;

/**
 * A private, closured object containing the private api (via `_converse.api`)
 * as well as private methods and internal data-structures.
 *
 * @namespace _converse
 */
const _converse = {
    'templates': {},
    'promises': {}
}

_converse.VERSION_NAME = "v4.1.1";

_.extend(_converse, Backbone.Events);

// Make converse pluggable
pluggable.enable(_converse, '_converse', 'pluggable');

// Core plugins are whitelisted automatically
// These are just the @converse/headless plugins, for the full converse,
// the other plugins are whitelisted in src/converse.js
_converse.core_plugins = [
    'converse-chatboxes',
    'converse-disco',
    'converse-mam',
    'converse-muc',
    'converse-ping',
    'converse-pubsub',
    'converse-roster',
    'converse-vcard'
];

_converse.keycodes = {
    TAB: 9,
    ENTER: 13,
    SHIFT: 16,
    CTRL: 17,
    ALT: 18,
    ESCAPE: 27,
    UP_ARROW: 38,
    DOWN_ARROW: 40,
    FORWARD_SLASH: 47,
    AT: 50,
    META: 91,
    META_RIGHT: 93
};


// Module-level constants
_converse.STATUS_WEIGHTS = {
    'offline':      6,
    'unavailable':  5,
    'xa':           4,
    'away':         3,
    'dnd':          2,
    'chat':         1, // We currently don't differentiate between "chat" and "online"
    'online':       1
};
_converse.PRETTY_CHAT_STATUS = {
    'offline':      'Offline',
    'unavailable':  'Unavailable',
    'xa':           'Extended Away',
    'away':         'Away',
    'dnd':          'Do not disturb',
    'chat':         'Chattty',
    'online':       'Online'
};
_converse.ANONYMOUS  = "anonymous";
_converse.CLOSED = 'closed';
_converse.EXTERNAL = "external";
_converse.LOGIN = "login";
_converse.LOGOUT = "logout";
_converse.OPENED = 'opened';
_converse.PREBIND = "prebind";

_converse.IQ_TIMEOUT = 20000;

_converse.CONNECTION_STATUS = {
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
   10: 'RECONNECTING',
};

_converse.SUCCESS = 'success';
_converse.FAILURE = 'failure';

// Generated from css/images/user.svg
_converse.DEFAULT_IMAGE_TYPE = 'image/svg+xml';
_converse.DEFAULT_IMAGE = "PD94bWwgdmVyc2lvbj0iMS4wIj8+CjxzdmcgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiA8cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iIzU1NSIvPgogPGNpcmNsZSBjeD0iNjQiIGN5PSI0MSIgcj0iMjQiIGZpbGw9IiNmZmYiLz4KIDxwYXRoIGQ9Im0yOC41IDExMiB2LTEyIGMwLTEyIDEwLTI0IDI0LTI0IGgyMyBjMTQgMCAyNCAxMiAyNCAyNCB2MTIiIGZpbGw9IiNmZmYiLz4KPC9zdmc+Cg==";

_converse.TIMEOUTS = { // Set as module attr so that we can override in tests.
    'PAUSED':     10000,
    'INACTIVE':   90000
};

// XEP-0085 Chat states
// http://xmpp.org/extensions/xep-0085.html
_converse.INACTIVE = 'inactive';
_converse.ACTIVE = 'active';
_converse.COMPOSING = 'composing';
_converse.PAUSED = 'paused';
_converse.GONE = 'gone';


// Chat types
_converse.PRIVATE_CHAT_TYPE = 'chatbox';
_converse.CHATROOMS_TYPE = 'chatroom';
_converse.HEADLINES_TYPE = 'headline';
_converse.CONTROLBOX_TYPE = 'controlbox';


// Default configuration values
// ----------------------------
_converse.default_settings = {
    allow_non_roster_messaging: false,
    animate: true,
    authentication: 'login', // Available values are "login", "prebind", "anonymous" and "external".
    auto_away: 0, // Seconds after which user status is set to 'away'
    auto_login: false, // Currently only used in connection with anonymous login
    auto_reconnect: true,
    auto_xa: 0, // Seconds after which user status is set to 'xa'
    blacklisted_plugins: [],
    bosh_service_url: undefined,
    connection_options: {},
    credentials_url: null, // URL from where login credentials can be fetched
    csi_waiting_time: 0, // Support for XEP-0352. Seconds before client is considered idle and CSI is sent out.
    debug: false,
    default_state: 'online',
    expose_rid_and_sid: false,
    geouri_regex: /https:\/\/www.openstreetmap.org\/.*#map=[0-9]+\/([\-0-9.]+)\/([\-0-9.]+)\S*/g,
    geouri_replacement: 'https://www.openstreetmap.org/?mlat=$1&mlon=$2#map=18/$1/$2',
    idle_presence_timeout: 300, // Seconds after which an idle presence is sent
    jid: undefined,
    keepalive: true,
    locales_url: 'locale/{{{locale}}}/LC_MESSAGES/converse.json',
    locales: [
        'af', 'ar', 'bg', 'ca', 'cs', 'de', 'eo', 'es', 'eu', 'en', 'fr', 'gl',
        'he', 'hi', 'hu', 'id', 'it', 'ja', 'nb', 'nl',
        'pl', 'pt_BR', 'ro', 'ru', 'tr', 'uk', 'zh_CN', 'zh_TW'
    ],
    message_carbons: true,
    nickname: undefined,
    password: undefined,
    prebind_url: null,
    priority: 0,
    rid: undefined,
    root: window.document,
    sid: undefined,
    strict_plugin_dependencies: false,
    trusted: true,
    view_mode: 'overlayed', // Choices are 'overlayed', 'fullscreen', 'mobile'
    websocket_url: undefined,
    whitelisted_plugins: []
};


_converse.log = function (message, level, style='') {
    /* Logs messages to the browser's developer console.
     *
     * Parameters:
     *      (String) message - The message to be logged.
     *      (Integer) level - The loglevel which allows for filtering of log
     *                       messages.
     *
     *  Available loglevels are 0 for 'debug', 1 for 'info', 2 for 'warn',
     *  3 for 'error' and 4 for 'fatal'.
     *
     *  When using the 'error' or 'warn' loglevels, a full stacktrace will be
     *  logged as well.
     */
    if (level === Strophe.LogLevel.ERROR || level === Strophe.LogLevel.FATAL) {
        style = style || 'color: maroon';
    }
    if (message instanceof Error) {
        message = message.stack;
    } else if (_.isElement(message)) {
        message = message.outerHTML;
    }
    const prefix = style ? '%c' : '';
    const logger = _.assign({
            'debug': _.get(console, 'log') ? console.log.bind(console) : _.noop,
            'error': _.get(console, 'log') ? console.log.bind(console) : _.noop,
            'info': _.get(console, 'log') ? console.log.bind(console) : _.noop,
            'warn': _.get(console, 'log') ? console.log.bind(console) : _.noop
        }, console);
    if (level === Strophe.LogLevel.ERROR) {
        logger.error(`${prefix} ERROR: ${message}`, style);
    } else if (level === Strophe.LogLevel.WARN) {
        if (_converse.debug) {
            logger.warn(`${prefix} ${moment().format()} WARNING: ${message}`, style);
        }
    } else if (level === Strophe.LogLevel.FATAL) {
        logger.error(`${prefix} FATAL: ${message}`, style);
    } else if (_converse.debug) {
        if (level === Strophe.LogLevel.DEBUG) {
            logger.debug(`${prefix} ${moment().format()} DEBUG: ${message}`, style);
        } else {
            logger.info(`${prefix} ${moment().format()} INFO: ${message}`, style);
        }
    }
};

Strophe.log = function (level, msg) { _converse.log(level+' '+msg, level); };
Strophe.error = function (msg) { _converse.log(msg, Strophe.LogLevel.ERROR); };


_converse.__ = function (str) {
    /* Translate the given string based on the current locale.
     *
     * Parameters:
     *      (String) str - The string to translate.
     */
    if (_.isUndefined(i18n)) {
        return str;
    }
    return i18n.translate.apply(i18n, arguments);
}

const __ = _converse.__;

const PROMISES = [
    'initialized',
    'connectionInitialized',
    'pluginsInitialized',
    'statusInitialized'
];

function addPromise (promise) {
    /* Private function, used to add a new promise to the ones already
     * available via the `waitUntil` api method.
     */
    _converse.promises[promise] = u.getResolveablePromise();
}

_converse.emit = function (name) {
    /* Event emitter and promise resolver */
    _converse.trigger.apply(this, arguments);
    const promise = _converse.promises[name];
    if (!_.isUndefined(promise)) {
        promise.resolve();
    }
};

_converse.isUniView = function () {
    /* We distinguish between UniView and MultiView instances.
     *
     * UniView means that only one chat is visible, even though there might be multiple ongoing chats.
     * MultiView means that multiple chats may be visible simultaneously.
     */
    return _.includes(['mobile', 'fullscreen', 'embedded'], _converse.view_mode);
}

_converse.router = new Backbone.Router();


function initPlugins() {
    // If initialize gets called a second time (e.g. during tests), then we
    // need to re-apply all plugins (for a new converse instance), and we
    // therefore need to clear this array that prevents plugins from being
    // initialized twice.
    // If initialize is called for the first time, then this array is empty
    // in any case.
    _converse.pluggable.initialized_plugins = [];
    const whitelist = _converse.core_plugins.concat(
        _converse.whitelisted_plugins);

    if (_converse.view_mode === 'embedded') {
        _.forEach([ // eslint-disable-line lodash/prefer-map
            "converse-bookmarks",
            "converse-controlbox",
            "converse-headline",
            "converse-register"
        ], (name) => {
            _converse.blacklisted_plugins.push(name)
        });
    }

    _converse.pluggable.initializePlugins({
        'updateSettings' () {
            _converse.log(
                "(DEPRECATION) "+
                "The `updateSettings` method has been deprecated. "+
                "Please use `_converse.api.settings.update` instead.",
                Strophe.LogLevel.WARN
            )
            _converse.api.settings.update.apply(_converse, arguments);
        },
        '_converse': _converse
    }, whitelist, _converse.blacklisted_plugins);
    _converse.emit('pluginsInitialized');
}

function initClientConfig () {
    /* The client config refers to configuration of the client which is
     * independent of any particular user.
     * What this means is that config values need to persist across
     * user sessions.
     */
    const id = 'converse.client-config';
    _converse.config = new Backbone.Model({
        'id': id,
        'trusted': _converse.trusted && true || false,
        'storage': _converse.trusted ? 'local' : 'session'
    });
    _converse.config.browserStorage = new Backbone.BrowserStorage.session(id);
    _converse.config.fetch();
    _converse.emit('clientConfigInitialized');
}

_converse.initConnection = function () {
    /* Creates a new Strophe.Connection instance if we don't already have one.
     */
    if (!_converse.connection) {
        if (!_converse.bosh_service_url && ! _converse.websocket_url) {
            throw new Error("initConnection: you must supply a value for either the bosh_service_url or websocket_url or both.");
        }
        if (('WebSocket' in window || 'MozWebSocket' in window) && _converse.websocket_url) {
            _converse.connection = new Strophe.Connection(_converse.websocket_url, _converse.connection_options);
        } else if (_converse.bosh_service_url) {
            _converse.connection = new Strophe.Connection(
                _converse.bosh_service_url,
                _.assignIn(_converse.connection_options, {'keepalive': _converse.keepalive})
            );
        } else {
            throw new Error("initConnection: this browser does not support websockets and bosh_service_url wasn't specified.");
        }
    }
    _converse.emit('connectionInitialized');
}


function setUpXMLLogging () {
    Strophe.log = function (level, msg) {
        _converse.log(msg, level);
    };
    if (_converse.debug) {
        _converse.connection.xmlInput = function (body) {
            _converse.log(body.outerHTML, Strophe.LogLevel.DEBUG, 'color: darkgoldenrod');
        };
        _converse.connection.xmlOutput = function (body) {
            _converse.log(body.outerHTML, Strophe.LogLevel.DEBUG, 'color: darkcyan');
        };
    }
}


function finishInitialization () {
    initClientConfig();
    initPlugins();
    _converse.initConnection();
    setUpXMLLogging();
    _converse.logIn();
    _converse.registerGlobalEventHandlers();
    if (!Backbone.history.started) {
        Backbone.history.start();
    }
    if (_converse.idle_presence_timeout > 0) {
        _converse.on('addClientFeatures', () => {
            _converse.api.disco.own.features.add(Strophe.NS.IDLE);
        });
    }
}


function unregisterGlobalEventHandlers () {
    document.removeEventListener("visibilitychange", _converse.saveWindowState);
    _converse.emit('unregisteredGlobalEventHandlers');
}

function cleanup () {
    // Looks like _converse.initialized was called again without logging
    // out or disconnecting in the previous session.
    // This happens in tests. We therefore first clean up.
    Backbone.history.stop();
    _converse.chatboxviews.closeAllChatBoxes();
    unregisterGlobalEventHandlers();
    window.localStorage.clear();
    window.sessionStorage.clear();
    if (_converse.bookmarks) {
        _converse.bookmarks.reset();
    }
    delete _converse.controlboxtoggle;
    delete _converse.chatboxviews;

    _converse.connection.reset();
    _converse.tearDown();
    _converse.stopListening();
    _converse.off();

    delete _converse.config;
    initClientConfig();
}


_converse.initialize = async function (settings, callback) {
    settings = !_.isUndefined(settings) ? settings : {};
    const init_promise = u.getResolveablePromise();
    _.each(PROMISES, addPromise);
    if (!_.isUndefined(_converse.connection)) {
        cleanup();
    }

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

    _.assignIn(this, this.default_settings);
    // Allow only whitelisted configuration attributes to be overwritten
    _.assignIn(this, _.pick(settings, _.keys(this.default_settings)));

    if (this.authentication === _converse.ANONYMOUS) {
        if (this.auto_login && !this.jid) {
            throw new Error("Config Error: you need to provide the server's " +
                  "domain via the 'jid' option when using anonymous " +
                  "authentication with auto_login.");
        }
    }

    /* Localisation */
    if (!_.isUndefined(i18n)) {
        i18n.setLocales(settings.i18n, _converse);
    } else {
        _converse.locale = 'en';
    }

    // Module-level variables
    // ----------------------
    this.callback = callback || _.noop;
    /* When reloading the page:
     * For new sessions, we need to send out a presence stanza to notify
     * the server/network that we're online.
     * When re-attaching to an existing session (e.g. via the keepalive
     * option), we don't need to again send out a presence stanza, because
     * it's as if "we never left" (see onConnectStatusChanged).
     * https://github.com/jcbrand/converse.js/issues/521
     */
    this.send_initial_presence = true;
    this.msg_counter = 0;
    this.user_settings = settings; // Save the user settings so that they can be used by plugins

    // Module-level functions
    // ----------------------

    this.generateResource = () => `/converse.js-${Math.floor(Math.random()*139749528).toString()}`;

    this.sendCSI = function (stat) {
        /* Send out a Chat Status Notification (XEP-0352)
         *
         * Parameters:
         *  (String) stat: The user's chat status
         */
        _converse.api.send($build(stat, {xmlns: Strophe.NS.CSI}));
        _converse.inactive = (stat === _converse.INACTIVE) ? true : false;
    };

    this.onUserActivity = function () {
        /* Resets counters and flags relating to CSI and auto_away/auto_xa */
        if (_converse.idle_seconds > 0) {
            _converse.idle_seconds = 0;
        }
        if (!_converse.connection.authenticated) {
            // We can't send out any stanzas when there's no authenticated connection.
            // This can happen when the connection reconnects.
            return;
        }
        if (_converse.inactive) {
            _converse.sendCSI(_converse.ACTIVE);
        }
        if (_converse.idle) {
            _converse.idle = false;
            _converse.xmppstatus.sendPresence();
        }
        if (_converse.auto_changed_status === true) {
            _converse.auto_changed_status = false;
            // XXX: we should really remember the original state here, and
            // then set it back to that...
            _converse.xmppstatus.set('status', _converse.default_state);
        }
    };

    this.onEverySecond = function () {
        /* An interval handler running every second.
         * Used for CSI and the auto_away and auto_xa features.
         */
        if (!_converse.connection.authenticated) {
            // We can't send out any stanzas when there's no authenticated connection.
            // This can happen when the connection reconnects.
            return;
        }
        const stat = _converse.xmppstatus.get('status');
        _converse.idle_seconds++;
        if (_converse.csi_waiting_time > 0 &&
                _converse.idle_seconds > _converse.csi_waiting_time &&
                !_converse.inactive) {
            _converse.sendCSI(_converse.INACTIVE);
        }
        if (_converse.idle_presence_timeout > 0 &&
                _converse.idle_seconds > _converse.idle_presence_timeout &&
                !_converse.idle) {
            _converse.idle = true;
            _converse.xmppstatus.sendPresence();
        }
        if (_converse.auto_away > 0 &&
                _converse.idle_seconds > _converse.auto_away &&
                stat !== 'away' && stat !== 'xa' && stat !== 'dnd') {
            _converse.auto_changed_status = true;
            _converse.xmppstatus.set('status', 'away');
        } else if (_converse.auto_xa > 0 &&
                _converse.idle_seconds > _converse.auto_xa &&
                stat !== 'xa' && stat !== 'dnd') {
            _converse.auto_changed_status = true;
            _converse.xmppstatus.set('status', 'xa');
        }
    };

    this.registerIntervalHandler = function () {
        /* Set an interval of one second and register a handler for it.
         * Required for the auto_away, auto_xa and csi_waiting_time features.
         */
        if (_converse.auto_away < 1 && _converse.auto_xa < 1 && _converse.csi_waiting_time < 1 && _converse.idle_presence_timeout < 1) {
            // Waiting time of less then one second means features aren't used.
            return;
        }
        _converse.idle_seconds = 0
        _converse.auto_changed_status = false; // Was the user's status changed by Converse?
        window.addEventListener('click', _converse.onUserActivity);
        window.addEventListener('focus', _converse.onUserActivity);
        window.addEventListener('keypress', _converse.onUserActivity);
        window.addEventListener('mousemove', _converse.onUserActivity);
        const options = {'once': true, 'passive': true};
        window.addEventListener(_converse.unloadevent, _converse.onUserActivity, options);
        _converse.everySecondTrigger = window.setInterval(_converse.onEverySecond, 1000);
    };

    this.setConnectionStatus = function (connection_status, message) {
        _converse.connfeedback.set({
            'connection_status': connection_status,
            'message': message
        });
    };

    this.rejectPresenceSubscription = function (jid, message) {
        /* Reject or cancel another user's subscription to our presence updates.
         *
         *  Parameters:
         *    (String) jid - The Jabber ID of the user whose subscription
         *      is being canceled.
         *    (String) message - An optional message to the user
         */
        const pres = $pres({to: jid, type: "unsubscribed"});
        if (message && message !== "") { pres.c("status").t(message); }
        _converse.api.send(pres);
    };

    this.reconnect = _.debounce(function () {
        _converse.log('RECONNECTING');
        _converse.log('The connection has dropped, attempting to reconnect.');
        _converse.setConnectionStatus(
            Strophe.Status.RECONNECTING,
            __('The connection has dropped, attempting to reconnect.')
        );
        _converse.connection.reconnecting = true;
        _converse.tearDown();
        _converse.logIn(null, true);
    }, 3000, {'leading': true});

    this.disconnect = function () {
        _converse.log('DISCONNECTED');
        delete _converse.connection.reconnecting;
        _converse.connection.reset();
        _converse.tearDown();
        _converse.clearSession();
        _converse.emit('disconnected');
    };

    this.onDisconnected = function () {
        /* Gets called once strophe's status reaches Strophe.Status.DISCONNECTED.
         * Will either start a teardown process for converse.js or attempt
         * to reconnect.
         */
        const reason = _converse.disconnection_reason;

        if (_converse.disconnection_cause === Strophe.Status.AUTHFAIL) {
            if (_converse.credentials_url && _converse.auto_reconnect) {
                /* In this case, we reconnect, because we might be receiving
                 * expirable tokens from the credentials_url.
                 */
                _converse.emit('will-reconnect');
                return _converse.reconnect();
            } else {
                return _converse.disconnect();
            }
        } else if (_converse.disconnection_cause === _converse.LOGOUT ||
                (!_.isUndefined(reason) && reason === _.get(Strophe, 'ErrorCondition.NO_AUTH_MECH')) ||
                reason === "host-unknown" ||
                reason === "remote-connection-failed" ||
                !_converse.auto_reconnect) {
            return _converse.disconnect();
        }
        _converse.emit('will-reconnect');
        _converse.reconnect();
    };

    this.setDisconnectionCause = function (cause, reason, override) {
        /* Used to keep track of why we got disconnected, so that we can
         * decide on what the next appropriate action is (in onDisconnected)
         */
        if (_.isUndefined(cause)) {
            delete _converse.disconnection_cause;
            delete _converse.disconnection_reason;
        } else if (_.isUndefined(_converse.disconnection_cause) || override) {
            _converse.disconnection_cause = cause;
            _converse.disconnection_reason = reason;
        }
    };

    this.onConnectStatusChanged = function (status, message) {
        /* Callback method called by Strophe as the Strophe.Connection goes
         * through various states while establishing or tearing down a
         * connection.
         */
        _converse.log(`Status changed to: ${_converse.CONNECTION_STATUS[status]}`);
        if (status === Strophe.Status.CONNECTED || status === Strophe.Status.ATTACHED) {
            _converse.setConnectionStatus(status);
            // By default we always want to send out an initial presence stanza.
            _converse.send_initial_presence = true;
            _converse.setDisconnectionCause();
            if (_converse.connection.reconnecting) {
                _converse.log(status === Strophe.Status.CONNECTED ? 'Reconnected' : 'Reattached');
                _converse.onConnected(true);
            } else {
                _converse.log(status === Strophe.Status.CONNECTED ? 'Connected' : 'Attached');
                if (_converse.connection.restored) {
                    // No need to send an initial presence stanza when
                    // we're restoring an existing session.
                    _converse.send_initial_presence = false;
                }
                _converse.onConnected();
            }
        } else if (status === Strophe.Status.DISCONNECTED) {
            _converse.setDisconnectionCause(status, message);
            _converse.onDisconnected();
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
                message = __('Your Jabber ID and/or password is incorrect. Please try again.');
            }
            _converse.setConnectionStatus(status, message);
            _converse.setDisconnectionCause(status, message, true);
            _converse.onDisconnected();
        } else if (status === Strophe.Status.CONNFAIL) {
            let feedback = message;
            if (message === "host-unknown" || message == "remote-connection-failed") {
                feedback = __("Sorry, we could not connect to the XMPP host with domain: %1$s",
                    `\"${Strophe.getDomainFromJid(_converse.connection.jid)}\"`);
            } else if (!_.isUndefined(message) && message === _.get(Strophe, 'ErrorCondition.NO_AUTH_MECH')) {
                feedback = __("The XMPP server did not offer a supported authentication mechanism");
            }
            _converse.setConnectionStatus(status, feedback);
            _converse.setDisconnectionCause(status, message);
        } else if (status === Strophe.Status.DISCONNECTING) {
            _converse.setDisconnectionCause(status, message);
        }
    };

    this.incrementMsgCounter = function () {
        this.msg_counter += 1;
        const unreadMsgCount = this.msg_counter;
        let title = document.title;
        if (_.isNil(title)) {
            return;
        }
        if (title.search(/^Messages \(\d+\) /) === -1) {
            title = `Messages (${unreadMsgCount}) ${title}`;
        } else {
            title = title.replace(/^Messages \(\d+\) /, `Messages (${unreadMsgCount})`);
        }
    };

    this.clearMsgCounter = function () {
        this.msg_counter = 0;
        let title = document.title;
        if (_.isNil(title)) {
            return;
        }
        if (title.search(/^Messages \(\d+\) /) !== -1) {
            title = title.replace(/^Messages \(\d+\) /, "");
        }
    };

    this.initStatus = (reconnecting) => {
        // If there's no xmppstatus obj, then we were never connected to
        // begin with, so we set reconnecting to false.
        reconnecting = _.isUndefined(_converse.xmppstatus) ? false : reconnecting;
        if (reconnecting) {
            _converse.onStatusInitialized(reconnecting);
        } else {
            const id = `converse.xmppstatus-${_converse.bare_jid}`;
            this.xmppstatus = new this.XMPPStatus({'id': id});
            this.xmppstatus.browserStorage = new Backbone.BrowserStorage.session(id);
            this.xmppstatus.fetch({
                'success': _.partial(_converse.onStatusInitialized, reconnecting),
                'error': _.partial(_converse.onStatusInitialized, reconnecting)
            });
        }
    }


    this.initSession = function () {
        const id = 'converse.bosh-session';
        _converse.session = new Backbone.Model({id});
        _converse.session.browserStorage = new Backbone.BrowserStorage.session(id);
        _converse.session.fetch();
        _converse.emit('sessionInitialized');
    };

    this.clearSession = function () {
        if (!_converse.config.get('trusted')) {
            window.localStorage.clear();
            window.sessionStorage.clear();
        } else if (!_.isUndefined(this.session) && this.session.browserStorage) {
            this.session.browserStorage._clear();
        }
        _converse.emit('clearSession');
    };

    this.logOut = function () {
        _converse.clearSession();
        _converse.setDisconnectionCause(_converse.LOGOUT, undefined, true);
        if (!_.isUndefined(_converse.connection)) {
            _converse.connection.disconnect();
        } else {
            _converse.tearDown();
        }
        // Recreate all the promises
        _.each(_.keys(_converse.promises), addPromise);

        _converse.emit('logout');
    };

    this.saveWindowState = function (ev) {
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
        if (state  === 'visible') {
            _converse.clearMsgCounter();
        }
        _converse.windowState = state;
        _converse.emit('windowStateChanged', {state});
    };

    this.registerGlobalEventHandlers = function () {
        document.addEventListener("visibilitychange", _converse.saveWindowState);
        _converse.saveWindowState({'type': document.hidden ? "blur" : "focus"}); // Set initial state
        _converse.emit('registeredGlobalEventHandlers');
    };

    this.enableCarbons = function () {
        /* Ask the XMPP server to enable Message Carbons
         * See XEP-0280 https://xmpp.org/extensions/xep-0280.html#enabling
         */
        if (!this.message_carbons || this.session.get('carbons_enabled')) {
            return;
        }
        const carbons_iq = new Strophe.Builder('iq', {
            'from': this.connection.jid,
            'id': 'enablecarbons',
            'type': 'set'
          })
          .c('enable', {xmlns: Strophe.NS.CARBONS});
        this.connection.addHandler((iq) => {
            if (iq.querySelectorAll('error').length > 0) {
                _converse.log(
                    'An error occurred while trying to enable message carbons.',
                    Strophe.LogLevel.WARN);
            } else {
                this.session.save({'carbons_enabled': true});
                _converse.log('Message carbons have been enabled.');
            }
        }, null, "iq", null, "enablecarbons");
        this.connection.send(carbons_iq);
    };


    this.sendInitialPresence = function () {
        if (_converse.send_initial_presence) {
            _converse.xmppstatus.sendPresence();
        }
    };

    this.onStatusInitialized = function (reconnecting) {
        _converse.emit('statusInitialized', reconnecting);
        if (reconnecting) {
            _converse.emit('reconnected');
        } else {
            init_promise.resolve();
            _converse.emit('initialized');
            _converse.emit('connected');
        }
    };

    this.setUserJID = function () {
        _converse.jid = _converse.connection.jid;
        _converse.bare_jid = Strophe.getBareJidFromJid(_converse.connection.jid);
        _converse.resource = Strophe.getResourceFromJid(_converse.connection.jid);
        _converse.domain = Strophe.getDomainFromJid(_converse.connection.jid);
        _converse.emit('setUserJID');
    };

    this.onConnected = function (reconnecting) {
        /* Called as soon as a new connection has been established, either
         * by logging in or by attaching to an existing BOSH session.
         */
        _converse.connection.flush(); // Solves problem of returned PubSub BOSH response not received by browser
        _converse.setUserJID();
        _converse.initSession();
        _converse.enableCarbons();
        _converse.initStatus(reconnecting)
    };


    this.ConnectionFeedback = Backbone.Model.extend({
        defaults: {
            'connection_status': Strophe.Status.DISCONNECTED,
            'message': ''
        },

        initialize () {
            this.on('change', () => {
                _converse.emit('connfeedback', _converse.connfeedback);
            });
        }
    });
    this.connfeedback = new this.ConnectionFeedback();


    this.XMPPStatus = Backbone.Model.extend({

        defaults () {
            return {
                "jid": _converse.bare_jid,
                "status":  _converse.default_state
            }
        },

        initialize () {
            this.vcard = _converse.vcards.findWhere({'jid': this.get('jid')});
            if (_.isNil(this.vcard)) {
                this.vcard = _converse.vcards.create({'jid': this.get('jid')});
            }

            this.on('change:status', (item) => {
                const status = this.get('status');
                this.sendPresence(status);
                _converse.emit('statusChanged', status);
            });

            this.on('change:status_message', () => {
                const status_message = this.get('status_message');
                this.sendPresence(this.get('status'), status_message);
                _converse.emit('statusMessageChanged', status_message);
            });
        },

        constructPresence (type, status_message) {
            let presence;
            type = _.isString(type) ? type : (this.get('status') || _converse.default_state);
            status_message = _.isString(status_message) ? status_message : this.get('status_message');
            // Most of these presence types are actually not explicitly sent,
            // but I add all of them here for reference and future proofing.
            if ((type === 'unavailable') ||
                    (type === 'probe') ||
                    (type === 'error') ||
                    (type === 'unsubscribe') ||
                    (type === 'unsubscribed') ||
                    (type === 'subscribe') ||
                    (type === 'subscribed')) {
                presence = $pres({'type': type});
            } else if (type === 'offline') {
                presence = $pres({'type': 'unavailable'});
            } else if (type === 'online') {
                presence = $pres();
            } else {
                presence = $pres().c('show').t(type).up();
            }
            if (status_message) {
                presence.c('status').t(status_message).up();
            }
            presence.c('priority').t(
                _.isNaN(Number(_converse.priority)) ? 0 : _converse.priority
            ).up();
            if (_converse.idle) {
                const idle_since = new Date();
                idle_since.setSeconds(idle_since.getSeconds() - _converse.idle_seconds);
                presence.c('idle', {xmlns: Strophe.NS.IDLE, since: idle_since.toISOString()});
            }
            return presence;
        },

        sendPresence (type, status_message) {
            _converse.api.send(this.constructPresence(type, status_message));
        }
    });


    this.fetchLoginCredentials = () =>
        new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', _converse.credentials_url, true);
            xhr.setRequestHeader('Accept', "application/json, text/javascript");
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 400) {
                    const data = JSON.parse(xhr.responseText);
                    resolve({
                        'jid': data.jid,
                        'password': data.password
                    });
                } else {
                    xhr.onerror();
                }
            };
            xhr.onerror = function () {
                delete _converse.connection;
                _converse.emit('noResumeableSession', this);
                reject(xhr.responseText);
            };
            xhr.send();
        });

    this.startNewBOSHSession = function () {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', _converse.prebind_url, true);
        xhr.setRequestHeader('Accept', "application/json, text/javascript");
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 400) {
                const data = JSON.parse(xhr.responseText);
                _converse.connection.attach(
                        data.jid, data.sid, data.rid,
                        _converse.onConnectStatusChanged);
            } else {
                xhr.onerror();
            }
        };
        xhr.onerror = function () {
            delete _converse.connection;
            _converse.emit('noResumeableSession', this);
        };
        xhr.send();
    };

    this.restoreBOSHSession = function (jid_is_required) {
        /* Tries to restore a cached BOSH session. */
        if (!this.jid) {
            const msg = "restoreBOSHSession: tried to restore a \"keepalive\" session "+
                "but we don't have the JID for the user!";
            if (jid_is_required) {
                throw new Error(msg);
            } else {
                _converse.log(msg);
            }
        }
        try {
            this.connection.restore(this.jid, this.onConnectStatusChanged);
            return true;
        } catch (e) {
            _converse.log(
                "Could not restore session for jid: "+
                this.jid+" Error message: "+e.message, Strophe.LogLevel.WARN);
            this.clearSession(); // We want to clear presences (see #555)
            return false;
        }
    };

    this.attemptPreboundSession = function (reconnecting) {
        /* Handle session resumption or initialization when prebind is
         * being used.
         */
        if (!reconnecting) {
            if (this.keepalive && this.restoreBOSHSession(true)) {
                return;
            }
            // No keepalive, or session resumption has failed.
            if (this.jid && this.sid && this.rid) {
                return this.connection.attach(
                    this.jid, this.sid, this.rid,
                    this.onConnectStatusChanged
                );
            }
        }
        if (this.prebind_url) {
            return this.startNewBOSHSession();
        } else {
            throw new Error(
                "attemptPreboundSession: If you use prebind and not keepalive, "+
                "then you MUST supply JID, RID and SID values or a prebind_url.");
        }
    };

    this.attemptNonPreboundSession = function (credentials, reconnecting) {
        /* Handle session resumption or initialization when prebind is not being used.
         *
         * Two potential options exist and are handled in this method:
         *  1. keepalive
         *  2. auto_login
         */
        if (!reconnecting && this.keepalive && this.restoreBOSHSession()) {
            return;
        }

        if (credentials) {
            // When credentials are passed in, they override prebinding
            // or credentials fetching via HTTP
            this.autoLogin(credentials);
        } else if (this.auto_login) {
            if (this.credentials_url) {
                this.fetchLoginCredentials().then(
                    this.autoLogin.bind(this),
                    this.autoLogin.bind(this)
                );
            } else if (!this.jid) {
                throw new Error(
                    "attemptNonPreboundSession: If you use auto_login, "+
                    "you also need to give either a jid value (and if "+
                    "applicable a password) or you need to pass in a URL "+
                    "from where the username and password can be fetched "+
                    "(via credentials_url)."
                );
            } else {
                this.autoLogin(); // Could be ANONYMOUS or EXTERNAL
            }
        } else if (reconnecting) {
            this.autoLogin();
        }
    };

    this.autoLogin = function (credentials) {
        if (credentials) {
            // If passed in, the credentials come from credentials_url,
            // so we set them on the converse object.
            this.jid = credentials.jid;
        }
        if (this.authentication === _converse.ANONYMOUS || this.authentication === _converse.EXTERNAL) {
            if (!this.jid) {
                throw new Error("Config Error: when using anonymous login " +
                    "you need to provide the server's domain via the 'jid' option. " +
                    "Either when calling converse.initialize, or when calling " +
                    "_converse.api.user.login.");
            }
            if (!this.connection.reconnecting) {
                this.connection.reset();
            }
            this.connection.connect(this.jid.toLowerCase(), null, this.onConnectStatusChanged, BOSH_WAIT);
        } else if (this.authentication === _converse.LOGIN) {
            const password = _.isNil(credentials) ? (_converse.connection.pass || this.password) : credentials.password;
            if (!password) {
                if (this.auto_login) {
                    throw new Error("initConnection: If you use auto_login and "+
                        "authentication='login' then you also need to provide a password.");
                }
                _converse.setDisconnectionCause(Strophe.Status.AUTHFAIL, undefined, true);
                _converse.disconnect();
                return;
            }
            const resource = Strophe.getResourceFromJid(this.jid);
            if (!resource) {
                this.jid = this.jid.toLowerCase() + _converse.generateResource();
            } else {
                this.jid = Strophe.getBareJidFromJid(this.jid).toLowerCase()+'/'+resource;
            }
            if (!this.connection.reconnecting) {
                this.connection.reset();
            }
            this.connection.connect(this.jid, password, this.onConnectStatusChanged, BOSH_WAIT);
        }
    };

    this.logIn = function (credentials, reconnecting) {
        // We now try to resume or automatically set up a new session.
        // Otherwise the user will be shown a login form.
        if (this.authentication === _converse.PREBIND) {
            this.attemptPreboundSession(reconnecting);
        } else {
            this.attemptNonPreboundSession(credentials, reconnecting);
        }
    };

    this.tearDown = function () {
        /* Remove those views which are only allowed with a valid
         * connection.
         */
        _converse.emit('beforeTearDown');
        if (!_.isUndefined(_converse.session)) {
            _converse.session.destroy();
        }
        window.removeEventListener('click', _converse.onUserActivity);
        window.removeEventListener('focus', _converse.onUserActivity);
        window.removeEventListener('keypress', _converse.onUserActivity);
        window.removeEventListener('mousemove', _converse.onUserActivity);
        window.removeEventListener(_converse.unloadevent, _converse.onUserActivity);
        window.clearInterval(_converse.everySecondTrigger);
        _converse.emit('afterTearDown');
        return _converse;
    };


    // Initialization
    // --------------
    // This is the end of the initialize method.
    if (settings.connection) {
        this.connection = settings.connection;
    }

    if (_.get(_converse.connection, 'service') === 'jasmine tests') {
        finishInitialization();
        return _converse;
    } else if (!_.isUndefined(i18n)) {
        const url = u.interpolate(_converse.locales_url, {'locale': _converse.locale});
        try {
            await i18n.fetchTranslations(_converse.locale, _converse.locales, url);
        } catch (e) {
            _converse.log(e.message, Strophe.LogLevel.FATAL);
        }
    }
    finishInitialization();
    return init_promise;
};

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
_converse.api = {
    /**
     * This grouping collects API functions related to the XMPP connection.
     *
     * @namespace _converse.api.connection
     * @memberOf _converse.api
     */
    'connection': {
        /**
         * @method _converse.api.connection.connected
         * @memberOf _converse.api.connection
         * @returns {boolean} Whether there is an established connection or not.
         */
        'connected' () {
            return _converse.connection && _converse.connection.connected || false;
        },
        /**
         * Terminates the connection.
         *
         * @method _converse.api.connection.disconnect
         * @memberOf _converse.api.connection
         */
        'disconnect' () {
            _converse.connection.disconnect();
        },
    },

    /**
     * Lets you emit (i.e. trigger) events, which can be listened to via
     * {@link _converse.api.listen.on} or {@link _converse.api.listen.once}
     * (see [_converse.api.listen](http://localhost:8000/docs/html/api/-_converse.api.listen.html)).
     *
     * @method _converse.api.emit
     */
    'emit' () {
        _converse.emit.apply(_converse, arguments);
    },

    /**
     * This grouping collects API functions related to the current logged in user.
     *
     * @namespace _converse.api.user
     * @memberOf _converse.api
     */
    'user': {
        /**
         * @method _converse.api.user.jid
         * @returns {string} The current user's full JID (Jabber ID)
         * @example _converse.api.user.jid())
         */
        'jid' () {
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
         * @param {object} [credentials] An object with the credentials.
         * @example
         * converse.plugins.add('myplugin', {
         *     initialize: function () {
         *
         *         this._converse.api.user.login({
         *             'jid': 'dummy@example.com',
         *             'password': 'secret'
         *         });
         *
         *     }
         * });
         */
        'login' (credentials) {
            _converse.logIn(credentials);
        },
        /**
         * Logs the user out of the current XMPP session.
         *
         * @method _converse.api.user.logout
         * @example _converse.api.user.logout();
         */
        'logout' () {
            _converse.logOut();
        },
        /**
         * Set and get the user's chat status, also called their *availability*.
         *
         * @namespace _converse.api.user.status
         * @memberOf _converse.api.user
         */
        'status': {
            /** Return the current user's availability status.
             *
             * @method _converse.api.user.status.get
             * @example _converse.api.user.status.get();
             */
            'get' () {
                return _converse.xmppstatus.get('status');
            },
            /**
             * The user's status can be set to one of the following values:
             *
             * @method _converse.api.user.status.set
             * @param {string} value The user's chat status (e.g. 'away', 'dnd', 'offline', 'online', 'unavailable' or 'xa')
             * @param {string} [message] A custom status message
             *
             * @example this._converse.api.user.status.set('dnd');
             * @example this._converse.api.user.status.set('dnd', 'In a meeting');
             */
            'set' (value, message) {
                const data = {'status': value};
                if (!_.includes(_.keys(_converse.STATUS_WEIGHTS), value)) {
                    throw new Error('Invalid availability value. See https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.1');
                }
                if (_.isString(message)) {
                    data.status_message = message;
                }
                _converse.xmppstatus.sendPresence(value);
                _converse.xmppstatus.save(data);
            },

            /**
             * Set and retrieve the user's custom status message.
             *
             * @namespace _converse.api.user.status.message
             * @memberOf _converse.api.user.status
             */
            'message': {
                /**
                 * @method _converse.api.user.status.message.get
                 * @returns {string} The status message
                 * @example const message = _converse.api.user.status.message.get()
                 */
                'get' () {
                    return _converse.xmppstatus.get('status_message');
                },
                /**
                 * @method _converse.api.user.status.message.set
                 * @param {string} status The status message
                 * @example _converse.api.user.status.message.set('In a meeting');
                 */
                'set' (status) {
                    _converse.xmppstatus.save({'status_message': status});
                }
            }
        },
    },

    /**
     * This grouping allows access to the
     * [configuration settings](/docs/html/configuration.html#configuration-settings)
     * of Converse.
     *
     * @namespace _converse.api.settings
     * @memberOf _converse.api
     */
    'settings': {
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
        'update' (settings) {
            u.merge(_converse.default_settings, settings);
            u.merge(_converse, settings);
            u.applyUserSettings(_converse, settings, _converse.user_settings);
        },
        /**
         * @method _converse.api.settings.get
         * @returns {*} Value of the particular configuration setting.
         * @example _converse.api.settings.get("play_sounds");
         */
        'get' (key) {
            if (_.includes(_.keys(_converse.default_settings), key)) {
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
         *     "play_sounds", true,
         *     "hide_offline_users" true
         * });
         */
        'set' (key, val) {
            const o = {};
            if (_.isObject(key)) {
                _.assignIn(_converse, _.pick(key, _.keys(_converse.default_settings)));
            } else if (_.isString("string")) {
                o[key] = val;
                _.assignIn(_converse, _.pick(o, _.keys(_converse.default_settings)));
            }
        }
    },

    /**
     * Converse and its plugins emit various events which you can listen to via the
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
     * * [statusInitialized](/docs/html/events.html#statusInitialized)
     * * [roomsPanelRendered](/docs/html/events.html#roomsPanelRendered)
     *
     * The various plugins might also provide promises, and they do this by using the
     * `promises.add` api method.
     *
     * @namespace _converse.api.promises
     * @memberOf _converse.api
     */
    'promises': {
        /**
         * By calling `promises.add`, a new [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
         * is made available for other code or plugins to depend on via the
         * {@link _converse.api.waitUntil} method.
         *
         * Generally, it's the responsibility of the plugin which adds the promise to
         * also resolve it.
         *
         * This is done by calling {@link _converse.api.emit}, which not only resolves the
         * promise, but also emits an event with the same name (which can be listened to
         * via {@link _converse.api.listen}).
         *
         * @method _converse.api.promises.add
         * @param {string|array} [name|names] The name or an array of names for the promise(s) to be added
         * @example _converse.api.promises.add('foo-completed');
         */
        'add' (promises) {
            promises = _.isArray(promises) ? promises : [promises]
            _.each(promises, addPromise);
        }
    },

    /**
     * This namespace lets you access the BOSH tokens
     *
     * @namespace _converse.api.tokens
     * @memberOf _converse.api
     */
    'tokens': {
        /**
         * @method _converse.api.tokens.get
         * @param {string} [id] The type of token to return ('rid' or 'sid').
         * @returns 'string' A token, either the RID or SID token depending on what's asked for.
         * @example _converse.api.tokens.get('rid');
         */
        'get' (id) {
            if (!_converse.expose_rid_and_sid || _.isUndefined(_converse.connection)) {
                return null;
            }
            if (id.toLowerCase() === 'rid') {
                return _converse.connection.rid || _converse.connection._proto.rid;
            } else if (id.toLowerCase() === 'sid') {
                return _converse.connection.sid || _converse.connection._proto.sid;
            }
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
    'listen': {
        /**
         * Lets you listen to an event exactly once.
         *
         * @method _converse.api.listen.once
         * @param {string} name The event's name
         * @param {function} callback The callback method to be called when the event is emitted.
         * @param {object} [context] The value of the `this` parameter for the callback.
         * @example _converse.api.listen.once('message', function (messageXML) { ... });
         */
        'once': _converse.once.bind(_converse),

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
        'on': _converse.on.bind(_converse),

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
        'not': _converse.off.bind(_converse),

        /**
         * Subscribe to an incoming stanza
         *
         * Every a matched stanza is received, the callback method specified by `callback` will be called.
         *
         * @method _converse.api.listen.stanza
         * @param {string} name The stanza's name
         * @param {object} options Matching options
         * (e.g. 'ns' for namespace, 'type' for stanza type, also 'id' and 'from');
         * @param {function} handler The callback method to be called when the stanza appears
         */
        'stanza' (name, options, handler) {
            if (_.isFunction(options)) {
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
        },
    },

    /**
     * Wait until a promise is resolved
     *
     * @method _converse.api.waitUntil
     * @param {string} name The name of the promise
     * @returns {Promise}
     */
    'waitUntil' (name) {
        const promise = _converse.promises[name];
        if (_.isUndefined(promise)) {
            return null;
        }
        return promise;
    },

    /**
     * Allows you to send XML stanzas.
     *
     * @method _converse.api.send
     * @example
     * const msg = converse.env.$msg({
     *     'from': 'juliet@example.com/balcony',
     *     'to': 'romeo@example.net',
     *     'type':'chat'
     * });
     * _converse.api.send(msg);
     */
    'send' (stanza) {
        _converse.connection.send(stanza);
        _converse.emit('send', stanza);
    },

    /**
     * Send an IQ stanza and receive a promise
     *
     * @method _converse.api.sendIQ
     * @returns {Promise} A promise which resolves when we receive a `result` stanza
     * or is rejected when we receive an `error` stanza.
     */
    'sendIQ' (stanza, timeout) {
        return new Promise((resolve, reject) => {
            _converse.connection.sendIQ(stanza, resolve, reject, timeout || _converse.IQ_TIMEOUT);
            _converse.emit('send', stanza);
        });
    }
};

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
 * @namespace converse
 */
const converse = {
    /**
     * Public API method which initializes Converse.
     * This method must always be called when using Converse.
     *
     * @memberOf converse
     * @method initialize
     * @param {object} config A map of [configuration-settings](https://conversejs.org/docs/html/configuration.html#configuration-settings).
     *
     * @example
     * converse.initialize({
     *     auto_list_rooms: false,
     *     auto_subscribe: false,
     *     bosh_service_url: 'https://bind.example.com',
     *     hide_muc_server: false,
     *     i18n: locales['en'],
     *     keepalive: true,
     *     play_sounds: true,
     *     prebind: false,
     *     show_controlbox_by_default: true,
     *     debug: false,
     *     roster_groups: true
     * });
     */
    'initialize' (settings, callback) {
        return _converse.initialize(settings, callback);
    },
    /**
     * Exposes methods for adding and removing plugins. You'll need to write a plugin
     * if you want to have access to the private API methods defined further down below.
     *
     * For more information on plugins, read the documentation on [writing a plugin](/docs/html/plugin_development.html).
     *
     * @namespace plugins
     * @memberOf converse
     */
    'plugins': {
        /** Registers a new plugin.
         *
         * @method converse.plugins.add
         * @param {string} name The name of the plugin
         * @param {object} plugin The plugin object
         *
         * @example
         *
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
        'add' (name, plugin) {
            plugin.__name__ = name;
            if (!_.isUndefined(_converse.pluggable.plugins[name])) {
                throw new TypeError(
                    `Error: plugin with name "${name}" has already been `+
                    'registered!');
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
     * @property {object} converse.env.Backbone    - The [Backbone](http://backbonejs.org) object used by Converse to create models and views.
     * @property {function} converse.env.Promise   - The Promise implementation used by Converse.
     * @property {function} converse.env.Strophe   - The [Strophe](http://strophe.im/strophejs) XMPP library used by Converse.
     * @property {object} converse.env._           - The instance of [lodash](http://lodash.com) used by Converse.
     * @property {function} converse.env.f         - And instance of Lodash with its methods wrapped to produce immutable auto-curried iteratee-first data-last methods.
     * @property {function} converse.env.b64_sha1  - Utility method from Strophe for creating base64 encoded sha1 hashes.
     * @property {object} converse.env.moment      - [Moment](https://momentjs.com) date manipulation library.
     * @property {function} converse.env.sizzle    - [Sizzle](https://sizzlejs.com) CSS selector engine.
     * @property {object} converse.env.utils       - Module containing common utility methods used by Converse.
     */
    'env': {
        '$build': $build,
        '$iq': $iq,
        '$msg': $msg,
        '$pres': $pres,
        'Backbone': Backbone,
        'Promise': Promise,
        'Strophe': Strophe,
        '_': _,
        'f': f,
        'b64_sha1':  b64_sha1,
        'moment': moment,
        'sizzle': sizzle,
        'utils': u
    }
};
window.converse = converse;
window.dispatchEvent(new CustomEvent('converse-loaded'));
export default converse;
