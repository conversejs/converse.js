export default BOBs;
/**
 * @class BOBs
 * Collection of BOB (Bits of Binary) cache entries with persistent storage
 * @extends {Collection<BOB>}
 */
declare class BOBs extends Collection<BOB> {
    constructor();
    model: typeof BOB;
    initialize(): Promise<void>;
    fetchBOBs(): Promise<any> & {
        isResolved: boolean;
        isPending: boolean;
        isRejected: boolean;
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
    };
    /**
     * Remove expired BOB entries from the collection
     */
    cleanupExpired(): void;
}
import BOB from './bob.js';
import { Collection } from '@converse/skeletor';
//# sourceMappingURL=bobs.d.ts.map