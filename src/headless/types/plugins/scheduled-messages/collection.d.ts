export default ScheduledMessages;
/**
 * Persistent scheduled messages, ordered by their delivery time.
 *
 * Delivery is injected so the collection stays useful to any headless client:
 * the web UI can send directly, while the daemon can reapply its policy first.
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