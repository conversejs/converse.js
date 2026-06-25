export default CapsInfoCache;
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
declare class CapsInfoCache extends Collection<CapsInfo> {
    constructor();
    initialize(): Promise<void>;
    fetchCache(): Promise<any> & {
        isResolved: boolean;
        isPending: boolean;
        isRejected: boolean;
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
    };
    /**
     * Returns the cached disco#info for a given verification hash, or
     * `undefined` if it hasn't been verified and cached yet.
     * @param {string} hash - The hashing algorithm (e.g. "sha-1")
     * @param {string} ver - The verification string
     * @returns {CapsInfo|undefined}
     */
    getCachedInfo(hash: string, ver: string): CapsInfo | undefined;
    /**
     * Stores a verified disco#info result against its verification hash.
     *
     * The caller is responsible for having verified that the data hashes to
     * `ver` (see XEP-0115 Section 5.4) before calling this method.
     * @param {import('./types').CapsAttributes} caps - The advertised caps ({ hash, node, ver })
     * @param {import('./types').CapsInfoData} info - The verified disco#info data
     * @returns {CapsInfo}
     */
    store({ hash, node, ver }: import("./types").CapsAttributes, { identities, features, dataforms }: import("./types").CapsInfoData): CapsInfo;
}
import CapsInfo from './model.js';
import { Collection } from '@converse/skeletor';
//# sourceMappingURL=collection.d.ts.map