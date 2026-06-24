export default PubSubMessages;
/**
 * A collection of {@link PubSubMessage} posts belonging to one feed (or, when
 * nested under a post, that post's comments).
 *
 * `autoSync` is hydrate-only at the collection level: the collection loads its
 * cached members from storage on construction, while each {@link PubSubMessage}
 * persists itself. Storage is supplied via the `id` construction option so it is
 * available before the constructor's hydration step runs.
 *
 * @extends {Collection}
 */
declare class PubSubMessages extends Collection<import("@converse/skeletor").Model<import("@converse/skeletor").ModelAttributes>> {
    constructor(models?: import("@converse/skeletor").ModelAttributes | import("@converse/skeletor").Model<import("@converse/skeletor").ModelAttributes> | import("@converse/skeletor").ModelAttributes[] | import("@converse/skeletor").Model<import("@converse/skeletor").ModelAttributes>[], options?: import("@converse/skeletor").CollectionOptions<import("@converse/skeletor").Model<import("@converse/skeletor").ModelAttributes>>);
    get model(): typeof PubSubMessage;
    /**
     * @param {PubSubMessage[]} [_models]
     * @param {object} [options]
     * @param {string} [options.id] - Cache key for the backing store.
     */
    initialize(_models?: PubSubMessage[], options?: {
        id?: string;
    }): void;
}
import { Collection } from '@converse/skeletor';
import PubSubMessage from './message.js';
//# sourceMappingURL=messages.d.ts.map