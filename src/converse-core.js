// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define, window, document, JSON */
(function (root, factory) {
    define(["sizzle",
            "es6-promise",
            "lodash.noconflict",
            "polyfill",
            "utils",
            "moment_with_locales",
            "strophe",
            "pluggable",
            "backbone.noconflict",
            "backbone.browserStorage",
            "backbone.overview",
    ], factory);
}(this, function (
        sizzle, Promise, _, polyfill,
        utils, moment, Strophe, pluggable, Backbone) {

    /* Cannot use this due to Safari bug.
     * See https://github.com/jcbrand/converse.js/issues/196
     */
    // "use strict";

    // Strophe globals
    const { $build, $iq, $msg, $pres } = Strophe;
    const b64_sha1 = Strophe.SHA1.b64_sha1;
    Strophe = Strophe.Strophe;

    // Use Mustache style syntax for variable interpolation
    /* Configuration of Lodash templates (this config is distinct to the
     * config of requirejs-tpl in main.js). This one is for normal inline templates.
     */
    _.templateSettings = {
        'escape': /\{\{\{([\s\S]+?)\}\}\}/g,
        'evaluate': /\{\[([\s\S]+?)\]\}/g,
        'interpolate': /\{\{([\s\S]+?)\}\}/g
    };

    const _converse = {
        'templates': {},
        'promises': {}
    }

    _.extend(_converse, Backbone.Events);

    _converse.core_plugins = [
        'converse-bookmarks',
        'converse-chatboxes',
        'converse-chatview',
        'converse-controlbox',
        'converse-core',
        'converse-disco',
        'converse-dragresize',
        'converse-headline',
        'converse-mam',
        'converse-minimize',
        'converse-muc',
        'converse-notification',
        'converse-otr',
        'converse-ping',
        'converse-register',
        'converse-roomslist',
        'converse-rosterview',
        'converse-vcard'
    ];

    // Make converse pluggable
    pluggable.enable(_converse, '_converse', 'pluggable');

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

    const PRETTY_CONNECTION_STATUS = {
        0: 'ERROR',
        1: 'CONNECTING',
        2: 'CONNFAIL',
        3: 'AUTHENTICATING',
        4: 'AUTHFAIL',
        5: 'CONNECTED',
        6: 'DISCONNECTED',
        7: 'DISCONNECTING',
        8: 'ATTACHED',
        9: 'REDIRECT'
    };

    _converse.DEFAULT_IMAGE_TYPE = 'image/png';
    _converse.DEFAULT_IMAGE = "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH3gwHCy455JBsggAABkJJREFUeNrtnM1PE1sUwHvvTD8otWLHST/Gimi1CEgr6M6FEWuIBo2pujDVsNDEP8GN/4MbN7oxrlipG2OCgZgYlxAbkRYw1KqkIDRCSkM7nXvvW8x7vjyNeQ9m7p1p3z1LQk/v/Dhz7vkEXL161cHl9wI5Ag6IA+KAOCAOiAPigDggLhwQB2S+iNZ+PcYY/SWEEP2HAAAIoSAIoihCCP+ngDDGtVotGAz29/cfOXJEUZSOjg6n06lp2sbGRqlUWlhYyGazS0tLbrdbEASrzgksyeYJId3d3el0uqenRxRFAAAA4KdfIIRgjD9+/Pj8+fOpqSndslofEIQwHA6Pjo4mEon//qmFhYXHjx8vLi4ihBgDEnp7e9l8E0Jo165dQ0NDd+/eDYVC2/qsJElDQ0OEkKWlpa2tLZamxAhQo9EIBoOjo6MXL17csZLe3l5FUT59+lQul5l5JRaAVFWNRqN37tw5ceKEQVWRSOTw4cOFQuHbt2+iKLYCIISQLMu3b99OJpOmKAwEAgcPHszn8+vr6wzsiG6UQQhxuVyXLl0aGBgwUW0sFstkMl6v90fo1KyAMMYDAwPnzp0zXfPg4GAqlWo0Gk0MiBAiy/L58+edTqf5Aa4onj59OhaLYYybFRCEMBaL0fNxBw4cSCQStN0QRUBut3t4eJjq6U+dOiVJElVPRBFQIBDo6+ujCqirqyscDlONGykC2lYyYSR6pBoQQapHZwAoHo/TuARYAOrs7GQASFEUqn6aIiBJkhgA6ujooFpUo6iaTa7koFwnaoWadLNe81tbWwzoaJrWrICWl5cZAFpbW6OabVAEtLi4yABQsVjUNK0pAWWzWQaAcrlcswKanZ1VVZUqHYRQEwOq1Wpv3ryhCmh6erpcLjdrNl+v1ycnJ+l5UELI27dvv3//3qxxEADgy5cvExMT9Mznw4cPtFtAdAPFarU6Pj5eKpVM17yxsfHy5cvV1VXazXu62gVBKBQKT58+rdVqJqrFGL948eLdu3dU8/g/H4FBUaJYLAqC0NPTY9brMD4+PjY25mDSracOCABACJmZmXE6nUePHjWu8NWrV48ePSKEsGlAs7Agfd5nenq6Wq0mk0kjDzY2NvbkyRMIIbP2PLvhBUEQ8vl8NpuNx+M+n29bzhVjvLKycv/+/YmJCcazQuwA6YzW1tYmJyf1SY+2trZ/rRk1Go1SqfT69esHDx4UCgVmNaa/zZ/9ABUhRFXVYDB48uTJeDweiUQkSfL7/T9MA2NcqVTK5fLy8vL8/PzU1FSxWHS5XJaM4wGr9sUwxqqqer3eUCgkSZJuUBBCfTRvc3OzXC6vrKxUKhWn02nhCJ5lM4oQQo/HgxD6+vXr58+fHf8sDOp+HQDg8XgclorFU676dKLlo6yWRdItIBwQB8QBcUCtfosRQjRNQwhhjPUC4w46WXryBSHU1zgEQWBz99EFhDGu1+t+v//48ePxeFxRlD179ng8nh0Efgiher2+vr6ur3HMzMysrq7uTJVdACGEurq6Ll++nEgkPB7Pj9jPoDHqOxyqqubz+WfPnuVyuV9XPeyeagAAAoHArVu3BgcHab8CuVzu4cOHpVKJUnfA5GweY+xyuc6cOXPv3r1IJMLAR8iyPDw8XK/Xi8Wiqqqmm5KZgBBC7e3tN27cuHbtGuPVpf7+/lAoNDs7W61WzfVKpgHSSzw3b95MpVKW3MfRaDQSiczNzVUqFRMZmQOIEOL1eq9fv3727FlL1t50URRFluX5+flqtWpWEGAOIFEUU6nUlStXLKSjy759+xwOx9zcnKZpphzGHMzhcDiTydgk9r1w4YIp7RPTAAmCkMlk2FeLf/tIEKbTab/fbwtAhJBoNGrutpNx6e7uPnTokC1eMU3T0um0DZPMkZER6wERQnw+n/FFSxpy7Nix3bt3WwwIIcRgIWnHkkwmjecfRgGx7DtuV/r6+iwGhDHev3+/bQF1dnYaH6E2CkiWZdsC2rt3r8WAHA5HW1ubbQGZcjajgOwTH/4qNko1Wlg4IA6IA+KAOKBWBUQIsfNojyliKIoRRfH9+/dut9umf3wzpoUNNQ4BAJubmwz+ic+OxefzWWlBhJD29nbug7iT5sIBcUAcEAfEAXFAHBAHxOVn+QMrmWpuPZx12gAAAABJRU5ErkJggg==";

    _converse.log = function (message, level) {
        if (message instanceof Error) {
            message = message.stack;
        }
        const logger = _.assign({
                'debug': _.get(console, 'log') ? console.log.bind(console) : _.noop,
                'error': _.get(console, 'log') ? console.log.bind(console) : _.noop,
                'info': _.get(console, 'log') ? console.log.bind(console) : _.noop,
                'warn': _.get(console, 'log') ? console.log.bind(console) : _.noop
            }, console);
        if (level === Strophe.LogLevel.ERROR) {
            if (_converse.debug) {
                logger.trace(`ERROR: ${message}`);
            } else {
                logger.error(`ERROR: ${message}`);
            }
        } else if (level === Strophe.LogLevel.WARN) {
            logger.warn(`WARNING: ${message}`);
        } else if (level === Strophe.LogLevel.FATAL) {
            if (_converse.debug) {
                logger.trace(`FATAL: ${message}`);
            } else {
                logger.error(`FATAL: ${message}`);
            }
        } else if (_converse.debug) {
            if (level === Strophe.LogLevel.DEBUG) {
                logger.debug(`DEBUG: ${message}`);
            } else {
                logger.info(`INFO: ${message}`);
            }
        }
    };

    const PROMISES = [
        'initialized',
        'cachedRoster',
        'connectionInitialized',
        'pluginsInitialized',
        'roster',
        'rosterContactsFetched',
        'rosterGroupsFetched',
        'rosterInitialized',
        'statusInitialized'
    ];

    function addPromise (promise) {
        /* Private function, used to add a new promise to the ones already
         * available via the `waitUntil` api method.
         */
        _converse.promises[promise] = utils.getWrappedPromise();
    }

    _converse.emit = function (name) {
        /* Event emitter and promise resolver */
        _converse.trigger.apply(this, arguments);
        const promise = _converse.promises[name];
        if (!_.isUndefined(promise)) {
            promise.resolve();
        }
    };

    _converse.initialize = function (settings, callback) {
        "use strict";
        settings = !_.isUndefined(settings) ? settings : {};
        const init_promise = utils.getWrappedPromise();

        _.each(PROMISES, addPromise);

        if (!_.isUndefined(_converse.connection)) {
            // Looks like _converse.initialized was called again without logging
            // out or disconnecting in the previous session.
            // This happens in tests. We therefore first clean up.
            delete _converse.controlboxtoggle;
            _converse.connection.reset();
            _converse.off();
            _converse.stopListening();
            _converse._tearDown();
        }

        let unloadevent;
        if ('onpagehide' in window) {
            // Pagehide gets thrown in more cases than unload. Specifically it
            // gets thrown when the page is cached and not just
            // closed/destroyed. It's the only viable event on mobile Safari.
            // https://www.webkit.org/blog/516/webkit-page-cache-ii-the-unload-event/
            unloadevent = 'pagehide';
        } else if ('onbeforeunload' in window) {
            unloadevent = 'beforeunload';
        } else if ('onunload' in window) {
            unloadevent = 'unload';
        }

        // Logging
        Strophe.log = function (level, msg) { _converse.log(level+' '+msg, level); };
        Strophe.error = function (msg) { _converse.log(msg, Strophe.LogLevel.ERROR); };

        // Add Strophe Namespaces
        Strophe.addNamespace('CARBONS', 'urn:xmpp:carbons:2');
        Strophe.addNamespace('CHATSTATES', 'http://jabber.org/protocol/chatstates');
        Strophe.addNamespace('CSI', 'urn:xmpp:csi:0');
        Strophe.addNamespace('DELAY', 'urn:xmpp:delay');
        Strophe.addNamespace('HINTS', 'urn:xmpp:hints');
        Strophe.addNamespace('MAM', 'urn:xmpp:mam:2');
        Strophe.addNamespace('NICK', 'http://jabber.org/protocol/nick');
        Strophe.addNamespace('PUBSUB', 'http://jabber.org/protocol/pubsub');
        Strophe.addNamespace('ROSTERX', 'http://jabber.org/protocol/rosterx');
        Strophe.addNamespace('RSM', 'http://jabber.org/protocol/rsm');
        Strophe.addNamespace('XFORM', 'jabber:x:data');

        // Instance level constants
        this.TIMEOUTS = { // Set as module attr so that we can override in tests.
            'PAUSED':     10000,
            'INACTIVE':   90000
        };

        // Internationalization
        this.locale = utils.getLocale(settings.i18n, utils.isConverseLocale);
        if (!moment.locale) {
            //moment.lang is deprecated after 2.8.1, use moment.locale instead
            moment.locale = moment.lang;
        }
        moment.locale(utils.getLocale(settings.i18n, utils.isMomentLocale));
        const __ = _converse.__ = utils.__.bind(_converse);
        _converse.___ = utils.___;

        // XEP-0085 Chat states
        // http://xmpp.org/extensions/xep-0085.html
        this.INACTIVE = 'inactive';
        this.ACTIVE = 'active';
        this.COMPOSING = 'composing';
        this.PAUSED = 'paused';
        this.GONE = 'gone';

        // Default configuration values
        // ----------------------------
        this.default_settings = {
            allow_contact_requests: true,
            allow_non_roster_messaging: false,
            animate: true,
            authentication: 'login', // Available values are "login", "prebind", "anonymous" and "external".
            auto_away: 0, // Seconds after which user status is set to 'away'
            auto_login: false, // Currently only used in connection with anonymous login
            auto_reconnect: false,
            auto_subscribe: false,
            auto_xa: 0, // Seconds after which user status is set to 'xa'
            blacklisted_plugins: [],
            bosh_service_url: undefined,
            connection_options: {},
            credentials_url: null, // URL from where login credentials can be fetched
            csi_waiting_time: 0, // Support for XEP-0352. Seconds before client is considered idle and CSI is sent out.
            debug: false,
            default_state: 'online',
            expose_rid_and_sid: false,
            filter_by_resource: false,
            forward_messages: false,
            hide_offline_users: false,
            include_offline_state: false,
            jid: undefined,
            keepalive: true,
            message_carbons: true,
            message_storage: 'session',
            password: undefined,
            prebind_url: null,
            priority: 0,
            registration_domain: '',
            rid: undefined,
            roster_groups: true,
            show_only_online_users: false,
            show_send_button: false,
            sid: undefined,
            storage: 'session',
            strict_plugin_dependencies: false,
            synchronize_availability: true,
            websocket_url: undefined,
            whitelisted_plugins: [],
            xhr_custom_status: false,
            xhr_custom_status_url: '',
        };
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

        this.generateResource = () => `/converse.js-${Math.floor(Math.random()*139749825).toString()}`;

        this.sendCSI = function (stat) {
            /* Send out a Chat Status Notification (XEP-0352)
             *
             * Parameters:
             *  (String) stat: The user's chat status
             */
            /* Send out a Chat Status Notification (XEP-0352) */
            // XXX if (converse.features[Strophe.NS.CSI] || true) {
            _converse.connection.send($build(stat, {xmlns: Strophe.NS.CSI}));
            _converse.inactive = (stat === _converse.INACTIVE) ? true : false;
        };

        this.onUserActivity = function () {
            /* Resets counters and flags relating to CSI and auto_away/auto_xa */
            if (_converse.idle_seconds > 0) {
                _converse.idle_seconds = 0;
            }
            if (!_converse.connection.authenticated) {
                // We can't send out any stanzas when there's no authenticated connection.
                // converse can happen when the connection reconnects.
                return;
            }
            if (_converse.inactive) {
                _converse.sendCSI(_converse.ACTIVE);
            }
            if (_converse.auto_changed_status === true) {
                _converse.auto_changed_status = false;
                // XXX: we should really remember the original state here, and
                // then set it back to that...
                _converse.xmppstatus.setStatus(_converse.default_state);
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
            const stat = _converse.xmppstatus.getStatus();
            _converse.idle_seconds++;
            if (_converse.csi_waiting_time > 0 &&
                    _converse.idle_seconds > _converse.csi_waiting_time &&
                    !_converse.inactive) {
                _converse.sendCSI(_converse.INACTIVE);
            }
            if (_converse.auto_away > 0 &&
                    _converse.idle_seconds > _converse.auto_away &&
                    stat !== 'away' && stat !== 'xa' && stat !== 'dnd') {
                _converse.auto_changed_status = true;
                _converse.xmppstatus.setStatus('away');
            } else if (_converse.auto_xa > 0 &&
                    _converse.idle_seconds > _converse.auto_xa &&
                    stat !== 'xa' && stat !== 'dnd') {
                _converse.auto_changed_status = true;
                _converse.xmppstatus.setStatus('xa');
            }
        };

        this.registerIntervalHandler = function () {
            /* Set an interval of one second and register a handler for it.
             * Required for the auto_away, auto_xa and csi_waiting_time features.
             */
            if (_converse.auto_away < 1 && _converse.auto_xa < 1 && _converse.csi_waiting_time < 1) {
                // Waiting time of less then one second means features aren't used.
                return;
            }
            _converse.idle_seconds = 0;
            _converse.auto_changed_status = false; // Was the user's status changed by _converse.js?
            window.addEventListener('click', _converse.onUserActivity);
            window.addEventListener('focus', _converse.onUserActivity);
            window.addEventListener('keypress', _converse.onUserActivity);
            window.addEventListener('mousemove', _converse.onUserActivity);
            window.addEventListener(unloadevent, _converse.onUserActivity);
            _converse.everySecondTrigger = window.setInterval(_converse.onEverySecond, 1000);
        };

        this.giveFeedback = function (subject, klass, message) {
            _.forEach(document.querySelectorAll('.conn-feedback'), (el) => {
                el.classList.add('conn-feedback');
                el.textContent = subject;
                if (klass) {
                    el.classList.add(klass);
                } else {
                    el.classList.remove('error');
                }
            });
            _converse.emit('feedback', {
                'klass': klass,
                'message': message,
                'subject': subject
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
            _converse.connection.send(pres);
        };

        this.reconnect = _.debounce(function () {
            _converse.log('RECONNECTING');
            _converse.log('The connection has dropped, attempting to reconnect.');
            _converse.giveFeedback(
                __("Reconnecting"),
                'warn',
                __('The connection has dropped, attempting to reconnect.')
            );
            _converse.connection.reconnecting = true;
            _converse._tearDown();
            _converse.logIn(null, true);
        }, 3000, {'leading': true});

        this.disconnect = function () {
            _converse.log('DISCONNECTED');
            delete _converse.connection.reconnecting;
            _converse.connection.reset();
            _converse._tearDown();
            _converse.emit('disconnected');
        };

        this.onDisconnected = function () {
            /* Gets called once strophe's status reaches Strophe.Status.DISCONNECTED.
             * Will either start a teardown process for converse.js or attempt
             * to reconnect.
             */
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
                    _converse.disconnection_reason === "host-unknown" ||
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

        this.onConnectStatusChanged = function (status, condition) {
            /* Callback method called by Strophe as the Strophe.Connection goes
             * through various states while establishing or tearing down a
             * connection.
             */
            _converse.log(`Status changed to: ${PRETTY_CONNECTION_STATUS[status]}`);
            if (status === Strophe.Status.CONNECTED || status === Strophe.Status.ATTACHED) {
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
                _converse.setDisconnectionCause(status, condition);
                _converse.onDisconnected();
            } else if (status === Strophe.Status.ERROR) {
                _converse.giveFeedback(
                    __('Connection error'), 'error',
                    __('An error occurred while connecting to the chat server.')
                );
            } else if (status === Strophe.Status.CONNECTING) {
                _converse.giveFeedback(__('Connecting'));
            } else if (status === Strophe.Status.AUTHENTICATING) {
                _converse.giveFeedback(__('Authenticating'));
            } else if (status === Strophe.Status.AUTHFAIL) {
                _converse.giveFeedback(__('Authentication Failed'), 'error');
                _converse.setDisconnectionCause(status, condition, true);
                _converse.onDisconnected();
            } else if (status === Strophe.Status.CONNFAIL) {
                _converse.giveFeedback(
                    __('Connection failed'), 'error',
                    __('An error occurred while connecting to the chat server: '+condition)
                );
                _converse.setDisconnectionCause(status, condition);
            } else if (status === Strophe.Status.DISCONNECTING) {
                _converse.setDisconnectionCause(status, condition);
            }
        };

        this.incrementMsgCounter = function () {
            this.msg_counter += 1;
            const unreadMsgCount = this.msg_counter;
            if (document.title.search(/^Messages \(\d+\) /) === -1) {
                document.title = `Messages (${unreadMsgCount}) ${document.title}`;
            } else {
                document.title = document.title.replace(
                    /^Messages \(\d+\) /, `Messages (${unreadMsgCount}) `
                );
            }
        };

        this.clearMsgCounter = function () {
            this.msg_counter = 0;
            if (document.title.search(/^Messages \(\d+\) /) !== -1) {
                document.title = document.title.replace(/^Messages \(\d+\) /, "");
            }
        };

        this.initStatus = () => 
            new Promise((resolve, reject) => {
                const promise = new utils.getWrappedPromise();
                this.xmppstatus = new this.XMPPStatus();
                const id = b64_sha1(`converse.xmppstatus-${_converse.bare_jid}`);
                this.xmppstatus.id = id; // Appears to be necessary for backbone.browserStorage
                this.xmppstatus.browserStorage = new Backbone.BrowserStorage[_converse.storage](id);
                this.xmppstatus.fetch({
                    success: resolve,
                    error: resolve
                });
                _converse.emit('statusInitialized');
            });

        this.initSession = function () {
            _converse.session = new Backbone.Model();
            const id = b64_sha1('converse.bosh-session');
            _converse.session.id = id; // Appears to be necessary for backbone.browserStorage
            _converse.session.browserStorage = new Backbone.BrowserStorage[_converse.storage](id);
            _converse.session.fetch();
        };

        this.clearSession = function () {
            if (!_.isUndefined(this.roster)) {
                this.roster.browserStorage._clear();
            }
            if (!_.isUndefined(this.session) && this.session.browserStorage) {
                this.session.browserStorage._clear();
            }
        };

        this.logOut = function () {
            _converse.clearSession();
            _converse.setDisconnectionCause(_converse.LOGOUT, undefined, true);
            if (!_.isUndefined(_converse.connection)) {
                _converse.connection.disconnect();
            } else {
                _converse._tearDown();
            }
            _converse.emit('logout');
        };

        this.saveWindowState = function (ev, hidden) {
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
                state = document[hidden] ? "hidden" : "visible";
            }
            if (state  === 'visible') {
                _converse.clearMsgCounter();
            }
            _converse.windowState = state;
            _converse.emit('windowStateChanged', {state});
        };

        this.registerGlobalEventHandlers = function () {
            // Taken from:
            // http://stackoverflow.com/questions/1060008/is-there-a-way-to-detect-if-a-browser-window-is-not-currently-active
            let hidden = "hidden";
            // Standards:
            if (hidden in document) {
                document.addEventListener("visibilitychange", _.partial(_converse.saveWindowState, _, hidden));
            } else if ((hidden = "mozHidden") in document) {
                document.addEventListener("mozvisibilitychange", _.partial(_converse.saveWindowState, _, hidden));
            } else if ((hidden = "webkitHidden") in document) {
                document.addEventListener("webkitvisibilitychange", _.partial(_converse.saveWindowState, _, hidden));
            } else if ((hidden = "msHidden") in document) {
                document.addEventListener("msvisibilitychange", _.partial(_converse.saveWindowState, _, hidden));
            } else if ("onfocusin" in document) {
                // IE 9 and lower:
                document.onfocusin = document.onfocusout = _.partial(_converse.saveWindowState, _, hidden);
            } else {
                // All others:
                window.onpageshow = window.onpagehide = window.onfocus = window.onblur = _.partial(_converse.saveWindowState, _, hidden);
            }
            // set the initial state (but only if browser supports the Page Visibility API)
            if( document[hidden] !== undefined ) {
                _.partial(_converse.saveWindowState, _, hidden)({type: document[hidden] ? "blur" : "focus"});
            }
        };

        this.enableCarbons = function () {
            /* Ask the XMPP server to enable Message Carbons
             * See XEP-0280 https://xmpp.org/extensions/xep-0280.html#enabling
             */
            if (!this.message_carbons || this.session.get('carbons_enabled')) {
                return;
            }
            const carbons_iq = new Strophe.Builder('iq', {
                from: this.connection.jid,
                id: 'enablecarbons',
                type: 'set'
              })
              .c('enable', {xmlns: Strophe.NS.CARBONS});
            this.connection.addHandler((iq) => {
                if (iq.querySelectorAll('error').length > 0) {
                    _converse.log(
                        'An error occured while trying to enable message carbons.',
                        Strophe.LogLevel.ERROR);
                } else {
                    this.session.save({carbons_enabled: true});
                    _converse.log('Message carbons have been enabled.');
                }
            }, null, "iq", null, "enablecarbons");
            this.connection.send(carbons_iq);
        };

        this.initRoster = function () {
            /* Initialize the Bakcbone collections that represent the contats
             * roster and the roster groups.
             */
            _converse.roster = new _converse.RosterContacts();
            _converse.roster.browserStorage = new Backbone.BrowserStorage.session(
                b64_sha1(`converse.contacts-${_converse.bare_jid}`));
            _converse.rostergroups = new _converse.RosterGroups();
            _converse.rostergroups.browserStorage = new Backbone.BrowserStorage.session(
                b64_sha1(`converse.roster.groups${_converse.bare_jid}`));
            _converse.emit('rosterInitialized');
        };

        this.populateRoster = function () {
            /* Fetch all the roster groups, and then the roster contacts.
             * Emit an event after fetching is done in each case.
             */
            _converse.rostergroups.fetchRosterGroups().then(function () {
                _converse.emit('rosterGroupsFetched');
                _converse.roster.fetchRosterContacts().then(function () {
                    _converse.emit('rosterContactsFetched');
                    _converse.sendInitialPresence();
                });
            });
        };

        this.unregisterPresenceHandler = function () {
            if (!_.isUndefined(_converse.presence_ref)) {
                _converse.connection.deleteHandler(_converse.presence_ref);
                delete _converse.presence_ref;
            }
        };

        this.registerPresenceHandler = function () {
            _converse.unregisterPresenceHandler();
            _converse.presence_ref = _converse.connection.addHandler(
                function (presence) {
                    _converse.roster.presenceHandler(presence);
                    return true;
                }, null, 'presence', null);
        };


        this.sendInitialPresence = function () {
            if (_converse.send_initial_presence) {
                _converse.xmppstatus.sendPresence();
            }
        };

        this.onStatusInitialized = function (reconnecting) {
            /* Continue with session establishment (e.g. fetching chat boxes,
             * populating the roster etc.) necessary once the connection has
             * been established.
             */
            if (reconnecting) {
                // No need to recreate the roster, otherwise we lose our
                // cached data. However we still emit an event, to give
                // event handlers a chance to register views for the
                // roster and its groups, before we start populating.
                _converse.emit('rosterReadyAfterReconnection');
            } else {
                _converse.registerIntervalHandler();
                _converse.initRoster();
            }
            _converse.roster.onConnected();
            _converse.populateRoster();
            _converse.registerPresenceHandler();
            _converse.giveFeedback(__('Contacts'));
            if (reconnecting) {
                _converse.xmppstatus.sendPresence();
            } else {
                init_promise.resolve();
                _converse.emit('initialized');
            }
        };

        this.setUserJid = function () {
            _converse.jid = _converse.connection.jid;
            _converse.bare_jid = Strophe.getBareJidFromJid(_converse.connection.jid);
            _converse.resource = Strophe.getResourceFromJid(_converse.connection.jid);
            _converse.domain = Strophe.getDomainFromJid(_converse.connection.jid);
        };

        this.onConnected = function (reconnecting) {
            /* Called as soon as a new connection has been established, either
             * by logging in or by attaching to an existing BOSH session.
             */
            // Solves problem of returned PubSub BOSH response not received
            // by browser.
            _converse.connection.flush();

            _converse.setUserJid();
            _converse.initSession();
            _converse.enableCarbons();

            // If there's no xmppstatus obj, then we were never connected to
            // begin with, so we set reconnecting to false.
            reconnecting = _.isUndefined(_converse.xmppstatus) ? false : reconnecting;
            if (reconnecting) {
                _converse.onStatusInitialized(true);
                _converse.emit('reconnected');
            } else {
                _converse.initStatus()
                    .then(
                        _.partial(_converse.onStatusInitialized, false),
                        _.partial(_converse.onStatusInitialized, false))
                    .catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                _converse.emit('connected');
            }
        };

        this.RosterContact = Backbone.Model.extend({

            defaults: {
                'bookmarked': false,
                'chat_state': undefined,
                'chat_status': 'offline',
                'groups': [],
                'image': _converse.DEFAULT_IMAGE,
                'image_type': _converse.DEFAULT_IMAGE_TYPE,
                'num_unread': 0,
                'status': '',
            },

            initialize (attributes) {
                const { jid } = attributes;
                const bare_jid = Strophe.getBareJidFromJid(jid).toLowerCase();
                const resource = Strophe.getResourceFromJid(jid);
                attributes.jid = bare_jid;
                this.set(_.assignIn({
                    'id': bare_jid,
                    'jid': bare_jid,
                    'fullname': bare_jid,
                    'user_id': Strophe.getNodeFromJid(jid),
                    'resources': resource ? {resource :0} : {},
                }, attributes));

                this.on('destroy', () => { this.removeFromRoster(); });
                this.on('change:chat_status', function (item) {
                    _converse.emit('contactStatusChanged', item.attributes);
                });
            },

            subscribe (message) {
                /* Send a presence subscription request to this roster contact
                 *
                 * Parameters:
                 *    (String) message - An optional message to explain the
                 *      reason for the subscription request.
                 */
                this.save('ask', "subscribe"); // ask === 'subscribe' Means we have ask to subscribe to them.
                const pres = $pres({to: this.get('jid'), type: "subscribe"});
                if (message && message !== "") {
                    pres.c("status").t(message).up();
                }
                const nick = _converse.xmppstatus.get('fullname');
                if (nick && nick !== "") {
                    pres.c('nick', {'xmlns': Strophe.NS.NICK}).t(nick).up();
                }
                _converse.connection.send(pres);
                return this;
            },

            ackSubscribe () {
                /* Upon receiving the presence stanza of type "subscribed",
                 * the user SHOULD acknowledge receipt of that subscription
                 * state notification by sending a presence stanza of type
                 * "subscribe" to the contact
                 */
                _converse.connection.send($pres({
                    'type': 'subscribe',
                    'to': this.get('jid')
                }));
            },

            ackUnsubscribe () {
                /* Upon receiving the presence stanza of type "unsubscribed",
                 * the user SHOULD acknowledge receipt of that subscription state
                 * notification by sending a presence stanza of type "unsubscribe"
                 * this step lets the user's server know that it MUST no longer
                 * send notification of the subscription state change to the user.
                 *  Parameters:
                 *    (String) jid - The Jabber ID of the user who is unsubscribing
                 */
                _converse.connection.send($pres({'type': 'unsubscribe', 'to': this.get('jid')}));
                this.destroy(); // Will cause removeFromRoster to be called.
            },

            unauthorize (message) {
                /* Unauthorize this contact's presence subscription
                 * Parameters:
                 *   (String) message - Optional message to send to the person being unauthorized
                 */
                _converse.rejectPresenceSubscription(this.get('jid'), message);
                return this;
            },

            authorize (message) {
                /* Authorize presence subscription
                 * Parameters:
                 *   (String) message - Optional message to send to the person being authorized
                 */
                const pres = $pres({to: this.get('jid'), type: "subscribed"});
                if (message && message !== "") {
                    pres.c("status").t(message);
                }
                _converse.connection.send(pres);
                return this;
            },

            addResource (presence) {
                /* Adds a new resource and it's associated attributes as taken
                 * from the passed in presence stanza.
                 *
                 * Also updates the contact's chat_status if the presence has
                 * higher priority (and is newer).
                 */
                const jid = presence.getAttribute('from'),
                    chat_status = _.propertyOf(presence.querySelector('show'))('textContent') || 'online',
                    resource = Strophe.getResourceFromJid(jid),
                    delay = presence.querySelector(
                        `delay[xmlns="${Strophe.NS.DELAY}"]`
                    ),
                    timestamp = _.isNull(delay) ? moment().format() : moment(delay.getAttribute('stamp')).format();

                let priority = _.propertyOf(presence.querySelector('priority'))('textContent') || 0;
                priority = _.isNaN(parseInt(priority, 10)) ? 0 : parseInt(priority, 10);

                const resources = _.isObject(this.get('resources')) ? this.get('resources') : {};
                resources[resource] = {
                    'priority': priority,
                    'status': chat_status,
                    'timestamp': timestamp
                };
                const changed = {'resources': resources};
                const hpr = this.getHighestPriorityResource();
                if (priority == hpr.priority && timestamp == hpr.timestamp) {
                    // Only set the chat status if this is the newest resource
                    // with the highest priority
                    changed.chat_status = chat_status;
                }
                this.save(changed);
                return resources;
            },

            removeResource (resource) {
                /* Remove the passed in resource from the contact's resources map.
                 *
                 * Also recomputes the chat_status given that there's one less
                 * resource.
                 */
                let resources = this.get('resources');
                if (!_.isObject(resources)) {
                    resources = {};
                } else {
                    delete resources[resource];
                }
                this.save({
                    'resources': resources,
                    'chat_status': _.propertyOf(
                        this.getHighestPriorityResource())('status') || 'offline'
                });
            },

            getHighestPriorityResource () {
                /* Return the resource with the highest priority.
                 *
                 * If multiple resources have the same priority, take the
                 * newest one.
                 */
                const resources = this.get('resources');
                if (_.isObject(resources) && _.size(resources)) {
                    const val = _.flow(
                            _.values,
                            _.partial(_.sortBy, _, ['priority', 'timestamp']),
                            _.reverse
                        )(resources)[0];
                    if (!_.isUndefined(val)) {
                        return val;
                    }
                }
            },

            removeFromRoster (callback) {
                /* Instruct the XMPP server to remove this contact from our roster
                 * Parameters:
                 *   (Function) callback
                 */
                const iq = $iq({type: 'set'})
                    .c('query', {xmlns: Strophe.NS.ROSTER})
                    .c('item', {jid: this.get('jid'), subscription: "remove"});
                _converse.connection.sendIQ(iq, callback, callback);
                return this;
            }
        });


        this.RosterContacts = Backbone.Collection.extend({
            model: _converse.RosterContact,

            comparator (contact1, contact2) {
                const status1 = contact1.get('chat_status') || 'offline';
                const status2 = contact2.get('chat_status') || 'offline';
                if (_converse.STATUS_WEIGHTS[status1] === _converse.STATUS_WEIGHTS[status2]) {
                    const name1 = contact1.get('fullname').toLowerCase();
                    const name2 = contact2.get('fullname').toLowerCase();
                    return name1 < name2 ? -1 : (name1 > name2? 1 : 0);
                } else  {
                    return _converse.STATUS_WEIGHTS[status1] < _converse.STATUS_WEIGHTS[status2] ? -1 : 1;
                }
            },

            onConnected () {
                /* Called as soon as the connection has been established
                 * (either after initial login, or after reconnection).
                 *
                 * Use the opportunity to register stanza handlers.
                 */
                this.registerRosterHandler();
                this.registerRosterXHandler();
            },

            registerRosterHandler () {
                /* Register a handler for roster IQ "set" stanzas, which update
                 * roster contacts.
                 */
                _converse.connection.addHandler(
                    _converse.roster.onRosterPush.bind(_converse.roster),
                    Strophe.NS.ROSTER, 'iq', "set"
                );
            },

            registerRosterXHandler () {
                /* Register a handler for RosterX message stanzas, which are
                 * used to suggest roster contacts to a user.
                 */
                let t = 0;
                _converse.connection.addHandler(
                    function (msg) {
                        window.setTimeout(
                            function () {
                                _converse.connection.flush();
                                _converse.roster.subscribeToSuggestedItems.bind(_converse.roster)(msg);
                            }, t);
                        t += msg.querySelectorAll('item').length*250;
                        return true;
                    },
                    Strophe.NS.ROSTERX, 'message', null
                );
            },

            fetchRosterContacts () {
                /* Fetches the roster contacts, first by trying the
                 * sessionStorage cache, and if that's empty, then by querying
                 * the XMPP server.
                 *
                 * Returns a promise which resolves once the contacts have been
                 * fetched.
                 */
                return new Promise((resolve, reject) => {
                    this.fetch({
                        add: true,
                        success (collection) {
                            if (collection.length === 0) {
                                /* We don't have any roster contacts stored in sessionStorage,
                                * so lets fetch the roster from the XMPP server. We pass in
                                * 'sendPresence' as callback method, because after initially
                                * fetching the roster we are ready to receive presence
                                * updates from our contacts.
                                */
                                _converse.send_initial_presence = true;
                                _converse.roster.fetchFromServer(resolve);
                            } else {
                                _converse.emit('cachedRoster', collection);
                                resolve();
                            }
                        }
                    });
                });
            },

            subscribeToSuggestedItems (msg) {
                _.each(msg.querySelectorAll('item'), function (item) {
                    if (item.getAttribute('action') === 'add') {
                        _converse.roster.addAndSubscribe(
                            item.getAttribute('jid'),
                            null,
                            _converse.xmppstatus.get('fullname')
                        );
                    }
                });
                return true;
            },

            isSelf (jid) {
                return utils.isSameBareJID(jid, _converse.connection.jid);
            },

            addAndSubscribe (jid, name, groups, message, attributes) {
                /* Add a roster contact and then once we have confirmation from
                 * the XMPP server we subscribe to that contact's presence updates.
                 *  Parameters:
                 *    (String) jid - The Jabber ID of the user being added and subscribed to.
                 *    (String) name - The name of that user
                 *    (Array of Strings) groups - Any roster groups the user might belong to
                 *    (String) message - An optional message to explain the
                 *      reason for the subscription request.
                 *    (Object) attributes - Any additional attributes to be stored on the user's model.
                 */
                const handler = (contact) => {
                    if (contact instanceof _converse.RosterContact) {
                        contact.subscribe(message);
                    }
                }
                this.addContact(jid, name, groups, attributes).then(handler, handler);
            },

            sendContactAddIQ (jid, name, groups, callback, errback) {
                /*  Send an IQ stanza to the XMPP server to add a new roster contact.
                 *
                 *  Parameters:
                 *    (String) jid - The Jabber ID of the user being added
                 *    (String) name - The name of that user
                 *    (Array of Strings) groups - Any roster groups the user might belong to
                 *    (Function) callback - A function to call once the IQ is returned
                 *    (Function) errback - A function to call if an error occured
                 */
                name = _.isEmpty(name)? jid: name;
                const iq = $iq({type: 'set'})
                    .c('query', {xmlns: Strophe.NS.ROSTER})
                    .c('item', { jid, name });
                _.each(groups, function (group) { iq.c('group').t(group).up(); });
                _converse.connection.sendIQ(iq, callback, errback);
            },

            addContact (jid, name, groups, attributes) {
                /* Adds a RosterContact instance to _converse.roster and
                 * registers the contact on the XMPP server.
                 * Returns a promise which is resolved once the XMPP server has
                 * responded.
                 *
                 *  Parameters:
                 *    (String) jid - The Jabber ID of the user being added and subscribed to.
                 *    (String) name - The name of that user
                 *    (Array of Strings) groups - Any roster groups the user might belong to
                 *    (Object) attributes - Any additional attributes to be stored on the user's model.
                 */
                return new Promise((resolve, reject) => {
                    groups = groups || [];
                    name = _.isEmpty(name)? jid: name;
                    this.sendContactAddIQ(jid, name, groups,
                        () => {
                            const contact = this.create(_.assignIn({
                                ask: undefined,
                                fullname: name,
                                groups,
                                jid,
                                requesting: false,
                                subscription: 'none'
                            }, attributes), {sort: false});
                            resolve(contact);
                        },
                        function (err) {
                            alert(__('Sorry, there was an error while trying to add %1$s as a contact.', name));
                            _converse.log(err, Strophe.LogLevel.ERROR);
                            resolve(err);
                        }
                    );
                });
            },

            subscribeBack (bare_jid) {
                const contact = this.get(bare_jid);
                if (contact instanceof _converse.RosterContact) {
                    contact.authorize().subscribe();
                } else {
                    // Can happen when a subscription is retried or roster was deleted
                    const handler = (contact) => {
                        if (contact instanceof _converse.RosterContact) {
                            contact.authorize().subscribe();
                        }
                    }
                    this.addContact(bare_jid, '', [], { 'subscription': 'from' }).then(handler, handler);
                }
            },

            getNumOnlineContacts () {
                let ignored = ['offline', 'unavailable'];
                if (_converse.show_only_online_users) {
                    ignored = _.union(ignored, ['dnd', 'xa', 'away']);
                }
                return _.sum(this.models.filter((model) => !_.includes(ignored, model.get('chat_status'))));
            },

            onRosterPush (iq) {
                /* Handle roster updates from the XMPP server.
                 * See: https://xmpp.org/rfcs/rfc6121.html#roster-syntax-actions-push
                 *
                 * Parameters:
                 *    (XMLElement) IQ - The IQ stanza received from the XMPP server.
                 */
                const id = iq.getAttribute('id');
                const from = iq.getAttribute('from');
                if (from && from !== "" && Strophe.getBareJidFromJid(from) !== _converse.bare_jid) {
                    // Receiving client MUST ignore stanza unless it has no from or from = user's bare JID.
                    // XXX: Some naughty servers apparently send from a full
                    // JID so we need to explicitly compare bare jids here.
                    // https://github.com/jcbrand/converse.js/issues/493
                    _converse.connection.send(
                        $iq({type: 'error', id, from: _converse.connection.jid})
                            .c('error', {'type': 'cancel'})
                            .c('service-unavailable', {'xmlns': Strophe.NS.ROSTER })
                    );
                    return true;
                }
                _converse.connection.send($iq({type: 'result', id, from: _converse.connection.jid}));
                const items = sizzle(`query[xmlns="${Strophe.NS.ROSTER}"] item`, iq);
                _.each(items, this.updateContact.bind(this));
                _converse.emit('rosterPush', iq);
                return true;
            },

            fetchFromServer (callback) {
                /* Get the roster from the XMPP server */
                const iq = $iq({type: 'get', 'id': _converse.connection.getUniqueId('roster')})
                    .c('query', {xmlns: Strophe.NS.ROSTER});
                return _converse.connection.sendIQ(iq, (iq) => {
                    this.onReceivedFromServer(iq);
                    callback.apply(this, arguments);
                });
            },

            onReceivedFromServer (iq) {
                /* An IQ stanza containing the roster has been received from
                 * the XMPP server.
                 */
                const items = sizzle(`query[xmlns="${Strophe.NS.ROSTER}"] item`, iq);
                _.each(items, this.updateContact.bind(this));
                _converse.emit('roster', iq);
            },

            updateContact (item) {
                /* Update or create RosterContact models based on items
                 * received in the IQ from the server.
                 */
                const jid = item.getAttribute('jid');
                if (this.isSelf(jid)) { return; }

                const contact = this.get(jid),
                      subscription = item.getAttribute("subscription"),
                      ask = item.getAttribute("ask"),
                      groups = _.map(item.getElementsByTagName('group'), Strophe.getText);

                if (!contact) {
                    if ((subscription === "none" && ask === null) || (subscription === "remove")) {
                        return; // We're lazy when adding contacts.
                    }
                    this.create({
                        ask,
                        fullname: item.getAttribute("name") || jid,
                        groups,
                        jid,
                        subscription
                    }, {sort: false});
                } else {
                    if (subscription === "remove") {
                        return contact.destroy(); // will trigger removeFromRoster
                    }
                    // We only find out about requesting contacts via the
                    // presence handler, so if we receive a contact
                    // here, we know they aren't requesting anymore.
                    // see docs/DEVELOPER.rst
                    contact.save({
                        subscription,
                        ask,
                        requesting: null,
                        groups
                    });
                }
            },

            createRequestingContact (presence) {
                /* Creates a Requesting Contact.
                 *
                 * Note: this method gets completely overridden by converse-vcard.js
                 */
                const bare_jid = Strophe.getBareJidFromJid(presence.getAttribute('from')),
                      nick_el = presence.querySelector(`nick[xmlns="${Strophe.NS.NICK}"]`);
                const user_data = {
                    jid: bare_jid,
                    subscription: 'none',
                    ask: null,
                    requesting: true,
                    fullname: nick_el && nick_el.textContent || bare_jid,
                };
                this.create(user_data);
                _converse.emit('contactRequest', user_data);
            },

            handleIncomingSubscription (presence) {
                const jid = presence.getAttribute('from'),
                      bare_jid = Strophe.getBareJidFromJid(jid),
                      contact = this.get(bare_jid);

                if (!_converse.allow_contact_requests) {
                    _converse.rejectPresenceSubscription(
                        jid,
                        __("This client does not allow presence subscriptions")
                    );
                }
                if (_converse.auto_subscribe) {
                    if ((!contact) || (contact.get('subscription') !== 'to')) {
                        this.subscribeBack(bare_jid);
                    } else {
                        contact.authorize();
                    }
                } else {
                    if (contact) {
                        if (contact.get('subscription') !== 'none')  {
                            contact.authorize();
                        } else if (contact.get('ask') === "subscribe") {
                            contact.authorize();
                        }
                    } else {
                        this.createRequestingContact(presence);
                    }
                }
            },

            presenceHandler (presence) {
                const presence_type = presence.getAttribute('type');
                if (presence_type === 'error') { return true; }

                const jid = presence.getAttribute('from'),
                    bare_jid = Strophe.getBareJidFromJid(jid),
                    resource = Strophe.getResourceFromJid(jid),
                    chat_status = _.propertyOf(presence.querySelector('show'))('textContent') || 'online',
                    status_message = _.propertyOf(presence.querySelector('status'))('textContent'),
                    contact = this.get(bare_jid);

                if (this.isSelf(bare_jid)) {
                    if ((_converse.connection.jid !== jid) &&
                        (presence_type !== 'unavailable') &&
                        (_converse.synchronize_availability === true ||
                         _converse.synchronize_availability === resource)) {
                        // Another resource has changed its status and
                        // synchronize_availability option set to update,
                        // we'll update ours as well.
                        _converse.xmppstatus.save({'status': chat_status});
                        if (status_message) {
                            _converse.xmppstatus.save({'status_message': status_message});
                        }
                    }
                    return;
                } else if (sizzle(`query[xmlns="${Strophe.NS.MUC}"]`, presence).length) {
                    return; // Ignore MUC
                }
                if (contact && (status_message !== contact.get('status'))) {
                    contact.save({'status': status_message});
                }
                if (presence_type === 'subscribed' && contact) {
                    contact.ackSubscribe();
                } else if (presence_type === 'unsubscribed' && contact) {
                    contact.ackUnsubscribe();
                } else if (presence_type === 'unsubscribe') {
                    return;
                } else if (presence_type === 'subscribe') {
                    this.handleIncomingSubscription(presence);
                } else if (presence_type === 'unavailable' && contact) {
                    contact.removeResource(resource);
                } else if (contact) {
                    // presence_type is undefined
                    contact.addResource(presence);
                }
            }
        });


        this.RosterGroup = Backbone.Model.extend({
            initialize (attributes) {
                this.set(_.assignIn({
                    description: __('Click to hide these contacts'),
                    state: _converse.OPENED
                }, attributes));
                // Collection of contacts belonging to this group.
                this.contacts = new _converse.RosterContacts();
            }
        });


        this.RosterGroups = Backbone.Collection.extend({
            model: _converse.RosterGroup,

            fetchRosterGroups () {
                /* Fetches all the roster groups from sessionStorage.
                 *
                 * Returns a promise which resolves once the groups have been
                 * returned.
                 */
                return new Promise((resolve, reject) => {
                    this.fetch({
                        silent: true, // We need to first have all groups before
                                    // we can start positioning them, so we set
                                    // 'silent' to true.
                        success: resolve
                    });
                });
            }
        });


        this.Message = Backbone.Model.extend({
            defaults(){
                return {
                    msgid: _converse.connection.getUniqueId()
                };
            }
        });

        this.Messages = Backbone.Collection.extend({
            model: _converse.Message,
            comparator: 'time'
        });

        this.ChatBox = Backbone.Model.extend({
            defaults: {
                'type': 'chatbox',
                'bookmarked': false,
                'chat_state': undefined,
                'num_unread': 0,
                'url': ''
            },

            initialize () {
                this.messages = new _converse.Messages();
                this.messages.browserStorage = new Backbone.BrowserStorage[_converse.message_storage](
                    b64_sha1(`converse.messages${this.get('jid')}${_converse.bare_jid}`));
                this.save({
                    // The chat_state will be set to ACTIVE once the chat box is opened
                    // and we listen for change:chat_state, so shouldn't set it to ACTIVE here.
                    'box_id' : b64_sha1(this.get('jid')),
                    'time_opened': this.get('time_opened') || moment().valueOf(),
                    'user_id' : Strophe.getNodeFromJid(this.get('jid'))
                });
            },

            getMessageBody (message) {
                const type = message.getAttribute('type');
                return (type === 'error') ?
                    _.propertyOf(message.querySelector('error text'))('textContent') :
                        _.propertyOf(message.querySelector('body'))('textContent');
            },

            getMessageAttributes (message, delay, original_stanza) {
                delay = delay || message.querySelector('delay');
                const type = message.getAttribute('type'),
                      body = this.getMessageBody(message);

                const delayed = !_.isNull(delay),
                    is_groupchat = type === 'groupchat',
                    chat_state = message.getElementsByTagName(_converse.COMPOSING).length && _converse.COMPOSING ||
                        message.getElementsByTagName(_converse.PAUSED).length && _converse.PAUSED ||
                        message.getElementsByTagName(_converse.INACTIVE).length && _converse.INACTIVE ||
                        message.getElementsByTagName(_converse.ACTIVE).length && _converse.ACTIVE ||
                        message.getElementsByTagName(_converse.GONE).length && _converse.GONE;

                let from;
                if (is_groupchat) {
                    from = Strophe.unescapeNode(Strophe.getResourceFromJid(message.getAttribute('from')));
                } else {
                    from = Strophe.getBareJidFromJid(message.getAttribute('from'));
                }
                const time = delayed ? delay.getAttribute('stamp') : moment().format();
                let sender, fullname;
                if ((is_groupchat && from === this.get('nick')) || (!is_groupchat && from === _converse.bare_jid)) {
                    sender = 'me';
                    fullname = _converse.xmppstatus.get('fullname') || from;
                } else {
                    sender = 'them';
                    fullname = this.get('fullname') || from;
                }
                return {
                    'type': type,
                    'chat_state': chat_state,
                    'delayed': delayed,
                    'fullname': fullname,
                    'message': body || undefined,
                    'msgid': message.getAttribute('id'),
                    'sender': sender,
                    'time': time
                };
            },

            createMessage (message, delay, original_stanza) {
                return this.messages.create(this.getMessageAttributes.apply(this, arguments));
            },

            newMessageWillBeHidden () {
                /* Returns a boolean to indicate whether a newly received
                 * message will be visible to the user or not.
                 */
                return this.get('hidden') ||
                    this.get('minimized') ||
                    this.isScrolledUp() ||
                    _converse.windowState === 'hidden';
            },

            incrementUnreadMsgCounter (stanza) {
                /* Given a newly received message, update the unread counter if
                 * necessary.
                 */
                if (_.isNull(stanza.querySelector('body'))) {
                    return; // The message has no text
                }
                if (utils.isNewMessage(stanza) && this.newMessageWillBeHidden()) {
                    this.save({'num_unread': this.get('num_unread') + 1});
                    _converse.incrementMsgCounter();
                }
            },

            clearUnreadMsgCounter() {
                this.save({'num_unread': 0});
            },

            isScrolledUp () {
                return this.get('scrolled', true);
            }
        });

        this.XMPPStatus = Backbone.Model.extend({
            initialize () {
                this.set({
                    'status' : this.getStatus()
                });
                this.on('change', (item) => {
                    if (_.has(item.changed, 'status')) {
                        _converse.emit('statusChanged', this.get('status'));
                    }
                    if (_.has(item.changed, 'status_message')) {
                        _converse.emit('statusMessageChanged', this.get('status_message'));
                    }
                });
            },

            constructPresence (type, status_message) {
                let presence;
                type = _.isString(type) ? type : (this.get('status') || _converse.default_state);
                status_message = _.isString(status_message) ? status_message : undefined;
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
                );
                return presence;
            },

            sendPresence (type, status_message) {
                _converse.connection.send(this.constructPresence(type, status_message));
            },

            setStatus (value) {
                this.sendPresence(value);
                this.save({'status': value});
            },

            getStatus () {
                return this.get('status') || _converse.default_state;
            },

            setStatusMessage (status_message) {
                this.sendPresence(this.getStatus(), status_message);
                this.save({'status_message': status_message});
                if (this.xhr_custom_status) {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', this.xhr_custom_status_url, true);
                    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
                    xhr.send({'msg': status_message});
                }
                const prev_status = this.get('status_message');
                if (prev_status === status_message) {
                    this.trigger("update-status-ui", this);
                }
            }
        });

        this.setUpXMLLogging = function () {
            Strophe.log = function (level, msg) {
                _converse.log(msg, level);
            };
            if (this.debug) {
                this.connection.xmlInput = function (body) {
                    _converse.log(body.outerHTML, Strophe.LogLevel.DEBUG);
                };
                this.connection.xmlOutput = function (body) {
                    _converse.log(body.outerHTML, Strophe.LogLevel.DEBUG);
                };
            }
        };

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
                    this.jid+" Error message: "+e.message);
                this.clearSession(); // If there's a roster, we want to clear it (see #555)
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
            if (this.auto_login) {
                if (credentials) {
                    // When credentials are passed in, they override prebinding
                    // or credentials fetching via HTTP
                    this.autoLogin(credentials);
                } else if (this.credentials_url) {
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
                    this.autoLogin(); // Probably ANONYMOUS login
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
            if (this.authentication === _converse.ANONYMOUS) {
                if (!this.jid) {
                    throw new Error("Config Error: when using anonymous login " +
                        "you need to provide the server's domain via the 'jid' option. " +
                        "Either when calling converse.initialize, or when calling " +
                        "_converse.api.user.login.");
                }
                if (!this.connection.reconnecting) {
                    this.connection.reset();
                }
                this.connection.connect(this.jid.toLowerCase(), null, this.onConnectStatusChanged);
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
                this.connection.connect(this.jid, password, this.onConnectStatusChanged);
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

        this.initConnection = function () {
            if (!this.connection) {
                if (!this.bosh_service_url && ! this.websocket_url) {
                    throw new Error("initConnection: you must supply a value for either the bosh_service_url or websocket_url or both.");
                }
                if (('WebSocket' in window || 'MozWebSocket' in window) && this.websocket_url) {
                    this.connection = new Strophe.Connection(this.websocket_url, this.connection_options);
                } else if (this.bosh_service_url) {
                    this.connection = new Strophe.Connection(
                        this.bosh_service_url,
                        _.assignIn(this.connection_options, {'keepalive': this.keepalive})
                    );
                } else {
                    throw new Error("initConnection: this browser does not support websockets and bosh_service_url wasn't specified.");
                }
            }
            _converse.emit('connectionInitialized');
        };

        this._tearDown = function () {
            /* Remove those views which are only allowed with a valid
             * connection.
             */
            _converse.emit('beforeTearDown');
            _converse.unregisterPresenceHandler();
            if (_converse.roster) {
                _converse.roster.off().reset(); // Removes roster contacts
            }
            if (!_.isUndefined(_converse.session)) {
                _converse.session.destroy();
            }
            window.removeEventListener('click', _converse.onUserActivity);
            window.removeEventListener('focus', _converse.onUserActivity);
            window.removeEventListener('keypress', _converse.onUserActivity);
            window.removeEventListener('mousemove', _converse.onUserActivity);
            window.removeEventListener(unloadevent, _converse.onUserActivity);
            window.clearInterval(_converse.everySecondTrigger);
            _converse.emit('afterTearDown');
            return _converse;
        };

        this.initPlugins = function () {
            // If initialize gets called a second time (e.g. during tests), then we
            // need to re-apply all plugins (for a new converse instance), and we
            // therefore need to clear this array that prevents plugins from being
            // initialized twice.
            // If initialize is called for the first time, then this array is empty
            // in any case.
            _converse.pluggable.initialized_plugins = [];
            const whitelist = _converse.core_plugins.concat(
                _converse.whitelisted_plugins);

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
        };

        // Initialization
        // --------------
        // This is the end of the initialize method.
        if (settings.connection) {
            this.connection = settings.connection;
        }
        _converse.initPlugins();
        _converse.initConnection();
        _converse.setUpXMLLogging();
        _converse.logIn();
        _converse.registerGlobalEventHandlers();

        if (!_.isUndefined(_converse.connection) &&
            _converse.connection.service === 'jasmine tests') {
            return _converse;
        } else {
            return init_promise.promise;
        }
    };

    // API methods only available to plugins
    _converse.api = {
        'connection': {
            'connected' () {
                return _converse.connection && _converse.connection.connected || false;
            },
            'disconnect' () {
                _converse.connection.disconnect();
            },
        },
        'emit' () {
            _converse.emit.apply(_converse, arguments);
        },
        'user': {
            'jid' () {
                return _converse.connection.jid;
            },
            'login' (credentials) {
                _converse.initConnection();
                _converse.logIn(credentials);
            },
            'logout' () {
                _converse.logOut();
            },
            'status': {
                'get' () {
                    return _converse.xmppstatus.get('status');
                },
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
                'message': {
                    'get' () {
                        return _converse.xmppstatus.get('status_message');
                    },
                    'set' (stat) {
                        _converse.xmppstatus.save({'status_message': stat});
                    }
                }
            },
        },
        'settings': {
            'update' (settings) {
                utils.merge(_converse.default_settings, settings);
                utils.merge(_converse, settings);
                utils.applyUserSettings(_converse, settings, _converse.user_settings);
            },
            'get' (key) {
                if (_.includes(_.keys(_converse.default_settings), key)) {
                    return _converse[key];
                }
            },
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
        'promises': {
            'add' (promises) {
                promises = _.isArray(promises) ? promises : [promises]
                _.each(promises, addPromise);
            }
        },
        'contacts': {
            'get' (jids) {
                const _transform = function (jid) {
                    const contact = _converse.roster.get(Strophe.getBareJidFromJid(jid));
                    if (contact) {
                        return contact.attributes;
                    }
                    return null;
                };
                if (_.isUndefined(jids)) {
                    jids = _converse.roster.pluck('jid');
                } else if (_.isString(jids)) {
                    return _transform(jids);
                }
                return _.map(jids, _transform);
            },
            'add' (jid, name) {
                if (!_.isString(jid) || !_.includes(jid, '@')) {
                    throw new TypeError('contacts.add: invalid jid');
                }
                _converse.roster.addAndSubscribe(jid, _.isEmpty(name)? jid: name);
            }
        },
        'tokens': {
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
        'listen': {
            'once': _converse.once.bind(_converse),
            'on': _converse.on.bind(_converse),
            'not': _converse.off.bind(_converse),
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
        'waitUntil' (name) {
            const promise = _converse.promises[name];
            if (_.isUndefined(promise)) {
                return null;
            }
            return promise.promise;
        },
        'send' (stanza) {
            _converse.connection.send(stanza);
        },
    };

    // The public API
    return {
        'initialize' (settings, callback) {
            return _converse.initialize(settings, callback);
        },
        'plugins': {
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
        'env': {
            '$build': $build,
            '$iq': $iq,
            '$msg': $msg,
            '$pres': $pres,
            'Backbone': Backbone,
            'Promise': Promise,
            'Strophe': Strophe,
            '_': _,
            'b64_sha1':  b64_sha1,
            'moment': moment,
            'sizzle': sizzle,
            'utils': utils
        }
    };
}));
