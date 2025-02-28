/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "../status/index.js";
import VCard from "./vcard.js";
import _converse from "../../shared/_converse.js";
import api from "../../shared/api/index.js";
import converse from "../../shared/api/public.js";
import vcard_api from "./api.js";
import VCards from "./vcards";
import { clearVCardsSession, onOccupantAvatarChanged } from "./utils.js";

const { Strophe } = converse.env;

converse.plugins.add("converse-vcard", {
    dependencies: ["converse-status", "converse-roster"],

    enabled() {
        return !api.settings.get("blacklisted_plugins")?.includes("converse-vcard");
    },

    initialize() {
        api.settings.extend({
            lazy_load_vcards: true,
        });

        api.promises.add("VCardsInitialized");

        Object.assign(_converse.api, vcard_api);

        const exports = { VCard, VCards };
        Object.assign(_converse, exports); // XXX DEPRECATED
        Object.assign(_converse.exports, exports);

        api.listen.on(
            "chatRoomInitialized",
            /** @param {import('../muc/muc').default} m */ (m) => {
                m.listenTo(m.occupants, "change:image_hash", (o) => onOccupantAvatarChanged(o));
            }
        );

        api.listen.on("addClientFeatures", () => api.disco.own.features.add(Strophe.NS.VCARD));
        api.listen.on("clearSession", () => clearVCardsSession());

        api.listen.on("visibilityChanged", ({ el }) => {
            const { model } = el;
            if (model?.vcard) model.vcard.trigger("visibilityChanged");
        });

        api.listen.on("connected", () => {
            const vcards = new _converse.exports.VCards();
            _converse.state.vcards = vcards;
            Object.assign(_converse, { vcards }); // XXX DEPRECATED
        });
    },
});
