// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone */
(function (root, factory) {
    define(["converse-core", "converse-muc"], factory);
}(this, function (converse) {
    "use strict";

    converse.plugins.add('converse-muc-embedded', {
        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            ChatBoxes: {
                onConnected: function () {
                    // Override to avoid storing or fetching chat boxes from session
                    // storage.
                    var _converse = this.__super__._converse;
                    this.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                        converse.env.b64_sha1('converse.chatboxes-'+_converse.bare_jid));
                    this.registerMessageHandler();
                    /* This is disabled:
                     *
                     * this.fetch({
                     *      add: true,
                     *      success: this.onChatBoxesFetched.bind(this)
                     *  });
                     */
                     this.onChatBoxesFetched(new Backbone.Collection());
                }
            },

            ChatRoomView: {
                insertIntoDOM: function () {
                    converse.env.jQuery('#converse-embedded-chat').html(this.$el);
                    return this;
                }
            }
        }
    });
}));
