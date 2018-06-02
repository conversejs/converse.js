// Converse.js
// http://conversejs.org
//
// Copyright (c) 2012-2018, the Converse.js developers
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
 *
 */
(function (root, factory) {
    define(
        ["converse-core", "converse-chatview"],
        factory);
}(this, function (converse) {
    "use strict";
    const { _, Strophe } = converse.env;

    function hideChat (view) {
        if (view.model.get('id') === 'controlbox') { return; }
        view.model.save({'hidden': true});
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
            ChatBoxes: {

                chatBoxMayBeShown (chatbox) {
                    if (_.includes(['mobile', 'fullscreen', 'embedded'], this.__super__._converse.view_mode)) {
                        return !chatbox.get('hidden');
                    } else {
                        return this.__super__.chatBoxMayBeShown.apply(this, arguments);
                    }
                },

                createChatBox (jid, attrs) {
                    /* Make sure new chat boxes are hidden by default. */
                    if (_.includes(['mobile', 'fullscreen', 'embedded'], this.__super__._converse.view_mode)) {
                        attrs = attrs || {};
                        attrs.hidden = true;
                    }
                    return this.__super__.createChatBox.call(this, jid, attrs);
                }
            },

            ChatBoxView: {
                shouldShowOnTextMessage () {
                    if (_.includes(['mobile', 'fullscreen', 'embedded'], this.__super__._converse.view_mode)) {
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
                    if (_.includes(['mobile', 'fullscreen', 'embedded'], this.__super__._converse.view_mode)) {
                        _.each(this.__super__._converse.chatboxviews.xget(this.model.get('id')), hideChat);
                        this.model.set('hidden', false);
                    }
                    return this.__super__._show.apply(this, arguments);
                }
            },

            ChatRoomView: {
                show (focus) {
                    if (_.includes(['mobile', 'fullscreen', 'embedded'], this.__super__._converse.view_mode)) {
                        _.each(this.__super__._converse.chatboxviews.xget(this.model.get('id')), hideChat);
                        this.model.set('hidden', false);
                    }
                    return this.__super__.show.apply(this, arguments);
                }
            }
        }
    });
}));
