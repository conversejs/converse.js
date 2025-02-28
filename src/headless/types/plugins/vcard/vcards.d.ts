export default VCards;
declare class VCards extends Collection {
    constructor();
    model: typeof VCard;
    initialize(): Promise<void>;
    fetchVCards(): any;
}
import { Collection } from "@converse/skeletor";
import VCard from "./vcard";
//# sourceMappingURL=vcards.d.ts.map