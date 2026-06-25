import { Collection } from '@converse/skeletor';
import { getOpenPromise } from '@converse/openpromise';
import log from '@converse/log';
import api from '../../shared/api/index.js';
import { initStorage } from '../../utils/storage.js';
import CapsInfo from './model.js';
import { getCapsCacheStorageKey } from './utils.js';

/**
 * A persistent cache of verified XEP-0115 entity capabilities, keyed by the
 * verification hash (`${hash}/${ver}`).
 *
 * Because a verification hash is a cryptographic content address of an entity's
 * disco#info, a single cached entry is shared by every JID (and resource) that
 * advertises the same capabilities.
 *
 * @extends {Collection<CapsInfo>}
 */
class CapsInfoCache extends Collection {
    constructor() {
        // Pass the model via options so it's set before the (async) initialize()
        // that skeletor invokes from the constructor runs and fetches from storage.
        super([], { model: CapsInfo });
    }

    async initialize() {
        initStorage(this, getCapsCacheStorageKey());
        await this.fetchCache();

        /**
         * Triggered once the {@link CapsInfoCache} has been created and any
         * cached capabilities have been fetched from storage.
         * @event _converse#capsInitialized
         * @example _converse.api.listen.on('capsInitialized', () => { ... });
         */
        api.trigger('capsInitialized');
    }

    fetchCache() {
        const deferred = getOpenPromise();
        this.fetch({
            success: () => deferred.resolve(),
            error: (_, e) => {
                log.error(e);
                deferred.resolve();
            },
        });
        return deferred;
    }

    /**
     * Returns the cached disco#info for a given verification hash, or
     * `undefined` if it hasn't been verified and cached yet. On a hit, the
     * entry's `last_used` timestamp is refreshed so that LRU eviction keeps
     * frequently-consulted capabilities.
     * @param {string} hash - The hashing algorithm (e.g. "sha-1")
     * @param {string} ver - The verification string
     * @returns {CapsInfo|undefined}
     */
    getCachedInfo(hash, ver) {
        const model = this.get(`${hash}/${ver}`);
        model?.save({ last_used: Date.now() });
        return model;
    }

    /**
     * Stores a verified disco#info result against its verification hash.
     *
     * The caller is responsible for having verified that the data hashes to
     * `ver` (see XEP-0115 Section 5.4) before calling this method.
     * @param {import('./types').CapsAttributes} caps - The advertised caps ({ hash, node, ver })
     * @param {import('./types').CapsInfoData} info - The verified disco#info data
     * @returns {CapsInfo}
     */
    store({ hash, node, ver }, { identities, features, dataforms }) {
        const id = `${hash}/${ver}`;
        const attrs = { id, hash, node, ver, identities, features, dataforms, last_used: Date.now() };
        const existing = this.get(id);
        if (existing) {
            existing.save(attrs);
            return existing;
        }
        const model = /** @type {CapsInfo} */ (this.create(attrs));
        this.evictLeastRecentlyUsed();
        return model;
    }

    /**
     * Evicts the least-recently-used entries until the cache is back within the
     * `caps_cache_size` limit. Verified caps are content-addressed and cheap to
     * re-fetch, so dropping the coldest entries is safe.
     */
    evictLeastRecentlyUsed() {
        const max = api.settings.get('caps_cache_size');
        if (!(max > 0) || this.length <= max) return;

        const by_last_used = [...this.models].sort((a, b) => (a.get('last_used') ?? 0) - (b.get('last_used') ?? 0));
        let overflow = this.length - max;
        while (overflow-- > 0) by_last_used.shift()?.destroy();
    }
}

export default CapsInfoCache;
