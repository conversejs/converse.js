/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import URI from 'urijs';
import _converse from '@converse/headless/shared/_converse';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import dayjs from 'dayjs';
import i18n from '@converse/headless/shared/i18n';
import invoke from 'lodash-es/invoke';
import isFunction from 'lodash-es/isFunction';
import log from '@converse/headless/log.js';
import pluggable from 'pluggable.js/src/pluggable.js';
import { settings_api, user_settings_api } from '@converse/headless/shared/settings/api.js';
import sizzle from 'sizzle';
import u, { setUnloadEvent, replacePromise } from '@converse/headless/utils/core.js';
import { Collection } from "@converse/skeletor/src/collection";
import { Connection, MockConnection } from '@converse/headless/shared/connection.js';
import { Events } from '@converse/skeletor/src/events.js';
import { Model } from '@converse/skeletor/src/model.js';
import { Strophe, $build, $iq, $msg, $pres } from 'strophe.js/src/strophe';
import { TimeoutError } from '@converse/headless/shared/errors';
import { getOpenPromise } from '@converse/openpromise';
import { html } from 'lit';
import { initAppSettings, } from '@converse/headless/shared/settings/utils.js';
import { sprintf } from 'sprintf-js';

export { _converse };
export { i18n };

import {
    attemptNonPreboundSession,
    cleanup,
    initClientConfig,
    initPlugins,
    setUserJID,
    initSessionStorage,
    registerGlobalEventHandlers
} from './utils/init.js';

dayjs.extend(advancedFormat);

// Add Strophe Namespaces
Strophe.addNamespace('ACTIVITY', 'http://jabber.org/protocol/activity');
Strophe.addNamespace('CARBONS', 'urn:xmpp:carbons:2');
Strophe.addNamespace('CHATSTATES', 'http://jabber.org/protocol/chatstates');
Strophe.addNamespace('CSI', 'urn:xmpp:csi:0');
Strophe.addNamespace('DELAY', 'urn:xmpp:delay');
Strophe.addNamespace('EME', 'urn:xmpp:eme:0');
Strophe.addNamespace('FASTEN', 'urn:xmpp:fasten:0');
Strophe.addNamespace('FORWARD', 'urn:xmpp:forward:0');
Strophe.addNamespace('HINTS', 'urn:xmpp:hints');
Strophe.addNamespace('HTTPUPLOAD', 'urn:xmpp:http:upload:0');
Strophe.addNamespace('IDLE', 'urn:xmpp:idle:1');
Strophe.addNamespace('MAM', 'urn:xmpp:mam:2');
Strophe.addNamespace('MARKERS', 'urn:xmpp:chat-markers:0');
Strophe.addNamespace('MENTIONS', 'urn:xmpp:mmn:0');
Strophe.addNamespace('MESSAGE_CORRECT', 'urn:xmpp:message-correct:0');
Strophe.addNamespace('MODERATE', 'urn:xmpp:message-moderate:0');
Strophe.addNamespace('NICK', 'http://jabber.org/protocol/nick');
Strophe.addNamespace('OCCUPANTID', 'urn:xmpp:occupant-id:0');
Strophe.addNamespace('OMEMO', 'eu.siacs.conversations.axolotl');
Strophe.addNamespace('OUTOFBAND', 'jabber:x:oob');
Strophe.addNamespace('PUBSUB', 'http://jabber.org/protocol/pubsub');
Strophe.addNamespace('RAI', 'urn:xmpp:rai:0');
Strophe.addNamespace('RECEIPTS', 'urn:xmpp:receipts');
Strophe.addNamespace('REFERENCE', 'urn:xmpp:reference:0');
Strophe.addNamespace('REGISTER', 'jabber:iq:register');
Strophe.addNamespace('RETRACT', 'urn:xmpp:message-retract:0');
Strophe.addNamespace('ROSTERX', 'http://jabber.org/protocol/rosterx');
Strophe.addNamespace('RSM', 'http://jabber.org/protocol/rsm');
Strophe.addNamespace('SID', 'urn:xmpp:sid:0');
Strophe.addNamespace('SPOILER', 'urn:xmpp:spoiler:0');
Strophe.addNamespace('STANZAS', 'urn:ietf:params:xml:ns:xmpp-stanzas');
Strophe.addNamespace('STYLING', 'urn:xmpp:styling:0');
Strophe.addNamespace('VCARD', 'vcard-temp');
Strophe.addNamespace('VCARDUPDATE', 'vcard-temp:x:update');
Strophe.addNamespace('XFORM', 'jabber:x:data');
Strophe.addNamespace('XHTML', 'http://www.w3.org/1999/xhtml');

_converse.VERSION_NAME = "v9.0.0";

Object.assign(_converse, Events);

