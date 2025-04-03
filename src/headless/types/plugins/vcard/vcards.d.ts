export default VCards;
declare class VCards extends Collection {
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
import { Collection } from "@converse/skeletor";
import VCard from "./vcard";
//# sourceMappingURL=vcards.d.ts.map