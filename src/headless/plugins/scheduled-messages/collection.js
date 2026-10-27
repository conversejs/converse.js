import { Collection } from '@converse/skeletor';
import log from '@converse/log';
import { createStore } from '../../utils/storage.js';
import ScheduledMessage from './model.js';

const MAX_TIMEOUT = 2 ** 31 - 1;
const RETRY_DELAY = 30_000;

/**
 * Persistent scheduled messages, ordered by their delivery time.
 *
 * Delivery is injected so the collection stays useful to any headless client:
 * the web UI can send directly, while the daemon can reapply its policy first.
 *
 * A delivery handler may park a message instead of finishing it, by saving a
 * `parked` attribute on it. A parked message is never retried and stays stored
 * until it is cancelled.
 * @extends {Collection<ScheduledMessage>}
 */
class ScheduledMessages extends Collection {
    get model() {
        return ScheduledMessage;
    }

    get autoSync() {
        return true;
    }

    initialize(_models, options = {}) {
        this.comparator = 'send_at';
        this.on_due = options.on_due;
        this.now = options.now ?? (() => Date.now());
        this.set_timer = options.set_timer ?? setTimeout;
        this.clear_timer = options.clear_timer ?? clearTimeout;
        this.retry_delay = options.retry_delay ?? RETRY_DELAY;
        this.active = false;
        this.dispatching = null;
        this.timer = null;
        this.storage = options.storage ?? createStore(options.id);
    }

    /** Persist and arm a new scheduled message. */
    async schedule(attrs) {
        const scheduled = await this.create(attrs, { promise: true });
        this.#arm();
        return scheduled;
    }

    /** Remove a scheduled message, returning the removed model when it existed. */
    async cancel(id) {
        const scheduled = this.get(id);
        if (!scheduled) return undefined;
        await destroy(scheduled);
        this.#arm();
        return scheduled;
    }

    /** Start dispatching, including anything that became due while stopped. */
    resume() {
        this.active = true;
        return this.#dispatchDue();
    }

    /** Stop timers without removing anything from persistent storage. */
    pause() {
        this.active = false;
        this.#clearTimer();
    }

    async #dispatchDue() {
        if (!this.active) return;
        if (this.dispatching) return this.dispatching;
        this.dispatching = this.#drain();
        try {
            await this.dispatching;
        } finally {
            this.dispatching = null;
        }
    }

    async #drain() {
        this.#clearTimer();
        while (this.active) {
            const scheduled = this.#next();
            if (!scheduled) return;
            const delay = Date.parse(scheduled.get('send_at')) - this.now();
            if (delay > 0) return this.#setTimer(delay);
            if (!(await this.#deliver(scheduled))) return;
        }
    }

    async #deliver(scheduled) {
        try {
            await this.on_due(scheduled);
            if (!scheduled.get('parked')) await destroy(scheduled);
            return true;
        } catch (e) {
            log.error(`Could not send scheduled message ${scheduled.id}: ${e.message}`);
            if (this.active) this.#setTimer(this.retry_delay);
            return false;
        }
    }

    /** The earliest message that is still due to be sent, skipping parked ones. */
    #next() {
        return this.models.find((scheduled) => !scheduled.get('parked'));
    }

    #arm() {
        if (!this.active || this.dispatching) return;
        this.#clearTimer();
        const next = this.#next();
        if (!next) return;
        const delay = Math.max(0, Date.parse(next.get('send_at')) - this.now());
        this.#setTimer(delay);
    }

    #setTimer(delay) {
        this.timer = this.set_timer(
            () => {
                this.timer = null;
                this.#dispatchDue();
            },
            Math.min(delay, MAX_TIMEOUT),
        );
    }

    #clearTimer() {
        if (this.timer === null) return;
        this.clear_timer(this.timer);
        this.timer = null;
    }
}

/** Resolve once Skeletor has removed a persisted model. */
function destroy(model) {
    return new Promise((resolve, reject) => model.destroy({ success: () => resolve(), error: (_m, e) => reject(e) }));
}

export default ScheduledMessages;
