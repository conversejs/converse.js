// Converse.js
// https://conversejs.org
//
// Copyright (c) 2012-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

(function (root, factory) {
    define(["sizzle",
            "es6-promise",
            "lodash.noconflict",
            "lodash.fp",
            "polyfill",
            "i18n",
            "utils",
            "moment",
            "strophe",
            "pluggable",
            "backbone.noconflict",
            "backbone.nativeview",
            "backbone.browserStorage"
    ], factory);
}(this, function (sizzle, Promise, _, f, polyfill, i18n, u, moment, Strophe, pluggable, Backbone) {

    /* Cannot use this due to Safari bug.
     * See https://github.com/jcbrand/converse.js/issues/196
     */
    // "use strict";

    // Strophe globals
    const { $build, $iq, $msg, $pres } = Strophe;
    const b64_sha1 = Strophe.SHA1.b64_sha1;
    Strophe = Strophe.Strophe;

    // Add Strophe Namespaces
    Strophe.addNamespace('CARBONS', 'urn:xmpp:carbons:2');
    Strophe.addNamespace('CHATSTATES', 'http://jabber.org/protocol/chatstates');
    Strophe.addNamespace('CSI', 'urn:xmpp:csi:0');
    Strophe.addNamespace('DELAY', 'urn:xmpp:delay');
    Strophe.addNamespace('FORWARD', 'urn:xmpp:forward:0');
    Strophe.addNamespace('HINTS', 'urn:xmpp:hints');
    Strophe.addNamespace('HTTPUPLOAD', 'urn:xmpp:http:upload:0');
    Strophe.addNamespace('MAM', 'urn:xmpp:mam:2');
    Strophe.addNamespace('NICK', 'http://jabber.org/protocol/nick');
    Strophe.addNamespace('OUTOFBAND', 'jabber:x:oob');
    Strophe.addNamespace('PUBSUB', 'http://jabber.org/protocol/pubsub');
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

    const _converse = {
        'templates': {},
        'promises': {}
    }

    _.extend(_converse, Backbone.Events);

    // Core plugins are whitelisted automatically
    _converse.core_plugins = [
        'converse-bookmarks',
        'converse-chatboxes',
        'converse-chatview',
        'converse-caps',
        'converse-controlbox',
        'converse-core',
        'converse-disco',
        'converse-dragresize',
        'converse-embedded',
        'converse-fullscreen',
        'converse-headline',
        'converse-mam',
        'converse-message-view',
        'converse-minimize',
        'converse-modal',
        'converse-muc',
        'converse-muc-views',
        'converse-notification',
        'converse-otr',
        'converse-ping',
        'converse-profile',
        'converse-register',
        'converse-roomslist',
        'converse-roster',
        'converse-rosterview',
        'converse-singleton',
        'converse-spoilers',
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

    _converse.DEFAULT_IMAGE_TYPE = 'image/png';
    _converse.DEFAULT_IMAGE = "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH3gwHCy455JBsggAABkJJREFUeNrtnM1PE1sUwHvvTD8otWLHST/Gimi1CEgr6M6FEWuIBo2pujDVsNDEP8GN/4MbN7oxrlipG2OCgZgYlxAbkRYw1KqkIDRCSkM7nXvvW8x7vjyNeQ9m7p1p3z1LQk/v/Dhz7vkEXL161cHl9wI5Ag6IA+KAOCAOiAPigDggLhwQB2S+iNZ+PcYY/SWEEP2HAAAIoSAIoihCCP+ngDDGtVotGAz29/cfOXJEUZSOjg6n06lp2sbGRqlUWlhYyGazS0tLbrdbEASrzgksyeYJId3d3el0uqenRxRFAAAA4KdfIIRgjD9+/Pj8+fOpqSndslofEIQwHA6Pjo4mEon//qmFhYXHjx8vLi4ihBgDEnp7e9l8E0Jo165dQ0NDd+/eDYVC2/qsJElDQ0OEkKWlpa2tLZamxAhQo9EIBoOjo6MXL17csZLe3l5FUT59+lQul5l5JRaAVFWNRqN37tw5ceKEQVWRSOTw4cOFQuHbt2+iKLYCIISQLMu3b99OJpOmKAwEAgcPHszn8+vr6wzsiG6UQQhxuVyXLl0aGBgwUW0sFstkMl6v90fo1KyAMMYDAwPnzp0zXfPg4GAqlWo0Gk0MiBAiy/L58+edTqf5Aa4onj59OhaLYYybFRCEMBaL0fNxBw4cSCQStN0QRUBut3t4eJjq6U+dOiVJElVPRBFQIBDo6+ujCqirqyscDlONGykC2lYyYSR6pBoQQapHZwAoHo/TuARYAOrs7GQASFEUqn6aIiBJkhgA6ujooFpUo6iaTa7koFwnaoWadLNe81tbWwzoaJrWrICWl5cZAFpbW6OabVAEtLi4yABQsVjUNK0pAWWzWQaAcrlcswKanZ1VVZUqHYRQEwOq1Wpv3ryhCmh6erpcLjdrNl+v1ycnJ+l5UELI27dvv3//3qxxEADgy5cvExMT9Mznw4cPtFtAdAPFarU6Pj5eKpVM17yxsfHy5cvV1VXazXu62gVBKBQKT58+rdVqJqrFGL948eLdu3dU8/g/H4FBUaJYLAqC0NPTY9brMD4+PjY25mDSracOCABACJmZmXE6nUePHjWu8NWrV48ePSKEsGlAs7Agfd5nenq6Wq0mk0kjDzY2NvbkyRMIIbP2PLvhBUEQ8vl8NpuNx+M+n29bzhVjvLKycv/+/YmJCcazQuwA6YzW1tYmJyf1SY+2trZ/rRk1Go1SqfT69esHDx4UCgVmNaa/zZ/9ABUhRFXVYDB48uTJeDweiUQkSfL7/T9MA2NcqVTK5fLy8vL8/PzU1FSxWHS5XJaM4wGr9sUwxqqqer3eUCgkSZJuUBBCfTRvc3OzXC6vrKxUKhWn02nhCJ5lM4oQQo/HgxD6+vXr58+fHf8sDOp+HQDg8XgclorFU676dKLlo6yWRdItIBwQB8QBcUCtfosRQjRNQwhhjPUC4w46WXryBSHU1zgEQWBz99EFhDGu1+t+v//48ePxeFxRlD179ng8nh0Efgiher2+vr6ur3HMzMysrq7uTJVdACGEurq6Ll++nEgkPB7Pj9jPoDHqOxyqqubz+WfPnuVyuV9XPeyeagAAAoHArVu3BgcHab8CuVzu4cOHpVKJUnfA5GweY+xyuc6cOXPv3r1IJMLAR8iyPDw8XK/Xi8Wiqqqmm5KZgBBC7e3tN27cuHbtGuPVpf7+/lAoNDs7W61WzfVKpgHSSzw3b95MpVKW3MfRaDQSiczNzVUqFRMZmQOIEOL1eq9fv3727FlL1t50URRFluX5+flqtWpWEGAOIFEUU6nUlStXLKSjy759+xwOx9zcnKZpphzGHMzhcDiTydgk9r1w4YIp7RPTAAmCkMlk2FeLf/tIEKbTab/fbwtAhJBoNGrutpNx6e7uPnTokC1eMU3T0um0DZPMkZER6wERQnw+n/FFSxpy7Nix3bt3WwwIIcRgIWnHkkwmjecfRgGx7DtuV/r6+iwGhDHev3+/bQF1dnYaH6E2CkiWZdsC2rt3r8WAHA5HW1ubbQGZcjajgOwTH/4qNko1Wlg4IA6IA+KAOKBWBUQIsfNojyliKIoRRfH9+/dut9umf3wzpoUNNQ4BAJubmwz+ic+OxefzWWlBhJD29nbug7iT5sIBcUAcEAfEAXFAHBAHxOVn+QMrmWpuPZx12gAAAABJRU5ErkJggg==";

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

    _converse.router = new Backbone.Router();


    _converse.initialize = function (settings, callback) {
        "use strict";
        settings = !_.isUndefined(settings) ? settings : {};
        const init_promise = u.getResolveablePromise();

        _.each(PROMISES, addPromise);

        if (!_.isUndefined(_converse.connection)) {
            // Looks like _converse.initialized was called again without logging
            // out or disconnecting in the previous session.
            // This happens in tests. We therefore first clean up.
            Backbone.history.stop();
            _converse.chatboxviews.closeAllChatBoxes();
            delete _converse.controlboxtoggle;
            delete _converse.chatboxviews;
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

        // Instance level constants
        this.TIMEOUTS = { // Set as module attr so that we can override in tests.
            'PAUSED':     10000,
            'INACTIVE':   90000
        };

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
            auto_reconnect: true,
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
            geouri_regex: /https:\/\/www.openstreetmap.org\/.*#map=[0-9]+\/([\-0-9.]+)\/([\-0-9.]+)\S*/g,
            geouri_replacement: 'https://www.openstreetmap.org/?mlat=$1&mlon=$2#map=18/$1/$2',
            hide_offline_users: false,
            include_offline_state: false,
            jid: undefined,
            keepalive: true,
            locales_url: 'locale/{{{locale}}}/LC_MESSAGES/converse.json',
            locales: [
                'af', 'ar', 'bg', 'ca', 'de', 'es', 'eu', 'en', 'fr', 'he',
                'hu', 'id', 'it', 'ja', 'nb', 'nl',
                'pl', 'pt_BR', 'ru', 'tr', 'uk', 'zh_CN', 'zh_TW'
            ],
            message_carbons: true,
            nickname: undefined,
            password: undefined,
            prebind_url: null,
            priority: 0,
            registration_domain: '',
            rid: undefined,
            root: window.document,
            show_only_online_users: false,
            show_send_button: false,
            sid: undefined,
            storage: 'session',
            strict_plugin_dependencies: false,
            synchronize_availability: true,
            trusted: true,
            view_mode: 'overlayed', // Choices are 'overlayed', 'fullscreen', 'mobile'
            websocket_url: undefined,
            whitelisted_plugins: []
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
            _converse.connection.send(pres);
        };

        this.reconnect = _.debounce(function () {
            _converse.log('RECONNECTING');
            _converse.log('The connection has dropped, attempting to reconnect.');
            _converse.setConnectionStatus(
                Strophe.Status.RECONNECTING,
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
                this.xmppstatus = new this.XMPPStatus();
                const id = b64_sha1(`converse.xmppstatus-${_converse.bare_jid}`);
                this.xmppstatus.id = id; // Appears to be necessary for backbone.browserStorage
                this.xmppstatus.browserStorage = new Backbone.BrowserStorage[_converse.storage](id);
                this.xmppstatus.fetch({
                    success: _.partial(_converse.onStatusInitialized, reconnecting),
                    error: _.partial(_converse.onStatusInitialized, reconnecting)
                });
            }
        }

        this.initSession = function () {
            _converse.session = new Backbone.Model();
            const id = b64_sha1('converse.bosh-session');
            _converse.session.id = id; // Appears to be necessary for backbone.browserStorage
            _converse.session.browserStorage = new Backbone.BrowserStorage[_converse.storage](id);
            _converse.session.fetch();
        };

        this.clearSession = function () {
            if (!_converse.trusted) {
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
                _converse._tearDown();
            }
            // Recreate all the promises
            _.each(_.keys(_converse.promises), addPromise);

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
                'from': this.connection.jid,
                'id': 'enablecarbons',
                'type': 'set'
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


        this.unregisterPresenceHandler = function () {
            if (!_.isUndefined(_converse.presence_ref)) {
                _converse.connection.deleteHandler(_converse.presence_ref);
                delete _converse.presence_ref;
            }
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
            _converse.connection.flush(); // Solves problem of returned PubSub BOSH response not received by browser
            _converse.setUserJid();
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
                    "status":  _converse.default_state,
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
                );
                return presence;
            },

            sendPresence (type, status_message) {
                _converse.connection.send(this.constructPresence(type, status_message));
            }
        });

        this.setUpXMLLogging = function () {
            Strophe.log = function (level, msg) {
                _converse.log(msg, level);
            };
            if (this.debug) {
                this.connection.xmlInput = function (body) {
                    _converse.log(body.outerHTML, Strophe.LogLevel.DEBUG, 'color: darkgoldenrod');
                };
                this.connection.xmlOutput = function (body) {
                    _converse.log(body.outerHTML, Strophe.LogLevel.DEBUG, 'color: darkcyan');
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
                    this.jid+" Error message: "+e.message, Strophe.LogLevel.WARN);
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
            /* Creates a new Strophe.Connection instance if we don't already have one.
             */
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
        };

        // Initialization
        // --------------
        // This is the end of the initialize method.
        if (settings.connection) {
            this.connection = settings.connection;
        }

        function finishInitialization () {
            _converse.initPlugins();
            _converse.initConnection();
            _converse.setUpXMLLogging();
            _converse.logIn();
            _converse.registerGlobalEventHandlers();

            if (!Backbone.history.started) {
                Backbone.history.start();
            }
        }

        if (!_.isUndefined(_converse.connection) &&
                _converse.connection.service === 'jasmine tests') {
            finishInitialization();
            return _converse;
        } else if (_.isUndefined(i18n)) {
            finishInitialization();
        } else {
            i18n.fetchTranslations(
                _converse.locale,
                _converse.locales,
                u.interpolate(_converse.locales_url, {'locale': _converse.locale}))
            .catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL))
            .then(finishInitialization)
            .catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
        }
        return init_promise;
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
                u.merge(_converse.default_settings, settings);
                u.merge(_converse, settings);
                u.applyUserSettings(_converse, settings, _converse.user_settings);
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
            return promise;
        },
        'send' (stanza) {
            _converse.connection.send(stanza);
        },
    };

    // The public API
    window.converse = {
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
            'f': f,
            'b64_sha1':  b64_sha1,
            'moment': moment,
            'sizzle': sizzle,
            'utils': u
        }
    };
    window.dispatchEvent(new CustomEvent('converse-loaded'));
    return window.converse;
}));
