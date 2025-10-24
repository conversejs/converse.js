import { Collection } from "@converse/skeletor";
import { getOpenPromise } from "@converse/openpromise";
import api from "../../shared/api/index.js";
import _converse from "../../shared/_converse.js";
import { initStorage } from "../../utils/storage.js";
import VCard from "./vcard";

/**
 * @extends {Collection<VCard>}
 */
class VCards extends Collection {
    constructor() {
        super();
        this.model = VCard;
    }

    async initialize() {
        const { session } = _converse;
        const bare_jid = session.get("bare_jid");
        const cache_key = `${bare_jid}-converse.vcards`;
        initStorage(this, cache_key);

        await this.fetchVCards();

        /**
         * Triggered as soon as the `_converse.state.vcards` collection has
         * been initialized and populated from cache.
         * @event _converse#VCardsInitialized
         */
        api.trigger("VCardsInitialized");
    }

    fetchVCards() {
        const deferred = getOpenPromise();
        this.fetch(
            {
                success: () => deferred.resolve(),
                error: () => deferred.resolve(),
            },
        );
        return deferred;
    }
}

export default VCards;
