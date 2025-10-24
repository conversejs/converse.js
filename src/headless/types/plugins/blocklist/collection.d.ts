export default Blocklist;
/**
 * @extends {Collection<BlockedEntity>}
 */
declare class Blocklist extends Collection<BlockedEntity> {
    constructor();
    get idAttribute(): string;
    model: typeof BlockedEntity;
    initialize(): Promise<void>;
    fetched_flag: string;
    /**
     * @param {BlockedEntity} item
     */
    rejectContactRequest(item: BlockedEntity): Promise<void>;
    fetchBlocklist(): Promise<any> & {
        isResolved: boolean;
        isPending: boolean;
        isRejected: boolean;
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
    };
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
import BlockedEntity from './model.js';
import { Collection } from '@converse/skeletor';
//# sourceMappingURL=collection.d.ts.map