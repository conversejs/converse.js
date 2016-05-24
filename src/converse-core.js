// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define, window, document, locales */

(function (root, factory) {
    // Two modules are loaded as dependencies.
    //
    // * **converse-dependencies**: A list of dependencies converse.js depends on.
    //   The path to this module is in main.js and the module itself can be overridden.
    // * **converse-templates**: The HTML templates used by converse.js.
    //
    // The dependencies are then split up and passed into the factory function,
    // which contains and instantiates converse.js.
    define("converse-core", [
        "jquery",
        "underscore",
        "polyfill",
        "utils",
        "moment_with_locales",
        "strophe",
        "converse-templates",
        "strophe.disco",
        "backbone.browserStorage",
        "backbone.overview",
    ], factory);
}(this, function ($, _, dummy, utils, moment, Strophe, templates) {
    /*
     * Cannot use this due to Safari bug.
     * See https://github.com/jcbrand/converse.js/issues/196
     */
    // "use strict";

    // Strophe globals
    var $build = Strophe.$build;
    var $iq = Strophe.$iq;
    var $pres = Strophe.$pres;
    var b64_sha1 = Strophe.SHA1.b64_sha1;
    Strophe = Strophe.Strophe;

    // Use Mustache style syntax for variable interpolation
    /* Configuration of underscore templates (this config is distinct to the
     * config of requirejs-tpl in main.js). This one is for normal inline templates.
     */
    _.templateSettings = {
        evaluate : /\{\[([\s\S]+?)\]\}/g,
        interpolate : /\{\{([\s\S]+?)\}\}/g
    };

    // We create an object to act as the "this" context for event handlers (as
    // defined below and accessible via converse_api.listen).
    // We don't want the inner converse object to be the context, since it
    // contains sensitive information, and we don't want it to be something in
    // the DOM or window, because then anyone can trigger converse events.
    var event_context = {};

    var converse = {
        plugins: {},
        initialized_plugins: [],
        templates: templates,
        emit: function (evt, data) {
            $(event_context).trigger(evt, data);
        },
        once: function (evt, handler) {
            $(event_context).one(evt, handler);
        },
        on: function (evt, handler) {
            if (_.contains(['ready', 'initialized'], evt)) {
                converse.log('Warning: The "'+evt+'" event has been deprecated and will be removed, please use "connected".');
            }
            $(event_context).bind(evt, handler);
        },
        off: function (evt, handler) {
            $(event_context).unbind(evt, handler);
        }
    };

    // Module-level constants
    converse.STATUS_WEIGHTS = {
        'offline':      6,
        'unavailable':  5,
        'xa':           4,
        'away':         3,
        'dnd':          2,
        'chat':         1, // We currently don't differentiate between "chat" and "online"
        'online':       1
    };
    converse.LOGIN = "login";
    converse.ANONYMOUS  = "anonymous";
    converse.PREBIND = "prebind";
    converse.OPENED = 'opened';
    converse.CLOSED = 'closed';

    var PRETTY_CONNECTION_STATUS = {
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

    converse.log = function (txt, level) {
        var logger;
        if (typeof console === "undefined" || typeof console.log === "undefined") {
            logger = { log: function () {}, error: function () {} };
        } else {
            logger = console;
        }
        if (converse.debug) {
            if (level === 'error') {
                logger.log('ERROR: '+txt);
            } else {
                logger.log(txt);
            }
        }
    };


    converse.initialize = function (settings, callback) {
        "use strict";
        var converse = this;
        var unloadevent;
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
        Strophe.log = function (level, msg) { converse.log(level+' '+msg, level); };
        Strophe.error = function (msg) { converse.log(msg, 'error'); };

        // Add Strophe Namespaces
        Strophe.addNamespace('CARBONS', 'urn:xmpp:carbons:2');
        Strophe.addNamespace('CHATSTATES', 'http://jabber.org/protocol/chatstates');
        Strophe.addNamespace('CSI', 'urn:xmpp:csi:0');
        Strophe.addNamespace('ROSTERX', 'http://jabber.org/protocol/rosterx');
        Strophe.addNamespace('XFORM', 'jabber:x:data');
        Strophe.addNamespace('NICK', 'http://jabber.org/protocol/nick');

        // Instance level constants
        this.TIMEOUTS = { // Set as module attr so that we can override in tests.
            'PAUSED':     20000,
            'INACTIVE':   90000
        };

        // XEP-0085 Chat states
        // http://xmpp.org/extensions/xep-0085.html
        this.INACTIVE = 'inactive';
        this.ACTIVE = 'active';
        this.COMPOSING = 'composing';
        this.PAUSED = 'paused';
        this.GONE = 'gone';


        // Detect support for the user's locale
        // ------------------------------------
        this.isConverseLocale = function (locale) { return typeof locales[locale] !== "undefined"; };
        this.isMomentLocale = function (locale) { return moment.locale() !== moment.locale(locale); };

        this.user_settings = settings; // Save the user settings so that they can be used by plugins

        this.wrappedChatBox = function (chatbox) {
            /* Wrap a chatbox for outside consumption (i.e. so that it can be
             * returned via the API.
             */
            if (!chatbox) { return; }
            var view = converse.chatboxviews.get(chatbox.get('jid'));
            return {
                'close': view.close.bind(view),
                'focus': view.focus.bind(view),
                'get': chatbox.get.bind(chatbox),
                'open': view.show.bind(view),
                'set': chatbox.set.bind(chatbox)
            };
        };

        this.isLocaleAvailable = function (locale, available) {
            /* Check whether the locale or sub locale (e.g. en-US, en) is supported.
             *
             * Parameters:
             *      (Function) available - returns a boolean indicating whether the locale is supported
             */
            if (available(locale)) {
                return locale;
            } else {
                var sublocale = locale.split("-")[0];
                if (sublocale !== locale && available(sublocale)) {
                    return sublocale;
                }
            }
        };
		
        this.detectLocale = function (library_check) {
            /* Determine which locale is supported by the user's system as well
             * as by the relevant library (e.g. converse.js or moment.js).
             *
             * Parameters:
             *      (Function) library_check - returns a boolean indicating whether the locale is supported
             */
            var locale, i;
            if (window.navigator.userLanguage) {
                locale = this.isLocaleAvailable(window.navigator.userLanguage, library_check);
            }
            if (window.navigator.languages && !locale) {
                for (i=0; i<window.navigator.languages.length && !locale; i++) {
                    locale = this.isLocaleAvailable(window.navigator.languages[i], library_check);
                }
            }
            if (window.navigator.browserLanguage && !locale) {
                locale = this.isLocaleAvailable(window.navigator.browserLanguage, library_check);
            }
            if (window.navigator.language && !locale) {
                locale = this.isLocaleAvailable(window.navigator.language, library_check);
            }
            if (window.navigator.systemLanguage && !locale) {
                locale = this.isLocaleAvailable(window.navigator.systemLanguage, library_check);
            }
            return locale || 'en';
        };
		
        if (!moment.locale) { //moment.lang is deprecated after 2.8.1, use moment.locale instead
            moment.locale = moment.lang;
        }
        moment.locale(this.detectLocale(this.isMomentLocale));
        this.i18n = settings.i18n ? settings.i18n : locales[this.detectLocale(this.isConverseLocale)];

        // Translation machinery
        // ---------------------
        var __ = utils.__.bind(this);

        // Default configuration values
        // ----------------------------
        this.default_settings = {
            allow_contact_requests: true,
            animate: true,
            authentication: 'login', // Available values are "login", "prebind", "anonymous".
            auto_away: 0, // Seconds after which user status is set to 'away'
            auto_login: false, // Currently only used in connection with anonymous login
            auto_reconnect: false,
            auto_subscribe: false,
            auto_xa: 0, // Seconds after which user status is set to 'xa'
            bosh_service_url: undefined, // The BOSH connection manager URL.
            credentials_url: null, // URL from where login credentials can be fetched
            csi_waiting_time: 0, // Support for XEP-0352. Seconds before client is considered idle and CSI is sent out.
            debug: false,
            expose_rid_and_sid: false,
            forward_messages: false,
            hide_offline_users: false,
            include_offline_state: false,
            jid: undefined,
            keepalive: false,
            locked_domain: undefined,
            message_carbons: false, // Support for XEP-280
            password: undefined,
            prebind: false, // XXX: Deprecated, use "authentication" instead.
            prebind_url: null,
            rid: undefined,
            roster_groups: false,
            show_only_online_users: false,
            sid: undefined,
            storage: 'session',
            strict_plugin_dependencies: false,
            synchronize_availability: true, // Set to false to not sync with other clients or with resource name of the particular client that it should synchronize with
            visible_toolbar_buttons: {
                'emoticons': true,
                'call': false,
                'clear': true,
                'toggle_occupants': true
            },
            websocket_url: undefined,
            xhr_custom_status: false,
            xhr_custom_status_url: '',
        };

        _.extend(this, this.default_settings);
        // Allow only whitelisted configuration attributes to be overwritten
        _.extend(this, _.pick(settings, Object.keys(this.default_settings)));

        // BBB
        if (this.prebind === true) { this.authentication = converse.PREBIND; }

        if (this.authentication === converse.ANONYMOUS) {
            if (!this.jid) {
                throw("Config Error: you need to provide the server's domain via the " +
                        "'jid' option when using anonymous authentication.");
            }
        }

        if (settings.visible_toolbar_buttons) {
            _.extend(
                this.visible_toolbar_buttons,
                _.pick(settings.visible_toolbar_buttons, [
                    'emoticons', 'call', 'clear', 'toggle_occupants'
                ]
            ));
        }
        $.fx.off = !this.animate;

        // Module-level variables
        // ----------------------
        this.callback = callback || function () {};
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

        // Module-level functions
        // ----------------------

        this.generateResource = function () {
            return '/converse.js-' + Math.floor(Math.random()*139749825).toString();
        };

        this.sendCSI = function (stat) {
            /* Send out a Chat Status Notification (XEP-0352) */
            if (converse.features[Strophe.NS.CSI] || true) {
                converse.connection.send($build(stat, {xmlns: Strophe.NS.CSI}));
                converse.inactive = (stat === converse.INACTIVE) ? true : false;
            }
        };

        this.onUserActivity = function () {
            /* Resets counters and flags relating to CSI and auto_away/auto_xa */
            if (converse.idle_seconds > 0) {
                converse.idle_seconds = 0;
            }
            if (!converse.connection.authenticated) {
                // We can't send out any stanzas when there's no authenticated connection.
                // converse can happen when the connection reconnects.
                return;
            }
            if (converse.inactive) {
                converse.sendCSI(converse.ACTIVE);
            }
            if (converse.auto_changed_status === true) {
                converse.auto_changed_status = false;
                converse.xmppstatus.setStatus('online');
            }
        };

        this.onEverySecond = function () {
            /* An interval handler running every second.
             * Used for CSI and the auto_away and auto_xa features.
             */
            if (!converse.connection.authenticated) {
                // We can't send out any stanzas when there's no authenticated connection.
                // This can happen when the connection reconnects.
                return;
            }
            var stat = converse.xmppstatus.getStatus();
            converse.idle_seconds++;
            if (converse.csi_waiting_time > 0 &&
                    converse.idle_seconds > converse.csi_waiting_time &&
                    !converse.inactive) {
                converse.sendCSI(converse.INACTIVE);
            }
            if (converse.auto_away > 0 &&
                    converse.idle_seconds > converse.auto_away &&
                    stat !== 'away' && stat !== 'xa') {
                converse.auto_changed_status = true;
                converse.xmppstatus.setStatus('away');
            } else if (converse.auto_xa > 0 &&
                    converse.idle_seconds > converse.auto_xa && stat !== 'xa') {
                converse.auto_changed_status = true;
                converse.xmppstatus.setStatus('xa');
            }
        };

        this.registerIntervalHandler = function () {
            /* Set an interval of one second and register a handler for it.
             * Required for the auto_away, auto_xa and csi_waiting_time features.
             */
            if (converse.auto_away < 1 && converse.auto_xa < 1 && converse.csi_waiting_time < 1) {
                // Waiting time of less then one second means features aren't used.
                return;
            }
            converse.idle_seconds = 0;
            converse.auto_changed_status = false; // Was the user's status changed by converse.js?
            $(window).on('click mousemove keypress focus'+unloadevent, converse.onUserActivity);
            converse.everySecondTrigger = window.setInterval(converse.onEverySecond, 1000);
        };

        this.giveFeedback = function (message, klass) {
            $('.conn-feedback').each(function (idx, el) {
                var $el = $(el);
                $el.addClass('conn-feedback').text(message);
                if (klass) {
                    $el.addClass(klass);
                } else {
                    $el.removeClass('error');
                }
            });
            converse.emit('feedback', {'message': message, 'klass': klass});
        };

        this.rejectPresenceSubscription = function (jid, message) {
            /* Reject or cancel another user's subscription to our presence updates.
             *  Parameters:
             *    (String) jid - The Jabber ID of the user whose subscription
             *      is being canceled.
             *    (String) message - An optional message to the user
             */
            var pres = $pres({to: jid, type: "unsubscribed"});
            if (message && message !== "") { pres.c("status").t(message); }
            converse.connection.send(pres);
        };


        this.reconnect = _.debounce(function (condition) {
            converse.connection.disconnect('re-connecting');
            converse.connection.reset();
            converse.log('Attempting to reconnect');
            converse.giveFeedback(__('Attempting to reconnect'), 'error');
            converse.clearSession();
            converse._tearDown();
            if (converse.authentication !== "prebind") {
                converse.attemptNonPreboundSession();
            } else if (converse.prebind_url) {
                converse.startNewBOSHSession();
            }
        }, 1000);

        this.onDisconnected = function (condition) {
            if (!converse.auto_reconnect) { return; }
            if (converse.disconnection_cause === Strophe.Status.CONNFAIL) {
                converse.reconnect(condition);
                return 'reconnecting';
            } else {
                converse.emit('disconnected');
                return 'disconnected';
            }
        };

        this.onConnectStatusChanged = function (status, condition, reconnect) {
            converse.log("Status changed to: "+PRETTY_CONNECTION_STATUS[status]);
            if (status === Strophe.Status.CONNECTED || status === Strophe.Status.ATTACHED) {
                // By default we always want to send out an initial presence stanza.
                converse.send_initial_presence = true;
                delete converse.disconnection_cause;
                if ((typeof reconnect !== 'undefined') && (reconnect)) {
                    converse.log(status === Strophe.Status.CONNECTED ? 'Reconnected' : 'Reattached');
                    converse.onReconnected();
                } else {
                    converse.log(status === Strophe.Status.CONNECTED ? 'Connected' : 'Attached');
                    if (converse.connection.restored) {
                        converse.send_initial_presence = false; // No need to send an initial presence stanza when
                                                                // we're restoring an existing session.
                    }
                    converse.onConnected();
                }
            } else if (status === Strophe.Status.DISCONNECTED) {
                converse.onDisconnected(condition);
            } else if (status === Strophe.Status.ERROR) {
                converse.giveFeedback(__('Error'), 'error');
            } else if (status === Strophe.Status.CONNECTING) {
                converse.giveFeedback(__('Connecting'));
            } else if (status === Strophe.Status.AUTHENTICATING) {
                converse.giveFeedback(__('Authenticating'));
            } else if (status === Strophe.Status.AUTHFAIL) {
                converse.giveFeedback(__('Authentication Failed'), 'error');
                converse.connection.disconnect(__('Authentication Failed'));
                converse.disconnection_cause = Strophe.Status.AUTHFAIL;
            } else if (status === Strophe.Status.CONNFAIL) {
                if (converse.connection.authenticated) {
                    // Only set the disconnection_cause if we're still
                    // authenticated. If we're not, then the user logged out,
                    // and it's therefore not strictly speaking a connection
                    // failure (so we won't automatically reconnect).
                    converse.disconnection_cause = Strophe.Status.CONNFAIL;
                }
            } else if (status === Strophe.Status.DISCONNECTING) {
                if (condition) {
                    converse.giveFeedback(condition, 'error');
                }
            }
        };

        this.updateMsgCounter = function () {
            if (this.msg_counter > 0) {
                if (document.title.search(/^Messages \(\d+\) /) === -1) {
                    document.title = "Messages (" + this.msg_counter + ") " + document.title;
                } else {
                    document.title = document.title.replace(/^Messages \(\d+\) /, "Messages (" + this.msg_counter + ") ");
                }
                window.blur();
                window.focus();
            } else if (document.title.search(/^Messages \(\d+\) /) !== -1) {
                document.title = document.title.replace(/^Messages \(\d+\) /, "");
            }
        };

        this.incrementMsgCounter = function () {
            this.msg_counter += 1;
            this.updateMsgCounter();
        };

        this.clearMsgCounter = function () {
            this.msg_counter = 0;
            this.updateMsgCounter();
        };

        this.initStatus = function () {
            var deferred = new $.Deferred();
            this.xmppstatus = new this.XMPPStatus();
            var id = b64_sha1('converse.xmppstatus-'+converse.bare_jid);
            this.xmppstatus.id = id; // Appears to be necessary for backbone.browserStorage
            this.xmppstatus.browserStorage = new Backbone.BrowserStorage[converse.storage](id);
            this.xmppstatus.fetch({
                success: deferred.resolve,
                error: deferred.resolve
            });
            converse.emit('statusInitialized');
            return deferred.promise();
        };

        this.initSession = function () {
            this.session = new this.Session();
            var id = b64_sha1('converse.bosh-session');
            this.session.id = id; // Appears to be necessary for backbone.browserStorage
            this.session.browserStorage = new Backbone.BrowserStorage[converse.storage](id);
            this.session.fetch();
        };

        this.clearSession = function () {
            if (this.roster) {
                this.roster.browserStorage._clear();
            }
            this.session.browserStorage._clear();
        };

        this.logOut = function () {
            converse.chatboxviews.closeAllChatBoxes();
            converse.clearSession();
            if (typeof converse.connection !== 'undefined') {
                converse.connection.disconnect();
                converse.connection.reset();
            }
        };

        this.registerGlobalEventHandlers = function () {
            $(window).on("blur focus", function (ev) {
                if ((converse.windowState !== ev.type) && (ev.type === 'focus')) {
                    converse.clearMsgCounter();
                }
                converse.windowState = ev.type;
            });
        };

        this.afterReconnected = function () {
            this.chatboxes.registerMessageHandler();
            this.xmppstatus.sendPresence();
            this.giveFeedback(__('Contacts'));
        };

        this.onReconnected = function () {
            // We need to re-register all the event handlers on the newly
            // created connection.
            var deferred = new $.Deferred();
            this.initStatus().done(function () {
                this.afterReconnected();
                deferred.resolve();
            }.bind(this));
            converse.emit('reconnected');
            return deferred.promise();
        };

        this.enableCarbons = function () {
            /* Ask the XMPP server to enable Message Carbons
             * See XEP-0280 https://xmpp.org/extensions/xep-0280.html#enabling
             */
            if (!this.message_carbons || this.session.get('carbons_enabled')) {
                return;
            }
            var carbons_iq = new Strophe.Builder('iq', {
                from: this.connection.jid,
                id: 'enablecarbons',
                type: 'set'
              })
              .c('enable', {xmlns: Strophe.NS.CARBONS});
            this.connection.addHandler(function (iq) {
                if ($(iq).find('error').length > 0) {
                    converse.log('ERROR: An error occured while trying to enable message carbons.');
                } else {
                    this.session.save({carbons_enabled: true});
                    converse.log('Message carbons have been enabled.');
                }
            }.bind(this), null, "iq", null, "enablecarbons");
            this.connection.send(carbons_iq);
        };


        this.onStatusInitialized = function (deferred) {
            this.registerIntervalHandler();				
            this.roster = new this.RosterContacts();
            this.roster.browserStorage = new Backbone.BrowserStorage[this.storage](
                b64_sha1('converse.contacts-'+this.bare_jid));
            this.chatboxes.onConnected();
            this.giveFeedback(__('Contacts'));
            if (typeof this.callback === 'function') {
                // A callback method may be passed in via the
                // converse.initialize method.
                // XXX: Can we use $.Deferred instead of this callback?
                if (this.connection.service === 'jasmine tests') {
                    // XXX: Call back with the internal converse object. This
                    // object should never be exposed to production systems.
                    // 'jasmine tests' is an invalid http bind service value,
                    // so we're sure that this is just for tests.
                    this.callback(this);
                } else  {
                    this.callback();
                }
            }
            deferred.resolve();
            converse.emit('initialized');
        };

        this.onConnected = function (callback) {
            // When reconnecting, there might be some open chat boxes. We don't
            // know whether these boxes are of the same account or not, so we
            // close them now.
            var deferred = new $.Deferred();
            // XXX: ran into an issue where a returned PubSub BOSH response was
            // not received by the browser. The solution was to flush the
            // connection early on. I don't know what the underlying cause of
            // this issue is, and whether it's a Strophe.js or Prosody bug.
            // My suspicion is that Prosody replies to an invalid/expired
            // Request, which is why the browser then doesn't receive it.
            // In any case, flushing here (sending out a new BOSH request)
            // solves the problem.
            converse.connection.flush();
            /* Called as soon as a new connection has been established, either
             * by logging in or by attaching to an existing BOSH session.
             */
            this.chatboxviews.closeAllChatBoxes();
            this.jid = this.connection.jid;
            this.bare_jid = Strophe.getBareJidFromJid(this.connection.jid);
            this.resource = Strophe.getResourceFromJid(this.connection.jid);
            this.domain = Strophe.getDomainFromJid(this.connection.jid);
            this.features = new this.Features();
            this.enableCarbons();
            this.initStatus().done(_.bind(this.onStatusInitialized, this, deferred));
            converse.emit('connected');
            converse.emit('ready'); // BBB: Will be removed.
            return deferred.promise();
        };


        this.RosterContact = Backbone.Model.extend({

            initialize: function (attributes, options) {
                var jid = attributes.jid;
                var bare_jid = Strophe.getBareJidFromJid(jid);
                var resource = Strophe.getResourceFromJid(jid);
                attributes.jid = bare_jid;
                this.set(_.extend({
                    'id': bare_jid,
                    'jid': bare_jid,
                    'fullname': bare_jid,
                    'chat_status': 'offline',
                    'user_id': Strophe.getNodeFromJid(jid),
                    'resources': resource ? [resource] : [],
                    'groups': [],
                    'image_type': 'image/png',
                    'image': "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH3gwHCy455JBsggAABkJJREFUeNrtnM1PE1sUwHvvTD8otWLHST/Gimi1CEgr6M6FEWuIBo2pujDVsNDEP8GN/4MbN7oxrlipG2OCgZgYlxAbkRYw1KqkIDRCSkM7nXvvW8x7vjyNeQ9m7p1p3z1LQk/v/Dhz7vkEXL161cHl9wI5Ag6IA+KAOCAOiAPigDggLhwQB2S+iNZ+PcYY/SWEEP2HAAAIoSAIoihCCP+ngDDGtVotGAz29/cfOXJEUZSOjg6n06lp2sbGRqlUWlhYyGazS0tLbrdbEASrzgksyeYJId3d3el0uqenRxRFAAAA4KdfIIRgjD9+/Pj8+fOpqSndslofEIQwHA6Pjo4mEon//qmFhYXHjx8vLi4ihBgDEnp7e9l8E0Jo165dQ0NDd+/eDYVC2/qsJElDQ0OEkKWlpa2tLZamxAhQo9EIBoOjo6MXL17csZLe3l5FUT59+lQul5l5JRaAVFWNRqN37tw5ceKEQVWRSOTw4cOFQuHbt2+iKLYCIISQLMu3b99OJpOmKAwEAgcPHszn8+vr6wzsiG6UQQhxuVyXLl0aGBgwUW0sFstkMl6v90fo1KyAMMYDAwPnzp0zXfPg4GAqlWo0Gk0MiBAiy/L58+edTqf5Aa4onj59OhaLYYybFRCEMBaL0fNxBw4cSCQStN0QRUBut3t4eJjq6U+dOiVJElVPRBFQIBDo6+ujCqirqyscDlONGykC2lYyYSR6pBoQQapHZwAoHo/TuARYAOrs7GQASFEUqn6aIiBJkhgA6ujooFpUo6iaTa7koFwnaoWadLNe81tbWwzoaJrWrICWl5cZAFpbW6OabVAEtLi4yABQsVjUNK0pAWWzWQaAcrlcswKanZ1VVZUqHYRQEwOq1Wpv3ryhCmh6erpcLjdrNl+v1ycnJ+l5UELI27dvv3//3qxxEADgy5cvExMT9Mznw4cPtFtAdAPFarU6Pj5eKpVM17yxsfHy5cvV1VXazXu62gVBKBQKT58+rdVqJqrFGL948eLdu3dU8/g/H4FBUaJYLAqC0NPTY9brMD4+PjY25mDSracOCABACJmZmXE6nUePHjWu8NWrV48ePSKEsGlAs7Agfd5nenq6Wq0mk0kjDzY2NvbkyRMIIbP2PLvhBUEQ8vl8NpuNx+M+n29bzhVjvLKycv/+/YmJCcazQuwA6YzW1tYmJyf1SY+2trZ/rRk1Go1SqfT69esHDx4UCgVmNaa/zZ/9ABUhRFXVYDB48uTJeDweiUQkSfL7/T9MA2NcqVTK5fLy8vL8/PzU1FSxWHS5XJaM4wGr9sUwxqqqer3eUCgkSZJuUBBCfTRvc3OzXC6vrKxUKhWn02nhCJ5lM4oQQo/HgxD6+vXr58+fHf8sDOp+HQDg8XgclorFU676dKLlo6yWRdItIBwQB8QBcUCtfosRQjRNQwhhjPUC4w46WXryBSHU1zgEQWBz99EFhDGu1+t+v//48ePxeFxRlD179ng8nh0Efgiher2+vr6ur3HMzMysrq7uTJVdACGEurq6Ll++nEgkPB7Pj9jPoDHqOxyqqubz+WfPnuVyuV9XPeyeagAAAoHArVu3BgcHab8CuVzu4cOHpVKJUnfA5GweY+xyuc6cOXPv3r1IJMLAR8iyPDw8XK/Xi8Wiqqqmm5KZgBBC7e3tN27cuHbtGuPVpf7+/lAoNDs7W61WzfVKpgHSSzw3b95MpVKW3MfRaDQSiczNzVUqFRMZmQOIEOL1eq9fv3727FlL1t50URRFluX5+flqtWpWEGAOIFEUU6nUlStXLKSjy759+xwOx9zcnKZpphzGHMzhcDiTydgk9r1w4YIp7RPTAAmCkMlk2FeLf/tIEKbTab/fbwtAhJBoNGrutpNx6e7uPnTokC1eMU3T0um0DZPMkZER6wERQnw+n/FFSxpy7Nix3bt3WwwIIcRgIWnHkkwmjecfRgGx7DtuV/r6+iwGhDHev3+/bQF1dnYaH6E2CkiWZdsC2rt3r8WAHA5HW1ubbQGZcjajgOwTH/4qNko1Wlg4IA6IA+KAOKBWBUQIsfNojyliKIoRRfH9+/dut9umf3wzpoUNNQ4BAJubmwz+ic+OxefzWWlBhJD29nbug7iT5sIBcUAcEAfEAXFAHBAHxOVn+QMrmWpuPZx12gAAAABJRU5ErkJggg==",
                    'status': ''
                }, attributes));

                this.on('destroy', function () { this.removeFromRoster(); }.bind(this));
                this.on('change:chat_status', function (item) {
                    converse.emit('contactStatusChanged', item.attributes);
                });
            },

            subscribe: function (message) {
                /* Send a presence subscription request to this roster contact
                 *
                 * Parameters:
                 *    (String) message - An optional message to explain the
                 *      reason for the subscription request.
                 */
                this.save('ask', "subscribe"); // ask === 'subscribe' Means we have ask to subscribe to them.
                var pres = $pres({to: this.get('jid'), type: "subscribe"});
                if (message && message !== "") {
                    pres.c("status").t(message).up();
                }
                var nick = converse.xmppstatus.get('fullname');
                if (nick && nick !== "") {
                    pres.c('nick', {'xmlns': Strophe.NS.NICK}).t(nick).up();
                }
                converse.connection.send(pres);
                return this;
            },

            ackSubscribe: function () {
                /* Upon receiving the presence stanza of type "subscribed",
                 * the user SHOULD acknowledge receipt of that subscription
                 * state notification by sending a presence stanza of type
                 * "subscribe" to the contact
                 */
                converse.connection.send($pres({
                    'type': 'subscribe',
                    'to': this.get('jid')
                }));
            },

            ackUnsubscribe: function (jid) {
                /* Upon receiving the presence stanza of type "unsubscribed",
                 * the user SHOULD acknowledge receipt of that subscription state
                 * notification by sending a presence stanza of type "unsubscribe"
                 * this step lets the user's server know that it MUST no longer
                 * send notification of the subscription state change to the user.
                 *  Parameters:
                 *    (String) jid - The Jabber ID of the user who is unsubscribing
                 */
                converse.connection.send($pres({'type': 'unsubscribe', 'to': this.get('jid')}));
                this.destroy(); // Will cause removeFromRoster to be called.
            },

            unauthorize: function (message) {
                /* Unauthorize this contact's presence subscription
                 * Parameters:
                 *   (String) message - Optional message to send to the person being unauthorized
                 */
                converse.rejectPresenceSubscription(this.get('jid'), message);
                return this;
            },

            authorize: function (message) {
                /* Authorize presence subscription
                 * Parameters:
                 *   (String) message - Optional message to send to the person being authorized
                 */
                var pres = $pres({to: this.get('jid'), type: "subscribed"});
                if (message && message !== "") {
                    pres.c("status").t(message);
                }
                converse.connection.send(pres);
                return this;
            },

            removeResource: function (resource) {
                var resources = this.get('resources'), idx;
                if (resource) {
                    idx = _.indexOf(resources, resource);
                    if (idx !== -1) {
                        resources.splice(idx, 1);
                        this.save({'resources': resources});
                    }
                }
                else {
                    // if there is no resource (resource is null), it probably
                    // means that the user is now completely offline. To make sure
                    // that there isn't any "ghost" resources left, we empty the array
                    this.save({'resources': []});
                    return 0;
                }
                return resources.length;
            },

            removeFromRoster: function (callback) {
                /* Instruct the XMPP server to remove this contact from our roster
                 * Parameters:
                 *   (Function) callback
                 */
                var iq = $iq({type: 'set'})
                    .c('query', {xmlns: Strophe.NS.ROSTER})
                    .c('item', {jid: this.get('jid'), subscription: "remove"});
                converse.connection.sendIQ(iq, callback, callback);
                return this;
            }
        });


        this.RosterContacts = Backbone.Collection.extend({
            model: converse.RosterContact,

            comparator: function (contact1, contact2) {
                var name1, name2;
                var status1 = contact1.get('chat_status') || 'offline';
                var status2 = contact2.get('chat_status') || 'offline';
                if (converse.STATUS_WEIGHTS[status1] === converse.STATUS_WEIGHTS[status2]) {
                    name1 = contact1.get('fullname').toLowerCase();
                    name2 = contact2.get('fullname').toLowerCase();
                    return name1 < name2 ? -1 : (name1 > name2? 1 : 0);
                } else  {
                    return converse.STATUS_WEIGHTS[status1] < converse.STATUS_WEIGHTS[status2] ? -1 : 1;
                }
            },

            subscribeToSuggestedItems: function (msg) {
                $(msg).find('item').each(function (i, items) {
                    if (this.getAttribute('action') === 'add') {
                        converse.roster.addAndSubscribe(
                                this.getAttribute('jid'), null, converse.xmppstatus.get('fullname'));
                    }
                });
                return true;
            },

            isSelf: function (jid) {
                return (Strophe.getBareJidFromJid(jid) === Strophe.getBareJidFromJid(converse.connection.jid));
            },

            addAndSubscribe: function (jid, name, groups, message, attributes) {
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
                this.addContact(jid, name, groups, attributes).done(function (contact) {
                    if (contact instanceof converse.RosterContact) {
                        contact.subscribe(message);
                    }
                });
            },

            sendContactAddIQ: function (jid, name, groups, callback, errback) {
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
                var iq = $iq({type: 'set'})
                    .c('query', {xmlns: Strophe.NS.ROSTER})
                    .c('item', { jid: jid, name: name });
                _.map(groups, function (group) { iq.c('group').t(group).up(); });
                converse.connection.sendIQ(iq, callback, errback);
            },

            addContact: function (jid, name, groups, attributes) {
                /* Adds a RosterContact instance to converse.roster and
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
                var deferred = new $.Deferred();
                groups = groups || [];
                name = _.isEmpty(name)? jid: name;
                this.sendContactAddIQ(jid, name, groups,
                    function (iq) {
                        var contact = this.create(_.extend({
                            ask: undefined,
                            fullname: name,
                            groups: groups,
                            jid: jid,
                            requesting: false,
                            subscription: 'none'
                        }, attributes), {sort: false});
                        deferred.resolve(contact);
                    }.bind(this),
                    function (err) {
                        alert(__("Sorry, there was an error while trying to add "+name+" as a contact."));
                        converse.log(err);
                        deferred.resolve(err);
                    }
                );
                return deferred.promise();
            },

            addResource: function (bare_jid, resource) {
                var item = this.get(bare_jid),
                    resources;
                if (item) {
                    resources = item.get('resources');
                    if (resources) {
                        if (_.indexOf(resources, resource) === -1) {
                            resources.push(resource);
                            item.set({'resources': resources});
                        }
                    } else  {
                        item.set({'resources': [resource]});
                    }
                }
            },

            subscribeBack: function (bare_jid) {
                var contact = this.get(bare_jid);
                if (contact instanceof converse.RosterContact) {
                    contact.authorize().subscribe();
                } else {
                    // Can happen when a subscription is retried or roster was deleted
                    this.addContact(bare_jid, '', [], { 'subscription': 'from' }).done(function (contact) {
                        if (contact instanceof converse.RosterContact) {
                            contact.authorize().subscribe();
                        }
                    });
                }
            },

            getNumOnlineContacts: function () {
                var count = 0,
                    ignored = ['offline', 'unavailable'],
                    models = this.models,
                    models_length = models.length,
                    i;
                if (converse.show_only_online_users) {
                    ignored = _.union(ignored, ['dnd', 'xa', 'away']);
                }
                for (i=0; i<models_length; i++) {
                    if (_.indexOf(ignored, models[i].get('chat_status')) === -1) {
                        count++;
                    }
                }
                return count;
            },

            onRosterPush: function (iq) {
                /* Handle roster updates from the XMPP server.
                 * See: https://xmpp.org/rfcs/rfc6121.html#roster-syntax-actions-push
                 *
                 * Parameters:
                 *    (XMLElement) IQ - The IQ stanza received from the XMPP server.
                 */
                var id = iq.getAttribute('id');
                var from = iq.getAttribute('from');
                if (from && from !== "" && Strophe.getBareJidFromJid(from) !== converse.bare_jid) {
                    // Receiving client MUST ignore stanza unless it has no from or from = user's bare JID.
                    // XXX: Some naughty servers apparently send from a full
                    // JID so we need to explicitly compare bare jids here.
                    // https://github.com/jcbrand/converse.js/issues/493
                    converse.connection.send(
                        $iq({type: 'error', id: id, from: converse.connection.jid})
                            .c('error', {'type': 'cancel'})
                            .c('service-unavailable', {'xmlns': Strophe.NS.ROSTER })
                    );
                    return true;
                }
                converse.connection.send($iq({type: 'result', id: id, from: converse.connection.jid}));
                $(iq).children('query').find('item').each(function (idx, item) {
                    this.updateContact(item);
                }.bind(this));

                converse.emit('rosterPush', iq);
                return true;
            },

            fetchFromServer: function (callback) {
                /* Get the roster from the XMPP server */
                var iq = $iq({type: 'get', 'id': converse.connection.getUniqueId('roster')})
                        .c('query', {xmlns: Strophe.NS.ROSTER});
                return converse.connection.sendIQ(iq, function () {
                        this.onReceivedFromServer.apply(this, arguments);
                        callback.apply(this, arguments);
                    }.bind(this));
            },

            onReceivedFromServer: function (iq) {
                /* An IQ stanza containing the roster has been received from
                 * the XMPP server.
                 */
                converse.emit('roster', iq);
                $(iq).children('query').find('item').each(function (idx, item) {
                    this.updateContact(item);
                }.bind(this));
            },

            updateContact: function (item) {
                /* Update or create RosterContact models based on items
                 * received in the IQ from the server.
                 */
                var jid = item.getAttribute('jid');
                if (this.isSelf(jid)) { return; }
                var groups = [],
                    contact = this.get(jid),
                    ask = item.getAttribute("ask"),
                    subscription = item.getAttribute("subscription");
                $.map(item.getElementsByTagName('group'), function (group) {
                    groups.push(Strophe.getText(group));
                });
                if (!contact) {
                    if ((subscription === "none" && ask === null) || (subscription === "remove")) {
                        return; // We're lazy when adding contacts.
                    }
                    this.create({
                        ask: ask,
                        fullname: item.getAttribute("name") || jid,
                        groups: groups,
                        jid: jid,
                        subscription: subscription
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
                        subscription: subscription,
                        ask: ask,
                        requesting: null,
                        groups: groups
                    });
                }
            },

            createRequestingContact: function (presence) {
                /* Creates a Requesting Contact.
                 *
                 * Note: this method gets completely overridden by converse-vcard.js
                 */
                var bare_jid = Strophe.getBareJidFromJid(presence.getAttribute('from'));
                var nick = $(presence).children('nick[xmlns='+Strophe.NS.NICK+']').text();
                var user_data = {
                    jid: bare_jid,
                    subscription: 'none',
                    ask: null,
                    requesting: true,
                    fullname: nick || bare_jid,
                };
                this.create(user_data);
                converse.emit('contactRequest', user_data);
            },

            handleIncomingSubscription: function (presence) {
                var jid = presence.getAttribute('from');
                var bare_jid = Strophe.getBareJidFromJid(jid);
                var contact = this.get(bare_jid);
                if (!converse.allow_contact_requests) {
                    converse.rejectPresenceSubscription(
                        jid,
                        __("This client does not allow presence subscriptions")
                    );
                }
                if (converse.auto_subscribe) {
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
                    } else if (!contact) {
                        this.createRequestingContact(presence);
                    }
                }
            },

            presenceHandler: function (presence) {
                var $presence = $(presence),
                    presence_type = presence.getAttribute('type');
                if (presence_type === 'error') { return true; }
                var jid = presence.getAttribute('from'),
                    bare_jid = Strophe.getBareJidFromJid(jid),
                    resource = Strophe.getResourceFromJid(jid),
                    chat_status = $presence.find('show').text() || 'online',
                    status_message = $presence.find('status'),
                    contact = this.get(bare_jid);
                if (this.isSelf(bare_jid)) {
                    if ((converse.connection.jid !== jid) &&
                        (presence_type !== 'unavailable') &&
                        (converse.synchronize_availability === true ||
                         converse.synchronize_availability === resource)) {
                        // Another resource has changed its status and
                        // synchronize_availability option set to update,
                        // we'll update ours as well.
                        converse.xmppstatus.save({'status': chat_status});
                        if (status_message.length) {
                            converse.xmppstatus.save({
                                'status_message': status_message.text()
                            });
                        }
                    }
                    return;
                } else if (($presence.find('x').attr('xmlns') || '').indexOf(Strophe.NS.MUC) === 0) {
                    return; // Ignore MUC
                }
                if (contact && (status_message.text() !== contact.get('status'))) {
                    contact.save({'status': status_message.text()});
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
                    // Only set the user to offline if there aren't any
                    // other resources still available.
                    if (contact.removeResource(resource) === 0) {
                        contact.save({'chat_status': "offline"});
                    }
                } else if (contact) { // presence_type is undefined
                    this.addResource(bare_jid, resource);
                    contact.save({'chat_status': chat_status});
                }
            }
        });


        this.Message = Backbone.Model.extend({
            idAttribute: 'msgid',
            defaults: function(){
                return {
                    msgid: converse.connection.getUniqueId()
                };
            }
        });


        this.Messages = Backbone.Collection.extend({
            model: converse.Message,
            comparator: 'time'
        });


        this.ChatBox = Backbone.Model.extend({

            initialize: function () {
                this.messages = new converse.Messages();
                this.messages.browserStorage = new Backbone.BrowserStorage[converse.storage](
                    b64_sha1('converse.messages'+this.get('jid')+converse.bare_jid));
                this.save({
                    // The chat_state will be set to ACTIVE once the chat box is opened
                    // and we listen for change:chat_state, so shouldn't set it to ACTIVE here.
                    'box_id' : b64_sha1(this.get('jid')),
                    'chat_state': undefined,
                    'num_unread': this.get('num_unread') || 0,
                    'time_opened': this.get('time_opened') || moment().valueOf(),
                    'url': '',
                    'user_id' : Strophe.getNodeFromJid(this.get('jid'))
                });
            },

            createMessage: function ($message, $delay) {
                $delay = $delay || $message.find('delay');
                var body = $message.children('body').text(),
                    delayed = $delay.length > 0,
                    fullname = this.get('fullname'),
                    is_groupchat = $message.attr('type') === 'groupchat',
                    msgid = $message.attr('id'),
                    chat_state = $message.find(converse.COMPOSING).length && converse.COMPOSING ||
                        $message.find(converse.PAUSED).length && converse.PAUSED ||
                        $message.find(converse.INACTIVE).length && converse.INACTIVE ||
                        $message.find(converse.ACTIVE).length && converse.ACTIVE ||
                        $message.find(converse.GONE).length && converse.GONE,
                    stamp, time, sender, from;

                if (is_groupchat) {
                    from = Strophe.unescapeNode(Strophe.getResourceFromJid($message.attr('from')));
                } else {
                    from = Strophe.getBareJidFromJid($message.attr('from'));
                }
                if (_.isEmpty(fullname)) {
                    fullname = from;
                }
                if (delayed) {
                    stamp = $delay.attr('stamp');
                    time = stamp;
                } else {
                    time = moment().format();
                }
                if ((is_groupchat && from === this.get('nick')) || (!is_groupchat && from === converse.bare_jid)) {
                    sender = 'me';
                } else {
                    sender = 'them';
                }
                return this.messages.create({
                    chat_state: chat_state,
                    delayed: delayed,
                    fullname: fullname,
                    message: body || undefined,
                    msgid: msgid,
                    sender: sender,
                    time: time
                });
            }
        });
        
        this.ChatBoxes = Backbone.Collection.extend({
            model: converse.ChatBox,
            comparator: 'time_opened',

            registerMessageHandler: function () {
                converse.connection.addHandler(
                    function (message) {
                        this.onMessage(message);
                        return true;
                    }.bind(this), null, 'message', 'chat');
            },

            chatBoxMayBeShown: function (chatbox) {
                return true;
            },

            onChatBoxesFetched: function (collection) {
                /* Show chat boxes upon receiving them from sessionStorage
                 *
                 * This method gets overridden entirely in src/converse-controlbox.js
                 * if the controlbox plugin is active.
                 */
                collection.each(function (chatbox) {
                    if (this.chatBoxMayBeShown(chatbox)) {
                        chatbox.trigger('show');
                    }
                }.bind(this));
                converse.emit('chatBoxesFetched');
            },

            onConnected: function () {
                this.browserStorage = new Backbone.BrowserStorage[converse.storage](
                    b64_sha1('converse.chatboxes-'+converse.bare_jid));
                this.registerMessageHandler();
                this.fetch({
                    add: true,
                    success: this.onChatBoxesFetched.bind(this)
                });
            },

            onMessage: function (message) {
                /* Handler method for all incoming single-user chat "message"
                 * stanzas.
                 */
                var $message = $(message),
                    contact_jid, $forwarded, $delay, from_bare_jid,
                    from_resource, is_me, msgid,
                    chatbox, resource,
                    from_jid = $message.attr('from'),
                    to_jid = $message.attr('to'),
                    to_resource = Strophe.getResourceFromJid(to_jid);

                if (to_resource && to_resource !== converse.resource) {
                    converse.log(
                        'onMessage: Ignoring incoming message intended for a different resource: '+to_jid,
                        'info'
                    );
                    return true;
                } else if (from_jid === converse.connection.jid) {
                    // FIXME: Forwarded messages should be sent to specific
                    // resources, not broadcasted
                    converse.log(
                        "onMessage: Ignoring incoming message sent from this client's JID: "+from_jid,
                        'info'
                    );
                    return true;
                } else if (utils.isHeadlineMessage(message)) {
                    // XXX: Ideally we wouldn't have to check for headline
                    // messages, but Prosody sends headline messages with the
                    // wrong type ('chat'), so we need to filter them out here.
                    converse.log(
                        "onMessage: Ignoring incoming headline message sent with type 'chat' from JID: "+from_jid,
                        'info'
                    );
                    return true;
                }
                $forwarded = $message.find('forwarded');
                if ($forwarded.length) {
                    $message = $forwarded.children('message');
                    $delay = $forwarded.children('delay');
                    from_jid = $message.attr('from');
                    to_jid = $message.attr('to');
                }
                from_bare_jid = Strophe.getBareJidFromJid(from_jid);
                from_resource = Strophe.getResourceFromJid(from_jid);
                is_me = from_bare_jid === converse.bare_jid;
                msgid = $message.attr('id');

                if (is_me) {
                    // I am the sender, so this must be a forwarded message...
                    contact_jid = Strophe.getBareJidFromJid(to_jid);
                    resource = Strophe.getResourceFromJid(to_jid);
                } else {
                    contact_jid = from_bare_jid;
                    resource = from_resource;
                }
                // Get chat box, but only create a new one when the message has a body.
                chatbox = this.getChatBox(contact_jid, $message.find('body').length > 0);
                if (!chatbox) {
                    return true;
                }
                if (msgid && chatbox.messages.findWhere({msgid: msgid})) {
                    return true; // We already have this message stored.
                }
                chatbox.createMessage($message, $delay);
                converse.roster.addResource(contact_jid, resource);
                converse.emit('message', message);
                return true;
            },

            getChatBox: function (jid, create) {
                /* Returns a chat box or optionally return a newly
                 * created one if one doesn't exist.
                 *
                 * Parameters:
                 *    (String) jid - The JID of the user whose chat box we want
                 *    (Boolean) create - Should a new chat box be created if none exists?
                 */
                jid = jid.toLowerCase();
                var bare_jid = Strophe.getBareJidFromJid(jid);
                var chatbox = this.get(bare_jid);
                if (!chatbox && create) {
                    var roster_item = converse.roster.get(bare_jid);
                    if (roster_item === undefined) {
                        converse.log('Could not get roster item for JID '+bare_jid, 'error');
                        return;
                    }
                    chatbox = this.create({
                        'id': bare_jid,
                        'jid': bare_jid,
                        'fullname': _.isEmpty(roster_item.get('fullname'))? jid: roster_item.get('fullname'),
                        'image_type': roster_item.get('image_type'),
                        'image': roster_item.get('image'),
                        'url': roster_item.get('url')
                    });
                }
                return chatbox;
            }
        });

        this.ChatBoxViews = Backbone.Overview.extend({

            initialize: function () {
                this.model.on("add", this.onChatBoxAdded, this);
                this.model.on("destroy", this.removeChat, this);
            },

            _ensureElement: function () {
                /* Override method from backbone.js
                 * If the #conversejs element doesn't exist, create it.
                 */
                if (!this.el) {
                    var $el = $('#conversejs');
                    if (!$el.length) {
                        $el = $('<div id="conversejs">');
                        $('body').append($el);
                    }
                    $el.html(converse.templates.chats_panel());
                    this.setElement($el, false);
                } else {
                    this.setElement(_.result(this, 'el'), false);
                }
            },

            onChatBoxAdded: function (item) {
                // Views aren't created here, since the core code doesn't
                // contain any views. Instead, they're created in overrides in
                // plugins, such as in converse-chatview.js and converse-muc.js
                return this.get(item.get('id'));
            },

            removeChat: function (item) {
                this.remove(item.get('id'));
            },

            closeAllChatBoxes: function () {
                /* This method gets overridden in src/converse-controlbox.js if
                 * the controlbox plugin is active.
                 */
                this.each(function (view) { view.close(); });
                return this;
            },

            chatBoxMayBeShown: function (chatbox) {
                return this.model.chatBoxMayBeShown(chatbox);
            },

            showChat: function (attrs) {
                /* Find the chat box and show it (if it may be shown).
                 * If it doesn't exist, create it.
                 */
                var chatbox  = this.model.get(attrs.jid);
                if (!chatbox) {
                    chatbox = this.model.create(attrs, {
                        'error': function (model, response) {
                            converse.log(response.responseText);
                        }
                    });
                }
                if (this.chatBoxMayBeShown(chatbox)) {
                    chatbox.trigger('show', true);
                }
                return chatbox;
            }
        });


        this.XMPPStatus = Backbone.Model.extend({
            initialize: function () {
                this.set({
                    'status' : this.getStatus()
                });
                this.on('change', function (item) {
                    if (_.has(item.changed, 'status')) {
                        converse.emit('statusChanged', this.get('status'));
                    }
                    if (_.has(item.changed, 'status_message')) {
                        converse.emit('statusMessageChanged', this.get('status_message'));
                    }
                }.bind(this));
            },

            constructPresence: function (type, status_message) {
                if (typeof type !== 'string') {
                    type = this.get('status') || 'online';
                }
                if (typeof status_message !== 'string') {
                    status_message = this.get('status_message');
                }
                var presence;
                // Most of these presence types are actually not explicitly sent,
                // but I add all of them here fore reference and future proofing.
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
                    if (status_message) {
                        presence.c('show').t(type);
                    }
                } else {
                    if (type === 'online') {
                        presence = $pres();
                    } else {
                        presence = $pres().c('show').t(type).up();
                    }
                    if (status_message) {
                        presence.c('status').t(status_message);
                    }
                }
                return presence;
            },

            sendPresence: function (type, status_message) {
                converse.connection.send(this.constructPresence(type, status_message));
            },

            setStatus: function (value) {
                this.sendPresence(value);
                this.save({'status': value});
            },

            getStatus: function () {
                return this.get('status') || 'online';
            },

            setStatusMessage: function (status_message) {
                this.sendPresence(this.getStatus(), status_message);
                var prev_status = this.get('status_message');
                this.save({'status_message': status_message});
                if (this.xhr_custom_status) {
                    $.ajax({
                        url:  this.xhr_custom_status_url,
                        type: 'POST',
                        data: {'msg': status_message}
                    });
                }
                if (prev_status === status_message) {
                    this.trigger("update-status-ui", this);
                }
            }
        });

        this.Session = Backbone.Model; // General session settings to be saved to sessionStorage.
        this.Feature = Backbone.Model;
        this.Features = Backbone.Collection.extend({
            /* Service Discovery
             * -----------------
             * This collection stores Feature Models, representing features
             * provided by available XMPP entities (e.g. servers)
             * See XEP-0030 for more details: http://xmpp.org/extensions/xep-0030.html
             * All features are shown here: http://xmpp.org/registrar/disco-features.html
             */
            model: converse.Feature,
            initialize: function () {
                this.addClientIdentities().addClientFeatures();
                this.browserStorage = new Backbone.BrowserStorage[converse.storage](
                    b64_sha1('converse.features'+converse.bare_jid));
                this.on('add', this.onFeatureAdded, this);
                if (this.browserStorage.records.length === 0) {
                    // browserStorage is empty, so we've likely never queried this
                    // domain for features yet
                    converse.connection.disco.info(converse.domain, null, this.onInfo.bind(this));
                    converse.connection.disco.items(converse.domain, null, this.onItems.bind(this));
                } else {
                    this.fetch({add:true});
                }
            },

            onFeatureAdded: function (feature) {
                converse.emit('serviceDiscovered', feature);
            },

            addClientIdentities: function () {
                /* See http://xmpp.org/registrar/disco-categories.html
                 */
                 converse.connection.disco.addIdentity('client', 'web', 'Converse.js');
                 return this;
            },

            addClientFeatures: function () {
                /* The strophe.disco.js plugin keeps a list of features which
                 * it will advertise to any #info queries made to it.
                 *
                 * See: http://xmpp.org/extensions/xep-0030.html#info
                 */
                converse.connection.disco.addFeature(Strophe.NS.BOSH);
                converse.connection.disco.addFeature(Strophe.NS.CHATSTATES);
                converse.connection.disco.addFeature(Strophe.NS.DISCO_INFO);
                converse.connection.disco.addFeature(Strophe.NS.ROSTERX); // Limited support
                if (converse.message_carbons) {
                    converse.connection.disco.addFeature(Strophe.NS.CARBONS);
                }
                return this;
            },

            onItems: function (stanza) {
                $(stanza).find('query item').each(function (idx, item) {
                    converse.connection.disco.info(
                        $(item).attr('jid'),
                        null,
                        this.onInfo.bind(this));
                }.bind(this));
            },

            onInfo: function (stanza) {
                var $stanza = $(stanza);
                if (($stanza.find('identity[category=server][type=im]').length === 0) &&
                    ($stanza.find('identity[category=conference][type=text]').length === 0)) {
                    // This isn't an IM server component
                    return;
                }
                $stanza.find('feature').each(function (idx, feature) {
                    var namespace = $(feature).attr('var');
                    this[namespace] = true;
                    this.create({
                        'var': namespace,
                        'from': $stanza.attr('from')
                    });
                }.bind(this));
            }
        });

        this.setUpXMLLogging = function () {
            if (this.debug) {
                this.connection.xmlInput = function (body) { converse.log(body.outerHTML); };
                this.connection.xmlOutput = function (body) { converse.log(body.outerHTML); };
            }
        };

        this.fetchLoginCredentials = function () {
            var deferred = new $.Deferred();
            $.ajax({
                url:  converse.credentials_url,
                type: 'GET',
                dataType: "json",
                success: function (response) {
                    deferred.resolve({
                        'jid': response.jid,
                        'password': response.password
                    });
                },
                error: function (response) {
                    delete converse.connection;
                    converse.emit('noResumeableSession');
                    deferred.reject(response);
                }
            });
            return deferred.promise();
        };

        this.startNewBOSHSession = function () {
            $.ajax({
                url:  this.prebind_url,
                type: 'GET',
                dataType: "json",
                success: function (response) {
                    this.connection.attach(
                            response.jid,
                            response.sid,
                            response.rid,
                            this.onConnectStatusChanged
                    );
                }.bind(this),
                error: function (response) {
                    delete this.connection;
                    this.emit('noResumeableSession');
                }.bind(this)
            });
        };

        this.attemptPreboundSession = function (tokens) {
            /* Handle session resumption or initialization when prebind is being used.
             */
            if (this.jid && this.sid && this.rid) {
                return this.connection.attach(this.jid, this.sid, this.rid, this.onConnectStatusChanged);
            } else if (this.keepalive) {
                if (!this.jid) {
                    throw new Error("attemptPreboundSession: when using 'keepalive' with 'prebind, "+
                                    "you must supply the JID of the current user.");
                }
                try {
                    return this.connection.restore(this.jid, this.onConnectStatusChanged);
                } catch (e) {
                    this.log("Could not restore session for jid: "+this.jid+" Error message: "+e.message);
                    this.clearSession(); // If there's a roster, we want to clear it (see #555)
                }
            } else {
                throw new Error("attemptPreboundSession: If you use prebind and not keepalive, "+
                    "then you MUST supply JID, RID and SID values");
            }
            // We haven't been able to attach yet. Let's see if there
            // is a prebind_url, otherwise there's nothing with which
            // we can attach.
            if (this.prebind_url) {
                this.startNewBOSHSession();
            } else {
                delete this.connection;
                this.emit('noResumeableSession');
            }
        };

        this.autoLogin = function (credentials) {
            if (credentials) {
                // If passed in, then they come from credentials_url, so we
                // set them on the converse object.
                this.jid = credentials.jid;
                this.password = credentials.password;
            }
            if (this.authentication === converse.ANONYMOUS) {
                this.connection.connect(this.jid.toLowerCase(), null, this.onConnectStatusChanged);
            } else if (this.authentication === converse.LOGIN) {
                if (!this.password) {
                    throw new Error("initConnection: If you use auto_login and "+
                        "authentication='login' then you also need to provide a password.");
                }
                var resource = Strophe.getResourceFromJid(this.jid);
                if (!resource) {
                    this.jid = this.jid.toLowerCase() + converse.generateResource();
                } else {
                    this.jid = Strophe.getBareJidFromJid(this.jid).toLowerCase()+'/'+resource;
                }
                this.connection.connect(this.jid, this.password, this.onConnectStatusChanged);
            }
        };

        this.attemptNonPreboundSession = function () {
            /* Handle session resumption or initialization when prebind is not being used.
             *
             * Two potential options exist and are handled in this method:
             *  1. keepalive
             *  2. auto_login
             */
            if (this.keepalive) {
                try {
                    return this.connection.restore(undefined, this.onConnectStatusChanged);
                } catch (e) {
                    this.log("Could not restore session. Error message: "+e.message);
                    this.clearSession(); // If there's a roster, we want to clear it (see #555)
                }
            }
            if (this.auto_login) {
                if (this.credentials_url) {
                    this.fetchLoginCredentials().done(this.autoLogin.bind(this));
                } else if (!this.jid) {
                    throw new Error(
                        "initConnection: If you use auto_login, you also need"+
                        "to give either a jid value (and if applicable a "+
                        "password) or you need to pass in a URL from where the "+
                        "username and password can be fetched (via credentials_url)."
                    );
                } else {
                    this.autoLogin();
                }
            }
        };

        this.logIn = function (credentials) {
            if (credentials) {
                // When credentials are passed in, they override prebinding
                // or credentials fetching via HTTP
                this.autoLogin(credentials);
            } else {
                // We now try to resume or automatically set up a new session.
                // Otherwise the user will be shown a login form.
                if (this.authentication === converse.PREBIND) {
                    this.attemptPreboundSession();
                } else {
                    this.attemptNonPreboundSession();
                }
            }
        };

        this.initConnection = function () {
            if (this.connection) {
                return;
            }
            if (!this.bosh_service_url && ! this.websocket_url) {
                throw new Error("initConnection: you must supply a value for either the bosh_service_url or websocket_url or both.");
            }
            if (('WebSocket' in window || 'MozWebSocket' in window) && this.websocket_url) {
                this.connection = new Strophe.Connection(this.websocket_url);
            } else if (this.bosh_service_url) {
                this.connection = new Strophe.Connection(this.bosh_service_url, {'keepalive': this.keepalive});
            } else {
                throw new Error("initConnection: this browser does not support websockets and bosh_service_url wasn't specified.");
            }
        };

        this._tearDown = function () {
            /* Remove those views which are only allowed with a valid
             * connection.
             */
            if (this.roster) {
                this.roster.off().reset(); // Removes roster contacts
            }
            this.chatboxes.remove(); // Don't call off(), events won't get re-registered upon reconnect.
            if (this.features) {
                this.features.reset();
            }
            $(window).off('click mousemove keypress focus'+unloadevent, converse.onUserActivity);
            window.clearInterval(converse.everySecondTrigger);
            return this;
        };

        this._initialize = function () {
            this.chatboxes = new this.ChatBoxes();
            this.chatboxviews = new this.ChatBoxViews({model: this.chatboxes});
            this.initSession();
            this.initConnection();
            this.setUpXMLLogging();
            this.logIn();
            return this;
        };

        this.wrappedOverride = function (key, value, super_method) {
            // We create a partially applied wrapper function, that
            // makes sure to set the proper super method when the
            // overriding method is called. This is done to enable
            // chaining of plugin methods, all the way up to the
            // original method.
            this._super[key] = super_method;
            return value.apply(this, _.rest(arguments, 3));
        };

        this._overrideAttribute = function (key, plugin) {
            // See converse.plugins.override
            var value = plugin.overrides[key];
            if (typeof value === "function") {
                var wrapped_function = _.partial(
                    converse.wrappedOverride.bind(converse),
                        key, value, converse[key].bind(converse)
                );
                converse[key] = wrapped_function;
            } else {
                converse[key] = value;
            }
        };

        this._extendObject = function (obj, attributes) {
            // See converse.plugins.extend
            if (!obj.prototype._super) {
                obj.prototype._super = {'converse': converse};
            }
            _.each(attributes, function (value, key) {
                if (key === 'events') {
                    obj.prototype[key] = _.extend(value, obj.prototype[key]);
                } else if (typeof value === 'function') {
                    // We create a partially applied wrapper function, that
                    // makes sure to set the proper super method when the
                    // overriding method is called. This is done to enable
                    // chaining of plugin methods, all the way up to the
                    // original method.
                    var wrapped_function = _.partial(
                        converse.wrappedOverride,
                            key, value, obj.prototype[key]
                    );
                    obj.prototype[key] = wrapped_function;
                } else {
                    obj.prototype[key] = value;
                }
            });
        };

        this.initializePlugins = function () {
            if (typeof converse._super === 'undefined') {
                converse._super = { 'converse': converse };
            }

            var updateSettings = function (settings) {
                /* Helper method which gets put on the plugin and allows it to
                 * add more user-facing config settings to converse.js.
                 */
                _.extend(converse.default_settings, settings);
                _.extend(converse, settings);
                _.extend(converse, _.pick(converse.user_settings, Object.keys(settings)));
            };

            _.each(_.keys(this.plugins), function (name) {
                var plugin = this.plugins[name];
                plugin.updateSettings = updateSettings;

                if (_.contains(this.initialized_plugins, name)) {
                    // Don't initialize plugins twice, otherwise we get
                    // infinite recursion in overridden methods.
                    return;
                }
                plugin.converse = converse;
                _.each(Object.keys(plugin.overrides || {}), function (key) {
                    /* We automatically override all methods and Backbone views and
                     * models that are in the "overrides" namespace.
                     */
                    var msg,
                        override = plugin.overrides[key];
                    if (typeof override === "object") {
                        if (typeof converse[key] === 'undefined') {
                            msg = "Error: Plugin tried to override "+key+" but it's not found.";
                            if (converse.strict_plugin_dependencies) {
                                throw msg;
                            } else {
                                converse.log(msg);
                            }
                        }
                        this._extendObject(converse[key], override);
                    } else {
                        this._overrideAttribute(key, plugin);
                    }
                }.bind(this));

                if (typeof plugin.initialize === "function") {
                    plugin.initialize.bind(plugin)(this);
                }
                this.initialized_plugins.push(name);
            }.bind(this));
        };

        // Initialization
        // --------------
        // This is the end of the initialize method.
        if (settings.connection) {
            this.connection = settings.connection;
        }
        this.initializePlugins();
        this._initialize();
        this.registerGlobalEventHandlers();
    };
    return converse;
}));
