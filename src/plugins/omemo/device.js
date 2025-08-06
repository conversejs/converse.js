import { _converse, api, converse, log, u, Model } from "@converse/headless";
import { IQError } from "shared/errors.js";
import { UNDECIDED } from "./consts.js";
import { parseBundle } from "./utils.js";

const { Strophe, sizzle, stx } = converse.env;

class Device extends Model {
    defaults() {
        return {
            trusted: UNDECIDED,
            active: true,
        };
    }

    /**
     * @returns {import('./types').PreKey}
     */
    getRandomPreKey() {
        // XXX: assumes that the bundle has already been fetched
        const bundle = this.get("bundle");
        return bundle.prekeys[u.getRandomInt(bundle.prekeys.length)];
    }

    /**
     * Fetch the device's OMEMO bundle from the server.
     * A bundle is a collection of publicly accessible data that can
     * be used to build a session with a device, namely its public IdentityKey,
     * a signed PreKey with corresponding signature, and a list of (single use) PreKeys.
     * @returns {Promise<import('./types').Bundle>}
     */
    async fetchBundleFromServer() {
        const bare_jid = _converse.session.get("bare_jid");
        const stanza = stx`
            <iq type="get" from="${bare_jid}" to="${this.get("jid")}" xmlns="jabber:client">
                <pubsub xmlns="${Strophe.NS.PUBSUB}">
                    <items node="${Strophe.NS.OMEMO_BUNDLES}:${this.get("id")}"/>
                </pubsub>
            </iq>`;

        let iq;
        try {
            iq = await api.sendIQ(stanza);
        } catch (iq) {
            log.error(`Could not fetch bundle for device ${this.get("id")} from ${this.get("jid")}`);
            log.error(iq);
            return null;
        }
        if (iq.querySelector("error")) {
            throw new IQError("Could not fetch bundle", iq);
        }
        const publish_el = sizzle(`items[node="${Strophe.NS.OMEMO_BUNDLES}:${this.get("id")}"]`, iq).pop();
        const bundle_el = sizzle(`bundle[xmlns="${Strophe.NS.OMEMO}"]`, publish_el).pop();
        const bundle = parseBundle(bundle_el);
        this.save("bundle", bundle);
        return bundle;
    }

    /**
     * Fetch and save the bundle information associated with
     * this device, if the information is not cached already.
     * @returns {Promise<import('./types').Bundle>}
     */
    getBundle() {
        if (this.get("bundle")) {
            return Promise.resolve(this.get("bundle"));
        } else {
            return this.fetchBundleFromServer();
        }
    }
}

export default Device;
