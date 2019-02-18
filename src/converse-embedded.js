// Converse.js
// http://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

import "@converse/headless/converse-muc";
import converse from "@converse/headless/converse-core";

const { Backbone, _ } = converse.env;

converse.plugins.add('converse-embedded', {

    enabled (_converse) {
        return _converse.view_mode === 'embedded';
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        this._converse.api.settings.update({
            'allow_logout': false, // No point in logging out when we have auto_login as true.
            'allow_muc_invitations': false, // Doesn't make sense to allow because only
                                            // roster contacts can be invited
            'hide_muc_server': true
        });
        const { _converse } = this;
        if (!_.isArray(_converse.auto_join_rooms) && !_.isArray(_converse.auto_join_private_chats)) {
            throw new Error("converse-embedded: auto_join_rooms must be an Array");
        }
        if (_converse.auto_join_rooms.length > 1 && _converse.auto_join_private_chats.length > 1) {
            throw new Error("converse-embedded: It doesn't make "+
                "sense to have the auto_join_rooms setting more then one, "+
                "since only one chat room can be open at any time.");
        }
    }
});
