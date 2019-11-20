// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)
/**
 * @module converse-core
 */
import 'strophe.js/src/websocket';
import './polyfill';
import * as strophe from 'strophe.js/src/core';
import Backbone from 'backbone';
import BrowserStorage from 'backbone.browserStorage';
import _ from './lodash.noconflict';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import dayjs from 'dayjs';
import i18n from './i18n';
import pluggable from 'pluggable.js/src/pluggable';
import sizzle from 'sizzle';
import u from '@converse/headless/utils/core';

const Strophe = strophe.default.Strophe;
const $build = strophe.default.$build;
const $iq = strophe.default.$iq;
const $msg = strophe.default.$msg;
const $pres = strophe.default.$pres;

Backbone = Backbone.noConflict();

dayjs.extend(advancedFormat);

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
Strophe.addNamespace('OMEMO', 'eu.siacs.conversations.axolotl');
Strophe.addNamespace('OUTOFBAND', 'jabber:x:oob');
Strophe.addNamespace('PUBSUB', 'http://jabber.org/protocol/pubsub');
Strophe.addNamespace('REGISTER', 'jabber:iq:register');
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

// Setting wait to 59 instead of 60 to avoid timing conflicts with the
// webserver, which is often also set to 60 and might therefore sometimes
// return a 504 error page instead of passing through to the BOSH proxy.
const BOSH_WAIT = 59;

// Core plugins are whitelisted automatically
// These are just the @converse/headless plugins, for the full converse,
// the other plugins are whitelisted in src/converse.js
const CORE_PLUGINS = [
    'converse-bookmarks',
    'converse-bosh',
    'converse-caps',
    'converse-chatboxes',
    'converse-disco',
    'converse-emoji',
    'converse-mam',
    'converse-muc',
    'converse-ping',
    'converse-pubsub',
    'converse-roster',
    'converse-rsm',
    'converse-smacks',
    'converse-vcard'
];


/**
 * A private, closured object containing the private api (via {@link _converse.api})
 * as well as private methods and internal data-structures.
 * @global
 * @namespace _converse
 */
// XXX: Strictly speaking _converse is not a global, but we need to set it as
// such to get JSDoc to create the correct document site strucure.
const _converse = {
    'templates': {},
    'promises': {}
}

_converse.VERSION_NAME = "v5.0.5";

Object.assign(_converse, Backbone.Events);

_converse.Collection = Backbone.Collection.extend({
    clearSession (options) {
        Array.from(this.models).forEach(m => m.destroy(options));
        this.browserStorage._clear();
        this.reset();
    }
});


/**
 * Custom error for indicating timeouts
 * @namespace _converse
 */
class TimeoutError extends Error {}
_converse.TimeoutError = TimeoutError;


// Make converse pluggable
pluggable.enable(_converse, '_converse', 'pluggable');

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
_converse.ANONYMOUS = 'anonymous';
_converse.CLOSED = 'closed';
_converse.EXTERNAL = 'external';
_converse.LOGIN = 'login';
_converse.LOGOUT = 'logout';
_converse.OPENED = 'opened';
_converse.PREBIND = 'prebind';

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
    10: 'RECONNECTING'
};

_converse.SUCCESS = 'success';
_converse.FAILURE = 'failure';

// Generated from css/images/user.svg
_converse.DEFAULT_IMAGE_TYPE = 'image/svg+xml';
_converse.DEFAULT_IMAGE = "PD94bWwgdmVyc2lvbj0iMS4wIj8+CjxzdmcgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiA8cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iIzU1NSIvPgogPGNpcmNsZSBjeD0iNjQiIGN5PSI0MSIgcj0iMjQiIGZpbGw9IiNmZmYiLz4KIDxwYXRoIGQ9Im0yOC41IDExMiB2LTEyIGMwLTEyIDEwLTI0IDI0LTI0IGgyMyBjMTQgMCAyNCAxMiAyNCAyNCB2MTIiIGZpbGw9IiNmZmYiLz4KPC9zdmc+Cg==";

_converse.TIMEOUTS = {
    // Set as module attr so that we can override in tests.
    PAUSED: 10000,
    INACTIVE: 90000
};

// XEP-0085 Chat states
// https://xmpp.org/extensions/xep-0085.html
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

_converse.default_connection_options = {'explicitResourceBinding': true};