// Make converse pluggable
pluggable.enable(_converse, '_converse', 'pluggable');


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
        reconnect () {
            if (_converse.connection?.reconnecting) {
                return _converse.connection.debouncedReconnect();
            } else {
                return _converse.connection.reconnect();
            }
        },

        /**
         * Utility method to determine the type of connection we have
         * @method isType
         * @memberOf _converse.api.connection
         * @returns {boolean}
         */
        isType (type) {
            return _converse.connection.isType(type);
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
        if (!_converse._events) {
            return;
        }
        const args = Array.from(arguments);
        const options = args.pop();
        if (options && options.synchronous) {
            const events = _converse._events[name] || [];
            const event_args = args.splice(1);
            await Promise.all(events.map(e => e.callback.apply(e.ctx, event_args)));
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
     * @param {string} name - The hook name
     * @param {...any} context - The context to which the hook applies (could be for example, a {@link _converse.ChatBox)).
     * @param {...any} data - The data structure to be intercepted and modified by the hook listeners.
     * @returns {Promise<any>} - A promise that resolves with the modified data structure.
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
        settings: user_settings_api,

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
         *  @returns  {void}
         */
        async login (jid, password, automatic=false) {
            jid = jid || api.settings.get('jid');
            if (!_converse.connection?.jid || (jid && !u.isSameDomain(_converse.connection.jid, jid))) {
                await _converse.initConnection();
            }
            if (api.settings.get("connection_options")?.worker && (await _converse.connection.restoreWorkerSession())) {
                return;
            }
            if (jid) {
                jid = await setUserJID(jid);
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
        async logout () {
            /**
             * Triggered before the user is logged out
             * @event _converse#beforeLogout
             */
            await api.trigger('beforeLogout', {'synchronous': true});

            const promise = getOpenPromise();
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

            _converse.connection.setDisconnectionCause(_converse.LOGOUT, undefined, true);
            if (_converse.connection !== undefined) {
                api.listen.once('disconnected', () => complete());
                _converse.connection.disconnect();
            } else {
                complete();
            }
            return promise;
        }
    },

    settings: settings_api,


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
                const promise = getOpenPromise();
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
         * @method _converse.api.listen.once
         * @param {string} name The event's name
         * @param {function} callback The callback method to be called when the event is emitted.
         * @param {object} [context] The value of the `this` parameter for the callback.
         * @example _converse.api.listen.once('message', function (messageXML) { ... });
         */
        once: _converse.once.bind(_converse),

        /**
         * Lets you subscribe to an event.
         * Every time the event fires, the callback method specified by `callback` will be called.
         * @method _converse.api.listen.on
         * @param {string} name The event's name
         * @param {function} callback The callback method to be called when the event is emitted.
         * @param {object} [context] The value of the `this` parameter for the callback.
         * @example _converse.api.listen.on('message', function (messageXML) { ... });
         */
        on: _converse.on.bind(_converse),

        /**
         * To stop listening to an event, you can use the `not` method.
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
     * @param {XMLElement} stanza
     * @return {void}
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
        if (typeof stanza === 'string') {
            stanza = u.toStanza(stanza);
        } else if (stanza?.nodeTree) {
            stanza = stanza.nodeTree;
        }

        if (stanza.tagName === 'iq') {
            return api.sendIQ(stanza);
        } else {
            _converse.connection.send(stanza);
            api.trigger('send', stanza);
        }
    },

    /**
     * Send an IQ stanza
     * @method _converse.api.sendIQ
     * @param {XMLElement} stanza
     * @param {Integer} [timeout=_converse.STANZA_TIMEOUT]
     * @param {Boolean} [reject=true] - Whether an error IQ should cause the promise
     *  to be rejected. If `false`, the promise will resolve instead of being rejected.
     * @returns {Promise} A promise which resolves (or potentially rejected) once we
     *  receive a `result` or `error` stanza or once a timeout is reached.
     *  If the IQ stanza being sent is of type `result` or `error`, there's
     *  nothing to wait for, so an already resolved promise is returned.
     */
    sendIQ (stanza, timeout=_converse.STANZA_TIMEOUT, reject=true) {
        let promise;
        stanza = stanza?.nodeTree ?? stanza;
        if (['get', 'set'].includes(stanza.getAttribute('type'))) {
            timeout = timeout || _converse.STANZA_TIMEOUT;
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
        } else {
            _converse.connection.sendIQ(stanza);
            promise = Promise.resolve();
        }
        api.trigger('send', stanza);
        return promise;
    }
};


_converse.shouldClearCache = () => (
    !_converse.config.get('trusted') ||
    api.settings.get('clear_cache_on_logout') ||
    _converse.isTestEnv()
);


export function clearSession () {
    _converse.session?.destroy();
    delete _converse.session;
    _converse.shouldClearCache() && _converse.api.user.settings.clear();
    /**
     * Synchronouse event triggered once the user session has been cleared,
     * for example when the user has logged out or when Converse has
     * disconnected for some other reason.
     * @event _converse#clearSession
     */
    return _converse.api.trigger('clearSession', {'synchronous': true});
}


_converse.initConnection = function () {
    const api = _converse.api;

    if (! api.settings.get('bosh_service_url')) {
        if (api.settings.get("authentication") === _converse.PREBIND) {
            throw new Error("authentication is set to 'prebind' but we don't have a BOSH connection");
        }
    }

    let connection_url = '';
    const XMPPConnection = _converse.isTestEnv() ? MockConnection : Connection;
    if (('WebSocket' in window || 'MozWebSocket' in window) && api.settings.get("websocket_url")) {
        connection_url = api.settings.get('websocket_url');
    } else if (api.settings.get('bosh_service_url')) {
        connection_url = api.settings.get('bosh_service_url');
    }
    _converse.connection = new XMPPConnection(
        connection_url,
        Object.assign(
            _converse.default_connection_options,
            api.settings.get("connection_options"),
            {'keepalive': api.settings.get("keepalive")}
        )
    );

    setUpXMLLogging();
    /**
     * Triggered once the `Connection` constructor has been initialized, which
     * will be responsible for managing the connection to the XMPP server.
     *
     * @event _converse#connectionInitialized
     */
    api.trigger('connectionInitialized');
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

_converse.ConnectionFeedback = Model.extend({
    defaults: {
        'connection_status': Strophe.Status.DISCONNECTED,
        'message': ''
    },
    initialize () {
        this.on('change', () => api.trigger('connfeedback', _converse.connfeedback));
    }
});


export const converse = window.converse || {};


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
        await cleanup(_converse);

        setUnloadEvent();
        initAppSettings(settings);
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
        _converse.connfeedback = new _converse.ConnectionFeedback();

        /* When reloading the page:
         * For new sessions, we need to send out a presence stanza to notify
         * the server/network that we're online.
         * When re-attaching to an existing session we don't need to again send out a presence stanza,
         * because it's as if "we never left" (see onConnectStatusChanged).
         * https://github.com/conversejs/converse.js/issues/521
         */
        _converse.send_initial_presence = true;

        await initSessionStorage(_converse);
        await initClientConfig(_converse);
        await i18n.initialize();
        initPlugins(_converse);

        // Register all custom elements
        // XXX: api.elements is defined in the UI part of Converse, outside of @converse/headless.
        // This line should probably be moved to the UI code as part of a larger refactoring.
        api.elements?.register();

        registerGlobalEventHandlers(_converse);

        try {
            !History.started && _converse.router.history.start();
        } catch (e) {
            log.error(e);
        }

        if (api.settings.get("idle_presence_timeout") > 0) {
            api.listen.on('addClientFeatures', () => api.disco.own.features.add(Strophe.NS.IDLE));
        }

        const plugins = _converse.pluggable.plugins
        if (api.settings.get("auto_login") || api.settings.get("keepalive") && invoke(plugins['converse-bosh'], 'enabled')) {
            await api.user.login(null, null, true);
        }

        /**
         * Triggered once converse.initialize has finished.
         * @event _converse#initialized
         */
        api.trigger('initialized');

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
     * @typedef ConverseEnv
     * @property {function} converse.env.$build    - Creates a Strophe.Builder, for creating stanza objects.
     * @property {function} converse.env.$iq       - Creates a Strophe.Builder with an <iq/> element as the root.
     * @property {function} converse.env.$msg      - Creates a Strophe.Builder with an <message/> element as the root.
     * @property {function} converse.env.$pres     - Creates a Strophe.Builder with an <presence/> element as the root.
     * @property {function} converse.env.Promise   - The Promise implementation used by Converse.
     * @property {function} converse.env.Strophe   - The [Strophe](http://strophe.im/strophejs) XMPP library used by Converse.
     * @property {function} converse.env.f         - And instance of Lodash with its methods wrapped to produce immutable auto-curried iteratee-first data-last methods.
     * @property {function} converse.env.sizzle    - [Sizzle](https://sizzlejs.com) CSS selector engine.
     * @property {function} converse.env.sprintf
     * @property {object} converse.env._           - The instance of [lodash-es](http://lodash.com) used by Converse.
     * @property {object} converse.env.dayjs       - [DayJS](https://github.com/iamkun/dayjs) date manipulation library.
     * @property {object} converse.env.utils       - Module containing common utility methods used by Converse.
     * @memberOf converse
     */
    'env': {
        $build,
        $iq,
        $msg,
        $pres,
        'utils': u,
        Collection,
        Model,
        Promise,
        Strophe,
        URI,
        dayjs,
        html,
        log,
        sizzle,
        sprintf,
        u,
    }
});
