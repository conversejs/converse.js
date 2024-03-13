export default DiscoEntities;
declare class DiscoEntities extends Collection {
    constructor();
    model: typeof DiscoEntity;
    fetchEntities(): Promise<any>;
}
import { Collection } from "@converse/skeletor";
import DiscoEntity from "./entity.js";
//# sourceMappingURL=entities.d.ts.map