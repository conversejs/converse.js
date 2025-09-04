/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Adds support for XEP-0191 Blocking Command
 */
import _converse from "../../shared/_converse.js";
import api from "../../shared/api/index.js";
import converse from "../../shared/api/public.js";
import log from "@converse/log";
import Blocklist from "./collection.js";
import BlockedEntity from "./model.js";
import blocklist_api from "./api.js";
import { rejectPresenceSubscription } from "../roster/utils.js";

const { Strophe, sizzle } = converse.env;

Strophe.addNamespace("BLOCKING", "urn:xmpp:blocking");

converse.plugins.add("converse-blocklist", {
    /**
     * @typedef {import('../roster/contact').default} RosterContact
     * @typedef {import('../roster/contacts').default} RosterContacts
     */

    dependencies: ["converse-disco"],

    initialize() {
        const exports = { Blocklist, BlockedEntity };
        Object.assign(_converse.exports, exports);
        Object.assign(api, blocklist_api);

        api.promises.add(["blocklistInitialized"]);

        api.listen.on(
            "cachedRoster",
            /** @param {RosterContacts} roster */
            async (roster) => {
                const domain = _converse.session.get("domain");
                const blocking_supported = await api.disco.supports(Strophe.NS.BLOCKING, domain);
                if (blocking_supported) {
                    const blocklist = await api.blocklist.get();
                    const requesting_contacts = roster.filter(
                        /** @param {RosterContact} m */ (m) => m.get("requesting")
                    );
                    requesting_contacts.forEach(
                        /** @param {RosterContact} m */ async (m) => {
                            if (blocklist.get(m.get("jid"))) {
                                rejectPresenceSubscription(m.get("jid"));
                                m.destroy();
                            }
                        }
                    );
                }
            }
        );

        api.listen.on(
            "getErrorAttributesForMessage",
            /**
             * @param {import('shared/types').MessageAttributes} attrs
             * @param {import('shared/types').MessageErrorAttributes} new_attrs
             */
            (attrs, new_attrs) => {
                if (attrs.errors.find((e) => e.name === "blocked" && e.xmlns === `${Strophe.NS.BLOCKING}:errors`)) {
                    const { __ } = _converse;
                    new_attrs.error = __("You are blocked from sending messages.");
                }
                return new_attrs;
            }
        );

        api.listen.on("connected", () => {
            const connection = api.connection.get();
            connection.addHandler(
                /** @param {Element} stanza */ (stanza) => {
                    const bare_jid = _converse.session.get("bare_jid");
                    const from = stanza.getAttribute("from");
                    if (Strophe.getBareJidFromJid(from ?? bare_jid) != bare_jid) {
                        log.warn(`Received a blocklist push stanza from a suspicious JID ${from}`);
                        return true;
                    }

                    const add_jids = sizzle(`block[xmlns="${Strophe.NS.BLOCKING}"] item`, stanza).map(
                        /** @param {Element} item */ (item) => item.getAttribute("jid")
                    );
                    if (add_jids.length) api.blocklist.add(add_jids, false);

                    const remove_jids = sizzle(`unblock[xmlns="${Strophe.NS.BLOCKING}"] item`, stanza).map(
                        /** @param {Element} item */ (item) => item.getAttribute("jid")
                    );
                    if (remove_jids.length) api.blocklist.remove(remove_jids, false);

                    return true;
                },
                Strophe.NS.BLOCKING,
                "iq",
                "set"
            );
        });

        api.listen.on("clearSession", () => {
            const { state } = _converse;
            if (state.blocklist) {
                state.blocklist.clearStore({ "silent": true });
                state.session.set(state.blocklist.fetched_flag, undefined);
                delete state.blocklist;
            }
        });

        api.listen.on("discoInitialized", async () => {
            const domain = _converse.session.get("domain");
            if (await api.disco.supports(Strophe.NS.BLOCKING, domain)) {
                _converse.state.blocklist = new _converse.exports.Blocklist();
            }
        });
    },
});
