export default ScheduledMessage;
/**
 * A message waiting for its local delivery time.
 *
 * The model deliberately stores only plain data. Product-specific policy and
 * presentation belong to callers listening to the `scheduledMessageDue` hook.
 */
declare class ScheduledMessage extends Model<import("@converse/skeletor").ModelAttributes> {
    constructor(attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=model.d.ts.map