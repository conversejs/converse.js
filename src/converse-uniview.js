// Converse.js
// http://conversejs.org
//
// Copyright (c) 2013-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)
/**
 * @module converse-uniview
 * @description
 * A plugin which ensures that only one chat (private or groupchat) is
 * visible at any one time. All other ongoing chats are hidden and kept in the
 * background.
 *
 * This plugin makes sense in mobile, embedded or fullscreen chat environments
 * (as configured by the `view_mode` setting).
 */
import "converse-chatview";
import converse from "@converse/headless/converse-core";

const u = converse.env.utils;


function hideChat (view) {
    if (view.model.get('id') === 'controlbox') { return; }
    u.safeSave(view.model, {'hidden': true});
    view.hide();
}

function visibleChats (_converse) {
    return _converse.chatboxes
        .filter(cb => (cb.get('id') !== 'controlbox' && !cb.get('hidden'))).length > 0;
}


converse.plugins.add('converse-uniview', {
    // It's possible however to make optional dependencies non-optional.
    // If the setting "strict_plugin_dependencies" is set to true,
    // an error will be raised if the plugin is not found.
    dependencies: ['converse-chatboxes', 'converse-muc-views', 'converse-controlbox', 'converse-rosterview'],

    overrides: {
        // overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        //
        // new functions which don't exist yet can also be added.
        ChatBoxes: {
            createChatBox (jid, attrs) {
                /* Make sure new chat boxes are hidden by default. */
                const { _converse } = this.__super__;
                if (_converse.isUniView()) {
                    attrs = attrs || {};
                    attrs.hidden = true;
                }
                return this.__super__.createChatBox.call(this, jid, attrs);
            }
        },

        ChatBox: {
            maybeShow () {
                const { _converse } = this.__super__;
                if (_converse.isUniView() && (!this.get('hidden') || !visibleChats(_converse))) {
                    return this.trigger("show");
                } else {
                    return this.__super__.maybeShow.apply(this, arguments);
                }
            }
        },

        ChatBoxView: {
            shouldShowOnTextMessage () {
                const { _converse } = this.__super__;
                if (_converse.isUniView()) {
                    return false;
                } else {
                    return this.__super__.shouldShowOnTextMessage.apply(this, arguments);
                }
            }
        }
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;

        /************************ BEGIN Event Handlers ************************/
        _converse.api.listen.on('beforeShowingChatView', (view) => {
            /* We only have one chat visible at any one
             * time. So before opening a chat, we make sure all other
             * chats are hidden.
             */
            if (_converse.isUniView()) {
                Object.values(_converse.chatboxviews.xget(view.model.get('id')))
                    .filter(v => !v.model.get('hidden'))
                    .forEach(hideChat);

                if (view.model.get('hidden')) {
                    u.safeSave(view.model, {'hidden': false});
                }
            }
        });
        /************************ END Event Handlers ************************/
    }
});
