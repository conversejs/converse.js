import { Model } from '@converse/skeletor';

/**
 * A message waiting for its local delivery time.
 *
 * The model deliberately stores only plain data. Product-specific policy and
 * presentation belong to callers listening to the `scheduledMessageDue` hook.
 */
class ScheduledMessage extends Model {}

export default ScheduledMessage;
