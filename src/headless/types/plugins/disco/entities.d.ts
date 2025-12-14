export default DiscoEntities;
/**
 * @extends {Collection<DiscoEntity>}
 */
declare class DiscoEntities extends Collection<DiscoEntity> {
    constructor();
    model: typeof DiscoEntity;
    fetchEntities(): Promise<any>;
}
import DiscoEntity from './entity.js';
import { Collection } from "@converse/skeletor";
//# sourceMappingURL=entities.d.ts.map