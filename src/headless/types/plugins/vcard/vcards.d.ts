export default VCards;
/**
 * @extends {Collection<VCard>}
 */
declare class VCards extends Collection<VCard> {
    constructor();
    model: typeof VCard;
    initialize(): Promise<void>;
    fetchVCards(): Promise<any> & {
        isResolved: boolean;
        isPending: boolean;
        isRejected: boolean;
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
    };
    /**
     * Removes VCards from the cache that don't belong to any active entity:
     * roster contacts, MUC occupants, or open chats.
     * @returns {Promise<number>} Number of VCards removed
     */
    pruneVCards(): Promise<number>;
}
import VCard from './vcard';
import { Collection } from '@converse/skeletor';
//# sourceMappingURL=vcards.d.ts.map
