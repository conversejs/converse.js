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
    set(key: any, val: any, options: any, ...args: any[]): any;
    getDisplayName(): any;
}
import { Model } from "@converse/skeletor";
//# sourceMappingURL=vcard.d.ts.map