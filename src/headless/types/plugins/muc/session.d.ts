export default MUCSession;
declare class MUCSession extends Model<import("@converse/skeletor").ModelAttributes> {
    constructor(attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
    defaults(): {
        connection_status: number;
    };
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=session.d.ts.map