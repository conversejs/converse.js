/*!
 * Converse.js (Web-based XMPP instant messaging client)
 * http://conversejs.org
 *
 * Copyright (c) 2012, Jan-Carel Brand <jc@opkode.com>
 * Licensed under the Mozilla Public License (MPL)
 */

// AMD/global registrations
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define("converse",
              ["converse-dependencies", "converse-templates"],
            function(dependencies, templates) {
                var otr = dependencies.otr,
                    moment = dependencies.moment;
                if (typeof otr !== "undefined") {
                    return factory(jQuery, _, otr.OTR, otr.DSA, templates, moment);
                } else {
                    return factory(jQuery, _, undefined, undefined, templates, moment);
                }
            }
        );
    } else {
        root.converse = factory(jQuery, _, OTR, DSA, JST, moment);
    }
}(this, function ($, _, OTR, DSA, templates, moment) {
    // "use strict";
    // Cannot use this due to Safari bug.
    // See https://github.com/jcbrand/converse.js/issues/196
    if (typeof console === "undefined" || typeof console.log === "undefined") {
        console = { log: function () {}, error: function () {} };
    }

    // Configuration of underscore templates (this config is distict to the
    // config of requirejs-tpl in main.js). This one is for normal inline
    // templates.
    // Use Mustache style syntax for variable interpolation
    _.templateSettings = {
        evaluate : /\{\[([\s\S]+?)\]\}/g,
        interpolate : /\{\{([\s\S]+?)\}\}/g
    };

    // TODO: these non-backbone methods should all be moved to utils.
    $.fn.addHyperlinks = function() {
        if (this.length > 0) {
            this.each(function(i, obj) {
                var x = $(obj).html();
                var list = x.match(/\b(https?:\/\/|www\.|https?:\/\/www\.)[^\s<]{2,200}\b/g );
                if (list) {
                    for (i=0; i<list.length; i++) {
                        var prot = list[i].indexOf('http://') === 0 || list[i].indexOf('https://') === 0 ? '' : 'http://';
                        var escaped_url = encodeURI(decodeURI(list[i])).replace(/[!'()]/g, escape).replace(/\*/g, "%2A");
                        x = x.replace(list[i], "<a target='_blank' href='" + prot + escaped_url + "'>"+ list[i] + "</a>" );
                    }
                }
                $(obj).html(x);
            });
        }
        return this;
    };

    var contains = function (attr, query) {
        return function (item) {
            if (typeof attr === 'object') {
                var value = false;
                _.each(attr, function (a) {
                    value = value || item.get(a).toLowerCase().indexOf(query.toLowerCase()) !== -1;
                });
                return value;
            } else if (typeof attr === 'string') {
                return item.get(attr).toLowerCase().indexOf(query.toLowerCase()) !== -1;
            } else {
                throw new Error('Wrong attribute type. Must be string or array.');
            }
        };
    };
    contains.not = function (attr, query) {
        return function (item) {
            return !(contains(attr, query)(item));
        };
    };

    String.prototype.splitOnce = function (delimiter) {
        var components = this.split(delimiter);
        return [components.shift(), components.join(delimiter)];
    };

    var playNotification = function () {
        var audio;
        if (converse.play_sounds && typeof Audio !== "undefined"){
            audio = new Audio("sounds/msg_received.ogg");
            if (audio.canPlayType('/audio/ogg')) {
                audio.play();
            } else {
                audio = new Audio("/sounds/msg_received.mp3");
                audio.play();
            }
        }
    };

    $.fn.addEmoticons = function() {
        if (converse.visible_toolbar_buttons.emoticons) {
            if (this.length > 0) {
                this.each(function(i, obj) {
                    var text = $(obj).html();
                    text = text.replace(/&gt;:\)/g, '<span class="emoticon icon-evil"></span>');
                    text = text.replace(/:\)/g, '<span class="emoticon icon-smiley"></span>');
                    text = text.replace(/:\-\)/g, '<span class="emoticon icon-smiley"></span>');
                    text = text.replace(/;\)/g, '<span class="emoticon icon-wink"></span>');
                    text = text.replace(/;\-\)/g, '<span class="emoticon icon-wink"></span>');
                    text = text.replace(/:D/g, '<span class="emoticon icon-grin"></span>');
                    text = text.replace(/:\-D/g, '<span class="emoticon icon-grin"></span>');
                    text = text.replace(/:P/g, '<span class="emoticon icon-tongue"></span>');
                    text = text.replace(/:\-P/g, '<span class="emoticon icon-tongue"></span>');
                    text = text.replace(/:p/g, '<span class="emoticon icon-tongue"></span>');
                    text = text.replace(/:\-p/g, '<span class="emoticon icon-tongue"></span>');
                    text = text.replace(/8\)/g, '<span class="emoticon icon-cool"></span>');
                    text = text.replace(/:S/g, '<span class="emoticon icon-confused"></span>');
                    text = text.replace(/:\\/g, '<span class="emoticon icon-wondering"></span>');
                    text = text.replace(/:\/ /g, '<span class="emoticon icon-wondering"></span>');
                    text = text.replace(/&gt;:\(/g, '<span class="emoticon icon-angry"></span>');
                    text = text.replace(/:\(/g, '<span class="emoticon icon-sad"></span>');
                    text = text.replace(/:\-\(/g, '<span class="emoticon icon-sad"></span>');
                    text = text.replace(/:O/g, '<span class="emoticon icon-shocked"></span>');
                    text = text.replace(/:\-O/g, '<span class="emoticon icon-shocked"></span>');
                    text = text.replace(/\=\-O/g, '<span class="emoticon icon-shocked"></span>');
                    text = text.replace(/\(\^.\^\)b/g, '<span class="emoticon icon-thumbs-up"></span>');
                    text = text.replace(/&lt;3/g, '<span class="emoticon icon-heart"></span>');
                    $(obj).html(text);
                });
            }
        }
        return this;
    };

    var converse = {
        templates: templates,
        emit: function(evt, data) {
            $(this).trigger(evt, data);
        },
        once: function(evt, handler) {
            $(this).one(evt, handler);
        },
        on: function(evt, handler) {
            $(this).bind(evt, handler);
        },
        off: function(evt, handler) {
            $(this).unbind(evt, handler);
        },
        refreshWebkit: function () {
            /* This works around a webkit bug. Refresh the browser's viewport,
            * otherwise chatboxes are not moved along when one is closed.
            */
            if ($.browser.webkit) {
                var conversejs = document.getElementById('conversejs');
                conversejs.style.display = 'none';
                conversejs.offsetHeight = conversejs.offsetHeight;
                conversejs.style.display = 'block';
            }
        }
    };

    converse.initialize = function (settings, callback) {
        var converse = this;

        // Constants
        // ---------
        var UNENCRYPTED = 0;
        var UNVERIFIED= 1;
        var VERIFIED= 2;
        var FINISHED = 3;
        var KEY = {
            ENTER: 13
        };
        var STATUS_WEIGHTS = {
            'offline':      6,
            'unavailable':  5,
            'xa':           4,
            'away':         3,
            'dnd':          2,
            'online':       1
        };

        var INACTIVE = 'inactive';
        var ACTIVE = 'active';
        var COMPOSING = 'composing';
        var PAUSED = 'paused';
        var GONE = 'gone';

        var HAS_CSPRNG = ((typeof crypto !== 'undefined') &&
            ((typeof crypto.randomBytes === 'function') ||
                (typeof crypto.getRandomValues === 'function')
        ));
        var HAS_CRYPTO = HAS_CSPRNG && (
            (typeof CryptoJS !== "undefined") &&
            (typeof OTR !== "undefined") &&
            (typeof DSA !== "undefined")
        );

        var OPENED = 'opened';
        var CLOSED = 'closed';

        // Default configuration values
        // ----------------------------
        this.allow_contact_requests = true;
        this.allow_dragresize = true;
        this.allow_logout = true;
        this.allow_muc = true;
        this.allow_otr = true;
        this.animate = true;
        this.auto_list_rooms = false;
        this.auto_reconnect = false;
        this.auto_subscribe = false;
        this.bosh_service_url = undefined; // The BOSH connection manager URL.
        this.cache_otr_key = false;
        this.debug = false;
        this.default_box_height = 324; // The default height, in pixels, for the control box, chat boxes and chatrooms.
        this.expose_rid_and_sid = false;
        this.forward_messages = false;
        this.hide_muc_server = false;
        this.i18n = locales.en;
        this.keepalive = false;
        this.message_carbons = false;
        this.no_trimming = false; // Set to true for phantomjs tests (where browser apparently has no width)
        this.play_sounds = false;
        this.prebind = false;
        this.roster_groups = false;
        this.show_controlbox_by_default = false;
        this.show_only_online_users = false;
        this.show_toolbar = true;
        this.storage = 'session';
        this.use_otr_by_default = false;
        this.use_vcards = true;
        this.visible_toolbar_buttons = {
            'emoticons': true,
            'call': false,
            'clear': true,
            'toggle_participants': true
        };
        this.xhr_custom_status = false;
        this.xhr_custom_status_url = '';
        this.xhr_user_search = false;
        this.xhr_user_search_url = '';

        // Allow only whitelisted configuration attributes to be overwritten
        _.extend(this, _.pick(settings, [
            'allow_contact_requests',
            'allow_dragresize',
            'allow_logout',
            'allow_muc',
            'allow_otr',
            'animate',
            'auto_list_rooms',
            'auto_reconnect',
            'auto_subscribe',
            'bosh_service_url',
            'cache_otr_key',
            'connection',
            'debug',
            'default_box_height',
            'keepalive',
            'message_carbons',
            'expose_rid_and_sid',
            'forward_messages',
            'fullname',
            'hide_muc_server',
            'i18n',
            'jid',
            'no_trimming',
            'play_sounds',
            'prebind',
            'rid',
            'roster_groups',
            'show_controlbox_by_default',
            'show_only_online_users',
            'show_toolbar',
            'sid',
            'storage',
            'use_otr_by_default',
            'use_vcards',
            'xhr_custom_status',
            'xhr_custom_status_url',
            'xhr_user_search',
            'xhr_user_search_url'
        ]));
        if (settings.visible_toolbar_buttons) {
            _.extend(
                this.visible_toolbar_buttons,
                _.pick(settings.visible_toolbar_buttons, [
                    'emoticons', 'call', 'clear', 'toggle_participants'
                ]
            ));
        }
        $.fx.off = !this.animate;

        // Only allow OTR if we have the capability
        this.allow_otr = this.allow_otr && HAS_CRYPTO;

        // Only use OTR by default if allow OTR is enabled to begin with
        this.use_otr_by_default = this.use_otr_by_default && this.allow_otr;

        // Translation machinery
        // ---------------------
        var __ = $.proxy(function (str) {
            // Translation factory
            if (this.i18n === undefined) {
                this.i18n = locales.en;
            }
            var t = this.i18n.translate(str);
            if (arguments.length>1) {
                return t.fetch.apply(t, [].slice.call(arguments,1));
            } else {
                return t.fetch();
            }
        }, this);

        var ___ = function (str) {
            /* XXX: This is part of a hack to get gettext to scan strings to be
             * translated. Strings we cannot send to the function above because
             * they require variable interpolation and we don't yet have the
             * variables at scan time.
             *
             * See actionInfoMessages
             */
            return str;
        };

        // Translation aware constants
        // ---------------------------
        var OTR_CLASS_MAPPING = {};
        OTR_CLASS_MAPPING[UNENCRYPTED] = 'unencrypted';
        OTR_CLASS_MAPPING[UNVERIFIED] = 'unverified';
        OTR_CLASS_MAPPING[VERIFIED] = 'verified';
        OTR_CLASS_MAPPING[FINISHED] = 'finished';

        var OTR_TRANSLATED_MAPPING  = {};
        OTR_TRANSLATED_MAPPING[UNENCRYPTED] = __('unencrypted');
        OTR_TRANSLATED_MAPPING[UNVERIFIED] = __('unverified');
        OTR_TRANSLATED_MAPPING[VERIFIED] = __('verified');
        OTR_TRANSLATED_MAPPING[FINISHED] = __('finished');

        var STATUSES = {
            'dnd': __('This contact is busy'),
            'online': __('This contact is online'),
            'offline': __('This contact is offline'),
            'unavailable': __('This contact is unavailable'),
            'xa': __('This contact is away for an extended period'),
            'away': __('This contact is away')
        };
        var DESC_GROUP_TOGGLE = __('Click to hide these contacts');

        var HEADER_CURRENT_CONTACTS =  __('My contacts');
        var HEADER_PENDING_CONTACTS = __('Pending contacts');
        var HEADER_REQUESTING_CONTACTS = __('Contact requests');
        var HEADER_UNGROUPED = __('Ungrouped');

        var LABEL_CONTACTS = __('Contacts');
        var LABEL_GROUPS = __('Groups');

        var HEADER_WEIGHTS = {};
        HEADER_WEIGHTS[HEADER_CURRENT_CONTACTS]    = 0;
        HEADER_WEIGHTS[HEADER_UNGROUPED]           = 1;
        HEADER_WEIGHTS[HEADER_REQUESTING_CONTACTS] = 2;
        HEADER_WEIGHTS[HEADER_PENDING_CONTACTS]    = 3;

        // Module-level variables
        // ----------------------
        this.callback = callback || function () {};
        this.initial_presence_sent = 0;
        this.msg_counter = 0;

        // Module-level functions
        // ----------------------
        this.giveFeedback = function (message, klass) {
            $('.conn-feedback').attr('class', 'conn-feedback').text(message);
            if (klass) {
                $('.conn-feedback').addClass(klass);
            }
        };

        this.log = function (txt, level) {
            if (this.debug) {
                if (level == 'error') {
                    console.log('ERROR: '+txt);
                } else {
                    console.log(txt);
                }
            }
        };

        this.getVCard = function (jid, callback, errback) {
            if (!this.use_vcards) {
                if (callback) {
                    callback(jid, jid);
                }
                return;
            }
            converse.connection.vcard.get(
                $.proxy(function (iq) {
                    // Successful callback
                    var $vcard = $(iq).find('vCard');
                    var fullname = $vcard.find('FN').text(),
                        img = $vcard.find('BINVAL').text(),
                        img_type = $vcard.find('TYPE').text(),
                        url = $vcard.find('URL').text();
                    if (jid) {
                        var contact = converse.roster.get(jid);
                        if (contact) {
                            fullname = _.isEmpty(fullname)? contact.get('fullname') || jid: fullname;
                            contact.save({
                                'fullname': fullname,
                                'image_type': img_type,
                                'image': img,
                                'url': url,
                                'vcard_updated': moment().format()
                            });
                        }
                    }
                    if (callback) {
                        callback(jid, fullname, img, img_type, url);
                    }
                }, this),
                jid,
                function (iq) {
                    // Error callback
                    var contact = converse.roster.get(jid);
                    if (contact) {
                        contact.save({
                            'vcard_updated': moment().format()
                        });
                    }
                    if (errback) {
                        errback(jid, iq);
                    }
                }
            );
        };

        this.reconnect = function () {
            converse.giveFeedback(__('Reconnecting'), 'error');
            converse.emit('reconnect');
            if (!converse.prebind) {
                this.connection.connect(
                    this.connection.jid,
                    this.connection.pass,
                    function (status, condition) {
                        converse.onConnect(status, condition, true);
                    },
                    this.connection.wait,
                    this.connection.hold,
                    this.connection.route
                );
            }
        };

        this.renderLoginPanel = function () {
            converse._tearDown();
            var view = converse.chatboxviews.get('controlbox');
            view.model.set({connected:false});
            view.renderLoginPanel();
        };

        this.onConnect = function (status, condition, reconnect) {
            var $button, $form;
            if ((status === Strophe.Status.CONNECTED) ||
                (status === Strophe.Status.ATTACHED)) {
                if ((typeof reconnect !== 'undefined') && (reconnect)) {
                    converse.log(status === Strophe.Status.CONNECTED ? 'Reconnected' : 'Reattached');
                    converse.onReconnected();
                } else {
                    converse.log(status === Strophe.Status.CONNECTED ? 'Connected' : 'Attached');
                    converse.onConnected();
                }
            } else if (status === Strophe.Status.DISCONNECTED) {
                converse.giveFeedback(__('Disconnected'), 'error');
                if (converse.auto_reconnect) {
                    converse.reconnect();
                } else {
                    converse.renderLoginPanel();
                }
            } else if (status === Strophe.Status.Error) {
                converse.renderLoginPanel();
                converse.giveFeedback(__('Error'), 'error');
            } else if (status === Strophe.Status.CONNECTING) {
                converse.giveFeedback(__('Connecting'));
            } else if (status === Strophe.Status.CONNFAIL) {
                converse.renderLoginPanel();
                converse.giveFeedback(__('Connection Failed'), 'error');
            } else if (status === Strophe.Status.AUTHENTICATING) {
                converse.giveFeedback(__('Authenticating'));
            } else if (status === Strophe.Status.AUTHFAIL) {
                converse.renderLoginPanel();
                converse.giveFeedback(__('Authentication Failed'), 'error');
            } else if (status === Strophe.Status.DISCONNECTING) {
                if (!converse.connection.connected) {
                    converse.renderLoginPanel();
                } else {
                    converse.giveFeedback(__('Disconnecting'), 'error');
                }
            }
        };

        this.applyHeightResistance = function (height) {
            /* This method applies some resistance/gravity around the
             * "default_box_height". If "height" is close enough to
             * default_box_height, then that is returned instead.
             */
            if (typeof height === 'undefined') {
                return converse.default_box_height;
            }
            var resistance = 10;
            if ((height !== converse.default_box_height) &&
                (Math.abs(height - converse.default_box_height) < resistance)) {
                return converse.default_box_height;
            }
            return height;
        };

        this.updateMsgCounter = function () {
            if (this.msg_counter > 0) {
                if (document.title.search(/^Messages \(\d+\) /) == -1) {
                    document.title = "Messages (" + this.msg_counter + ") " + document.title;
                } else {
                    document.title = document.title.replace(/^Messages \(\d+\) /, "Messages (" + this.msg_counter + ") ");
                }
                window.blur();
                window.focus();
            } else if (document.title.search(/^Messages \(\d+\) /) != -1) {
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

        this.initStatus = function (callback) {
            this.xmppstatus = new this.XMPPStatus();
            var id = b64_sha1('converse.xmppstatus-'+converse.bare_jid);
            this.xmppstatus.id = id; // Appears to be necessary for backbone.browserStorage
            this.xmppstatus.browserStorage = new Backbone.BrowserStorage[converse.storage](id);
            this.xmppstatus.fetch({success: callback, error: callback});
        };

        this.initSession = function () {
            this.session = new this.BOSHSession();
            var id = b64_sha1('converse.bosh-session');
            this.session.id = id; // Appears to be necessary for backbone.browserStorage
            this.session.browserStorage = new Backbone.BrowserStorage[converse.storage](id);
            this.session.fetch();
            $(window).on('beforeunload', $.proxy(function () {
                if (converse.connection.connected) {
                    this.setSession();
                } else {
                    this.clearSession();
                }
            }, this));
        };

        this.clearSession = function () {
            this.session.browserStorage._clear();
            // XXX: this should perhaps go into the beforeunload handler
            converse.chatboxes.get('controlbox').save({'connected': false});
        };

        this.setSession = function () {
            if (this.keepalive) {
                this.session.save({
                    jid: this.connection.jid,
                    rid: this.connection._proto.rid,
                    sid: this.connection._proto.sid
                });
            }
        };

        this.logOut = function () {
            converse.chatboxviews.closeAllChatBoxes(false);
            converse.clearSession();
            converse.connection.disconnect();
            converse.connection.reset();
        };

        this.registerGlobalEventHandlers = function () {
            $(document).click(function() {
                if ($('.toggle-otr ul').is(':visible')) {
                    $('.toggle-otr ul', this).slideUp();
                }
                if ($('.toggle-smiley ul').is(':visible')) {
                    $('.toggle-smiley ul', this).slideUp();
                }
            });

            $(document).on('mousemove', $.proxy(function (ev) {
                if (!this.resized_chatbox || !this.allow_dragresize) { return true; }
                ev.preventDefault();
                this.resized_chatbox.resizeChatBox(ev);
            }, this));

            $(document).on('mouseup', $.proxy(function (ev) {
                if (!this.resized_chatbox || !this.allow_dragresize) { return true; }
                ev.preventDefault();
                var height = this.applyHeightResistance(this.resized_chatbox.height);
                if (this.connection.connected) {
                    this.resized_chatbox.model.save({'height': height});
                } else {
                    this.resized_chatbox.model.set({'height': height});
                }
                this.resized_chatbox = null;
            }, this));

            $(window).on("blur focus", $.proxy(function (ev) {
                if ((this.windowState != ev.type) && (ev.type == 'focus')) {
                    converse.clearMsgCounter();
                }
                this.windowState = ev.type;
            },this));

            $(window).on("resize", _.debounce($.proxy(function (ev) {
                this.chatboxviews.trimChats();
            },this), 200));
        };

        this.onReconnected = function () {
            // We need to re-register all the event handlers on the newly
            // created connection.
            this.initStatus($.proxy(function () {
                this.registerRosterXHandler();
                this.registerPresenceHandler();
                this.chatboxes.registerMessageHandler();
                converse.xmppstatus.sendPresence();
                this.giveFeedback(__('Online Contacts'));
            }, this));
        };

        this.enableCarbons = function () {
            /* Ask the XMPP server to enable Message Carbons
             * See XEP-0280 https://xmpp.org/extensions/xep-0280.html#enabling
             */
            if (!this.message_carbons) {
                return;
            }
            var carbons_iq = new Strophe.Builder('iq', {
                from: this.connection.jid,
                id: 'enablecarbons',
                type: 'set'
              })
              .c('enable', {xmlns: 'urn:xmpp:carbons:2'});
            this.connection.send(carbons_iq);
            this.connection.addHandler(function(iq) {
                //TODO: check if carbons was enabled:
            }, null, "iq", null, "enablecarbons");
        };

        this.onConnected = function () {
            if (this.debug) {
                this.connection.xmlInput = function (body) { console.log(body); };
                this.connection.xmlOutput = function (body) { console.log(body); };
                Strophe.log = function (level, msg) { console.log(level+' '+msg); };
                Strophe.error = function (msg) {
                    console.log('ERROR: '+msg);
                };
            }
            // When reconnecting, there might be some open chat boxes. We don't
            // know whether these boxes are of the same account or not, so we
            // close them now.
            this.chatboxviews.closeAllChatBoxes();
            this.setSession();
            this.jid = this.connection.jid;
            this.bare_jid = Strophe.getBareJidFromJid(this.connection.jid);
            this.domain = Strophe.getDomainFromJid(this.connection.jid);
            this.minimized_chats = new converse.MinimizedChats({model: this.chatboxes});
            this.features = new this.Features();
            this.enableCarbons();
            this.initStatus($.proxy(function () {

                this.chatboxes.onConnected();
                this.giveFeedback(__('Online Contacts'));
                if (this.callback) {
                    if (this.connection.service === 'jasmine tests') {
                        // XXX: Call back with the internal converse object. This
                        // object should never be exposed to production systems.
                        // 'jasmine tests' is an invalid http bind service value,
                        // so we're sure that this is just for tests.
                        //
                        // TODO: We might need to consider websockets, which
                        // probably won't use the 'service' attr. Current
                        // strophe.js version used by converse.js doesn't support
                        // websockets.
                        this.callback(this);
                    } else  {
                        this.callback();
                    }
                }
            }, this));
            converse.emit('ready');
        };

        // Backbone Models and Views
        // -------------------------
        this.OTR = Backbone.Model.extend({
            // A model for managing OTR settings.
            getSessionPassphrase: function () {
                if (converse.prebind) {
                    var key = b64_sha1(converse.connection.jid),
                        pass = window.sessionStorage[key];
                    if (typeof pass === 'undefined') {
                        pass = Math.floor(Math.random()*4294967295).toString();
                        window.sessionStorage[key] = pass;
                    }
                    return pass;
                } else {
                    return converse.connection.pass;
                }
            },

            generatePrivateKey: function () {
                var key = new DSA();
                var jid = converse.connection.jid;
                if (converse.cache_otr_key) {
                    var cipher = CryptoJS.lib.PasswordBasedCipher;
                    var pass = this.getSessionPassphrase();
                    if (typeof pass !== "undefined") {
                        // Encrypt the key and set in sessionStorage. Also store instance tag.
                        window.sessionStorage[b64_sha1(jid+'priv_key')] =
                            cipher.encrypt(CryptoJS.algo.AES, key.packPrivate(), pass).toString();
                        window.sessionStorage[b64_sha1(jid+'instance_tag')] = instance_tag;
                        window.sessionStorage[b64_sha1(jid+'pass_check')] =
                            cipher.encrypt(CryptoJS.algo.AES, 'match', pass).toString();
                    }
                }
                return key;
            }
        });

        this.Message = Backbone.Model;
        this.Messages = Backbone.Collection.extend({
            model: converse.Message
        });

        this.ChatBox = Backbone.Model.extend({
            initialize: function () {
                var height = converse.applyHeightResistance(this.get('height'));
                if (this.get('box_id') !== 'controlbox') {
                    this.messages = new converse.Messages();
                    this.messages.browserStorage = new Backbone.BrowserStorage[converse.storage](
                        b64_sha1('converse.messages'+this.get('jid')+converse.bare_jid));
                    this.save({
                        'box_id' : b64_sha1(this.get('jid')),
                        'height': height,
                        'minimized': this.get('minimized') || false,
                        'otr_status': this.get('otr_status') || UNENCRYPTED,
                        'time_minimized': this.get('time_minimized') || moment(),
                        'time_opened': this.get('time_opened') || moment().valueOf(),
                        'user_id' : Strophe.getNodeFromJid(this.get('jid')),
                        'num_unread': this.get('num_unread') || 0,
                        'url': ''
                    });
                } else {
                    this.set({
                        'height': height,
                        'time_opened': moment(0).valueOf(),
                        'num_unread': this.get('num_unread') || 0
                    });
                }
            },

            maximize: function () {
                this.save({
                    'minimized': false,
                    'time_opened': moment().valueOf()
                });
            },

            minimize: function () {
                this.save({
                    'minimized': true,
                    'time_minimized': moment().format()
                });
            },

            getSession: function (callback) {
                var cipher = CryptoJS.lib.PasswordBasedCipher;
                var result, pass, instance_tag, saved_key, pass_check;
                if (converse.cache_otr_key) {
                    pass = converse.otr.getSessionPassphrase();
                    if (typeof pass !== "undefined") {
                        instance_tag = window.sessionStorage[b64_sha1(this.id+'instance_tag')];
                        saved_key = window.sessionStorage[b64_sha1(this.id+'priv_key')];
                        pass_check = window.sessionStorage[b64_sha1(this.connection.jid+'pass_check')];
                        if (saved_key && instance_tag && typeof pass_check !== 'undefined') {
                            var decrypted = cipher.decrypt(CryptoJS.algo.AES, saved_key, pass);
                            var key = DSA.parsePrivate(decrypted.toString(CryptoJS.enc.Latin1));
                            if (cipher.decrypt(CryptoJS.algo.AES, pass_check, pass).toString(CryptoJS.enc.Latin1) === 'match') {
                                // Verified that the passphrase is still the same
                                this.trigger('showHelpMessages', [__('Re-establishing encrypted session')]);
                                callback({
                                    'key': key,
                                    'instance_tag': instance_tag
                                });
                                return; // Our work is done here
                            }
                        }
                    }
                }
                // We need to generate a new key and instance tag
                this.trigger('showHelpMessages', [
                    __('Generating private key.'),
                    __('Your browser might become unresponsive.')],
                    null,
                    true // show spinner
                );
                setTimeout(function () {
                    callback({
                        'key': converse.otr.generatePrivateKey.apply(this),
                        'instance_tag': OTR.makeInstanceTag()
                    });
                }, 500);
            },

            updateOTRStatus: function (state) {
                switch (state) {
                    case OTR.CONST.STATUS_AKE_SUCCESS:
                        if (this.otr.msgstate === OTR.CONST.MSGSTATE_ENCRYPTED) {
                            this.save({'otr_status': UNVERIFIED});
                        }
                        break;
                    case OTR.CONST.STATUS_END_OTR:
                        if (this.otr.msgstate === OTR.CONST.MSGSTATE_FINISHED) {
                            this.save({'otr_status': FINISHED});
                        } else if (this.otr.msgstate === OTR.CONST.MSGSTATE_PLAINTEXT) {
                            this.save({'otr_status': UNENCRYPTED});
                        }
                        break;
                }
            },

            onSMP: function (type, data) {
                // Event handler for SMP (Socialist's Millionaire Protocol)
                // used by OTR (off-the-record).
                switch (type) {
                    case 'question':
                        this.otr.smpSecret(prompt(__(
                            'Authentication request from %1$s\n\nYour buddy is attempting to verify your identity, by asking you the question below.\n\n%2$s',
                            [this.get('fullname'), data])));
                        break;
                    case 'trust':
                        if (data === true) {
                            this.save({'otr_status': VERIFIED});
                        } else {
                            this.trigger(
                                'showHelpMessages',
                                [__("Could not verify this user's identify.")],
                                'error');
                            this.save({'otr_status': UNVERIFIED});
                        }
                        break;
                    default:
                        throw new Error('Unknown type.');
                }
            },

            initiateOTR: function (query_msg) {
                // Sets up an OTR object through which we can send and receive
                // encrypted messages.
                //
                // If 'query_msg' is passed in, it means there is an alread incoming
                // query message from our buddy. Otherwise, it is us who will
                // send the query message to them.
                this.save({'otr_status': UNENCRYPTED});
                var session = this.getSession($.proxy(function (session) {
                    this.otr = new OTR({
                        fragment_size: 140,
                        send_interval: 200,
                        priv: session.key,
                        instance_tag: session.instance_tag,
                        debug: this.debug
                    });
                    this.otr.on('status', $.proxy(this.updateOTRStatus, this));
                    this.otr.on('smp', $.proxy(this.onSMP, this));

                    this.otr.on('ui', $.proxy(function (msg) {
                        this.trigger('showReceivedOTRMessage', msg);
                    }, this));
                    this.otr.on('io', $.proxy(function (msg) {
                        this.trigger('sendMessageStanza', msg);
                    }, this));
                    this.otr.on('error', $.proxy(function (msg) {
                        this.trigger('showOTRError', msg);
                    }, this));

                    this.trigger('showHelpMessages', [__('Exchanging private key with buddy.')]);
                    if (query_msg) {
                        this.otr.receiveMsg(query_msg);
                    } else {
                        this.otr.sendQueryMsg();
                    }
                }, this));
            },

            endOTR: function () {
                if (this.otr) {
                    this.otr.endOtr();
                }
                this.save({'otr_status': UNENCRYPTED});
            },

            createMessage: function ($message) {
                var body = $message.children('body').text(),
                    composing = $message.find('composing'),
                    paused = $message.find('paused'),
                    delayed = $message.find('delay').length > 0,
                    fullname = this.get('fullname'),
                    is_groupchat = $message.attr('type') === 'groupchat',
                    stamp, time, sender, from;

                if (is_groupchat) {
                    from = Strophe.unescapeNode(Strophe.getResourceFromJid($message.attr('from')));
                } else {
                    from = Strophe.getBareJidFromJid($message.attr('from'));
                }
                fullname = (_.isEmpty(fullname)? from: fullname).split(' ')[0];

                if (!body) {
                    if (composing.length || paused.length) {
                        this.messages.add({
                            fullname: fullname,
                            sender: 'them',
                            delayed: delayed,
                            time: moment().format(),
                            composing: composing.length,
                            paused: paused.length
                        });
                    }
                } else {
                    if (delayed) {
                        stamp = $message.find('delay').attr('stamp');
                        time = stamp;
                    } else {
                        time = moment().format();
                    }
                    if ((is_groupchat && from === this.get('nick')) || (!is_groupchat && from == converse.bare_jid)) {
                        sender = 'me';
                    } else {
                        sender = 'them';
                    }
                    this.messages.create({
                        fullname: fullname,
                        sender: sender,
                        delayed: delayed,
                        time: time,
                        message: body
                    });
                }
            },

            receiveMessage: function ($message) {
                var $body = $message.children('body');
                var text = ($body.length > 0 ? $body.text() : undefined);
                if ((!text) || (!converse.allow_otr)) {
                    return this.createMessage($message);
                }
                if (text.match(/^\?OTRv23?/)) {
                    this.initiateOTR(text);
                } else {
                    if (_.contains([UNVERIFIED, VERIFIED], this.get('otr_status'))) {
                        this.otr.receiveMsg(text);
                    } else {
                        if (text.match(/^\?OTR/)) {
                            if (!this.otr) {
                                this.initiateOTR(text);
                            } else {
                                this.otr.receiveMsg(text);
                            }
                        } else {
                            // Normal unencrypted message.
                            this.createMessage($message);
                        }
                    }
                }
            }
        });

        this.ChatBoxView = Backbone.View.extend({
            length: 200,
            tagName: 'div',
            className: 'chatbox',
            is_chatroom: false,  // This is not a multi-user chatroom

            events: {
                'click .close-chatbox-button': 'close',
                'click .toggle-chatbox-button': 'minimize',
                'keypress textarea.chat-textarea': 'keyPressed',
                'click .toggle-smiley': 'toggleEmoticonMenu',
                'click .toggle-smiley ul li': 'insertEmoticon',
                'click .toggle-clear': 'clearMessages',
                'click .toggle-otr': 'toggleOTRMenu',
                'click .start-otr': 'startOTRFromToolbar',
                'click .end-otr': 'endOTR',
                'click .auth-otr': 'authOTR',
                'click .toggle-call': 'toggleCall',
                'mousedown .dragresize-tm': 'onDragResizeStart'
            },

            initialize: function (){
                this.model.messages.on('add', this.onMessageAdded, this);
                this.model.on('show', this.show, this);
                this.model.on('destroy', this.hide, this);
                this.model.on('change', this.onChange, this);
                this.model.on('showOTRError', this.showOTRError, this);
                this.model.on('buddyStartsOTR', this.buddyStartsOTR, this);
                this.model.on('showHelpMessages', this.showHelpMessages, this);
                this.model.on('sendMessageStanza', this.sendMessageStanza, this);
                this.model.on('showSentOTRMessage', function (text) {
                    this.showMessage({'message': text, 'sender': 'me'});
                }, this);
                this.model.on('showReceivedOTRMessage', function (text) {
                    this.showMessage({'message': text, 'sender': 'them'});
                }, this);

                this.updateVCard();
                this.$el.insertAfter(converse.chatboxviews.get("controlbox").$el);
                this.render().model.messages.fetch({add: true});
                if (this.model.get('minimized')) {
                    this.hide();
                } else {
                    this.show();
                }
                if ((_.contains([UNVERIFIED, VERIFIED], this.model.get('otr_status'))) || converse.use_otr_by_default) {
                    this.model.initiateOTR();
                }
            },

            render: function () {
                this.$el.attr('id', this.model.get('box_id'))
                    .html(converse.templates.chatbox(
                            _.extend(this.model.toJSON(), {
                                    show_toolbar: converse.show_toolbar,
                                    label_personal_message: __('Personal message')
                                }
                            )
                        )
                    );
                this.renderToolbar().renderAvatar();
                converse.emit('chatBoxOpened', this);
                setTimeout(function () {
                    converse.refreshWebkit();
                }, 50);
                return this.showStatusMessage();
            },

            initDragResize: function () {
                this.prev_pageY = 0; // To store last known mouse position
                if (converse.connection.connected) {
                    this.height = this.model.get('height');
                }
                return this;
            },

            showStatusNotification: function (message, keep_old) {
                var $chat_content = this.$el.find('.chat-content');
                if (!keep_old) {
                    $chat_content.find('div.chat-event').remove();
                }
                $chat_content.append($('<div class="chat-event"></div>').text(message));
                this.scrollDown();
            },

            clearChatRoomMessages: function (ev) {
                ev.stopPropagation();
                var result = confirm(__("Are you sure you want to clear the messages from this room?"));
                if (result === true) {
                    this.$el.find('.chat-content').empty();
                }
                return this;
            },

            showMessage: function (msg_dict) {
                var $content = this.$el.find('.chat-content'),
                    msg_time = moment(msg_dict.time) || moment,
                    text = msg_dict.message,
                    match = text.match(/^\/(.*?)(?: (.*))?$/),
                    fullname = msg_dict.fullname || this.model.get('fullname'), // XXX Perhaps always use model's?
                    extra_classes = msg_dict.delayed && 'delayed' || '',
                    template, username;

                if ((match) && (match[1] === 'me')) {
                    text = text.replace(/^\/me/, '');
                    template = converse.templates.action;
                    username = fullname;
                } else  {
                    template = converse.templates.message;
                    username = msg_dict.sender === 'me' && __('me') || fullname;
                }
                $content.find('div.chat-event').remove();

                if (this.is_chatroom && msg_dict.sender == 'them' && (new RegExp("\\b"+this.model.get('nick')+"\\b")).test(text)) {
                    // Add special class to mark groupchat messages in which we
                    // are mentioned.
                    extra_classes += ' mentioned';
                }

                var message = template({
                    'sender': msg_dict.sender,
                    'time': msg_time.format('hh:mm'),
                    'username': username,
                    'message': '',
                    'extra_classes': extra_classes
                });
                $content.append($(message).children('.chat-message-content').first().text(text).addHyperlinks().addEmoticons().parent());
                this.scrollDown();
            },

            showHelpMessages: function (msgs, type, spinner) {
                var $chat_content = this.$el.find('.chat-content'), i,
                    msgs_length = msgs.length;
                for (i=0; i<msgs_length; i++) {
                    $chat_content.append($('<div class="chat-'+(type||'info')+'">'+msgs[i]+'</div>'));
                }
                if (spinner === true) {
                    $chat_content.append('<span class="spinner"/>');
                } else if (spinner === false) {
                    $chat_content.find('span.spinner').remove();
                }
                return this.scrollDown();
            },

            onMessageAdded: function (message) {
                var time = message.get('time'),
                    times = this.model.messages.pluck('time'),
                    previous_message, idx, this_date, prev_date, text, match;

                // If this message is on a different day than the one received
                // prior, then indicate it on the chatbox.
                idx = _.indexOf(times, time)-1;
                if (idx >= 0) {
                    previous_message = this.model.messages.at(idx);
                    prev_date = moment(previous_message.get('time'));
                    if (prev_date.isBefore(time, 'day')) {
                        this_date = moment(time);
                        this.$el.find('.chat-content').append(converse.templates.new_day({
                            isodate: this_date.format("YYYY-MM-DD"),
                            datestring: this_date.format("dddd MMM Do YYYY")
                        }));
                    }
                }
                if (message.get(COMPOSING)) {
                    this.showStatusNotification(message.get('fullname')+' '+__('is typing'));
                    return;
                } else if (message.get(PAUSED)) {
                    this.showStatusNotification(message.get('fullname')+' '+__('has stopped typing'));
                    return;
                } else {
                    this.showMessage(_.clone(message.attributes));
                }
                if ((message.get('sender') != 'me') && (converse.windowState == 'blur')) {
                    converse.incrementMsgCounter();
                }
                return this.scrollDown();
            },

            sendMessageStanza: function (text) {
                /*
                 * Sends the actual XML stanza to the XMPP server.
                 */
                // TODO: Look in ChatPartners to see what resources we have for the recipient.
                // if we have one resource, we sent to only that resources, if we have multiple
                // we send to the bare jid.
                var timestamp = (new Date()).getTime();
                var bare_jid = this.model.get('jid');
                var message = $msg({from: converse.connection.jid, to: bare_jid, type: 'chat', id: timestamp})
                    .c('body').t(text).up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'});
                converse.connection.send(message);
                if (converse.forward_messages) {
                    // Forward the message, so that other connected resources are also aware of it.
                    var forwarded = $msg({to:converse.bare_jid, type:'chat', id:timestamp})
                                    .c('forwarded', {xmlns:'urn:xmpp:forward:0'})
                                    .c('delay', {xmns:'urn:xmpp:delay',stamp:timestamp}).up()
                                    .cnode(message.tree());
                    converse.connection.send(forwarded);
                }
            },

            sendMessage: function (text) {
                var match = text.replace(/^\s*/, "").match(/^\/(.*)\s*$/), msgs;
                if (match) {
                    if (match[1] === "clear") {
                        return this.clearMessages();
                    }
                    else if (match[1] === "help") {
                        msgs = [
                            '<strong>/help</strong>:'+__('Show this menu')+'',
                            '<strong>/me</strong>:'+__('Write in the third person')+'',
                            '<strong>/clear</strong>:'+__('Remove messages')+''
                            ];
                        this.showHelpMessages(msgs);
                        return;
                    } else if ((converse.allow_otr) && (match[1] === "endotr")) {
                        return this.endOTR();
                    } else if ((converse.allow_otr) && (match[1] === "otr")) {
                        return this.model.initiateOTR();
                    }
                }
                if (_.contains([UNVERIFIED, VERIFIED], this.model.get('otr_status'))) {
                    // Off-the-record encryption is active
                    this.model.otr.sendMsg(text);
                    this.model.trigger('showSentOTRMessage', text);
                } else {
                    // We only save unencrypted messages.
                    var fullname = converse.xmppstatus.get('fullname');
                    fullname = _.isEmpty(fullname)? converse.bare_jid: fullname;
                    this.model.messages.create({
                        fullname: fullname,
                        sender: 'me',
                        time: moment().format(),
                        message: text
                    });
                    this.sendMessageStanza(text);
                }
            },

            keyPressed: function (ev) {
                var $textarea = $(ev.target),
                    message, notify, composing;
                if(ev.keyCode == KEY.ENTER) {
                    ev.preventDefault();
                    message = $textarea.val();
                    $textarea.val('').focus();
                    if (message !== '') {
                        if (this.model.get('chatroom')) {
                            this.sendChatRoomMessage(message);
                        } else {
                            this.sendMessage(message);
                        }
                        converse.emit('messageSend', message);
                    }
                    this.$el.data('composing', false);
                } else if (!this.model.get('chatroom')) {
                    // composing data is only for single user chat
                    composing = this.$el.data('composing');
                    if (!composing) {
                        if (ev.keyCode != 47) {
                            // We don't send composing messages if the message
                            // starts with forward-slash.
                            notify = $msg({'to':this.model.get('jid'), 'type': 'chat'})
                                            .c('composing', {'xmlns':'http://jabber.org/protocol/chatstates'});
                            converse.connection.send(notify);
                        }
                        this.$el.data('composing', true);
                    }
                }
            },

            onDragResizeStart: function (ev) {
                if (!converse.allow_dragresize) { return true; }
                // Record element attributes for mouseMove().
                this.height = this.$el.children('.box-flyout').height();
                converse.resized_chatbox = this;
                this.prev_pageY = ev.pageY;
            },

            setChatBoxHeight: function (height) {
                if (!this.model.get('minimized')) {
                    this.$el.children('.box-flyout')[0].style.height = converse.applyHeightResistance(height)+'px';
                }
            },

            resizeChatBox: function (ev) {
                var diff = ev.pageY - this.prev_pageY;
                if (!diff) { return; }
                this.height -= diff;
                this.prev_pageY = ev.pageY;
                this.setChatBoxHeight(this.height);
            },

            clearMessages: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                var result = confirm(__("Are you sure you want to clear the messages from this chat box?"));
                if (result === true) {
                    this.$el.find('.chat-content').empty();
                    this.model.messages.reset();
                    this.model.messages.browserStorage._clear();
                }
                return this;
            },

            insertEmoticon: function (ev) {
                ev.stopPropagation();
                this.$el.find('.toggle-smiley ul').slideToggle(200);
                var $textbox = this.$el.find('textarea.chat-textarea');
                var value = $textbox.val();
                var $target = $(ev.target);
                $target = $target.is('a') ? $target : $target.children('a');
                if (value && (value[value.length-1] !== ' ')) {
                    value = value + ' ';
                }
                $textbox.focus().val(value+$target.data('emoticon')+' ');
            },

            toggleEmoticonMenu: function (ev) {
                ev.stopPropagation();
                this.$el.find('.toggle-smiley ul').slideToggle(200);
            },

            toggleOTRMenu: function (ev) {
                ev.stopPropagation();
                this.$el.find('.toggle-otr ul').slideToggle(200);
            },

            showOTRError: function (msg) {
                if (msg == 'Message cannot be sent at this time.') {
                    this.showHelpMessages(
                        [__('Your message could not be sent')], 'error');
                } else if (msg == 'Received an unencrypted message.') {
                    this.showHelpMessages(
                        [__('We received an unencrypted message')], 'error');
                } else if (msg == 'Received an unreadable encrypted message.') {
                    this.showHelpMessages(
                        [__('We received an unreadable encrypted message')],
                        'error');
                } else {
                    this.showHelpMessages(['Encryption error occured: '+msg], 'error');
                }
                console.log("OTR ERROR:"+msg);
            },

            buddyStartsOTR: function (ev) {
                this.showHelpMessages([__('This user has requested an encrypted session.')]);
                this.model.initiateOTR();
            },

            startOTRFromToolbar: function (ev) {
                $(ev.target).parent().parent().slideUp();
                ev.stopPropagation();
                this.model.initiateOTR();
            },

            endOTR: function (ev) {
                if (typeof ev !== "undefined") {
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                this.model.endOTR();
            },

            authOTR: function (ev) {
                var scheme = $(ev.target).data().scheme;
                var result, question, answer;
                if (scheme === 'fingerprint') {
                    result = confirm(__('Here are the fingerprints, please confirm them with %1$s, outside of this chat.\n\nFingerprint for you, %2$s: %3$s\n\nFingerprint for %1$s: %4$s\n\nIf you have confirmed that the fingerprints match, click OK, otherwise click Cancel.', [
                            this.model.get('fullname'),
                            converse.xmppstatus.get('fullname')||converse.bare_jid,
                            this.model.otr.priv.fingerprint(),
                            this.model.otr.their_priv_pk.fingerprint()
                        ]
                    ));
                    if (result === true) {
                        this.model.save({'otr_status': VERIFIED});
                    } else {
                        this.model.save({'otr_status': UNVERIFIED});
                    }
                } else if (scheme === 'smp') {
                    alert(__('You will be prompted to provide a security question and then an answer to that question.\n\nYour buddy will then be prompted the same question and if they type the exact same answer (case sensitive), their identity will be verified.'));
                    question = prompt(__('What is your security question?'));
                    if (question) {
                        answer = prompt(__('What is the answer to the security question?'));
                        this.model.otr.smpSecret(answer, question);
                    }
                } else {
                    this.showHelpMessages([__('Invalid authentication scheme provided')], 'error');
                }
            },

            toggleCall: function (ev) {
                ev.stopPropagation();
                converse.emit('callButtonClicked', {
                    connection: converse.connection,
                    model: this.model
                });
            },

            onChange: function (item, changed) {
                if (_.has(item.changed, 'chat_status')) {
                    var chat_status = item.get('chat_status'),
                        fullname = item.get('fullname');
                    fullname = _.isEmpty(fullname)? item.get('jid'): fullname;
                    if (this.$el.is(':visible')) {
                        if (chat_status === 'offline') {
                            this.showStatusNotification(fullname+' '+'has gone offline');
                        } else if (chat_status === 'away') {
                            this.showStatusNotification(fullname+' '+'has gone away');
                        } else if ((chat_status === 'dnd')) {
                            this.showStatusNotification(fullname+' '+'is busy');
                        } else if (chat_status === 'online') {
                            this.$el.find('div.chat-event').remove();
                        }
                    }
                    converse.emit('buddyStatusChanged', item.attributes, item.get('chat_status'));
                }
                if (_.has(item.changed, 'status')) {
                    this.showStatusMessage();
                    converse.emit('buddyStatusMessageChanged', item.attributes, item.get('status'));
                }
                if (_.has(item.changed, 'image')) {
                    this.renderAvatar();
                }
                if (_.has(item.changed, 'otr_status')) {
                    this.renderToolbar().informOTRChange();
                }
                if (_.has(item.changed, 'minimized')) {
                    if (item.get('minimized')) {
                        this.hide();
                    } else {
                        this.maximize();
                    }
                }
                // TODO check for changed fullname as well
            },

            showStatusMessage: function (msg) {
                msg = msg || this.model.get('status');
                if (msg) {
                    this.$el.find('p.user-custom-message').text(msg).attr('title', msg);
                }
                return this;
            },

            close: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                if (converse.connection.connected) {
                    this.model.destroy();
                } else {
                    this.model.trigger('hide');
                }
                converse.emit('chatBoxClosed', this);
                return this;
            },

            maximize: function () {
                // Restores a minimized chat box
                this.$el.insertAfter(converse.chatboxviews.get("controlbox").$el).show('fast', $.proxy(function () {
                    converse.refreshWebkit();
                    this.focus();
                    converse.emit('chatBoxMaximized', this);
                }, this));
            },

            minimize: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                // Minimizes a chat box
                this.model.minimize();
                this.$el.hide('fast', converse.refreshwebkit);
                converse.emit('chatBoxMinimized', this);
            },

            updateVCard: function () {
                var jid = this.model.get('jid'),
                    contact = converse.roster.get(jid);
                if ((contact) && (!contact.get('vcard_updated'))) {
                    converse.getVCard(
                        jid,
                        $.proxy(function (jid, fullname, image, image_type, url) {
                            this.model.save({
                                'fullname' : fullname || jid,
                                'url': url,
                                'image_type': image_type,
                                'image': image
                            });
                        }, this),
                        $.proxy(function (stanza) {
                            converse.log("ChatBoxView.initialize: An error occured while fetching vcard");
                        }, this)
                    );
                }
            },

            informOTRChange: function () {
                var data = this.model.toJSON();
                var msgs = [];
                if (data.otr_status == UNENCRYPTED) {
                    msgs.push(__("Your messages are not encrypted anymore"));
                } else if (data.otr_status == UNVERIFIED){
                    msgs.push(__("Your messages are now encrypted but your buddy's identity has not been verified."));
                } else if (data.otr_status == VERIFIED){
                    msgs.push(__("Your buddy's identify has been verified."));
                } else if (data.otr_status == FINISHED){
                    msgs.push(__("Your buddy has ended encryption on their end, you should do the same."));
                }
                return this.showHelpMessages(msgs, 'info', false);
            },

            renderToolbar: function () {
                if (converse.show_toolbar) {
                    var data = this.model.toJSON();
                    if (data.otr_status == UNENCRYPTED) {
                        data.otr_tooltip = __('Your messages are not encrypted. Click here to enable OTR encryption.');
                    } else if (data.otr_status == UNVERIFIED){
                        data.otr_tooltip = __('Your messages are encrypted, but your buddy has not been verified.');
                    } else if (data.otr_status == VERIFIED){
                        data.otr_tooltip = __('Your messages are encrypted and your buddy verified.');
                    } else if (data.otr_status == FINISHED){
                        data.otr_tooltip = __('Your buddy has closed their end of the private session, you should do the same');
                    }
                    this.$el.find('.chat-toolbar').html(
                        converse.templates.toolbar(
                            _.extend(data, {
                                FINISHED: FINISHED,
                                UNENCRYPTED: UNENCRYPTED,
                                UNVERIFIED: UNVERIFIED,
                                VERIFIED: VERIFIED,
                                allow_otr: converse.allow_otr && !this.is_chatroom,
                                label_clear: __('Clear all messages'),
                                label_end_encrypted_conversation: __('End encrypted conversation'),
                                label_hide_participants: __('Hide the list of participants'),
                                label_refresh_encrypted_conversation: __('Refresh encrypted conversation'),
                                label_start_call: __('Start a call'),
                                label_start_encrypted_conversation: __('Start encrypted conversation'),
                                label_verify_with_fingerprints: __('Verify with fingerprints'),
                                label_verify_with_smp: __('Verify with SMP'),
                                label_whats_this: __("What\'s this?"),
                                otr_status_class: OTR_CLASS_MAPPING[data.otr_status],
                                otr_translated_status: OTR_TRANSLATED_MAPPING[data.otr_status],
                                show_call_button: converse.visible_toolbar_buttons.call,
                                show_clear_button: converse.visible_toolbar_buttons.clear,
                                show_emoticons: converse.visible_toolbar_buttons.emoticons,
                                show_participants_toggle: this.is_chatroom && converse.visible_toolbar_buttons.toggle_participants
                            })
                        )
                    );
                }
                return this;
            },

            renderAvatar: function () {
                if (!this.model.get('image')) {
                    return;
                }
                var img_src = 'data:'+this.model.get('image_type')+';base64,'+this.model.get('image'),
                    canvas = $('<canvas height="31px" width="31px" class="avatar"></canvas>').get(0);

                if (!(canvas.getContext && canvas.getContext('2d'))) {
                    return this;
                }
                var ctx = canvas.getContext('2d');
                var img = new Image();   // Create new Image object
                img.onload = function() {
                    var ratio = img.width/img.height;
                    ctx.drawImage(img, 0,0, 35*ratio, 35);
                };
                img.src = img_src;
                this.$el.find('.chat-title').before(canvas);
                return this;
            },

            focus: function () {
                this.$el.find('.chat-textarea').focus();
                converse.emit('chatBoxFocused', this);
                return this;
            },

            hide: function () {
                if (this.$el.is(':visible') && this.$el.css('opacity') == "1") {
                    this.$el.hide();
                    converse.refreshWebkit();
                }
                return this;
            },

            show: function (callback) {
                if (this.$el.is(':visible') && this.$el.css('opacity') == "1") {
                    return this.focus();
                }
                this.$el.fadeIn(callback);
                if (converse.connection.connected) {
                    // Without a connection, we haven't yet initialized
                    // localstorage
                    this.model.save();
                    this.initDragResize();
                }
                return this;
            },

            scrollDown: function () {
                var $content = this.$('.chat-content');
                if ($content.is(':visible')) {
                    $content.scrollTop($content[0].scrollHeight);
                }
                return this;
            }
        });

        this.ContactsPanel = Backbone.View.extend({
            tagName: 'div',
            className: 'controlbox-pane',
            id: 'users',
            events: {
                'click a.toggle-xmpp-contact-form': 'toggleContactForm',
                'submit form.add-xmpp-contact': 'addContactFromForm',
                'submit form.search-xmpp-contact': 'searchContacts',
                'click a.subscribe-to-user': 'addContactFromList'
            },

            initialize: function (cfg) {
                cfg.$parent.append(this.$el);
                this.$tabs = cfg.$parent.parent().find('#controlbox-tabs');
            },

            render: function () {
                var markup;
                var widgets = converse.templates.contacts_panel({
                    label_online: __('Online'),
                    label_busy: __('Busy'),
                    label_away: __('Away'),
                    label_offline: __('Offline'),
                    label_logout: __('Log out'),
                    allow_logout: converse.allow_logout,
                });
                this.$tabs.append(converse.templates.contacts_tab({label_contacts: LABEL_CONTACTS}));
                if (converse.xhr_user_search) {
                    markup = converse.templates.search_contact({
                        label_contact_name: __('Contact name'),
                        label_search: __('Search')
                    });
                } else {
                    markup = converse.templates.add_contact_form({
                        label_contact_username: __('Contact username'),
                        label_add: __('Add')
                    });
                }
                if (converse.allow_contact_requests) {
                    widgets += converse.templates.add_contact_dropdown({
                        label_click_to_chat: __('Click to add new chat contacts'),
                        label_add_contact: __('Add a contact')
                    });
                }
                this.$el.html(widgets);
                this.$el.find('.search-xmpp ul').append(markup);
                return this;
            },

            toggleContactForm: function (ev) {
                ev.preventDefault();
                this.$el.find('.search-xmpp').toggle('fast', function () {
                    if ($(this).is(':visible')) {
                        $(this).find('input.username').focus();
                    }
                });
            },

            searchContacts: function (ev) {
                ev.preventDefault();
                $.getJSON(converse.xhr_user_search_url+ "?q=" + $(ev.target).find('input.username').val(), function (data) {
                    var $ul= $('.search-xmpp ul');
                    $ul.find('li.found-user').remove();
                    $ul.find('li.chat-info').remove();
                    if (!data.length) {
                        $ul.append('<li class="chat-info">'+__('No users found')+'</li>');
                    }
                    $(data).each(function (idx, obj) {
                        $ul.append(
                            $('<li class="found-user"></li>')
                            .append(
                                $('<a class="subscribe-to-user" href="#" title="'+__('Click to add as a chat contact')+'"></a>')
                                .attr('data-recipient', Strophe.escapeNode(obj.id)+'@'+converse.domain)
                                .text(obj.fullname)
                            )
                        );
                    });
                });
            },

            addContactFromForm: function (ev) {
                ev.preventDefault();
                var $input = $(ev.target).find('input');
                var jid = $input.val();
                if (! jid) {
                    // this is not a valid JID
                    $input.addClass('error');
                    return;
                }
                this.addContact(jid);
                $('.search-xmpp').hide();
            },

            addContactFromList: function (ev) {
                ev.preventDefault();
                var $target = $(ev.target),
                    jid = $target.attr('data-recipient'),
                    name = $target.text();
                this.addContact(jid, name);
                $target.parent().remove();
                $('.search-xmpp').hide();
            },

            addContact: function (jid, name) {
                name = _.isEmpty(name)? jid: name;
                converse.connection.roster.add(jid, name, [], function (iq) {
                    converse.connection.roster.subscribe(jid, null, converse.xmppstatus.get('fullname'));
                });
            }
        });

        this.RoomsPanel = Backbone.View.extend({
            tagName: 'div',
            id: 'chatrooms',
            events: {
                'submit form.add-chatroom': 'createChatRoom',
                'click input#show-rooms': 'showRooms',
                'click a.open-room': 'createChatRoom',
                'click a.room-info': 'showRoomInfo'
            },

            initialize: function (cfg) {
                cfg.$parent.append(
                    this.$el.html(
                        converse.templates.room_panel({
                            'server_input_type': converse.hide_muc_server && 'hidden' || 'text',
                            'label_room_name': __('Room name'),
                            'label_nickname': __('Nickname'),
                            'label_server': __('Server'),
                            'label_join': __('Join'),
                            'label_show_rooms': __('Show rooms')
                        })
                    ).hide());
                this.$tabs = cfg.$parent.parent().find('#controlbox-tabs');

                this.on('update-rooms-list', function (ev) {
                    this.updateRoomsList();
                });
                converse.xmppstatus.on("change", $.proxy(function (model) {
                    if (!(_.has(model.changed, 'fullname'))) {
                        return;
                    }
                    var $nick = this.$el.find('input.new-chatroom-nick');
                    if (! $nick.is(':focus')) {
                        $nick.val(model.get('fullname'));
                    }
                }, this));
            },

            render: function () {
                this.$tabs.append(converse.templates.chatrooms_tab({label_rooms: __('Rooms')}));
                return this;
            },

            informNoRoomsFound: function () {
                var $available_chatrooms = this.$el.find('#available-chatrooms');
                // # For translators: %1$s is a variable and will be replaced with the XMPP server name
                $available_chatrooms.html('<dt>'+__('No rooms on %1$s',this.muc_domain)+'</dt>');
                $('input#show-rooms').show().siblings('span.spinner').remove();
            },

            updateRoomsList: function (domain) {
                converse.connection.muc.listRooms(
                    this.muc_domain,
                    $.proxy(function (iq) { // Success
                        var name, jid, i, fragment,
                            that = this,
                            $available_chatrooms = this.$el.find('#available-chatrooms');
                        this.rooms = $(iq).find('query').find('item');
                        if (this.rooms.length) {
                            // # For translators: %1$s is a variable and will be
                            // # replaced with the XMPP server name
                            $available_chatrooms.html('<dt>'+__('Rooms on %1$s',this.muc_domain)+'</dt>');
                            fragment = document.createDocumentFragment();
                            for (i=0; i<this.rooms.length; i++) {
                                name = Strophe.unescapeNode($(this.rooms[i]).attr('name')||$(this.rooms[i]).attr('jid'));
                                jid = $(this.rooms[i]).attr('jid');
                                fragment.appendChild($(
                                    converse.templates.room_item({
                                        'name':name,
                                        'jid':jid,
                                        'open_title': __('Click to open this room'),
                                        'info_title': __('Show more information on this room')
                                        })
                                    )[0]);
                            }
                            $available_chatrooms.append(fragment);
                            $('input#show-rooms').show().siblings('span.spinner').remove();
                        } else {
                            this.informNoRoomsFound();
                        }
                        return true;
                    }, this),
                    $.proxy(function (iq) { // Failure
                        this.informNoRoomsFound();
                    }, this));
            },

            showRooms: function (ev) {
                var $available_chatrooms = this.$el.find('#available-chatrooms');
                var $server = this.$el.find('input.new-chatroom-server');
                var server = $server.val();
                if (!server) {
                    $server.addClass('error');
                    return;
                }
                this.$el.find('input.new-chatroom-name').removeClass('error');
                $server.removeClass('error');
                $available_chatrooms.empty();
                $('input#show-rooms').hide().after('<span class="spinner"/>');
                this.muc_domain = server;
                this.updateRoomsList();
            },

            showRoomInfo: function (ev) {
                var target = ev.target,
                    $dd = $(target).parent('dd'),
                    $div = $dd.find('div.room-info');
                if ($div.length) {
                    $div.remove();
                } else {
                    $dd.find('span.spinner').remove();
                    $dd.append('<span class="spinner hor_centered"/>');
                    converse.connection.disco.info(
                        $(target).attr('data-room-jid'),
                        null,
                        $.proxy(function (stanza) {
                            var $stanza = $(stanza);
                            // All MUC features found here: http://xmpp.org/registrar/disco-features.html
                            $dd.find('span.spinner').replaceWith(
                                converse.templates.room_description({
                                    'desc': $stanza.find('field[var="muc#roominfo_description"] value').text(),
                                    'occ': $stanza.find('field[var="muc#roominfo_occupants"] value').text(),
                                    'hidden': $stanza.find('feature[var="muc_hidden"]').length,
                                    'membersonly': $stanza.find('feature[var="muc_membersonly"]').length,
                                    'moderated': $stanza.find('feature[var="muc_moderated"]').length,
                                    'nonanonymous': $stanza.find('feature[var="muc_nonanonymous"]').length,
                                    'open': $stanza.find('feature[var="muc_open"]').length,
                                    'passwordprotected': $stanza.find('feature[var="muc_passwordprotected"]').length,
                                    'persistent': $stanza.find('feature[var="muc_persistent"]').length,
                                    'publicroom': $stanza.find('feature[var="muc_public"]').length,
                                    'semianonymous': $stanza.find('feature[var="muc_semianonymous"]').length,
                                    'temporary': $stanza.find('feature[var="muc_temporary"]').length,
                                    'unmoderated': $stanza.find('feature[var="muc_unmoderated"]').length,
                                    'label_desc': __('Description:'),
                                    'label_occ': __('Occupants:'),
                                    'label_features': __('Features:'),
                                    'label_requires_auth': __('Requires authentication'),
                                    'label_hidden': __('Hidden'),
                                    'label_requires_invite': __('Requires an invitation'),
                                    'label_moderated': __('Moderated'),
                                    'label_non_anon': __('Non-anonymous'),
                                    'label_open_room': __('Open room'),
                                    'label_permanent_room': __('Permanent room'),
                                    'label_public': __('Public'),
                                    'label_semi_anon':  _('Semi-anonymous'),
                                    'label_temp_room':  _('Temporary room'),
                                    'label_unmoderated': __('Unmoderated')
                                }));
                        }, this));
                }
            },

            createChatRoom: function (ev) {
                ev.preventDefault();
                var name, $name,
                    server, $server,
                    jid,
                    $nick = this.$el.find('input.new-chatroom-nick'),
                    nick = $nick.val(),
                    chatroom;

                if (!nick) { $nick.addClass('error'); }
                else { $nick.removeClass('error'); }

                if (ev.type === 'click') {
                    jid = $(ev.target).attr('data-room-jid');
                } else {
                    $name = this.$el.find('input.new-chatroom-name');
                    $server= this.$el.find('input.new-chatroom-server');
                    server = $server.val();
                    name = $name.val().trim().toLowerCase();
                    $name.val(''); // Clear the input
                    if (name && server) {
                        jid = Strophe.escapeNode(name) + '@' + server;
                        $name.removeClass('error');
                        $server.removeClass('error');
                        this.muc_domain = server;
                    } else {
                        if (!name) { $name.addClass('error'); }
                        if (!server) { $server.addClass('error'); }
                        return;
                    }
                }
                if (!nick) { return; }
                chatroom = converse.chatboxviews.showChat({
                    'id': jid,
                    'jid': jid,
                    'name': Strophe.unescapeNode(Strophe.getNodeFromJid(jid)),
                    'nick': nick,
                    'chatroom': true,
                    'box_id' : b64_sha1(jid)
                });
            }
        });

        this.ControlBoxView = converse.ChatBoxView.extend({
            tagName: 'div',
            className: 'chatbox',
            id: 'controlbox',
            events: {
                'click a.close-chatbox-button': 'close',
                'click ul#controlbox-tabs li a': 'switchTab',
                'mousedown .dragresize-tm': 'onDragResizeStart'
            },

            initialize: function () {
                this.$el.insertAfter(converse.controlboxtoggle.$el);
                this.model.on('change:connected', this.onConnected, this);
                this.model.on('destroy', this.hide, this);
                this.model.on('hide', this.hide, this);
                this.model.on('show', this.show, this);
                this.model.on('change:closed', this.ensureClosedState, this);
                this.render();
                if (this.model.get('connected')) {
                    this.initRoster();
                }
                if (!this.model.get('closed')) {
                    this.show();
                } else {
                    this.hide();
                }
            },

            onConnected: function () {
                if (this.model.get('connected')) {
                    this.render().initRoster();
                    converse.features.off('add', this.featureAdded, this);
                    converse.features.on('add', this.featureAdded, this);
                    // Features could have been added before the controlbox was
                    // initialized. Currently we're only interested in MUC
                    var feature = converse.features.findWhere({'var': 'http://jabber.org/protocol/muc'});
                    if (feature) {
                        this.featureAdded(feature);
                    }
                }
            },

            initRoster: function () {
                /* We initialize the roster, which will appear inside the
                 * Contacts Panel.
                 */
                converse.roster = new converse.RosterContacts();
                converse.roster.browserStorage = new Backbone.BrowserStorage[converse.storage](
                    b64_sha1('converse.contacts-'+converse.bare_jid));
                var rostergroups = new converse.RosterGroups();
                rostergroups.browserStorage = new Backbone.BrowserStorage[converse.storage](
                    b64_sha1('converse.roster.groups'+converse.bare_jid));
                converse.rosterview = new converse.RosterView({model: rostergroups});
                this.contactspanel.$el.append(converse.rosterview.$el);
                converse.rosterview.render().fetch().update();
                converse.connection.roster.get(function () {});
                return this;
            },

            render: function () {
                if (!converse.connection.connected || !converse.connection.authenticated || converse.connection.disconnecting) {
                    // TODO: we might need to take prebinding into consideration here.
                    this.renderLoginPanel();
                } else if (!this.contactspanel || !this.contactspanel.$el.is(':visible')) {
                    this.renderContactsPanel();
                }
                return this;
            },

            renderLoginPanel: function () {
                this.$el.html(converse.templates.controlbox(this.model.toJSON()));
                var cfg = {'$parent': this.$el.find('.controlbox-panes'), 'model': this};
                if (!this.loginpanel) {
                    this.loginpanel = new converse.LoginPanel(cfg);
                } else {
                    this.loginpanel.delegateEvents().initialize(cfg);
                }
                this.loginpanel.render();
                this.initDragResize();
            },

            renderContactsPanel: function () {
                this.$el.html(converse.templates.controlbox(this.model.toJSON()));
                this.contactspanel = new converse.ContactsPanel({'$parent': this.$el.find('.controlbox-panes')});
                this.contactspanel.render();
                converse.xmppstatusview = new converse.XMPPStatusView({'model': converse.xmppstatus});
                converse.xmppstatusview.render();
                if (converse.allow_muc) {
                    this.roomspanel = new converse.RoomsPanel({'$parent': this.$el.find('.controlbox-panes')});
                    this.roomspanel.render();
                }
                this.initDragResize();
            },

            close: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                if (converse.connection.connected) {
                    this.model.save({'closed': true});
                } else {
                    this.model.trigger('hide');
                }
                converse.emit('controlBoxClosed', this);
                return this;
            },

            ensureClosedState: function () {
                if (this.model.get('closed')) {
                    this.hide();
                } else {
                    this.show();
                }
            },

            hide: function (callback) {
                this.$el.hide('fast', function () {
                    converse.refreshWebkit();
                    converse.emit('chatBoxClosed', this);
                    converse.controlboxtoggle.show(function () {
                        if (typeof callback === "function") {
                            callback();
                        }
                    });
                });
                return this;
            },

            show: function () {
                converse.controlboxtoggle.hide($.proxy(function () {
                    this.$el.show('fast', function () {
                        if (converse.rosterview) {
                            converse.rosterview.update();
                        }
                        converse.refreshWebkit();
                    }.bind(this));
                    converse.emit('controlBoxOpened', this);
                }, this));
                return this;
            },

            featureAdded: function (feature) {
                if ((feature.get('var') == 'http://jabber.org/protocol/muc') && (converse.allow_muc)) {
                    this.roomspanel.muc_domain = feature.get('from');
                    var $server= this.$el.find('input.new-chatroom-server');
                    if (! $server.is(':focus')) {
                        $server.val(this.roomspanel.muc_domain);
                    }
                    if (converse.auto_list_rooms) {
                        this.roomspanel.trigger('update-rooms-list');
                    }
                }
            },

            switchTab: function (ev) {
                ev.preventDefault();
                var $tab = $(ev.target),
                    $sibling = $tab.parent().siblings('li').children('a'),
                    $tab_panel = $($tab.attr('href'));
                $($sibling.attr('href')).hide();
                $sibling.removeClass('current');
                $tab.addClass('current');
                $tab_panel.show();
            },

            showHelpMessages: function (msgs) {
                // Override showHelpMessages in ChatBoxView, for now do nothing.
                return;
            }
        });

        this.ChatRoomOccupant = Backbone.Model;
        this.ChatRoomOccupantView = Backbone.View.extend({
            tagName: 'li',
            initialize: function () {
                this.model.on('change', this.render, this);
                this.model.on('destroy', this.destroy, this);
            },
            render: function () {
                var $new = converse.templates.occupant(
                    _.extend(
                        this.model.toJSON(), {
                            'desc_moderator': __('This user is a moderator'),
                            'desc_participant': __('This user can send messages in this room'),
                            'desc_visitor': __('This user can NOT send messages in this room')
                    })
                );
                this.$el.replaceWith($new);
                this.setElement($new, true);
                return this;
            },

            destroy: function () {
                this.$el.remove();
            }
        });

        this.ChatRoomOccupants = Backbone.Collection.extend({
            model: converse.ChatRoomOccupant,
            initialize: function (options) {
                this.browserStorage = new Backbone.BrowserStorage[converse.storage](
                    b64_sha1('converse.occupants'+converse.bare_jid+options.nick));
            },
        });

        this.ChatRoomOccupantsView = Backbone.Overview.extend({
            tagName: 'div',
            className: 'participants',

            initialize: function () {
                this.model.on("add", this.onOccupantAdded, this);
            },

            render: function () {
                this.$el.html(
                    converse.templates.chatroom_sidebar({
                        'label_invitation': __('Invite...'),
                        'label_occupants': __('Occupants')
                    })
                );
                return this.initInviteWidget();
            },

            onOccupantAdded: function (item) {
                var view = this.get(item.get('id'));
                if (!view) {
                    view = this.add(item.get('id'), new converse.ChatRoomOccupantView({model: item}));
                } else {
                    delete view.model; // Remove ref to old model to help garbage collection
                    view.model = item;
                    view.initialize();
                }
                this.$('.participant-list').append(view.render().$el);
            },

            onChatRoomRoster: function (roster, room) {
                var roster_size = _.size(roster),
                    $participant_list = this.$('.participant-list'),
                    participants = [],
                    keys = _.keys(roster),
                    occupant, attrs, i, nick;

                for (i=0; i<roster_size; i++) {
                    nick = Strophe.unescapeNode(keys[i]);
                    attrs = {
                        'id': nick,
                        'role': roster[keys[i]].role,
                        'nick': nick
                    };
                    occupant = this.model.get(nick);
                    if (occupant) {
                        occupant.save(attrs);
                    } else {
                        this.model.create(attrs);
                    }
                }
                _.each(_.difference(this.model.pluck('id'), keys), function (id) {
                    this.model.get(id).destroy();
                }, this);
                return true;
            },

            initInviteWidget: function () {
                var $el = this.$('input.invited-contact');
                $el.typeahead({
                    minLength: 1,
                    highlight: true
                }, {
                    name: 'contacts-dataset',
                    source: function (q, cb) {
                        var results = [];
                        _.each(converse.roster.filter(contains(['fullname', 'jid'], q)), function (n) {
                            results.push({value: n.get('fullname'), jid: n.get('jid')});
                        });
                        cb(results);
                    },
                    templates: {
                        suggestion: _.template('<p data-jid="{{jid}}">{{value}}</p>')
                    }
                });
                $el.on('typeahead:selected', $.proxy(function (ev, suggestion, dname) {
                    var reason = prompt(
                        __(___('You are about to invite %1$s to the chat room "%2$s". '), suggestion.value, this.model.get('id')) +
                        __("You may optionally include a message, explaining the reason for the invitation.")
                    );
                    if (reason !== null) {
                        converse.connection.muc.rooms[this.chatroomview.model.get('id')].directInvite(suggestion.jid, reason);
                        converse.emit('roomInviteSent', this, suggestion.jid, reason);
                    }
                    $(ev.target).typeahead('val', '');
                }, this));
                return this;
            },

        });

        this.ChatRoomView = converse.ChatBoxView.extend({
            length: 300,
            tagName: 'div',
            className: 'chatroom',
            events: {
                'click .close-chatbox-button': 'close',
                'click .toggle-chatbox-button': 'minimize',
                'click .configure-chatroom-button': 'configureChatRoom',
                'click .toggle-smiley': 'toggleEmoticonMenu',
                'click .toggle-smiley ul li': 'insertEmoticon',
                'click .toggle-clear': 'clearChatRoomMessages',
                'click .toggle-participants a': 'toggleOccupants',
                'keypress textarea.chat-textarea': 'keyPressed',
                'mousedown .dragresize-tm': 'onDragResizeStart'
            },
            is_chatroom: true,

            initialize: function () {
                this.model.messages.on('add', this.onMessageAdded, this);
                this.model.on('change:minimized', function (item) {
                    if (item.get('minimized')) {
                        this.hide();
                    } else {
                        this.maximize();
                    }
                }, this);
                this.model.on('destroy', function (model, response, options) {
                    this.hide();
                    converse.connection.muc.leave(
                        this.model.get('jid'),
                        this.model.get('nick'),
                        $.proxy(this.onLeave, this),
                        undefined);
                },
                this);

                this.occupantsview = new converse.ChatRoomOccupantsView({
                    model: new converse.ChatRoomOccupants({nick: this.model.get('nick')}),
                });
                this.occupantsview.chatroomview = this;
                this.render();
                this.occupantsview.model.fetch({add:true});
                this.connect(null);
                converse.emit('chatRoomOpened', this);

                this.$el.insertAfter(converse.chatboxviews.get("controlbox").$el);
                this.model.messages.fetch({add: true});
                if (this.model.get('minimized')) {
                    this.hide();
                } else {
                    this.show();
                }
            },

            render: function () {
                this.$el.attr('id', this.model.get('box_id'))
                        .html(converse.templates.chatroom(this.model.toJSON()));
                this.renderChatArea();
                setTimeout(function () {
                    converse.refreshWebkit();
                }, 50);
                return this;
            },

            renderChatArea: function () {
                if (!this.$('.chat-area').length) {
                    this.$('.chat-body').empty()
                        .append(
                            converse.templates.chatarea({
                                'show_toolbar': converse.show_toolbar,
                                'label_message': __('Message'),
                            }))
                        .append(this.occupantsview.render().$el);
                    this.renderToolbar();
                }
                // XXX: This is a bit of a hack, to make sure that the
                // sidebar's state is remembered.
                this.model.set({hidden_occupants: !this.model.get('hidden_occupants')});
                this.toggleOccupants();
                return this;
            },

            toggleOccupants: function (ev) {
                if (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                var $el = this.$('.icon-hide-users');
                if (!this.model.get('hidden_occupants')) {
                    this.model.save({hidden_occupants: true});
                    $el.removeClass('icon-hide-users').addClass('icon-show-users');
                    this.$('div.participants').animate({width: 0}).hide();
                    this.$('.chat-area').animate({width: '100%'}, $.proxy(function () {
                        this.scrollDown();
                    }, this));
                    this.$('form.sendXMPPMessage').animate({width: '100%'});
                } else {
                    this.model.save({hidden_occupants: false});
                    $el.removeClass('icon-show-users').addClass('icon-hide-users');
                    this.$('.chat-area').animate({width: '200px'}, $.proxy(function () {
                        this.$('div.participants').css({width: '100px'}).show();
                        this.scrollDown();
                    }, this));
                    this.$('form.sendXMPPMessage').animate({width: '200px'});
                }
            },

            onCommandError: function (stanza) {
                this.showStatusNotification(__("Error: could not execute the command"), true);
            },

            sendChatRoomMessage: function (body) {
                var match = body.replace(/^\s*/, "").match(/^\/(.*?)(?: (.*))?$/) || [false],
                    $chat_content, args;

                switch (match[1]) {
                    case 'ban':
                        args = match[2].splitOnce(' ');
                        converse.connection.muc.ban(this.model.get('jid'), args[0], args[1], undefined, $.proxy(this.onCommandError, this));
                        break;
                    case 'clear':
                        this.clearChatRoomMessages();
                        break;
                    case 'deop':
                        args = match[2].splitOnce(' ');
                        converse.connection.muc.deop(this.model.get('jid'), args[0], args[1], undefined, $.proxy(this.onCommandError, this));
                        break;
                    case 'help':
                        $chat_content = this.$el.find('.chat-content');
                        msgs = [
                            '<strong>/ban</strong>: '   +__('Ban user from room'),
                            '<strong>/clear</strong>: ' +__('Remove messages'),
                            '<strong>/help</strong>: '  +__('Show this menu'),
                            '<strong>/kick</strong>: '  +__('Kick user from room'),
                            '<strong>/me</strong>: '    +__('Write in 3rd person'),
                            '<strong>/mute</strong>: '  +__("Remove user's ability to post messages"),
                            '<strong>/nick</strong>: '  +__('Change your nickname'),
                            '<strong>/topic</strong>: ' +__('Set room topic'),
                            '<strong>/voice</strong>: ' +__('Allow muted user to post messages')
                            ];
                        this.showHelpMessages(msgs);
                        break;
                    case 'kick':
                        args = match[2].splitOnce(' ');
                        converse.connection.muc.kick(this.model.get('jid'), args[0], args[1], undefined, $.proxy(this.onCommandError, this));
                        break;
                    case 'mute':
                        args = match[2].splitOnce(' ');
                        converse.connection.muc.mute(this.model.get('jid'), args[0], args[1], undefined, $.proxy(this.onCommandError, this));
                        break;
                    case 'nick':
                        converse.connection.muc.changeNick(this.model.get('jid'), match[2]);
                        break;
                    case 'op':
                        args = match[2].splitOnce(' ');
                        converse.connection.muc.op(this.model.get('jid'), args[0], args[1], undefined, $.proxy(this.onCommandError, this));
                        break;
                    case 'topic':
                        converse.connection.muc.setTopic(this.model.get('jid'), match[2]);
                        break;
                    case 'voice':
                        args = match[2].splitOnce(' ');
                        converse.connection.muc.voice(this.model.get('jid'), args[0], args[1], undefined, $.proxy(this.onCommandError, this));
                        break;
                    default:
                        this.last_msgid = converse.connection.muc.groupchat(this.model.get('jid'), body);
                    break;
                }
            },

            connect: function (password) {
                if (_.has(converse.connection.muc.rooms, this.model.get('jid'))) {
                    // If the room exists, it already has event listeners, so we
                    // don't add them again.
                    converse.connection.muc.join(
                        this.model.get('jid'), this.model.get('nick'), null, null, null, password);
                } else {
                    converse.connection.muc.join(
                        this.model.get('jid'),
                        this.model.get('nick'),
                        $.proxy(this.onChatRoomMessage, this),
                        $.proxy(this.onChatRoomPresence, this),
                        $.proxy(this.onChatRoomRoster, this),
                        password);
                }
            },

            onLeave: function () {
                this.model.set('connected', false);
            },

            renderConfigurationForm: function (stanza) {
                var $form= this.$el.find('form.chatroom-form'),
                    $stanza = $(stanza),
                    $fields = $stanza.find('field'),
                    title = $stanza.find('title').text(),
                    instructions = $stanza.find('instructions').text(),
                    i, j, options=[], $field, $options;
                var input_types = {
                    'text-private': 'password',
                    'text-single': 'textline',
                    'boolean': 'checkbox',
                    'hidden': 'hidden',
                    'list-single': 'dropdown'
                };
                $form.find('span.spinner').remove();
                $form.append($('<legend>').text(title));
                if (instructions != title) {
                    $form.append($('<p>').text(instructions));
                }
                for (i=0; i<$fields.length; i++) {
                    $field = $($fields[i]);
                    if ($field.attr('type') == 'list-single') {
                        options = [];
                        $options = $field.find('option');
                        for (j=0; j<$options.length; j++) {
                            options.push(converse.templates.select_option({
                                value: $($options[j]).find('value').text(),
                                label: $($options[j]).attr('label')
                            }));
                        }
                        $form.append(converse.templates.form_select({
                            name: $field.attr('var'),
                            label: $field.attr('label'),
                            options: options.join('')
                        }));
                    } else if ($field.attr('type') == 'boolean') {
                        $form.append(converse.templates.form_checkbox({
                            name: $field.attr('var'),
                            type: input_types[$field.attr('type')],
                            label: $field.attr('label') || '',
                            checked: $field.find('value').text() === "1" && 'checked="1"' || ''
                        }));
                    } else {
                        $form.append(converse.templates.form_input({
                            name: $field.attr('var'),
                            type: input_types[$field.attr('type')],
                            label: $field.attr('label') || '',
                            value: $field.find('value').text()
                        }));
                    }
                }
                $form.append('<input type="submit" value="'+__('Save')+'"/>');
                $form.append('<input type="button" value="'+__('Cancel')+'"/>');
                $form.on('submit', $.proxy(this.saveConfiguration, this));
                $form.find('input[type=button]').on('click', $.proxy(this.cancelConfiguration, this));
            },

            saveConfiguration: function (ev) {
                ev.preventDefault();
                var that = this;
                var $inputs = $(ev.target).find(':input:not([type=button]):not([type=submit])'),
                    count = $inputs.length,
                    configArray = [];
                $inputs.each(function () {
                    var $input = $(this), value;
                    if ($input.is('[type=checkbox]')) {
                        value = $input.is(':checked') && 1 || 0;
                    } else {
                        value = $input.val();
                    }
                    var cnode = $(converse.templates.field({
                        name: $input.attr('name'),
                        value: value
                    }))[0];
                    configArray.push(cnode);
                    if (!--count) {
                        converse.connection.muc.saveConfiguration(
                            that.model.get('jid'),
                            configArray,
                            $.proxy(that.onConfigSaved, that),
                            $.proxy(that.onErrorConfigSaved, that)
                        );
                    }
                });
                this.$el.find('div.chatroom-form-container').hide(
                    function () {
                        $(this).remove();
                        that.$el.find('.chat-area').show();
                        that.$el.find('.participants').show();
                    });
            },

            onConfigSaved: function (stanza) {
                // XXX
            },

            onErrorConfigSaved: function (stanza) {
                this.showStatusNotification(__("An error occurred while trying to save the form."));
            },

            cancelConfiguration: function (ev) {
                ev.preventDefault();
                var that = this;
                this.$el.find('div.chatroom-form-container').hide(
                    function () {
                        $(this).remove();
                        that.$el.find('.chat-area').show();
                        that.$el.find('.participants').show();
                    });
            },

            configureChatRoom: function (ev) {
                ev.preventDefault();
                if (this.$el.find('div.chatroom-form-container').length) {
                    return;
                }
                this.$('.chat-body').children().hide();
                this.$('.chat-body').append(
                    $('<div class="chatroom-form-container">'+
                        '<form class="chatroom-form">'+
                        '<span class="spinner centered"/>'+
                        '</form>'+
                    '</div>'));
                converse.connection.muc.configure(
                    this.model.get('jid'),
                    $.proxy(this.renderConfigurationForm, this)
                );
            },

            submitPassword: function (ev) {
                ev.preventDefault();
                var password = this.$el.find('.chatroom-form').find('input[type=password]').val();
                this.$el.find('.chatroom-form-container').replaceWith('<span class="spinner centered"/>');
                this.connect(password);
            },

            renderPasswordForm: function () {
                this.$('.chat-body').children().hide();
                this.$('span.centered.spinner').remove();
                this.$('.chat-body').append(
                    converse.templates.chatroom_password_form({
                        heading: __('This chatroom requires a password'),
                        label_password: __('Password: '),
                        label_submit: __('Submit')
                    }));
                this.$('.chatroom-form').on('submit', $.proxy(this.submitPassword, this));
            },

            showDisconnectMessage: function (msg) {
                this.$('.chat-area').hide();
                this.$('.participants').hide();
                this.$('span.centered.spinner').remove();
                this.$('.chat-body').append($('<p>'+msg+'</p>'));
            },

            /* http://xmpp.org/extensions/xep-0045.html
             * ----------------------------------------
             * 100 message      Entering a room         Inform user that any occupant is allowed to see the user's full JID
             * 101 message (out of band)                Affiliation change  Inform user that his or her affiliation changed while not in the room
             * 102 message      Configuration change    Inform occupants that room now shows unavailable members
             * 103 message      Configuration change    Inform occupants that room now does not show unavailable members
             * 104 message      Configuration change    Inform occupants that a non-privacy-related room configuration change has occurred
             * 110 presence     Any room presence       Inform user that presence refers to one of its own room occupants
             * 170 message or initial presence          Configuration change    Inform occupants that room logging is now enabled
             * 171 message      Configuration change    Inform occupants that room logging is now disabled
             * 172 message      Configuration change    Inform occupants that the room is now non-anonymous
             * 173 message      Configuration change    Inform occupants that the room is now semi-anonymous
             * 174 message      Configuration change    Inform occupants that the room is now fully-anonymous
             * 201 presence     Entering a room         Inform user that a new room has been created
             * 210 presence     Entering a room         Inform user that the service has assigned or modified the occupant's roomnick
             * 301 presence     Removal from room       Inform user that he or she has been banned from the room
             * 303 presence     Exiting a room          Inform all occupants of new room nickname
             * 307 presence     Removal from room       Inform user that he or she has been kicked from the room
             * 321 presence     Removal from room       Inform user that he or she is being removed from the room because of an affiliation change
             * 322 presence     Removal from room       Inform user that he or she is being removed from the room because the room has been changed to members-only and the user is not a member
             * 332 presence     Removal from room       Inform user that he or she is being removed from the room because of a system shutdown
             */
            infoMessages: {
                100: __('This room is not anonymous'),
                102: __('This room now shows unavailable members'),
                103: __('This room does not show unavailable members'),
                104: __('Non-privacy-related room configuration has changed'),
                170: __('Room logging is now enabled'),
                171: __('Room logging is now disabled'),
                172: __('This room is now non-anonymous'),
                173: __('This room is now semi-anonymous'),
                174: __('This room is now fully-anonymous'),
                201: __('A new room has been created'),
            },

            disconnectMessages: {
                301: __('You have been banned from this room'),
                307: __('You have been kicked from this room'),
                321: __("You have been removed from this room because of an affiliation change"),
                322: __("You have been removed from this room because the room has changed to members-only and you're not a member"),
                332: __("You have been removed from this room because the MUC (Multi-user chat) service is being shut down.")
            },

            actionInfoMessages: {
                /* XXX: Note the triple underscore function and not double
                 * underscore.
                 *
                 * This is a hack. We can't pass the strings to __ because we
                 * don't yet know what the variable to interpolate is.
                 *
                 * Triple underscore will just return the string again, but we
                 * can then at least tell gettext to scan for it so that these
                 * strings are picked up by the translation machinery.
                 */
                301: ___("<strong>%1$s</strong> has been banned"),
                303: ___("<strong>%1$s</strong>'s nickname has changed"),
                307: ___("<strong>%1$s</strong> has been kicked out"),
                321: ___("<strong>%1$s</strong> has been removed because of an affiliation change"),
                322: ___("<strong>%1$s</strong> has been removed for not being a member")
            },

            newNicknameMessages: {
                210: ___('Your nickname has been automatically changed to: <strong>%1$s</strong>'),
                303: ___('Your nickname has been changed to: <strong>%1$s</strong>')
            },

            showStatusMessages: function ($el, is_self) {
                /* Check for status codes and communicate their purpose to the user.
                 * Allow user to configure chat room if they are the owner.
                 * See: http://xmpp.org/registrar/mucstatus.html
                 */
                var $chat_content,
                    disconnect_msgs = [],
                    msgs = [],
                    reasons = [];
                $el.find('x[xmlns="'+Strophe.NS.MUC_USER+'"]').each($.proxy(function (idx, x) {
                    var $item = $(x).find('item');
                    if (Strophe.getBareJidFromJid($item.attr('jid')) === converse.bare_jid && $item.attr('affiliation') === 'owner') {
                        this.$el.find('a.configure-chatroom-button').show();
                    }
                    $(x).find('item reason').each(function (idx, reason) {
                        if ($(reason).text()) {
                            reasons.push($(reason).text());
                        }
                    });
                    $(x).find('status').each($.proxy(function (idx, stat) {
                        var code = stat.getAttribute('code');
                        if (is_self && _.contains(_.keys(this.newNicknameMessages), code)) {
                            this.model.save({'nick': Strophe.getResourceFromJid($el.attr('from'))});
                            msgs.push(__(this.newNicknameMessages[code], $item.attr('nick')));
                        } else if (is_self && _.contains(_.keys(this.disconnectMessages), code)) {
                            disconnect_msgs.push(this.disconnectMessages[code]);
                        } else if (!is_self && _.contains(_.keys(this.actionInfoMessages), code)) {
                            msgs.push(
                                __(this.actionInfoMessages[code], Strophe.unescapeNode(Strophe.getResourceFromJid($el.attr('from'))))
                            );
                        } else if (_.contains(_.keys(this.infoMessages), code)) {
                            msgs.push(this.infoMessages[code]);
                        } else if (code !== '110') {
                            if ($(stat).text()) {
                                msgs.push($(stat).text()); // Sometimes the status contains human readable text and not a code.
                            }
                        }
                    }, this));
                }, this));

                if (disconnect_msgs.length > 0) {
                    for (i=0; i<disconnect_msgs.length; i++) {
                        this.showDisconnectMessage(disconnect_msgs[i]);
                    }
                    for (i=0; i<reasons.length; i++) {
                        this.showDisconnectMessage(__('The reason given is: "'+reasons[i]+'"'), true);
                    }
                    this.model.set('connected', false);
                    return;
                }
                $chat_content = this.$el.find('.chat-content');
                for (i=0; i<msgs.length; i++) {
                    $chat_content.append(converse.templates.info({message: msgs[i]}));
                }
                for (i=0; i<reasons.length; i++) {
                    this.showStatusNotification(__('The reason given is: "'+reasons[i]+'"'), true);
                }
                return this.scrollDown();
            },

            showErrorMessage: function ($error, room) {
                // We didn't enter the room, so we must remove it from the MUC
                // add-on
                delete converse.connection.muc[room.name];
                if ($error.attr('type') == 'auth') {
                    if ($error.find('not-authorized').length) {
                        this.renderPasswordForm();
                    } else if ($error.find('registration-required').length) {
                        this.showDisconnectMessage(__('You are not on the member list of this room'));
                    } else if ($error.find('forbidden').length) {
                        this.showDisconnectMessage(__('You have been banned from this room'));
                    }
                } else if ($error.attr('type') == 'modify') {
                    if ($error.find('jid-malformed').length) {
                        this.showDisconnectMessage(__('No nickname was specified'));
                    }
                } else if ($error.attr('type') == 'cancel') {
                    if ($error.find('not-allowed').length) {
                        this.showDisconnectMessage(__('You are not allowed to create new rooms'));
                    } else if ($error.find('not-acceptable').length) {
                        this.showDisconnectMessage(__("Your nickname doesn't conform to this room's policies"));
                    } else if ($error.find('conflict').length) {
                        // TODO: give user the option of choosing a different
                        // nickname
                        this.showDisconnectMessage(__("Your nickname is already taken"));
                    } else if ($error.find('item-not-found').length) {
                        this.showDisconnectMessage(__("This room does not (yet) exist"));
                    } else if ($error.find('service-unavailable').length) {
                        this.showDisconnectMessage(__("This room has reached it's maximum number of occupants"));
                    }
                }
            },

            onChatRoomPresence: function (presence, room) {
                var $presence = $(presence), is_self;
                if ($presence.attr('type') === 'error') {
                    this.model.set('connected', false);
                    this.showErrorMessage($presence.find('error'), room);
                } else {
                    is_self = ($presence.find("status[code='110']").length) || ($presence.attr('from') == room.name+'/'+Strophe.escapeNode(room.nick));
                    if (!this.model.get('conneced')) {
                        this.model.set('connected', true);
                        this.$('span.centered.spinner').remove();
                        this.$el.find('.chat-body').children().show();
                    }
                    this.showStatusMessages($presence, is_self);
                }
                return true;
            },

            onChatRoomMessage: function (message) {
                var $message = $(message),
                    body = $message.children('body').text(),
                    jid = $message.attr('from'),
                    resource = Strophe.getResourceFromJid(jid),
                    sender = resource && Strophe.unescapeNode(resource) || '',
                    delayed = $message.find('delay').length > 0,
                    subject = $message.children('subject').text();
                this.showStatusMessages($message);
                if (subject) {
                    this.$el.find('.chatroom-topic').text(subject).attr('title', subject);
                    // # For translators: the %1$s and %2$s parts will get replaced by the user and topic text respectively
                    // # Example: Topic set by JC Brand to: Hello World!
                    this.$el.find('.chat-content').append(
                        converse.templates.info({
                            'message': __('Topic set by %1$s to: %2$s', sender, subject)
                        }));
                }
                if (sender === '') {
                    return true;
                }
                this.model.createMessage($message);
                if (!delayed && sender !== this.model.get('nick') && (new RegExp("\\b"+this.model.get('nick')+"\\b")).test(body)) {
                    playNotification();
                }
                if (sender !== this.model.get('nick')) {
                    // We only emit an event if it's not our own message
                    converse.emit('message', message);
                }
                return true;
            },

            onChatRoomRoster: function (roster, room) {
                return this.occupantsview.onChatRoomRoster(roster, room);
            }
        });

        this.ChatBoxes = Backbone.Collection.extend({
            model: converse.ChatBox,
            comparator: 'time_opened',

            registerMessageHandler: function () {
                converse.connection.addHandler(
                    $.proxy(function (message) {
                        this.onMessage(message);
                        return true;
                    }, this), null, 'message', 'chat');

                converse.connection.addHandler(
                    $.proxy(function (message) {
                        this.onInvite(message);
                        return true;
                    }, this), 'jabber:x:conference', 'message');
            },

            onConnected: function () {
                this.browserStorage = new Backbone.BrowserStorage[converse.storage](
                    b64_sha1('converse.chatboxes-'+converse.bare_jid));
                this.registerMessageHandler();
                this.fetch({
                    add: true,
                    success: $.proxy(function (collection, resp) {
                        if (!_.include(_.pluck(resp, 'id'), 'controlbox')) {
                            this.add({
                                id: 'controlbox',
                                box_id: 'controlbox'
                            });
                        }
                        this.get('controlbox').save({connected:true});
                    }, this)
                });
            },

            isOnlyChatStateNotification: function ($msg) {
                // See XEP-0085 Chat State Notification
                return (
                    $msg.find('body').length === 0 && (
                        $msg.find(ACTIVE).length !== 0 ||
                        $msg.find(COMPOSING).length !== 0 ||
                        $msg.find(INACTIVE).length !== 0 ||
                        $msg.find(PAUSED).length !== 0 ||
                        $msg.find(GONE).length !== 0
                    )
                );
            },

            onInvite: function (message) {
                var $message = $(message),
                    $x = $message.children('x[xmlns="jabber:x:conference"]'),
                    from = Strophe.getBareJidFromJid($message.attr('from')),
                    room_jid = $x.attr('jid'),
                    reason = $x.attr('reason'),
                    contact = converse.roster.get(from),
                    result;

                if (!reason) {
                    result = confirm(
                        __(___("%1$s has invited you to join a chat room: %2$s"), contact.get('fullname'), room_jid)
                    );
                } else {
                    result = confirm(
                         __(___('%1$s has invited you to join a chat room: %2$s, and left the following reason: "%3$s"'),
                                contact.get('fullname'), room_jid, reason)
                    );
                }
                if (result === true) {
                    var chatroom = converse.chatboxviews.showChat({
                        'id': room_jid,
                        'jid': room_jid,
                        'name': Strophe.unescapeNode(Strophe.getNodeFromJid(room_jid)),
                        'nick': Strophe.unescapeNode(Strophe.getNodeFromJid(converse.connection.jid)),
                        'chatroom': true,
                        'box_id' : b64_sha1(room_jid),
                        'password': $x.attr('password')
                    });
                    if (!chatroom.get('connected')) {
                        converse.chatboxviews.get(room_jid).connect(null);
                    }
                }
            },

            onMessage: function (message) {
                var $message = $(message);
                var buddy_jid, $forwarded, $received,
                    message_from = $message.attr('from');
                if (message_from === converse.connection.jid) {
                    // FIXME: Forwarded messages should be sent to specific resources,
                    // not broadcasted
                    return true;
                }
                $forwarded = $message.children('forwarded');
                $received = $message.children('received[xmlns="urn:xmpp:carbons:2"]');
                if ($forwarded.length) {
                    $message = $forwarded.children('message');
                } else if ($received.length) {
                    $message = $received.children('forwarded').children('message');
                    message_from = $message.attr('from');
                }
                var from = Strophe.getBareJidFromJid(message_from),
                    to = Strophe.getBareJidFromJid($message.attr('to')),
                    resource, chatbox, roster_item;
                if (from == converse.bare_jid) {
                    // I am the sender, so this must be a forwarded message...
                    buddy_jid = to;
                    resource = Strophe.getResourceFromJid($message.attr('to'));
                } else {
                    buddy_jid = from;
                    resource = Strophe.getResourceFromJid(message_from);
                }
                chatbox = this.get(buddy_jid);
                roster_item = converse.roster.get(buddy_jid);

                if (roster_item === undefined) {
                    // The buddy was likely removed
                    converse.log('Could not get roster item for JID '+buddy_jid, 'error');
                    return true;
                }

                if (!chatbox) {
                    var fullname = roster_item.get('fullname');
                    fullname = _.isEmpty(fullname)? buddy_jid: fullname;
                    chatbox = this.create({
                        'id': buddy_jid,
                        'jid': buddy_jid,
                        'fullname': fullname,
                        'image_type': roster_item.get('image_type'),
                        'image': roster_item.get('image'),
                        'url': roster_item.get('url')
                    });
                }
                if (!this.isOnlyChatStateNotification($message) && from !== converse.bare_jid) {
                    playNotification();
                }
                chatbox.receiveMessage($message);
                converse.roster.addResource(buddy_jid, resource);
                converse.emit('message', message);
                return true;
            }
        });

        this.ChatBoxViews = Backbone.Overview.extend({

            initialize: function () {
                this.model.on("add", this.onChatBoxAdded, this);
                this.model.on("change:minimized", function (item) {
                    if (item.get('minimized') === false) {
                         this.trimChats(this.get(item.get('id')));
                    } else {
                         this.trimChats();
                    }
                }, this);
            },

            _ensureElement: function() {
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
                var view = this.get(item.get('id'));
                if (!view) {
                    if (item.get('chatroom')) {
                        view = new converse.ChatRoomView({'model': item});
                    } else if (item.get('box_id') === 'controlbox') {
                        view = new converse.ControlBoxView({model: item});
                    } else {
                        view = new converse.ChatBoxView({model: item});
                    }
                    this.add(item.get('id'), view);
                } else {
                    delete view.model; // Remove ref to old model to help garbage collection
                    view.model = item;
                    view.initialize();
                }
                this.trimChats(view);
            },

            trimChats: function (newchat) {
                /* This method is called when a newly created chat box will
                 * be shown.
                 *
                 * It checks whether there is enough space on the page to show
                 * another chat box. Otherwise it minimize the oldest chat box
                 * to create space.
                 */
                if (converse.no_trimming || (this.model.length <= 1)) {
                    return;
                }
                var oldest_chat,
                    controlbox_width = 0,
                    $minimized = converse.minimized_chats.$el,
                    minimized_width = _.contains(this.model.pluck('minimized'), true) ? $minimized.outerWidth(true) : 0,
                    boxes_width = newchat ? newchat.$el.outerWidth(true) : 0,
                    new_id = newchat ? newchat.model.get('id') : null,
                    controlbox = this.get('controlbox');

                if (!controlbox || !controlbox.$el.is(':visible')) {
                    controlbox_width = converse.controlboxtoggle.$el.outerWidth(true);
                } else {
                    controlbox_width = controlbox.$el.outerWidth(true);
                }

                _.each(this.getAll(), function (view) {
                    var id = view.model.get('id');
                    if ((id !== 'controlbox') && (id !== new_id) && (!view.model.get('minimized')) && view.$el.is(':visible')) {
                        boxes_width += view.$el.outerWidth(true);
                    }
                });

                if ((minimized_width + boxes_width + controlbox_width) > this.$el.outerWidth(true)) {
                    oldest_chat = this.getOldestMaximizedChat();
                    if (oldest_chat) {
                        oldest_chat.minimize();
                    }
                }
            },

            getOldestMaximizedChat: function () {
                // Get oldest view (which is not controlbox)
                var i = 0;
                var model = this.model.sort().at(i);
                while (model.get('id') === 'controlbox' || model.get('minimized') === true) {
                    i++;
                    model = this.model.at(i);
                    if (!model) {
                        return null;
                    }
                }
                return model;
            },

            closeAllChatBoxes: function (include_controlbox) {
                var i, chatbox;
                // TODO: once Backbone.Overview has been refactored, we should
                // be able to call .each on the views themselves.
                this.model.each($.proxy(function (model) {
                    var id = model.get('id');
                    if (include_controlbox || id !== 'controlbox') {
                        this.get(id).close();
                    }
                }, this));
                return this;
            },

            showChat: function (attrs) {
                /* Find the chat box and show it.
                 * If it doesn't exist, create it.
                 */
                var chatbox  = this.model.get(attrs.jid);
                if (chatbox) {
                    if (chatbox.get('minimized')) {
                        chatbox.maximize();
                    } else {
                        chatbox.trigger('show');
                    }
                } else {
                    chatbox = this.model.create(attrs, {
                        'error': function (model, response) {
                            converse.log(response.responseText);
                        }
                    });
                }
                return chatbox;
            }
        });

        this.MinimizedChatBoxView = Backbone.View.extend({
            tagName: 'div',
            className: 'chat-head',

            events: {
                'click .close-chatbox-button': 'close',
                'click .restore-chat': 'restore'
            },

            initialize: function () {
                this.model.messages.on('add', this.updateUnreadMessagesCounter, this);
                this.model.on('showSentOTRMessage', this.updateUnreadMessagesCounter, this);
                this.model.on('showReceivedOTRMessage', this.updateUnreadMessagesCounter, this);
                this.model.on('change:minimized', this.clearUnreadMessagesCounter, this);
            },

            render: function () {
                var data = _.extend(
                    this.model.toJSON(),
                    { 'tooltip': __('Click to restore this chat') }
                );
                if (this.model.get('chatroom')) {
                    data.title = this.model.get('name');
                    this.$el.addClass('chat-head-chatroom');
                } else {
                    data.title = this.model.get('fullname');
                    this.$el.addClass('chat-head-chatbox');
                }
                return this.$el.html(converse.templates.trimmed_chat(data));
            },

            clearUnreadMessagesCounter: function () {
                this.model.set({'num_unread': 0});
                this.render();
            },

            updateUnreadMessagesCounter: function () {
                this.model.set({'num_unread': this.model.get('num_unread') + 1});
                this.render();
            },

            close: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                this.remove();
                this.model.destroy();
                converse.emit('chatBoxClosed', this);
                return this;
            },

            restore: _.debounce(function (ev) {
                if (ev && ev.preventDefault) {
                    ev.preventDefault();
                }
                this.remove();
                this.model.maximize();
            }, 200)
        });

        this.MinimizedChats = Backbone.Overview.extend({
            el: "#minimized-chats",

            events: {
                "click #toggle-minimized-chats": "toggle"
            },

            initialize: function () {
                this.initToggle();
                this.model.on("add", this.onChanged, this);
                this.model.on("destroy", this.removeChat, this);
                this.model.on("change:minimized", this.onChanged, this);
                this.model.on('change:num_unread', this.updateUnreadMessagesCounter, this);
            },

            tearDown: function () {
                this.model.off("add", this.onChanged);
                this.model.off("destroy", this.removeChat);
                this.model.off("change:minimized", this.onChanged);
                this.model.off('change:num_unread', this.updateUnreadMessagesCounter);
                return this;
            },

            initToggle: function () {
                this.toggleview = new converse.MinimizedChatsToggleView({
                    model: new converse.MinimizedChatsToggle()
                });
                var id = b64_sha1('converse.minchatstoggle'+converse.bare_jid);
                this.toggleview.model.id = id; // Appears to be necessary for backbone.browserStorage
                this.toggleview.model.browserStorage = new Backbone.BrowserStorage[converse.storage](id);
                this.toggleview.model.fetch();
            },

            render: function () {
                if (this.keys().length === 0) {
                    this.$el.hide('fast');
                } else if (this.keys().length === 1) {
                    this.$el.show('fast');
                }
                return this.$el;
            },

            toggle: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                this.toggleview.model.save({'collapsed': !this.toggleview.model.get('collapsed')});
                this.$('.minimized-chats-flyout').toggle();
            },

            onChanged: function (item) {
                if (item.get('id') !== 'controlbox' && item.get('minimized')) {
                    this.addChat(item);
                } else if (this.get(item.get('id'))) {
                    this.removeChat(item);
                }
            },

            addChat: function (item) {
                var existing = this.get(item.get('id'));
                if (existing && existing.$el.parent().length !== 0) {
                    return;
                }
                var view = new converse.MinimizedChatBoxView({model: item});
                this.$('.minimized-chats-flyout').append(view.render());
                this.add(item.get('id'), view);
                this.toggleview.model.set({'num_minimized': this.keys().length});
                this.render();
            },

            removeChat: function (item) {
                this.remove(item.get('id'));
                this.toggleview.model.set({'num_minimized': this.keys().length});
                this.render();
            },

            updateUnreadMessagesCounter: function () {
                var ls = this.model.pluck('num_unread'),
                    count = 0, i;
                for (i=0; i<ls.length; i++) { count += ls[i]; }
                this.toggleview.model.set({'num_unread': count});
                this.render();
            }
        });

        this.MinimizedChatsToggle = Backbone.Model.extend({
            initialize: function () {
                this.set({
                    'collapsed': this.get('collapsed') || false,
                    'num_minimized': this.get('num_minimized') || 0,
                    'num_unread':  this.get('num_unread') || 0,
                });
            }
        });

        this.MinimizedChatsToggleView = Backbone.View.extend({
            el: '#toggle-minimized-chats',

            initialize: function () {
                this.model.on('change:num_minimized', this.render, this);
                this.model.on('change:num_unread', this.render, this);
                this.$flyout = this.$el.siblings('.minimized-chats-flyout');
            },

            render: function () {
                this.$el.html(converse.templates.toggle_chats(
                    _.extend(this.model.toJSON(), {
                        'Minimized': __('Minimized')
                    })
                ));
                if (this.model.get('collapsed')) {
                    this.$flyout.hide();
                } else {
                    this.$flyout.show();
                }
                return this.$el;
            },
        });

        this.RosterContact = Backbone.Model.extend({
            initialize: function (attributes, options) {
                var jid = attributes.jid;
                var attrs = _.extend({
                    'id': jid,
                    'fullname': jid,
                    'chat_status': 'offline',
                    'user_id': Strophe.getNodeFromJid(jid),
                    'resources': [],
                    'groups': [],
                    'status': ''
                }, attributes);
                this.set(attrs);
            }
        });

        this.RosterContactView = Backbone.View.extend({
            tagName: 'dd',

            events: {
                "click .accept-xmpp-request": "acceptRequest",
                "click .decline-xmpp-request": "declineRequest",
                "click .open-chat": "openChat",
                "click .remove-xmpp-contact": "removeContact"
            },

            initialize: function () {
                this.model.on("change", this.onChange, this);
                this.model.on("remove", this.remove, this);
                this.model.on("destroy", this.remove, this);
                this.model.on("open", this.openChat, this);
            },

            onChange: function () {
                if (converse.show_only_online_users) {
                    if (this.model.get('chat_status') !== 'online') {
                        this.$el.hide();
                    } else {
                        this.$el.show();
                    }
                } else {
                    this.render();
                }
            },

            openChat: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                return converse.chatboxviews.showChat({
                    'id': this.model.get('jid'),
                    'jid': this.model.get('jid'),
                    'fullname': this.model.get('fullname'),
                    'image_type': this.model.get('image_type'),
                    'image': this.model.get('image'),
                    'url': this.model.get('url'),
                    'status': this.model.get('status')
                });
            },

            removeContact: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                var result = confirm(__("Are you sure you want to remove this contact?"));
                if (result === true) {
                    var bare_jid = this.model.get('jid');
                    converse.connection.roster.remove(bare_jid, $.proxy(function (iq) {
                        converse.connection.roster.unauthorize(bare_jid);
                        converse.rosterview.model.remove(bare_jid);
                        this.model.destroy();
                        this.remove();
                    }, this));
                }
            },

            acceptRequest: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                var jid = this.model.get('jid');
                converse.connection.roster.authorize(jid);
                converse.connection.roster.add(jid, this.model.get('fullname'), [], function (iq) {
                    converse.connection.roster.subscribe(jid, null, converse.xmppstatus.get('fullname'));
                });
            },

            declineRequest: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                var result = confirm(__("Are you sure you want to decline this contact request?"));
                if (result === true) {
                    converse.connection.roster.unauthorize(this.model.get('jid'));
                    this.model.destroy();
                }
                return this;
            },

            render: function () {
                var item = this.model,
                    ask = item.get('ask'),
                    chat_status = item.get('chat_status'),
                    requesting  = item.get('requesting'),
                    subscription = item.get('subscription');

                var classes_to_remove = [
                    'current-xmpp-contact',
                    'pending-xmpp-contact',
                    'requesting-xmpp-contact'
                    ].concat(_.keys(STATUSES));

                _.each(classes_to_remove,
                    function (cls) {
                        if (this.el.className.indexOf(cls) !== -1) {
                            this.$el.removeClass(cls);
                        }
                    }, this);
                this.$el.addClass(chat_status).data('status', chat_status);

                if ((ask === 'subscribe') || (subscription === 'from')) {
                    /* ask === 'subscribe'
                     *      Means we have asked to subscribe to them.
                     *
                     * subscription === 'from'
                     *      They are subscribed to use, but not vice versa.
                     *      We assume that there is a pending subscription
                     *      from us to them (otherwise we're in a state not
                     *      supported by converse.js).
                     *
                     *  So in both cases the user is a "pending" contact.
                     */
                    this.$el.addClass('pending-xmpp-contact');
                    this.$el.html(converse.templates.pending_contact(
                        _.extend(item.toJSON(), {
                            'desc_remove': __('Click to remove this contact')
                        })
                    ));
                } else if (requesting === true) {
                    this.$el.addClass('requesting-xmpp-contact');
                    this.$el.html(converse.templates.requesting_contact(
                        _.extend(item.toJSON(), {
                            'desc_accept': __("Click to accept this contact request"),
                            'desc_decline': __("Click to decline this contact request"),
                        })
                    ));
                    converse.controlboxtoggle.showControlBox();
                } else if (subscription === 'both' || subscription === 'to') {
                    this.$el.addClass('current-xmpp-contact');
                    this.$el.html(converse.templates.roster_item(
                        _.extend(item.toJSON(), {
                            'desc_status': STATUSES[chat_status||'offline'],
                            'desc_chat': __('Click to chat with this contact'),
                            'desc_remove': __('Click to remove this contact')
                        })
                    ));
                }
                return this;
            }
        });

        this.RosterContacts = Backbone.Collection.extend({
            model: converse.RosterContact,

            comparator: function (contact1, contact2) {
                var name1 = contact1.get('fullname').toLowerCase();
                var status1 = contact1.get('chat_status') || 'offline';
                var name2 = contact2.get('fullname').toLowerCase();
                var status2 = contact2.get('chat_status') || 'offline';
                if (STATUS_WEIGHTS[status1] === STATUS_WEIGHTS[status2]) {
                    return name1 < name2 ? -1 : (name1 > name2? 1 : 0);
                } else  {
                    return STATUS_WEIGHTS[status1] < STATUS_WEIGHTS[status2] ? -1 : 1;
                }
            },

            subscribeToSuggestedItems: function (msg) {
                $(msg).find('item').each(function () {
                    var $this = $(this),
                        jid = $this.attr('jid'),
                        action = $this.attr('action'),
                        fullname = $this.attr('name');
                    if (action === 'add') {
                        converse.connection.roster.add(jid, fullname, [], function (iq) {
                            converse.connection.roster.subscribe(jid, null, converse.xmppstatus.get('fullname'));
                        });
                    }
                });
                return true;
            },

            isSelf: function (jid) {
                return (Strophe.getBareJidFromJid(jid) === Strophe.getBareJidFromJid(converse.connection.jid));
            },

            addResource: function (bare_jid, resource) {
                var item = this.get(bare_jid),
                    resources;
                if (item) {
                    resources = item.get('resources');
                    if (resources) {
                        if (_.indexOf(resources, resource) == -1) {
                            resources.push(resource);
                            item.set({'resources': resources});
                        }
                    } else  {
                        item.set({'resources': [resource]});
                    }
                }
            },

            removeResource: function (bare_jid, resource) {
                var item = this.get(bare_jid),
                    resources,
                    idx;
                if (item) {
                    resources = item.get('resources');
                    idx = _.indexOf(resources, resource);
                    if (idx !== -1) {
                        resources.splice(idx, 1);
                        item.set({'resources': resources});
                        return resources.length;
                    }
                }
                return 0;
            },

            subscribeBack: function (jid) {
                var bare_jid = Strophe.getBareJidFromJid(jid);
                if (converse.connection.roster.findItem(bare_jid)) {
                    converse.connection.roster.authorize(bare_jid);
                    converse.connection.roster.subscribe(jid, null, converse.xmppstatus.get('fullname'));
                } else {
                    converse.connection.roster.add(jid, '', [], function (iq) {
                        converse.connection.roster.authorize(bare_jid);
                        converse.connection.roster.subscribe(jid, null, converse.xmppstatus.get('fullname'));
                    });
                }
            },

            unsubscribe: function (jid) {
                /* Upon receiving the presence stanza of type "unsubscribed",
                * the user SHOULD acknowledge receipt of that subscription state
                * notification by sending a presence stanza of type "unsubscribe"
                * this step lets the user's server know that it MUST no longer
                * send notification of the subscription state change to the user.
                */
                converse.xmppstatus.sendPresence('unsubscribe');
                if (converse.connection.roster.findItem(jid)) {
                    converse.connection.roster.remove(jid, function (iq) {
                        converse.rosterview.model.remove(jid);
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

            clearCache: function (items) {
                /* The localstorage cache containing roster contacts might contain
                * some contacts that aren't actually in our roster anymore. We
                * therefore need to remove them now.
                */
                var id, i, contact;
                for (i=0; i < this.models.length; ++i) {
                    id = this.models[i].get('id');
                    if (_.indexOf(_.pluck(items, 'jid'), id) === -1) {
                        contact = this.get(id);
                        if (contact) {
                            contact.destroy();
                        }
                    }
                }
            },

            rosterHandler: function (items) {
                converse.emit('roster', items);
                this.clearCache(items);
                _.each(items, function (item, index, items) {
                    if (this.isSelf(item.jid)) { return; }
                    var model = this.get(item.jid);
                    if (!model) {
                        var is_last = (index === (items.length-1)) ? true : false;
                        if ((item.subscription === 'none') && (item.ask === null) && !is_last) {
                            // We're not interested in zombies
                            // (Hack: except if it's the last item, then we still
                            // add it so that the roster will be shown).
                            return;
                        }
                        this.create({
                            ask: item.ask,
                            fullname: item.name || item.jid,
                            groups: item.groups,
                            jid: item.jid,
                            subscription: item.subscription
                        });
                    } else {
                        if ((item.subscription === 'none') && (item.ask === null)) {
                            // This user is no longer in our roster
                            model.destroy();
                        } else {
                            // We only find out about requesting contacts via the
                            // presence handler, so if we receive a contact
                            // here, we know they aren't requesting anymore.
                            // see docs/DEVELOPER.rst
                            model.save({
                                subscription: item.subscription,
                                ask: item.ask,
                                requesting: null,
                                groups: item.groups
                            });
                        }
                    }
                }, this);

                if (!converse.initial_presence_sent) {
                    /* Once we've sent out our initial presence stanza, we'll
                     * start receiving presence stanzas from our contacts.
                     * We therefore only want to do this after our roster has
                     * been set up (otherwise we can't meaningfully process
                     * incoming presence stanzas).
                     */
                    converse.initial_presence_sent = 1;
                    converse.xmppstatus.sendPresence();
                }
            },

            handleIncomingSubscription: function (jid) {
                var bare_jid = Strophe.getBareJidFromJid(jid);
                var item = this.get(bare_jid);

                if (!converse.allow_contact_requests) {
                    converse.connection.roster.unauthorize(bare_jid);
                    return true;
                }
                if (converse.auto_subscribe) {
                    if ((!item) || (item.get('subscription') != 'to')) {
                        this.subscribeBack(jid);
                    } else {
                        converse.connection.roster.authorize(bare_jid);
                    }
                } else {
                    if ((item) && (item.get('subscription') != 'none'))  {
                        converse.connection.roster.authorize(bare_jid);
                    } else {
                        if (!this.get(bare_jid)) {
                            converse.getVCard(
                                bare_jid,
                                $.proxy(function (jid, fullname, img, img_type, url) {
                                    this.add({
                                        jid: bare_jid,
                                        subscription: 'none',
                                        ask: null,
                                        requesting: true,
                                        fullname: fullname || jid,
                                        image: img,
                                        image_type: img_type,
                                        url: url,
                                        vcard_updated: moment().format()
                                    });
                                }, this),
                                $.proxy(function (jid, iq) {
                                    converse.log("Error while retrieving vcard");
                                    this.add({
                                        jid: bare_jid,
                                        subscription: 'none',
                                        ask: null,
                                        requesting: true,
                                        fullname: bare_jid,
                                        vcard_updated: moment().format()
                                    });
                                }, this)
                            );
                        } else {
                            return true;
                        }
                    }
                }
                return true;
            },

            presenceHandler: function (presence) {
                var $presence = $(presence),
                    presence_type = $presence.attr('type');
                if (presence_type === 'error') {
                    return true;
                }
                var jid = $presence.attr('from'),
                    bare_jid = Strophe.getBareJidFromJid(jid),
                    resource = Strophe.getResourceFromJid(jid),
                    $show = $presence.find('show'),
                    chat_status = $show.text() || 'online',
                    status_message = $presence.find('status'),
                    contact;

                if (this.isSelf(bare_jid)) {
                    if ((converse.connection.jid !== jid)&&(presence_type !== 'unavailable')) {
                        // Another resource has changed it's status, we'll update ours as well.
                        converse.xmppstatus.save({'status': chat_status});
                    }
                    return true;
                } else if (($presence.find('x').attr('xmlns') || '').indexOf(Strophe.NS.MUC) === 0) {
                    return true; // Ignore MUC
                }
                contact = this.get(bare_jid);
                if (contact && (status_message.text() != contact.get('status'))) {
                    contact.save({'status': status_message.text()});
                }
                if ((presence_type === 'subscribed') || (presence_type === 'unsubscribe')) {
                    return true;
                } else if (presence_type === 'subscribe') {
                    return this.handleIncomingSubscription(jid);
                } else if (presence_type === 'unsubscribed') {
                    this.unsubscribe(bare_jid);
                } else if (presence_type === 'unavailable') {
                    if (this.removeResource(bare_jid, resource) === 0) {
                        if (contact) {
                            contact.save({'chat_status': 'offline'});
                        }
                    }
                } else if (contact) {
                    // presence_type is undefined
                    this.addResource(bare_jid, resource);
                    contact.save({'chat_status': chat_status});
                }
                return true;
            }
        });

        this.RosterGroup = Backbone.Model.extend({
            initialize: function (attributes, options) {
                this.set(_.extend({
                    description: DESC_GROUP_TOGGLE,
                    state: OPENED
                }, attributes));
                // Collection of contacts belonging to this group.
                this.contacts = new converse.RosterContacts();
            }
        });

        this.RosterGroupView = Backbone.Overview.extend({
            tagName: 'dt',
            className: 'roster-group',
            events: {
                "click a.group-toggle": "toggle"
            },

            initialize: function () {
                this.model.contacts.on("add", this.addContact, this);
                this.model.contacts.on("change:subscription", this.onContactSubscriptionChange, this);
                this.model.contacts.on("change:requesting", this.onContactRequestChange, this);
                this.model.contacts.on("change:chat_status", function (contact) {
                    // This might be optimized by instead of first sorting,
                    // finding the correct position in positionContact
                    this.model.contacts.sort();
                    this.positionContact(contact).render();
                }, this);
                this.model.contacts.on("destroy", this.onRemove, this);
                this.model.contacts.on("remove", this.onRemove, this);
                converse.roster.on('change:groups', this.onContactGroupChange, this);
            },

            render: function () {
                this.$el.attr('data-group', this.model.get('name'));
                this.$el.html(
                    $(converse.templates.group_header({
                        label_group: this.model.get('name'),
                        desc_group_toggle: this.model.get('description'),
                        toggle_state: this.model.get('state')
                    }))
                );
                return this;
            },

            addContact: function (contact) {
                var view = new converse.RosterContactView({model: contact});
                this.add(contact.get('id'), view);
                view = this.positionContact(contact).render();
                if (this.model.get('state') === CLOSED) {
                    view.$el.hide();
                    this.$el.show();
                } else {
                    this.show();
                }
            },

            positionContact: function (contact) {
                /* Place the contact's DOM element in the correct alphabetical
                 * position amongst the other contacts in this group.
                 */
                var view = this.get(contact.get('id'));
                var index = this.model.contacts.indexOf(contact);
                view.$el.detach();
                if (index === 0) {
                    this.$el.after(view.$el);
                } else if (index == (this.model.contacts.length-1)) {
                    this.$el.nextUntil('dt').last().after(view.$el);
                } else {
                    this.$el.nextUntil('dt').eq(index).before(view.$el);
                }
                return view;
            },

            show: function () {
                this.$el.nextUntil('dt').addBack().show();
            },

            hide: function () {
                this.$el.nextUntil('dt').addBack().hide();
            },

            filter: function (q) {
                /* Filter the group's contacts based on the query "q".
                 * The query is matched against the contact's full name.
                 * If all contacts are filtered out (i.e. hidden), then the
                 * group must be filtered out as well.
                 */
                var matches, rejects;
                if (q.length === 0) {
                    if (this.model.get('state') === OPENED) {
                        this.model.contacts.each($.proxy(function (item) {
                            if (!(converse.show_only_online_users && item.get('chat_status') === 'online')) {
                                this.get(item.get('id')).$el.show();
                            }
                        }, this));
                    }
                    this.showIfInvisible();
                } else {
                    q = q.toLowerCase();
                    matches = this.model.contacts.filter(contains.not('fullname', q));
                    if (matches.length === this.model.contacts.length) { // hide the whole group
                        this.hide();
                    } else {
                        _.each(matches, $.proxy(function (item) {
                            this.get(item.get('id')).$el.hide();
                        }, this));
                        _.each(this.model.contacts.reject(contains.not('fullname', q)), $.proxy(function (item) {
                            this.get(item.get('id')).$el.show();
                        }, this));
                        this.showIfInvisible();
                    }
                }
            },

            showIfInvisible: function () {
                if (!this.$el.is(':visible')) {
                    this.$el.show();
                }
            },

            toggle: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                var $el = $(ev.target);
                if ($el.hasClass("icon-opened")) {
                    this.$el.nextUntil('dt').slideUp();
                    this.model.save({state: CLOSED});
                    $el.removeClass("icon-opened").addClass("icon-closed");
                } else {
                    $el.removeClass("icon-closed").addClass("icon-opened");
                    this.model.save({state: OPENED});
                    this.filter(
                        converse.rosterview.$('.roster-filter').val(),
                        converse.rosterview.$('.filter-type').val()
                    );
                }
            },

            onContactGroupChange: function (contact) {
                var in_this_group = _.contains(contact.get('groups'), this.model.get('name'));
                var cid = contact.get('id');
                var in_this_overview = !this.get(cid);
                if (in_this_group && !in_this_overview) {
                    this.model.contacts.remove(cid);
                } else if (!in_this_group && in_this_overview) {
                    this.addContact(contact);
                }
            },

            onContactSubscriptionChange: function (contact) {
                if ((this.model.get('name') === HEADER_PENDING_CONTACTS) && contact.get('subscription') !== 'from') {
                    this.model.contacts.remove(contact.get('id'));
                }
            },

            onContactRequestChange: function (contact) {
                if ((this.model.get('name') === HEADER_REQUESTING_CONTACTS) && !contact.get('requesting')) {
                    this.model.contacts.remove(contact.get('id'));
                }
            },

            onRemove: function (contact) {
                this.remove(contact.get('id'));
                if (this.model.contacts.length === 0) {
                    this.$el.hide();
                }
            }
        });

        this.RosterGroups = Backbone.Collection.extend({
            model: converse.RosterGroup,
            comparator: function (a, b) {
                /* Groups are sorted alphabetically, ignoring case.
                 * However, Ungrouped, Requesting Contacts and Pending Contacts
                 * appear last and in that order. */
                a = a.get('name');
                b = b.get('name');
                var special_groups = _.keys(HEADER_WEIGHTS);
                var a_is_special = _.contains(special_groups, a);
                var b_is_special = _.contains(special_groups, b);
                if (!a_is_special && !b_is_special ) {
                    return a.toLowerCase() < b.toLowerCase() ? -1 : (a.toLowerCase() > b.toLowerCase() ? 1 : 0);
                } else if (a_is_special && b_is_special) {
                    return HEADER_WEIGHTS[a] < HEADER_WEIGHTS[b] ? -1 : (HEADER_WEIGHTS[a] > HEADER_WEIGHTS[b] ? 1 : 0);
                } else if (!a_is_special && b_is_special) {
                    return (b === HEADER_CURRENT_CONTACTS) ? 1 : -1;
                } else if (a_is_special && !b_is_special) {
                    return (a === HEADER_CURRENT_CONTACTS) ? -1 : 1;
                }
            }
        });

        this.RosterView = Backbone.Overview.extend({
            tagName: 'div',
            id: 'converse-roster',
            events: {
                "keydown .roster-filter": "liveFilter",
                "click .onX": "clearFilter",
                "mousemove .x": "togglePointer",
                "change .filter-type": "changeFilterType"
            },

            initialize: function () {
                this.registerRosterHandler();
                this.registerRosterXHandler();
                this.registerPresenceHandler();
                converse.roster.on("add", this.onContactAdd, this);
                converse.roster.on('change', this.onContactChange, this);
                converse.roster.on("destroy", this.update, this);
                converse.roster.on("remove", this.update, this);
                this.model.on("add", this.onGroupAdd, this);
                this.model.on("reset", this.reset, this);
            },

            update: function () {
                var $count = $('#online-count');
                $count.text('('+converse.roster.getNumOnlineContacts()+')');
                if (!$count.is(':visible')) {
                    $count.show();
                }
                return this.showHideFilter();
            },

            render: function () {
                this.$el.html(converse.templates.roster({
                    placeholder: __('Type to filter'),
                    label_contacts: LABEL_CONTACTS,
                    label_groups: LABEL_GROUPS
                }));
                return this;
            },

            fetch: function () {
                this.model.fetch({
                    silent: true,
                    success: $.proxy(this.positionFetchedGroups, this)
                });
                converse.roster.fetch({add: true});
                return this;
            },

            changeFilterType: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                this.clearFilter();
                this.filter(
                    this.$('.roster-filter').val(),
                    ev.target.value
                );
            },

            tog: function (v) {
                return v?'addClass':'removeClass';
            },

            togglePointer: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                var el = ev.target;
                $(el)[this.tog(el.offsetWidth-18 < ev.clientX-el.getBoundingClientRect().left)]('onX');
            },

            filter: function (query, type) {
                var matches;
                query = query.toLowerCase();
                if (type === 'groups') {
                    _.each(this.getAll(), function (view, idx) {
                        if (view.model.get('name').toLowerCase().indexOf(query.toLowerCase()) === -1) {
                            view.hide();
                        } else if (view.model.contacts.length > 0) {
                            view.show();
                        }
                    });
                } else {
                    _.each(this.getAll(), function (view) {
                        view.filter(query, type);
                    });
                }
            },

            liveFilter: _.debounce(function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                var q = ev.target.value;
                var t = this.$('.filter-type').val();
                $(ev.target)[this.tog(q)]('x');
                this.filter(q, t);
            }, 300),

            clearFilter: function (ev) {
                if (ev && ev.preventDefault) {
                    ev.preventDefault();
                    $(ev.target).removeClass('x onX').val('');
                }
                this.filter('');
            },

            showHideFilter: function () {
                if (!this.$el.is(':visible')) {
                    return;
                }
                var $filter = this.$('.roster-filter');
                var $type  = this.$('.filter-type');
                var visible = $filter.is(':visible');
                if (visible && $filter.val().length > 0) {
                    // Don't hide if user is currently filtering.
                    return;
                }
                if (this.$('.roster-contacts').hasScrollBar()) {
                    if (!visible) {
                        $filter.show();
                        $type.show();
                    }
                } else {
                    $filter.hide();
                    $type.hide();
                }
                return this;
            },

            reset: function () {
                converse.roster.reset();
                this.removeAll();
                this.render().update();
                return this;
            },

            registerRosterHandler: function () {
                // Register handlers that depend on the roster
                converse.connection.roster.registerCallback(
                    $.proxy(converse.roster.rosterHandler, converse.roster),
                    null, 'presence', null);
            },

            registerRosterXHandler: function () {
                converse.connection.addHandler(
                    $.proxy(converse.roster.subscribeToSuggestedItems, converse.roster),
                    'http://jabber.org/protocol/rosterx', 'message', null);
            },

            registerPresenceHandler: function () {
                converse.connection.addHandler(
                    $.proxy(function (presence) {
                        converse.roster.presenceHandler(presence);
                        return true;
                    }, this), null, 'presence', null);
            },

            onGroupAdd: function (group) {
                var view = new converse.RosterGroupView({model: group});
                this.add(group.get('name'), view.render());
                this.positionGroup(view);
            },

            onContactAdd: function (contact) {
                this.addRosterContact(contact).update();
                if (!contact.get('vcard_updated')) {
                    // This will update the vcard, which triggers a change
                    // request which will rerender the roster contact.
                    converse.getVCard(contact.get('jid'));
                }
            },

            onContactChange: function (contact) {
                this.updateChatBox(contact).update();
                if (_.has(contact.changed, 'subscription')) {
                    if (contact.changed.subscription == 'from') {
                        this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                    } else if (contact.get('subscription') === 'both') {
                        this.addExistingContact(contact);
                    }
                }
                if (_.has(contact.changed, 'ask') && contact.changed.ask == 'subscribe') {
                    this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                }
                if (_.has(contact.changed, 'subscription') && contact.changed.requesting == 'true') {
                    this.addContactToGroup(contact, HEADER_REQUESTING_CONTACTS);
                }
            },

            updateChatBox: function (contact) {
                var chatbox = converse.chatboxes.get(contact.get('jid')),
                    changes = {};
                if (!chatbox) {
                    return this;
                }
                if (_.has(contact.changed, 'chat_status')) {
                    changes.chat_status = contact.get('chat_status');
                }
                if (_.has(contact.changed, 'status')) {
                    changes.status = contact.get('status');
                }
                chatbox.save(changes);
                return this;
            },

            positionFetchedGroups: function (model, resp, options) {
                /* Instead of throwing an add event for each group
                    * fetched, we wait until they're all fetched and then
                    * we position them.
                    * Works around the problem of positionGroup not
                    * working when all groups besides the one being
                    * positioned aren't already in inserted into the
                    * roster DOM element.
                    */
                model.sort();
                model.each($.proxy(function (group, idx) {
                    var view = this.get(group.get('name'));
                    if (!view) {
                        view = new converse.RosterGroupView({model: group});
                        this.add(group.get('name'), view.render());
                    }
                    if (idx === 0) {
                        this.$('.roster-contacts').append(view.$el);
                    } else {
                        this.appendGroup(view);
                    }
                }, this));
            },

            positionGroup: function (view) {
                /* Place the group's DOM element in the correct alphabetical
                 * position amongst the other groups in the roster.
                 */
                var index = this.model.indexOf(view.model);
                if (index === 0) {
                    this.$('.roster-contacts').prepend(view.$el);
                } else if (index == (this.model.length-1)) {
                    this.appendGroup(view);
                } else {
                    $(this.$('.roster-group').eq(index)).before(view.$el);
                }
                return this;
            },

            appendGroup: function (view) {
                /* Add the group at the bottom of the roster
                 */
                var $last = this.$('.roster-group').last();
                var $siblings = $last.siblings('dd');
                if ($siblings.length > 0) {
                    $siblings.last().after(view.$el);
                } else {
                    $last.after(view.$el);
                }
                return this;
            },

            getGroup: function (name) {
                /* Returns the group as specified by name.
                 * Creates the group if it doesn't exist.
                 */
                var view =  this.get(name);
                if (view) {
                    return view.model;
                }
                return this.model.create({name: name, id: b64_sha1(name)});
            },

            addContactToGroup: function (contact, name) {
                this.getGroup(name).contacts.add(contact);
            },

            addExistingContact: function (contact) {
                var groups;
                if (converse.roster_groups) {
                    groups = contact.get('groups');
                    if (groups.length === 0) {
                        groups = [HEADER_UNGROUPED];
                    }
                } else {
                    groups = [HEADER_CURRENT_CONTACTS];
                }
                _.each(groups, $.proxy(function (name) {
                    this.addContactToGroup(contact, name);
                }, this));
            },

            addRosterContact: function (contact) {
                if (contact.get('subscription') === 'both' || contact.get('subscription') === 'to') {
                    this.addExistingContact(contact);
                } else {
                    if ((contact.get('ask') === 'subscribe') || (contact.get('subscription') === 'from')) {
                        this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                    } else if (contact.get('requesting') === true) {
                        this.addContactToGroup(contact, HEADER_REQUESTING_CONTACTS);
                    }
                }
                return this;
            }
        });

        this.XMPPStatus = Backbone.Model.extend({
            initialize: function () {
                this.set({
                    'status' : this.get('status') || 'online'
                });
                this.on('change', $.proxy(function (item) {
                    if (this.get('fullname') === undefined) {
                        converse.getVCard(
                            null, // No 'to' attr when getting one's own vCard
                            $.proxy(function (jid, fullname, image, image_type, url) {
                                this.save({'fullname': fullname});
                            }, this)
                        );
                    }
                    if (_.has(item.changed, 'status')) {
                        converse.emit('statusChanged', this.get('status'));
                    }
                    if (_.has(item.changed, 'status_message')) {
                        converse.emit('statusMessageChanged', this.get('status_message'));
                    }
                }, this));
            },

            sendPresence: function (type) {
                if (type === undefined) {
                    type = this.get('status') || 'online';
                }
                var status_message = this.get('status_message'),
                    presence;
                // Most of these presence types are actually not explicitly sent,
                // but I add all of them here fore reference and future proofing.
                if ((type === 'unavailable') ||
                        (type === 'probe') ||
                        (type === 'error') ||
                        (type === 'unsubscribe') ||
                        (type === 'unsubscribed') ||
                        (type === 'subscribe') ||
                        (type === 'subscribed')) {
                    presence = $pres({'type':type});
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
                converse.connection.send(presence);
            },

            setStatus: function (value) {
                this.sendPresence(value);
                this.save({'status': value});
            },

            setStatusMessage: function (status_message) {
                converse.connection.send($pres().c('show').t(this.get('status')).up().c('status').t(status_message));
                this.save({'status_message': status_message});
                if (this.xhr_custom_status) {
                    $.ajax({
                        url:  this.xhr_custom_status_url,
                        type: 'POST',
                        data: {'msg': status_message}
                    });
                }
            }
        });

        this.XMPPStatusView = Backbone.View.extend({
            el: "span#xmpp-status-holder",

            events: {
                "click a.choose-xmpp-status": "toggleOptions",
                "click #fancy-xmpp-status-select a.change-xmpp-status-message": "renderStatusChangeForm",
                "submit #set-custom-xmpp-status": "setStatusMessage",
                "click .dropdown dd ul li a": "setStatus"
            },

            initialize: function () {
                this.model.on("change", this.updateStatusUI, this);
            },

           render: function () {
                // Replace the default dropdown with something nicer
                var $select = this.$el.find('select#select-xmpp-status'),
                    chat_status = this.model.get('status') || 'offline',
                    options = $('option', $select),
                    $options_target,
                    options_list = [],
                    that = this;
                this.$el.html(converse.templates.choose_status());
                this.$el.find('#fancy-xmpp-status-select')
                        .html(converse.templates.chat_status({
                            'status_message': this.model.get('status_message') || __("I am %1$s", this.getPrettyStatus(chat_status)),
                            'chat_status': chat_status,
                            'desc_custom_status': __('Click here to write a custom status message'),
                            'desc_change_status': __('Click to change your chat status')
                            }));
                // iterate through all the <option> elements and add option values
                options.each(function(){
                    options_list.push(converse.templates.status_option({
                        'value': $(this).val(),
                        'text': this.text
                    }));
                });
                $options_target = this.$el.find("#target dd ul").hide();
                $options_target.append(options_list.join(''));
                $select.remove();
                return this;
            },

            toggleOptions: function (ev) {
                ev.preventDefault();
                $(ev.target).parent().parent().siblings('dd').find('ul').toggle('fast');
            },

            renderStatusChangeForm: function (ev) {
                ev.preventDefault();
                var status_message = this.model.get('status') || 'offline';
                var input = converse.templates.change_status_message({
                    'status_message': status_message,
                    'label_custom_status': __('Custom status'),
                    'label_save': __('Save')
                });
                this.$el.find('.xmpp-status').replaceWith(input);
                this.$el.find('.custom-xmpp-status').focus().focus();
            },

            setStatusMessage: function (ev) {
                ev.preventDefault();
                var status_message = $(ev.target).find('input').val();
                this.model.setStatusMessage(status_message);
            },

            setStatus: function (ev) {
                ev.preventDefault();
                var $el = $(ev.target),
                    value = $el.attr('data-value');
                if (value === 'logout') {
                    this.$el.find(".dropdown dd ul").hide();
                    converse.logOut();
                } else {
                    this.model.setStatus(value);
                    this.$el.find(".dropdown dd ul").hide();
                }
            },

            getPrettyStatus: function (stat) {
                var pretty_status;
                if (stat === 'chat') {
                    pretty_status = __('online');
                } else if (stat === 'dnd') {
                    pretty_status = __('busy');
                } else if (stat === 'xa') {
                    pretty_status = __('away for long');
                } else if (stat === 'away') {
                    pretty_status = __('away');
                } else {
                    pretty_status = __(stat) || __('online');
                }
                return pretty_status;
            },

            updateStatusUI: function (model) {
                if (!(_.has(model.changed, 'status')) && !(_.has(model.changed, 'status_message'))) {
                    return;
                }
                var stat = model.get('status');
                // # For translators: the %1$s part gets replaced with the status
                // # Example, I am online
                var status_message = model.get('status_message') || __("I am %1$s", this.getPrettyStatus(stat));
                this.$el.find('#fancy-xmpp-status-select').html(
                    converse.templates.chat_status({
                        'chat_status': stat,
                        'status_message': status_message,
                        'desc_custom_status': __('Click here to write a custom status message'),
                        'desc_change_status': __('Click to change your chat status')
                    }));
            }
        });

        this.BOSHSession = Backbone.Model;
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
                if (this.browserStorage.records.length === 0) {
                    // browserStorage is empty, so we've likely never queried this
                    // domain for features yet
                    converse.connection.disco.info(converse.domain, null, $.proxy(this.onInfo, this));
                    converse.connection.disco.items(converse.domain, null, $.proxy(this.onItems, this));
                } else {
                    this.fetch({add:true});
                }
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
                 *
                 * TODO: these features need to be added in the relevant
                 * feature-providing Models, not here
                 */
                 converse.connection.disco.addFeature('http://jabber.org/protocol/chatstates'); // Limited support
                 converse.connection.disco.addFeature('http://jabber.org/protocol/rosterx'); // Limited support
                 converse.connection.disco.addFeature('jabber:x:conference');
                 converse.connection.disco.addFeature('urn:xmpp:carbons:2');
                 converse.connection.disco.addFeature('vcard-temp');
                 converse.connection.disco.addFeature(Strophe.NS.BOSH);
                 converse.connection.disco.addFeature(Strophe.NS.DISCO_INFO);
                 converse.connection.disco.addFeature(Strophe.NS.MUC);
                 return this;
            },

            onItems: function (stanza) {
                $(stanza).find('query item').each($.proxy(function (idx, item) {
                    converse.connection.disco.info(
                        $(item).attr('jid'),
                        null,
                        $.proxy(this.onInfo, this));
                }, this));
            },

            onInfo: function (stanza) {
                var $stanza = $(stanza);
                if (($stanza.find('identity[category=server][type=im]').length === 0) &&
                    ($stanza.find('identity[category=conference][type=text]').length === 0)) {
                    // This isn't an IM server component
                    return;
                }
                $stanza.find('feature').each($.proxy(function (idx, feature) {
                    this.create({
                        'var': $(feature).attr('var'),
                        'from': $stanza.attr('from')
                    });
                }, this));
            }
        });

        this.LoginPanel = Backbone.View.extend({
            tagName: 'div',
            id: "login-dialog",
            events: {
                'submit form#converse-login': 'authenticate'
            },

            connect: function ($form, jid, password) {
                if ($form) {
                    $form.find('input[type=submit]').hide().after('<span class="spinner login-submit"/>');
                }
                var resource = Strophe.getResourceFromJid(jid);
                if (!resource) {
                    jid += '/converse.js-' + Math.floor(Math.random()*139749825).toString();
                }
                converse.connection.connect(jid, password, converse.onConnect);
            },

            initialize: function (cfg) {
                cfg.$parent.html(this.$el.html(
                    converse.templates.login_panel({
                        'label_username': __('XMPP/Jabber Username:'),
                        'label_password': __('Password:'),
                        'label_login': __('Log In')
                    })
                ));
                this.$tabs = cfg.$parent.parent().find('#controlbox-tabs');
            },

            render: function () {
                this.$tabs.append(converse.templates.login_tab({label_sign_in: __('Sign in')}));
                this.$el.find('input#jid').focus();
                return this;
            },

            authenticate: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                var $form = $(ev.target),
                    $jid_input = $form.find('input[name=jid]'),
                    jid = $jid_input.val(),
                    $pw_input = $form.find('input[name=password]'),
                    password = $pw_input.val(),
                    $bsu_input = null,
                    errors = false;

                if (! converse.bosh_service_url) {
                    $bsu_input = $form.find('input#bosh_service_url');
                    converse.bosh_service_url = $bsu_input.val();
                    if (! converse.bosh_service_url)  {
                        errors = true;
                        $bsu_input.addClass('error');
                    }
                }
                if (! jid) {
                    errors = true;
                    $jid_input.addClass('error');
                }
                if (! password)  {
                    errors = true;
                    $pw_input.addClass('error');
                }
                if (errors) { return; }
                this.connect($form, jid, password);
                return false;
            },

            remove: function () {
                this.$tabs.empty();
                this.$el.parent().empty();
            }
        });

        this.ControlBoxToggle = Backbone.View.extend({
            tagName: 'a',
            className: 'toggle-controlbox',
            id: 'toggle-controlbox',
            events: {
                'click': 'onClick'
            },
            attributes: {
                'href': "#"
            },

            initialize: function () {
                this.render();
            },

            render: function () {
                $('#conversejs').prepend(this.$el.html(
                    converse.templates.controlbox_toggle({
                        'label_toggle': __('Toggle chat')
                    })
                ));
                // We let the render method of ControlBoxView decide whether
                // the ControlBox or the Toggle must be shown. This prevents
                // artifacts (i.e. on page load the toggle is shown only to then
                // seconds later be hidden in favor of the control box).
                this.$el.hide();
                return this;
            },

            hide: function (callback) {
                this.$el.fadeOut('fast', callback);
            },

            show: function (callback) {
                this.$el.show('fast', callback);
            },

            showControlBox: function () {
                var controlbox = converse.chatboxes.get('controlbox');
                if (!controlbox) {
                    controlbox = converse.addControlBox();
                }
                if (converse.connection.connected) {
                    controlbox.save({closed: false});
                } else {
                    controlbox.trigger('show');
                }
            },

            onClick: function (e) {
                e.preventDefault();
                if ($("div#controlbox").is(':visible')) {
                    var controlbox = converse.chatboxes.get('controlbox');
                    if (converse.connection.connected) {
                        controlbox.save({closed: true});
                    } else {
                        controlbox.trigger('hide');
                    }
                } else {
                    this.showControlBox();
                }
            }
        });

        this.addControlBox = function () {
            return this.chatboxes.add({
                id: 'controlbox',
                box_id: 'controlbox',
                height: this.default_box_height,
                closed: !this.show_controlbox_by_default
            });
        };

        this.initConnection = function () {
            var rid, sid, jid;
            if (this.connection) {
                this.onConnected();
            } else {
                // XXX: it's not yet clear what the order of preference should
                // be between RID and SID received via the initialize method or
                // those received from sessionStorage.
                //
                // What do you we if we receive values from both avenues?
                //
                // Also, what do we do when the keepalive session values are
                // expired? Do we try to fall back?
                if (!this.bosh_service_url) {
                    throw("Error: you must supply a value for the bosh_service_url");
                }
                this.connection = new Strophe.Connection(this.bosh_service_url);

                if (this.prebind) {
                    if ((!this.jid) || (!this.sid) || (!this.rid) || (!this.bosh_service_url)) {
                        throw('If you set prebind=true, you MUST supply JID, RID and SID values');
                    }
                    this.connection.attach(this.jid, this.sid, this.rid, this.onConnect);
                }
                if (this.keepalive) {
                    rid = this.session.get('rid');
                    sid = this.session.get('sid');
                    jid = this.session.get('jid');
                    if (rid && jid && sid) {
                        // We have the necessary tokens for resuming a session
                        rid += 1;
                        this.session.save({rid: rid}); // The RID needs to be increased with each request.
                        this.connection.attach(jid, sid, rid, this.onConnect);
                        return;
                    }
                }
            }
        };

        this._tearDown = function () {
            /* Remove those views which are only allowed with a valid
             * connection.
             */
            this.initial_presence_sent = false;
            this.roster.off().reset(); // Removes roster contacts
            this.connection.roster._callbacks = []; // Remove all Roster handlers (e.g. rosterHandler)
            this.rosterview.model.off().reset(); // Removes roster groups
            this.rosterview.undelegateEvents().remove();
            this.chatboxes.remove(); // Don't call off(), events won't get re-registered upon reconnect.
            if (this.features) {
                this.features.reset();
            }
            if (this.minimized_chats) {
                this.minimized_chats.undelegateEvents().model.reset();
                this.minimized_chats.removeAll(); // Remove sub-views
                this.minimized_chats.tearDown().remove(); // Remove overview
                delete this.minimized_chats;
            }
            return this;
        };

        this._initialize = function () {
            this.chatboxes = new this.ChatBoxes();
            this.chatboxviews = new this.ChatBoxViews({model: this.chatboxes});
            this.controlboxtoggle = new this.ControlBoxToggle();
            this.otr = new this.OTR();
            this.initSession();
            this.initConnection();
            this.addControlBox();
            return this;
        };

        // Initialization
        // --------------
        // This is the end of the initialize method.
        this._initialize();
        this.registerGlobalEventHandlers();
        converse.emit('initialized');
    };
    return {
        'initialize': function (settings, callback) {
            converse.initialize(settings, callback);
        },
        'getBuddy': function (jid) {
            var contact = converse.roster.get(Strophe.getBareJidFromJid(jid));
            if (contact) {
                return contact.attributes;
            }
        },
        'getRID': function () {
            if (converse.expose_rid_and_sid && typeof converse.connection !== "undefined") {
                return converse.connection.rid || converse.connection._proto.rid;
            }
            return null;
        },
        'getSID': function () {
            if (converse.expose_rid_and_sid && typeof converse.connection !== "undefined") {
                return converse.connection.sid || converse.connection._proto.sid;
            }
            return null;
        },
        'once': function(evt, handler) {
            converse.once(evt, handler);
        },
        'on': function(evt, handler) {
            converse.on(evt, handler);
        },
        'off': function(evt, handler) {
            converse.off(evt, handler);
        }
    };
}));
