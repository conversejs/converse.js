export default Blocklist;
declare class Blocklist extends Collection {
    constructor();
    get idAttribute(): string;
    model: typeof BlockedEntity;
    initialize(): Promise<void>;
    fetched_flag: string;
    fetchBlocklist(): any;
    /**
     * @param {Object} deferred
     */
    fetchBlocklistFromServer(deferred: any): Promise<void>;
    /**
     * @param {Object} deferred
     * @param {Element} iq
     */
    onBlocklistReceived(deferred: any, iq: Element): Promise<any>;
}
import { Collection } from '@converse/skeletor';
import BlockedEntity from './model.js';
//# sourceMappingURL=collection.d.ts.map