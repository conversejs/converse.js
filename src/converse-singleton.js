// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

/* converse-singleton
 * ******************
 *
 * A plugin which ensures that only one chat (private or groupchat) is
 * visible at any one time. All other ongoing chats are hidden and kept in the
 * background.
 *
 * This plugin makes sense in mobile or fullscreen chat environments (as
 * configured by the `view_mode` setting).
 */

import "converse-chatview";
import converse from "@converse/headless/converse-core";

const { _, Strophe } = converse.env;
const u = converse.env.utils;


function hideChat (view) {
    if (view.model.get('id') === 'controlbox') { return; }
    u.safeSave(view.model, {'hidden': true});
    view.hide();
}


converse.plugins.add('converse-singleton', {
    // It's possible however to make optional dependencies non-optional.
    // If the setting "strict_plugin_dependencies" is set to true,
    // an error will be raised if the plugin is not found.
    //
    // NB: These plugins need to have already been loaded via require.js.
    dependencies: ['converse-chatboxes', 'converse-muc', 'converse-muc-views', 'converse-controlbox', 'converse-rosterview'],

    overrides: {
        // overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        //
        // new functions which don't exist yet can also be added.

        ChatBox: {
            maybeShow (force) {
                // This method must return the chatbox
                const { _converse } = this.__super__;
                if (!force && _converse.isUniView()) {
                    if (this.get('id') === 'controlbox') {
                        return this.trigger('show');
                    }
                    const any_chats_visible = _converse.chatboxes
                        .filter(cb => cb.get('id') != 'controlbox')
                        .filter(cb => !cb.get('hidden')).length > 0;

                    if (!any_chats_visible || !this.get('hidden')) {
                        return this.trigger('show');
                    }
                } else {
                    return this.__super__.maybeShow.apply(this, arguments);
                }
            }
        },

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

        ChatBoxView: {
            shouldShowOnTextMessage () {
                const { _converse } = this.__super__;
                if (_converse.isUniView()) {
                    return false;
                } else { 
                    return this.__super__.shouldShowOnTextMessage.apply(this, arguments);
                }
            },

            _show (focus) {
                /* We only have one chat visible at any one
                 * time. So before opening a chat, we make sure all other
                 * chats are hidden.
                 */
                const { _converse } = this.__super__;
                if (_converse.isUniView()) {
                    _.each(this.__super__._converse.chatboxviews.xget(this.model.get('id')), hideChat);
                    u.safeSave(this.model, {'hidden': false});
                }
                return this.__super__._show.apply(this, arguments);
            }
        },

        ChatRoomView: {
            show (focus) {
                const { _converse } = this.__super__;
                if (_converse.isUniView()) {
                    _.each(this.__super__._converse.chatboxviews.xget(this.model.get('id')), hideChat);
                    u.safeSave(this.model, {'hidden': false});
                }
                return this.__super__.show.apply(this, arguments);
            }
        }
    }
});

