export default BOB;
/**
 * @class BOB
 * Represents a single Bits of Binary (XEP-0231) cache entry
 */
declare class BOB extends Model<import("@converse/skeletor").ModelAttributes> {
    constructor(attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
    /**
     * Check if this BOB entry has expired based on max_age
     * @returns {boolean}
     */
    isExpired(): boolean;
    /**
     * Get the BOB data as a Blob URL
     * @returns {string|null}
     */
    getBlobURL(): string | null;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=bob.d.ts.map