/**
 * @description XEP-0313 Message Archive Management
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { Strophe } from "strophe.js";
import _converse from "../../shared/_converse.js";
import api from "../../shared/api/index.js";
import converse from "../../shared/api/public.js";
import { CHATROOMS_TYPE, PRIVATE_CHAT_TYPE } from "../..//shared/constants.js";
import "../disco/index.js";
import mam_api from "./api.js";
import MAMPlaceholderMessage from "./placeholder.js";
import {
    createScrollupPlaceholder,
    fetchNewestMessages,
    getMAMPrefsFromFeature,
    handleMAMResult,
    onMAMError,
    onMAMPreferences,
    preMUCJoinMAMFetch,
} from "./utils.js";

const { NS } = Strophe;

converse.plugins.add("converse-mam", {
    dependencies: ["converse-disco", "converse-muc"],

    initialize() {
        api.settings.extend({
            archived_messages_page_size: "50",
            mam_request_all_pages: false,
            message_archiving: undefined, // Supported values are 'always', 'never', 'roster'
            // https://xmpp.org/extensions/xep-0313.html#prefs
            message_archiving_timeout: 60000, // Time (in milliseconds) to wait before aborting MAM request
        });

        Object.assign(api, mam_api);
        // This is mainly done to aid with tests
        const exports = { onMAMError, onMAMPreferences, handleMAMResult, MAMPlaceholderMessage };
        Object.assign(_converse, exports); // XXX DEPRECATED
        Object.assign(_converse.exports, exports);

        /************************ Event Handlers ************************/
        api.listen.on("addClientFeatures", () => api.disco.own.features.add(NS.MAM));
        api.listen.on("serviceDiscovered", getMAMPrefsFromFeature);
        api.listen.on("chatRoomViewInitialized", ({ model }) => {
            if (api.settings.get("muc_show_logs_before_join")) {
                preMUCJoinMAMFetch(model);
                // If we want to show MAM logs before entering the MUC, we need
                // to be informed once it's clear that this MUC supports MAM.
                model.features.on("change:mam_enabled", () => preMUCJoinMAMFetch(model));
            }
        });
        api.listen.on(
            "enteredNewRoom",
            /** @param {import('../muc/muc').default} muc */ (muc) =>
                muc.features.get("mam_enabled") && fetchNewestMessages(muc)
        );

        api.listen.on("chatReconnected", (chat) => {
            if (![CHATROOMS_TYPE, PRIVATE_CHAT_TYPE].includes(chat.get("type"))) {
                return;
            }
            fetchNewestMessages(chat);
        });

        api.listen.on("afterMessagesFetched", (chat) => {
            if (chat.get("type") === PRIVATE_CHAT_TYPE) {
                fetchNewestMessages(chat);
            }
            createScrollupPlaceholder(chat);
        });
    },
});
