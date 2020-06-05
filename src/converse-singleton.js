/**
 * @module converse-singleton
 * @copyright JC Brand
 * @license Mozilla Public License (MPLv2)
 * @description A plugin which restricts Converse to only one chat.
 */
import { api, converse } from "@converse/headless/converse-core";


converse.plugins.add('converse-singleton', {

    enabled (_converse) {
        return _converse.api.settings.get("singleton");
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        api.settings.extend({
            'allow_logout': false,          // No point in logging out when we have auto_login as true.
            'allow_muc_invitations': false, // Doesn't make sense to allow because only
                                            // roster contacts can be invited
            'hide_muc_server': true
        });
        if (!Array.isArray(api.settings.get('auto_join_rooms')) &&
                !Array.isArray(api.settings.get('auto_join_private_chats'))) {
            throw new Error("converse-singleton: auto_join_rooms must be an Array");
        }
        if (api.settings.get('auto_join_rooms').length > 1 || api.settings.get('auto_join_private_chats').length > 1) {
            throw new Error("It doesn't make sense to have singleton set to true and " +
                "auto_join_rooms or auto_join_private_chats set to more then one, " +
                "since only one chat room may be open at any time.");
        }
    }
});
