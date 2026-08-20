import { Model } from '@converse/skeletor';

/**
 * Represents a cached, verified XEP-0115 entity capabilities result: the
 * disco#info (identities, features and XEP-0128 data forms) that corresponds to
 * a particular verification hash.
 *
 * The model is content-addressed: its `id` is `${hash}/${ver}`, so a single
 * entry is shared by every JID that advertises the same caps.
 */
class CapsInfo extends Model {
    defaults() {
        return {
            identities: [],
            features: [],
            dataforms: [],
        };
    }
}

export default CapsInfo;
