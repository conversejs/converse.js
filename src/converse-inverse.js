// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define, window */

(function (root, factory) {
    define(["converse-core",
            "converse-chatview",
            "converse-controlbox",
            "converse-muc",
            "converse-singleton"
    ], factory);
}(this, function (converse) {
    "use strict";
    var $ = converse.env.jQuery,
        Strophe = converse.env.Strophe,
        _ = converse.env._;

    converse.plugins.add('converse-inverse', {

        overrides: {
            // overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // new functions which don't exist yet can also be added.

            areDesktopNotificationsEnabled: function () {
                // Call with "ignore_hidden" as true, so that it doesn't check
                // if the windowState is hidden.
                return this.__super__.areDesktopNotificationsEnabled.call(this, true);
            },

            shouldNotifyOfMessage: function (message) {
                var _converse = this.__super__._converse;
                var result = this.__super__.shouldNotifyOfMessage.apply(this, arguments);
                return result && _converse.isMessageToHiddenChat(message);
            },

            ControlBoxView: {
                close: function (ev) {
                    if (ev && ev.preventDefault) {
                        ev.preventDefault();
                    }
                    // The controlbox cannot be closed.
                },

                hide: function (ev) {
                    if (ev && ev.preventDefault) {
                        ev.preventDefault();
                    }
                    // The controlbox cannot be hidden
                },

                renderContactsPanel: function () {
                    this.__super__.renderContactsPanel.apply(this, arguments);
                    this.el.classList.remove("fullscreen");
                    return this;
                },

                renderRegistrationPanel: function () {
                    this.__super__.renderRegistrationPanel.apply(this, arguments);

                    // TODO: put into template
                    var div = document.createElement('div');
                    div.innerHTML = '<h1 class="brand-heading"><i class="icon-conversejs"></i> inVerse</h1>';
                    var el = document.getElementById('converse-register');
                    el.parentNode.insertBefore(div.firstChild, el);
                    return this;
                },

                renderLoginPanel: function () {
                    this.__super__.renderLoginPanel.apply(this, arguments);
                    this.el.classList.add("fullscreen");

                    // TODO: put into template
                    var div = document.createElement('div');
                    div.innerHTML = '<h1 class="brand-heading"><i class="icon-conversejs"></i> inVerse</h1>';
                    var el = document.getElementById('converse-login');
                    el.parentNode.insertBefore(div.firstChild, el);
                    return this;
                }
            },

            ChatRoomView: {
                afterShown: function (focus) {
                    /* Make sure chat rooms are scrolled down when opened
                     */
                    this.scrollDown();
                    if (focus) {
                        this.focus();
                    }
                    return this.__super__.afterShown.apply(this, arguments);
                }
            }
        },

        initialize: function () {
            var _converse = this._converse;

            this.updateSettings({
                sticky_controlbox: true,
                sounds_path: '/node_modules/converse.js/sounds/', // New default
                notification_icon: '/node_modules/converse.js/logo/conversejs128.png', // New default
            });

            _converse.isMessageToHiddenChat = function (message) {
                var jid = Strophe.getBareJidFromJid(message.getAttribute('from'));
                var model = _converse.chatboxes.get(jid);
                if (!_.isNil(model)) {
                    return model.get('hidden');
                }
                // Not having a chat box is assume to be practically the same
                // as it being hidden.
                return true;
            }
        }
    });
}));
