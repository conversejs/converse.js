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

        enabled (_converse) {
            return _converse.view_mode === 'embedded';
        },

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            ChatBoxViews: {
                initialize () {
                    this.__super__.initialize.apply(this, arguments);
                    this.el.classList.add('converse-embedded');
                }
            }
        },

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            this._converse.api.settings.update({
                'allow_logout': false, // No point in logging out when we have auto_login as true.
                'allow_muc_invitations': false, // Doesn't make sense to allow because only
                                                // roster contacts can be invited
                'hide_muc_server': true, // Federation is disabled, so no use in
                                         // showing the MUC server.
            });
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
