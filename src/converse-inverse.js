// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) JC Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define(["converse-core",
            "tpl!brand_heading",
            "converse-chatview",
            "converse-controlbox",
            "converse-muc",
            "converse-singleton"
    ], factory);
}(this, function (converse, tpl_brand_heading) {
    "use strict";
    const { Strophe, _ } = converse.env;

    function createBrandHeadingElement () {
        const div = document.createElement('div');
        div.innerHTML = tpl_brand_heading();
        return div.firstChild;
    }

     function isMessageToHiddenChat (_converse, message) {
        const jid = Strophe.getBareJidFromJid(message.getAttribute('from'));
        const model = _converse.chatboxes.get(jid);
        if (!_.isNil(model)) {
            return model.get('hidden');
        }
        // Not having a chat box is assume to be practically the same
        // as it being hidden.
        return true;
    }

    converse.plugins.add('converse-inverse', {

        overrides: {
            // overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // new functions which don't exist yet can also be added.

            areDesktopNotificationsEnabled () {
                // Call with "ignore_hidden" as true, so that it doesn't check
                // if the windowState is hidden.
                return this.__super__.areDesktopNotificationsEnabled.call(this, true);
            },

            shouldNotifyOfMessage (message) {
                const { _converse } = this.__super__;
                const result = this.__super__.shouldNotifyOfMessage.apply(this, arguments);
                return result && isMessageToHiddenChat(_converse, message);
            },

            ControlBoxView: {
                renderContactsPanel () {
                    this.__super__.renderContactsPanel.apply(this, arguments);
                    this.el.classList.remove("fullscreen");
                    return this;
                },

                renderRegistrationPanel () {
                    this.__super__.renderRegistrationPanel.apply(this, arguments);
                    if (this.__super__._converse.allow_registration) {
                        const el = document.getElementById('converse-register');
                        el.parentNode.insertBefore(createBrandHeadingElement(), el);
                    }
                    return this;
                },

                renderLoginPanel () {
                    this.__super__.renderLoginPanel.apply(this, arguments);
                    this.el.classList.add("fullscreen");
                    const el = document.getElementById('converse-login');
                    el.parentNode.insertBefore(createBrandHeadingElement(), el);
                    return this;
                }
            },

            ChatRoomView: {
                afterShown (focus) {
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

        initialize () {
            this._converse.api.settings.update({
                chatview_avatar_height: 44,
                chatview_avatar_width: 44,
                hide_open_bookmarks: true,
                show_controlbox_by_default: true,
                sticky_controlbox: true,
            });
        }
    });
}));
