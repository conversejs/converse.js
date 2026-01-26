import { Collection } from '@converse/skeletor';
import { getOpenPromise } from '@converse/openpromise';
import api from '../../shared/api/index.js';
import _converse from '../../shared/_converse.js';
import { initStorage } from '../../utils/storage.js';
import BOB from './bob.js';

/**
 * @class BOBs
 * Collection of BOB (Bits of Binary) cache entries with persistent storage
 * @extends {Collection<BOB>}
 */
class BOBs extends Collection {
    constructor() {
        super();
        this.model = BOB;
    }

    async initialize() {
        const { session } = _converse;
        const bare_jid = session.get('bare_jid');
        const cache_key = `${bare_jid}-converse.bobs`;
        initStorage(this, cache_key);

        await this.fetchBOBs();

        this.cleanupExpired();

        /**
         * Triggered as soon as the `_converse.state.bobs` collection has
         * been initialized and populated from cache.
         * @event _converse#BOBsInitialized
         */
        api.trigger('BOBsInitialized');
    }

    fetchBOBs() {
        const deferred = getOpenPromise();
        this.fetch({
            success: () => deferred.resolve(),
            error: () => deferred.resolve(),
        });
        return deferred;
    }

    /**
     * Remove expired BOB entries from the collection
     */
    cleanupExpired() {
        this.forEach((bob) => {
            if (bob.isExpired()) bob.destroy();
        });
    }
}

export default BOBs;
