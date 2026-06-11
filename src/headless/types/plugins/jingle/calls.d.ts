export default Calls;
/**
 * A memory-only, ephemeral collection of live {@link Call}s — one per session.
 * @extends {Collection<Call>}
 */
declare class Calls extends Collection<Call> {
    constructor(models?: import("@converse/skeletor").ModelAttributes | import("@converse/skeletor").ModelAttributes[] | Call | Call[], options?: import("@converse/skeletor").CollectionOptions<Call>);
    get model(): typeof Call;
}
import Call from './model.js';
import { Collection } from '@converse/skeletor';
//# sourceMappingURL=calls.d.ts.map