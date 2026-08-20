export default CapsInfo;
/**
 * Represents a cached, verified XEP-0115 entity capabilities result: the
 * disco#info (identities, features and XEP-0128 data forms) that corresponds to
 * a particular verification hash.
 *
 * The model is content-addressed: its `id` is `${hash}/${ver}`, so a single
 * entry is shared by every JID that advertises the same caps.
 */
declare class CapsInfo extends Model<import("@converse/skeletor").ModelAttributes> {
    constructor(attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
    defaults(): {
        identities: any[];
        features: any[];
        dataforms: any[];
    };
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=model.d.ts.map