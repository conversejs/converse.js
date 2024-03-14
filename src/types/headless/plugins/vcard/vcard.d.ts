export default VCard;
/**
 * Represents a VCard
 * @namespace _converse.VCard
 * @memberOf _converse
 */
declare class VCard extends Model {
    defaults(): {
        image: string;
        image_type: string;
    };
    /**
     * @param {string|Object} key
     * @param {string|Object} [val]
     * @param {Record.<string, any>} [options]
     */
    set(key: string | any, val?: string | any, options?: Record<string, any>, ...args: any[]): any;
    getDisplayName(): any;
}
import { Model } from "@converse/skeletor";
//# sourceMappingURL=vcard.d.ts.map