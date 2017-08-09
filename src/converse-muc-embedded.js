// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
(function (root, factory) {
    define(["converse-core", "converse-muc"], factory);
}(this, function (converse) {
    "use strict";
    const { Backbone, _ } = converse.env;

    converse.plugins.add('converse-muc-embedded', {
        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            ChatBoxes: {
                onConnected () {
                    // Override to avoid storing or fetching chat boxes from session
                    // storage.
                    const { _converse } = this.__super__;
                    this.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                        converse.env.b64_sha1(`converse.chatboxes-${_converse.bare_jid}`));
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
                insertIntoDOM () {
                    if (!document.body.contains(this.el)) {
                        const container = document.querySelector('#converse-embedded-chat');
                        container.innerHTML = '';
                        container.appendChild(this.el);
                    }
                    return this;
                }
            }
        },

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this;
            if (!_.isArray(_converse.auto_join_rooms)) {
                throw new Error("converse-muc-embedded: auto_join_rooms must be an Array");
            }
            if (_converse.auto_join_rooms.length !== 1) {
                throw new Error("converse-muc-embedded: It doesn't make "+
                    "sense to have the auto_join_rooms setting to zero or "+
                    "more then one, since only one chat room can be open "+
                    "at any time.");
            }
        }
    });
}));