// Default configuration values
// ----------------------------
_converse.default_settings = {
    allow_non_roster_messaging: false,
    authentication: 'login', // Available values are "login", "prebind", "anonymous" and "external".
    auto_away: 0, // Seconds after which user status is set to 'away'
    auto_login: false, // Currently only used in connection with anonymous login
    auto_reconnect: true,
    auto_xa: 0, // Seconds after which user status is set to 'xa'
    blacklisted_plugins: [],
    connection_options: {},
    credentials_url: null, // URL from where login credentials can be fetched
    csi_waiting_time: 0, // Support for XEP-0352. Seconds before client is considered idle and CSI is sent out.
    debug: false,
    default_state: 'online',
    geouri_regex: /https\:\/\/www.openstreetmap.org\/.*#map=[0-9]+\/([\-0-9.]+)\/([\-0-9.]+)\S*/g,
    geouri_replacement: 'https://www.openstreetmap.org/?mlat=$1&mlon=$2#map=18/$1/$2',
    idle_presence_timeout: 300, // Seconds after which an idle presence is sent
    jid: undefined,
    keepalive: true,
    locales: [
        'af', 'ar', 'bg', 'ca', 'cs', 'de', 'eo', 'es', 'eu', 'en', 'fr', 'gl',
        'he', 'hi', 'hu', 'id', 'it', 'ja', 'nb', 'nl', 'oc',
        'pl', 'pt', 'pt_BR', 'ro', 'ru', 'tr', 'uk', 'vi', 'zh_CN', 'zh_TW'
    ],
    message_carbons: true,
    nickname: undefined,
    password: undefined,
    priority: 0,
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
 * Logs messages to the browser's developer console.
 * Available loglevels are 0 for 'debug', 1 for 'info', 2 for 'warn',
 * 3 for 'error' and 4 for 'fatal'.
 * When using the 'error' or 'warn' loglevels, a full stacktrace will be
 * logged as well.
 * @method log
 * @private
 * @memberOf _converse
 * @param { string } message - The message to be logged
 * @param { integer } level - The loglevel which allows for filtering of log messages
 */
_converse.log = function (message, level, style='') {
    if (level === Strophe.LogLevel.ERROR || level === Strophe.LogLevel.FATAL) {
        style = style || 'color: maroon';
    }
    if (message instanceof Error) {
        message = message.stack;
    } else if (_.isElement(message)) {
        message = message.outerHTML;
    }
    const prefix = style ? '%c' : '';
    if (level === Strophe.LogLevel.ERROR) {
        u.logger.error(`${prefix} ERROR: ${message}`, style);
    } else if (level === Strophe.LogLevel.WARN) {
        u.logger.warn(`${prefix} ${(new Date()).toISOString()} WARNING: ${message}`, style);
    } else if (level === Strophe.LogLevel.FATAL) {
        u.logger.error(`${prefix} FATAL: ${message}`, style);
    } else if (_converse.debug) {
        if (level === Strophe.LogLevel.DEBUG) {
            u.logger.debug(`${prefix} ${(new Date()).toISOString()} DEBUG: ${message}`, style);
        } else {
            u.logger.info(`${prefix} ${(new Date()).toISOString()} INFO: ${message}`, style);
        }
    }
};

Strophe.log = function (level, msg) { _converse.log(level+' '+msg, level); };
Strophe.error = function (msg) { _converse.log(msg, Strophe.LogLevel.ERROR); };


/**
 * Translate the given string based on the current locale.
 * Handles all MUC presence stanzas.
 * @method __
 * @private
 * @memberOf _converse
 * @param { String } str - The string to translate
 */
_converse.__ = function (str) {
    if (i18n === undefined) {
        return str;
    }
    return i18n.translate.apply(i18n, arguments);
};

const __ = _converse.__;

const PROMISES = [
    'afterResourceBinding',
    'connectionInitialized',
    'initialized',
    'pluginsInitialized',
    'statusInitialized'
];

function addPromise (promise) {
    /* Private function, used to add a new promise to the ones already
     * available via the `waitUntil` api method.
     */
    _converse.promises[promise] = u.getResolveablePromise();
}

_converse.isTestEnv = function () {
    return _.get(_converse.connection, 'service') === 'jasmine tests';
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
    return _.includes(['mobile', 'fullscreen', 'embedded'], _converse.view_mode);
};

_converse.router = new Backbone.Router();

function initPlugins () {
    // If initialize gets called a second time (e.g. during tests), then we
    // need to re-apply all plugins (for a new converse instance), and we
    // therefore need to clear this array that prevents plugins from being
    // initialized twice.
    // If initialize is called for the first time, then this array is empty
    // in any case.
    _converse.pluggable.initialized_plugins = [];
    const whitelist = CORE_PLUGINS.concat(_converse.whitelisted_plugins);

    if (_converse.singleton) {
        [
            'converse-bookmarks',
            'converse-controlbox',
            'converse-headline',
            'converse-register'
        ].forEach(name => _converse.blacklisted_plugins.push(name));
    }

    _converse.pluggable.initializePlugins(
        { '_converse': _converse },
        whitelist,
        _converse.blacklisted_plugins
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
    _converse.config = new Backbone.Model({
        'id': id,
        'trusted': _converse.trusted && true || false,
        'storage': _converse.trusted ? 'local' : 'session'
    });
    _converse.config.browserStorage = new BrowserStorage.session(id);
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


function tearDown () {
    _converse.api.trigger('beforeTearDown');
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
    if (_converse.authentication === _converse.LOGIN) {
        // XXX: If EITHER ``keepalive`` or ``auto_login`` is ``true`` and
        // ``authentication`` is set to ``login``, then Converse will try to log the user in,
        // since we don't have a way to distinguish between wether we're
        // restoring a previous session (``keepalive``) or whether we're
        // automatically setting up a new session (``auto_login``).
        // So we can't do the check (!automatic || _converse.auto_login) here.
        if (credentials) {
            connect(credentials);
        } else if (_converse.credentials_url) {
            // We give credentials_url preference, because
            // _converse.connection.pass might be an expired token.
            connect(await getLoginCredentials());
        } else if (_converse.jid && (_converse.password || _converse.connection.pass)) {
            connect();
        } else if (!_converse.isTestEnv() && window.PasswordCredential) {
            connect(await getLoginCredentialsFromBrowser());
        } else {
            throw new Error("attemptNonPreboundSession: Could not find any credentials to log you in with!");
        }
    } else if ([_converse.ANONYMOUS, _converse.EXTERNAL].includes(_converse.authentication) && (!automatic || _converse.auto_login)) {
        connect();
    }
}


function connect (credentials) {
    if ([_converse.ANONYMOUS, _converse.EXTERNAL].includes(_converse.authentication)) {
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
    } else if (_converse.authentication === _converse.LOGIN) {
        const password = credentials ? credentials.password : (_converse.connection.pass || _converse.password);
        if (!password) {
            if (_converse.auto_login) {
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


function reconnect () {
    _converse.log('RECONNECTING: the connection has dropped, attempting to reconnect.');
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
    tearDown();
    return _converse.api.user.login();
}

const debouncedReconnect = _.debounce(reconnect, 2000);


_converse.shouldClearCache = function () {
    return !_converse.config.get('trusted') || _converse.isTestEnv();
}

function clearSession  () {
    if (_converse.session !== undefined) {
        _converse.session.destroy();
        _converse.session.browserStorage._clear();
        delete _converse.session;
    }
    if (_converse.shouldClearCache() && _converse.xmppstatus) {
        _converse.xmppstatus.destroy();
        _converse.xmppstatus.browserStorage._clear();
        delete _converse.xmppstatus;
    }
    /**
     * Triggered once the user session has been cleared,
     * for example when the user has logged out or when Converse has
     * disconnected for some other reason.
     * @event _converse#clearSession
     */
    _converse.api.trigger('clearSession');
}


/**
 * Creates a new Strophe.Connection instance and if applicable, attempt to
 * restore the BOSH session or if `auto_login` is true, attempt to log in.
 */
_converse.initConnection = async function () {
    if (!_converse.connection) {
        if (!_converse.bosh_service_url && ! _converse.websocket_url) {
            throw new Error("initConnection: you must supply a value for either the bosh_service_url or websocket_url or both.");
        }
        if (('WebSocket' in window || 'MozWebSocket' in window) && _converse.websocket_url) {
            _converse.connection = new Strophe.Connection(
                _converse.websocket_url,
                Object.assign(_converse.default_connection_options, _converse.connection_options)
            );
        } else if (_converse.bosh_service_url) {
            _converse.connection = new Strophe.Connection(
                _converse.bosh_service_url,
                Object.assign(
                    _converse.default_connection_options,
                    _converse.connection_options,
                    {'keepalive': _converse.keepalive}
                )
            );
        } else {
            throw new Error("initConnection: this browser does not support "+
                            "websockets and bosh_service_url wasn't specified.");
        }
        if (_converse.auto_login || _converse.keepalive) {
            await _converse.api.user.login(null, null, true);
        }
    }
    setUpXMLLogging();
    /**
     * Triggered once the `Strophe.Connection` constructor has been initialized, which
     * will be responsible for managing the connection to the XMPP server.
     *
     * @event _converse#connectionInitialized
     */
    _converse.api.trigger('connectionInitialized');
};


async function setUserJID (jid) {
    const bare_jid = Strophe.getBareJidFromJid(jid).toLowerCase();
    const id = `converse.session-${bare_jid}`;
    if (!_converse.session || _converse.session.get('id') !== id) {
        _converse.session = new Backbone.Model({id});
        _converse.session.browserStorage = new BrowserStorage.session(id);
        await new Promise(r => _converse.session.fetch({'success': r, 'error': r}));
        if (_converse.session.get('active')) {
            _converse.session.clear();
            _converse.session.save({'id': id});
        }
        saveJIDtoSession(jid);
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
    /**
     * Triggered whenever the user's JID has been updated
     * @event _converse#setUserJID
     */
    _converse.api.trigger('setUserJID');
    return jid;
}

function saveJIDtoSession (jid) {
    jid = _converse.session.get('jid') || jid;
    if (_converse.authentication !== _converse.ANONYMOUS && !Strophe.getResourceFromJid(jid)) {
        jid = jid.toLowerCase() + _converse.generateResource();
    }
    // Set JID on the connection object so that when we call
    // `connection.bind` the new resource is found by Strophe.js
    // and sent to the XMPP server.
    _converse.connection.jid = jid;
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
}


async function onConnected (reconnecting) {
    /* Called as soon as a new connection has been established, either
     * by logging in or by attaching to an existing BOSH session.
     */
    delete _converse.connection.reconnecting;
    _converse.connection.flush(); // Solves problem of returned PubSub BOSH response not received by browser
    await setUserJID(_converse.connection.jid);
    /**
     * Synchronous event triggered after we've sent an IQ to bind the
     * user's JID resource for this session.
     * @event _converse#afterResourceBinding
     */
    await _converse.api.trigger('afterResourceBinding', {'synchronous': true});
    _converse.enableCarbons();
    _converse.initStatus(reconnecting)
}


function setUpXMLLogging () {
    Strophe.log = function (level, msg) {
        _converse.log(msg, level);
    };
    _converse.connection.xmlInput = function (body) {
        if (_converse.debug) {
            _converse.log(body.outerHTML, Strophe.LogLevel.DEBUG, 'color: darkgoldenrod');
        }
    };
    _converse.connection.xmlOutput = function (body) {
        if (_converse.debug) {
            _converse.log(body.outerHTML, Strophe.LogLevel.DEBUG, 'color: darkcyan');
        }
    };
}


async function finishInitialization () {
    initClientConfig();
    initPlugins();
    await _converse.initConnection();
    _converse.registerGlobalEventHandlers();
    if (!Backbone.history.started) {
        Backbone.history.start();
    }
    if (_converse.idle_presence_timeout > 0) {
        _converse.api.listen.on('addClientFeatures', () => {
            _converse.api.disco.own.features.add(Strophe.NS.IDLE);
        });
    }
}


/**
 * Properly tear down the session so that it's possible to manually connect again.
 * @method finishDisconnection
 * @emits _converse#disconnected
 * @private
 */
function finishDisconnection () {
    _converse.log('DISCONNECTED');
    delete _converse.connection.reconnecting;
    _converse.connection.reset();
    tearDown();
    clearSession();
    /**
     * Triggered after converse.js has disconnected from the XMPP server.
     * @event _converse#disconnected
     * @memberOf _converse
     * @example _converse.api.listen.on('disconnected', () => { ... });
     */
    _converse.api.trigger('disconnected');
}


function fetchLoginCredentials (wait=0) {
    return new Promise(
        _.debounce((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', _converse.credentials_url, true);
            xhr.setRequestHeader('Accept', 'application/json, text/javascript');
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 400) {
                    const data = JSON.parse(xhr.responseText);
                    setUserJID(data.jid).then(() => {
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

async function getLoginCredentials () {
    let credentials;
    let wait = 0;
    while (!credentials) {
        try {
            credentials = await fetchLoginCredentials(wait); // eslint-disable-line no-await-in-loop
        } catch (e) {
            _converse.log('Could not fetch login credentials', Strophe.LogLevel.ERROR);
            _converse.log(e, Strophe.LogLevel.ERROR);
        }
        // If unsuccessful, we wait 2 seconds between subsequent attempts to
        // fetch the credentials.
        wait = 2000;
    }
    return credentials;
}

async function getLoginCredentialsFromBrowser () {
    const creds = await navigator.credentials.get({'password': true});
    if (creds && creds.type == 'password' && u.isValidJID(creds.id)) {
        await setUserJID(creds.id);
        return {'jid': creds.id, 'password': creds.password};
    }
}


function unregisterGlobalEventHandlers () {
    document.removeEventListener("visibilitychange", _converse.saveWindowState);
    _converse.api.trigger('unregisteredGlobalEventHandlers');
}

function cleanup () {
    // Looks like _converse.initialized was called again without logging
    // out or disconnecting in the previous session.
    // This happens in tests. We therefore first clean up.
    Backbone.history.stop();
    unregisterGlobalEventHandlers();
    delete _converse.controlboxtoggle;
    if (_converse.chatboxviews) {
        delete _converse.chatboxviews;
    }
    _converse.stopListening();
    _converse.off();
}


_converse.initialize = async function (settings, callback) {
    settings = settings !== undefined ? settings : {};
    const init_promise = u.getResolveablePromise();
    PROMISES.forEach(addPromise);
    if (_converse.connection !== undefined) {
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
    _.assignIn(this, _.pick(settings, Object.keys(this.default_settings)));
    this.settings = {};
    _.assignIn(this.settings, _.pick(settings, Object.keys(this.default_settings)));

    if (this.authentication === _converse.ANONYMOUS) {
        if (this.auto_login && !this.jid) {
            throw new Error("Config Error: you need to provide the server's " +
                  "domain via the 'jid' option when using anonymous " +
                  "authentication with auto_login.");
        }
    }

    _converse.router.route(/^converse\?debug=(true|false)$/, 'debug', debug => {
        if (debug === 'true') {
            _converse.debug = true;
        } else {
            _converse.debug = false;
        }
    });

    /* Localisation */
    if (i18n === undefined || _converse.isTestEnv()) {
        _converse.locale = 'en';
    } else {
        try {
            _converse.locale = i18n.getLocale(settings.i18n, _converse.locales);
            await i18n.fetchTranslations(_converse);
        } catch (e) {
            _converse.log(e.message, Strophe.LogLevel.FATAL);
        }
    }

    // Module-level variables
    // ----------------------
    this.callback = callback || function noop () {};
    /* When reloading the page:
     * For new sessions, we need to send out a presence stanza to notify
     * the server/network that we're online.
     * When re-attaching to an existing session we don't need to again send out a presence stanza,
     * because it's as if "we never left" (see onConnectStatusChanged).
     * https://github.com/jcbrand/converse.js/issues/521
     */
    this.send_initial_presence = true;
    this.msg_counter = 0;
    this.user_settings = settings; // Save the user settings so that they can be used by plugins

    // Module-level functions
    // ----------------------

    this.generateResource = () => `/converse.js-${Math.floor(Math.random()*139749528).toString()}`;

    /**
     * Send out a Client State Indication (XEP-0352)
     * @private
     * @method sendCSI
     * @memberOf _converse
     * @param { String } stat - The user's chat status
     */
    this.sendCSI = function (stat) {
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
        if (
            _converse.auto_away < 1 &&
            _converse.auto_xa < 1 &&
            _converse.csi_waiting_time < 1 &&
            _converse.idle_presence_timeout < 1
        ) {
            // Waiting time of less then one second means features aren't used.
            return;
        }
        _converse.idle_seconds = 0;
        _converse.auto_changed_status = false; // Was the user's status changed by Converse?
        window.addEventListener('click', _converse.onUserActivity);
        window.addEventListener('focus', _converse.onUserActivity);
        window.addEventListener('keypress', _converse.onUserActivity);
        window.addEventListener('mousemove', _converse.onUserActivity);
        const options = {'once': true, 'passive': true};
        window.addEventListener(_converse.unloadevent, _converse.onUserActivity, options);
        window.addEventListener(_converse.unloadevent, () => {
            if (_converse.session) {
                _converse.session.save('active', false);
            }
        });
        _converse.everySecondTrigger = window.setInterval(_converse.onEverySecond, 1000);
    };

    this.setConnectionStatus = function (connection_status, message) {
        _converse.connfeedback.set({
            'connection_status': connection_status,
            'message': message
        });
    };

    /**
     * Reject or cancel another user's subscription to our presence updates.
     * @method rejectPresenceSubscription
     * @private
     * @memberOf _converse
     * @param { String } jid - The Jabber ID of the user whose subscription is being canceled
     * @param { String } message - An optional message to the user
     */
    this.rejectPresenceSubscription = function (jid, message) {
        const pres = $pres({to: jid, type: "unsubscribed"});
        if (message && message !== "") { pres.c("status").t(message); }
        _converse.api.send(pres);
    };


    /**
     * Gets called once strophe's status reaches Strophe.Status.DISCONNECTED.
     * Will either start a teardown process for converse.js or attempt
     * to reconnect.
     * @method onDisconnected
     * @private
     * @memberOf _converse
     */
    this.onDisconnected = function () {
        const reason = _converse.disconnection_reason;
        if (_converse.disconnection_cause === Strophe.Status.AUTHFAIL) {
            if (_converse.auto_reconnect && (_converse.credentials_url || _converse.authentication === _converse.ANONYMOUS)) {
                /**
                 * If `credentials_url` is set, we reconnect, because we might
                 * be receiving expirable tokens from the credentials_url.
                 *
                 * If `authentication` is anonymous, we reconnect because we
                 * might have tried to attach with stale BOSH session tokens
                 * or with a cached JID and password
                 */
                return _converse.api.connection.reconnect();
            } else {
                return finishDisconnection();
            }
        } else if (_converse.disconnection_cause === _converse.LOGOUT ||
                (reason !== undefined && reason === _.get(Strophe, 'ErrorCondition.NO_AUTH_MECH')) ||
                reason === "host-unknown" ||
                reason === "remote-connection-failed" ||
                !_converse.auto_reconnect) {
            return finishDisconnection();
        }
        _converse.api.connection.reconnect();
    };


    this.setDisconnectionCause = function (cause, reason, override) {
        /* Used to keep track of why we got disconnected, so that we can
         * decide on what the next appropriate action is (in onDisconnected)
         */
        if (cause === undefined) {
            delete _converse.disconnection_cause;
            delete _converse.disconnection_reason;
        } else if (_converse.disconnection_cause === undefined || override) {
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
                onConnected(true);
            } else {
                _converse.log(status === Strophe.Status.CONNECTED ? 'Connected' : 'Attached');
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
            } else if (message !== undefined && message === _.get(Strophe, 'ErrorCondition.NO_AUTH_MECH')) {
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
        if (!title) {
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
        if (!title) {
            return;
        }
        if (title.search(/^Messages \(\d+\) /) !== -1) {
            title = title.replace(/^Messages \(\d+\) /, "");
        }
    };

    this.initStatus = (reconnecting) => {
        // If there's no xmppstatus obj, then we were never connected to
        // begin with, so we set reconnecting to false.
        reconnecting = _converse.xmppstatus === undefined ? false : reconnecting;
        if (reconnecting) {
            _converse.onStatusInitialized(reconnecting);
        } else {
            const id = `converse.xmppstatus-${_converse.bare_jid}`;
            _converse.xmppstatus = new this.XMPPStatus({'id': id});
            _converse.xmppstatus.browserStorage = new BrowserStorage.session(id);
            _converse.xmppstatus.fetch({
                'success': () => _converse.onStatusInitialized(reconnecting),
                'error': () => _converse.onStatusInitialized(reconnecting),
                'silent': true
            });
        }
    }

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
        /**
         * Triggered when window state has changed.
         * Used to determine when a user left the page and when came back.
         * @event _converse#windowStateChanged
         * @type { object }
         * @property{ string } state - Either "hidden" or "visible"
         * @example _converse.api.listen.on('windowStateChanged', obj => { ... });
         */
        _converse.api.trigger('windowStateChanged', {state});
    };

    this.registerGlobalEventHandlers = function () {
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
        _converse.api.trigger('registeredGlobalEventHandlers');
    };

    this.enableCarbons = function () {
        /* Ask the XMPP server to enable Message Carbons
         * See XEP-0280 https://xmpp.org/extensions/xep-0280.html#enabling
         */
        if (!this.message_carbons || !this.session || this.session.get('carbons_enabled')) {
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
        /**
         * Triggered when the user's own chat status has been initialized.
         * @event _converse#statusInitialized
         * @example _converse.api.listen.on('statusInitialized', status => { ... });
         * @example _converse.api.waitUntil('statusInitialized').then(() => { ... });
         */
        _converse.api.trigger('statusInitialized', reconnecting);
        if (reconnecting) {
            /**
             * After the connection has dropped and converse.js has reconnected.
             * Any Strophe stanza handlers (as registered via `converse.listen.stanza`) will
             * have to be registered anew.
             * @event _converse#reconnected
             * @example _converse.api.listen.on('reconnected', () => { ... });
             */
            _converse.api.trigger('reconnected');
        } else {
            init_promise.resolve();
            /**
             * Triggered once converse.js has been initialized.
             * See also {@link _converse#event:pluginsInitialized}.
             * @event _converse#initialized
             */
            _converse.api.trigger('initialized');
            /**
             * Triggered after the connection has been established and Converse
             * has got all its ducks in a row.
             * @event _converse#initialized
             */
            _converse.api.trigger('connected');
        }
    };

    this.bindResource = async function () {
        /**
         * Synchronous event triggered before we send an IQ to bind the user's
         * JID resource for this session.
         * @event _converse#beforeResourceBinding
         */
        await _converse.api.trigger('beforeResourceBinding', {'synchronous': true});
        _converse.connection.bind();
    };

    this.ConnectionFeedback = Backbone.Model.extend({
        defaults: {
            'connection_status': Strophe.Status.DISCONNECTED,
            'message': ''
        },

        initialize () {
            this.on('change', () => _converse.api.trigger('connfeedback', _converse.connfeedback));
        }
    });
    this.connfeedback = new this.ConnectionFeedback();


    this.XMPPStatus = Backbone.Model.extend({
        defaults: {
            "status":  _converse.default_state
        },

        initialize () {
            this.on('change', item => {
                if (!_.isObject(item.changed)) {
                    return;
                }
                if ('status' in item.changed || 'status_message' in item.changed) {
                    this.sendPresence(this.get('status'), this.get('status_message'));
                }
            });
        },

        getNickname () {
            return _converse.nickname;
        },

        getFullname () {
            // Gets overridden in converse-vcard
            return '';
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

    // Initialization
    // --------------
    // This is the end of the initialize method.
    if (settings.connection) {
        this.connection = settings.connection;
    }

    await finishInitialization();
    if (_converse.isTestEnv()) {
        return _converse;
    } else {
        return init_promise;
    }
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
    connection: {
        /**
         * @method _converse.api.connection.connected
         * @memberOf _converse.api.connection
         * @returns {boolean} Whether there is an established connection or not.
         */
        connected () {
            return (_converse.connection && _converse.connection.connected) || false;
        },

        /**
         * Terminates the connection.
         *
         * @method _converse.api.connection.disconnect
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

            if (_converse.authentication === _converse.ANONYMOUS) {
                tearDown();
                clearSession();
            }
            if (conn_status === Strophe.Status.CONNFAIL) {
                // When reconnecting with a new transport, we call setUserJID
                // so that a new resource is generated, to avoid multiple
                // server-side sessions with the same resource.
                //
                // We also call `_proto._doDisconnect` so that connection event handlers
                // for the old transport are removed.
                if (_converse.api.connection.isType('websocket') && _converse.bosh_service_url) {
                    await setUserJID(_converse.bare_jid);
                    _converse.connection._proto._doDisconnect();
                    _converse.connection._proto = new Strophe.Bosh(_converse.connection);
                    _converse.connection.service = _converse.bosh_service_url;
                } else if (_converse.api.connection.isType('bosh') && _converse.websocket_url) {
                    if (_converse.authentication === _converse.ANONYMOUS) {
                        // When reconnecting anonymously, we need to connect with only
                        // the domain, not the full JID that we had in our previous
                        // (now failed) session.
                        await setUserJID(_converse.settings.jid);
                    } else {
                        await setUserJID(_converse.bare_jid);
                    }
                    _converse.connection._proto._doDisconnect();
                    _converse.connection._proto = new Strophe.Websocket(_converse.connection);
                    _converse.connection.service = _converse.websocket_url;
                }
            }
            if (conn_status === Strophe.Status.AUTHFAIL && _converse.authentication === _converse.ANONYMOUS) {
                // When reconnecting anonymously, we need to connect with only
                // the domain, not the full JID that we had in our previous
                // (now failed) session.
                await setUserJID(_converse.settings.jid);
            }
            if (_converse.connection.reconnecting) {
                debouncedReconnect();
            } else {
                return reconnect();
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
            await Promise.all(events.map(e => e.callback.call(e.ctx, args)));
        } else {
            _converse.trigger.apply(_converse, arguments);
        }
        const promise = _converse.promises[name];
        if (promise !== undefined) {
            promise.resolve();
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
            if (_converse.api.connection.isType('bosh')) {
                if (await _converse.restoreBOSHSession()) {
                    return;
                } else if (_converse.authentication === _converse.PREBIND && (!automatic || _converse.auto_login)) {
                    return _converse.startNewPreboundBOSHSession();
                }
            } else if (_converse.authentication === _converse.PREBIND) {
                throw new Error("authentication is set to 'prebind' but we don't have a BOSH connection");
            }

            if (jid || _converse.jid) {
                // Reassign because we might have gained a resource
                jid = await setUserJID(jid || _converse.jid);
            }
            password = password || _converse.password;
            const credentials = (jid && password) ? { jid, password } : null;
            attemptNonPreboundSession(credentials, automatic);
        },

        /**
         * Logs the user out of the current XMPP session.
         * @method _converse.api.user.logout
         * @example _converse.api.user.logout();
         */
        logout () {
            _converse.setDisconnectionCause(_converse.LOGOUT, undefined, true);
            if (_converse.connection !== undefined) {
                _converse.connection.disconnect();
            }
            // Recreate all the promises
            Object.keys(_converse.promises).forEach(addPromise);
            /**
             * Triggered once the user has logged out.
             * @event _converse#logout
             */
            _converse.api.trigger('logout');
        },

        /**
         * Set and get the user's chat status, also called their *availability*.
         *
         * @namespace _converse.api.user.status
         * @memberOf _converse.api.user
         */
        status: {
            /** Return the current user's availability status.
             *
             * @method _converse.api.user.status.get
             * @example _converse.api.user.status.get();
             */
            get () {
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
            set (value, message) {
                const data = {'status': value};
                if (!_.includes(Object.keys(_converse.STATUS_WEIGHTS), value)) {
                    throw new Error(
                        'Invalid availability value. See https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.1'
                    );
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
            message: {
                /**
                 * @method _converse.api.user.status.message.get
                 * @returns {string} The status message
                 * @example const message = _converse.api.user.status.message.get()
                 */
                get () {
                    return _converse.xmppstatus.get('status_message');
                },
                /**
                 * @method _converse.api.user.status.message.set
                 * @param {string} status The status message
                 * @example _converse.api.user.status.message.set('In a meeting');
                 */
                set (status) {
                    _converse.xmppstatus.save({ status_message: status });
                }
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
            u.merge(_converse.default_settings, settings);
            u.merge(_converse, settings);
            u.applyUserSettings(_converse, settings, _converse.user_settings);
        },
        /**
         * @method _converse.api.settings.get
         * @returns {*} Value of the particular configuration setting.
         * @example _converse.api.settings.get("play_sounds");
         */
        get (key) {
            if (_.includes(Object.keys(_converse.default_settings), key)) {
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
        set (key, val) {
            const o = {};
            if (_.isObject(key)) {
                _.assignIn(_converse, _.pick(key, Object.keys(_converse.default_settings)));
            } else if (_.isString('string')) {
                o[key] = val;
                _.assignIn(_converse, _.pick(o, Object.keys(_converse.default_settings)));
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
     * * [statusInitialized](/docs/html/events.html#statusInitialized)
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
         * @example _converse.api.promises.add('foo-completed');
         */
        add (promises) {
            promises = Array.isArray(promises) ? promises : [promises];
            promises.forEach(addPromise);
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
        if (_.isFunction(condition)) {
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
        if (_.isString(stanza)) {
            stanza = u.toStanza(stanza);
        }
        if (stanza.tagName === 'iq') {
            return _converse.api.sendIQ(stanza);
        } else {
            _converse.connection.send(stanza);
            _converse.api.trigger('send', stanza);
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
        timeout = timeout || _converse.IQ_TIMEOUT;
        let promise;
        if (reject) {
            promise = new Promise((resolve, reject) => _converse.connection.sendIQ(stanza, resolve, reject, timeout));
        } else {
            promise = new Promise(resolve => _converse.connection.sendIQ(stanza, resolve, resolve, timeout));
        }
        _converse.api.trigger('send', stanza);
        return promise;
    }
};


window.converse = window.converse || {};

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
Object.assign(window.converse, {
    /**
     * Public API method which initializes Converse.
     * This method must always be called when using Converse.
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
    initialize (settings, callback) {
        return _converse.initialize(settings, callback);
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
     * @property {object} converse.env.Backbone    - The [Backbone](http://backbonejs.org) object used by Converse to create models and views.
     * @property {function} converse.env.Promise   - The Promise implementation used by Converse.
     * @property {function} converse.env.Strophe   - The [Strophe](http://strophe.im/strophejs) XMPP library used by Converse.
     * @property {object} converse.env._           - The instance of [lodash](http://lodash.com) used by Converse.
     * @property {function} converse.env.f         - And instance of Lodash with its methods wrapped to produce immutable auto-curried iteratee-first data-last methods.
     * @property {object} converse.env.dayjs       - [DayJS](https://github.com/iamkun/dayjs) date manipulation library.
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
        'dayjs': dayjs,
        'sizzle': sizzle,
        'utils': u
    }
});

/**
 * Once Converse.js has loaded, it'll dispatch a custom event with the name `converse-loaded`.
 * You can listen for this event in order to be informed as soon as converse.js has been
 * loaded and parsed, which would mean it's safe to call `converse.initialize`.
 * @event converse-loaded
 * @example window.addEventListener('converse-loaded', () => converse.initialize());
 */
window.dispatchEvent(new CustomEvent('converse-loaded'));
export default converse;
