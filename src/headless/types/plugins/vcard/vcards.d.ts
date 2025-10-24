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
}
import VCard from "./vcard";
import { Collection } from "@converse/skeletor";
//# sourceMappingURL=vcards.d.ts.map