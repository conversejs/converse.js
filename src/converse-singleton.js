// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)
/**
 * @module converse-singleton
 * @description
 * A plugin which restricts Converse to only one chat.
 */
import converse from "@converse/headless/converse-core";


converse.plugins.add('converse-singleton', {

    enabled (_converse) {
        return _converse.singleton;
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        this._converse.api.settings.update({
            'allow_logout': false,          // No point in logging out when we have auto_login as true.
            'allow_muc_invitations': false, // Doesn't make sense to allow because only
                                            // roster contacts can be invited
            'hide_muc_server': true
        });
        const { _converse } = this;
        if (!Array.isArray(_converse.auto_join_rooms) && !Array.isArray(_converse.auto_join_private_chats)) {
            throw new Error("converse-singleton: auto_join_rooms must be an Array");
        }
        if (_converse.auto_join_rooms.length > 1 || _converse.auto_join_private_chats.length > 1) {
            throw new Error("It doesn't make sense to have singleton set to true and " +
                "auto_join_rooms or auto_join_private_chats set to more then one, " +
                "since only one chat room may be open at any time.");
        }
    }
});
