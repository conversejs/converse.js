// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, JC Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define, window, document, JSON */

/* converse-singleton
/* ******************
 *
 * A non-core plugin which ensures that only one chat, private or group, is
 * visible at any one time. All other ongoing chats are hidden and kept in the
 * background.
 *
 * This plugin makes sense in mobile or fullscreen chat environments.
 */
(function (root, factory) {
    define(
        ["converse-core", "converse-chatview"],
        factory);
}(this, function (converse) {
    "use strict";
    var _ = converse.env._,
        Strophe = converse.env.Strophe;

    converse.plugins.add('converse-singleton', {
        // It's possible however to make optional dependencies non-optional.
        // If the setting "strict_plugin_dependencies" is set to true,
        // an error will be raised if the plugin is not found.
        //
        // NB: These plugins need to have already been loaded via require.js.
        optional_dependencies: ['converse-muc', 'converse-controlbox'],

        overrides: {
            // overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // new functions which don't exist yet can also be added.
 
            ChatBoxViews: {
                showChat: function (attrs) {
                    /* We only have one chat visible at any one
                     * time. So before opening a chat, we make sure all other
                     * chats are hidden.
                     */
                    var _converse = this.__super__._converse;
                    var chatbox = this.getChatBox(attrs, true);
                    if (!attrs.hidden && _converse.connection.authenticated) {
                        _.each(_converse.chatboxviews.xget(chatbox.get('id')),
                            function (view) {
                                if (view.model.get('id') === 'controlbox') {
                                    return;
                                }
                                view.model.save({'hidden': true});
                            }
                        );
                        chatbox.save({'hidden': false});
                    }
                    return this.__super__.showChat.apply(this, arguments);
                }
            },

            ChatBoxView: {
                _show: function (focus) {
                    /* We only have one chat visible at any one
                     * time. So before opening a chat, we make sure all other
                     * chats are hidden.
                     */
                    if (!this.model.get('hidden')) {
                        _.each(this.__super__._converse.chatboxviews.xget(this.model.get('id')), function (view) {
                            view.hide();
                            view.model.set({'hidden': true});
                        });
                        return this.__super__._show.apply(this, arguments);
                    }
                }
            },

            RosterContactView: {
                openChat: function (ev) {
                    /* We only have one chat visible at any one
                     * time. So before opening a chat, we make sure all other
                     * chats are hidden.
                     */
                    _.each(this.__super__._converse.chatboxviews.xget('controlbox'),
                        function (view) { view.model.save({'hidden': true}); });
                    this.model.save({'hidden': false});
                    return this.__super__.openChat.apply(this, arguments);
                },
            }
        }
    });
}));
