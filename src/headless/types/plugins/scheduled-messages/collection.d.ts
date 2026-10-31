export default ScheduledMessages;
/**
 * Persistent scheduled messages, ordered by their delivery time.
 *
 * Delivery is injected so the collection stays useful to any headless client:
 * the web UI can send directly, while the daemon can reapply its policy first.
 *
 * The delivery handler, `on_due`, resolves to what became of the message:
 *
 * - nothing: it was sent, and is removed.
 * - `{ park }`: it won't be sent without the user, such as when policy refused
 *   it. It's kept, with `park` saved as its `parked` attribute, and isn't
 *   tried again until it's cancelled.
 * - `{ retry: true }`: it can't be sent yet, such as when a rate limit holds
 *   it back. It's tried again after `retry_delay`.
 *
 * A handler that throws failed to send it. It's tried again, waiting twice as
 * long each time, and parked after `max_failures` tries. A message that is
 * waiting to be tried again doesn't hold back the ones due after it.
 * @extends {Collection<ScheduledMessage>}
 */
declare class ScheduledMessages extends Collection<ScheduledMessage> {
    constructor(models?: import("@converse/skeletor").ModelAttributes | import("@converse/skeletor").ModelAttributes[] | ScheduledMessage | ScheduledMessage[], options?: import("@converse/skeletor").CollectionOptions<ScheduledMessage>);
    get model(): typeof ScheduledMessage;
    initialize(_models: any, options?: {}): void;
    on_due: any;
    now: any;
    set_timer: any;
    clear_timer: any;
    retry_delay: any;
    max_failures: any;
    active: boolean;
    dispatching: Promise<void>;
    timer: any;
    /** Persist and arm a new scheduled message. */
    schedule(attrs: any): Promise<ScheduledMessage>;
    /** Remove a scheduled message, returning the removed model when it existed. */
    cancel(id: any): Promise<ScheduledMessage>;
    /** Start dispatching, including anything that became due while stopped. */
    resume(): Promise<void>;
    /** Stop timers without removing anything from persistent storage. */
    pause(): void;
    #private;
}
import ScheduledMessage from './model.js';
import { Collection } from '@converse/skeletor';
//# sourceMappingURL=collection.d.ts.map