import { Collection } from '@converse/skeletor';
import log from '@converse/log';
import { createStore } from '../../utils/storage.js';
import ScheduledMessage from './model.js';

const MAX_TIMEOUT = 2 ** 31 - 1;
const RETRY_DELAY = 30_000;
const MAX_FAILURES = 5;

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
        this.max_failures = options.max_failures ?? MAX_FAILURES;
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
            const delay = dueTime(scheduled) - this.now();
            if (delay > 0) return this.#setTimer(delay);
            await this.#deliver(scheduled);
        }
    }

    /** @param {ScheduledMessage} scheduled */
    async #deliver(scheduled) {
        let outcome;
        try {
            outcome = await this.on_due(scheduled);
        } catch (e) {
            log.error(`Could not send scheduled message ${scheduled.id}: ${e.message}`);
            const failures = (scheduled.get('failures') ?? 0) + 1;
            if (failures >= this.max_failures) {
                await this.#park(scheduled, {
                    rule: 'failed',
                    message: `Sending it failed ${failures} times: ${e.message}`,
                });
            } else {
                await this.#retry(scheduled, this.retry_delay * 2 ** (failures - 1), { failures });
            }
            return;
        }
        if (outcome?.park) {
            await this.#park(scheduled, outcome.park);
        } else if (outcome?.retry) {
            await this.#retry(scheduled, this.retry_delay);
        } else {
            await destroy(scheduled);
        }
    }

    /**
     * @param {ScheduledMessage} scheduled
     * @param {Record<string, unknown>} park
     */
    #park(scheduled, park) {
        return scheduled.save({ parked: { ...park, at: new Date(this.now()).toISOString() } });
    }

    /**
     * @param {ScheduledMessage} scheduled
     * @param {number} delay
     * @param {Record<string, unknown>} [attrs]
     */
    #retry(scheduled, delay, attrs = {}) {
        return scheduled.save({ ...attrs, retry_at: new Date(this.now() + delay).toISOString() });
    }

    /** The message to send next, skipping parked ones. */
    #next() {
        return this.models
            .filter((scheduled) => !scheduled.get('parked'))
            .reduce((next, scheduled) => (!next || dueTime(scheduled) < dueTime(next) ? scheduled : next), null);
    }

    #arm() {
        if (!this.active || this.dispatching) return;
        this.#clearTimer();
        const next = this.#next();
        if (!next) return;
        const delay = Math.max(0, dueTime(next) - this.now());
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

/**
 * When a message is next to be tried: its delivery time, or later if it has
 * been held back since.
 * @param {ScheduledMessage} scheduled
 */
function dueTime(scheduled) {
    return Date.parse(scheduled.get('retry_at') ?? scheduled.get('send_at'));
}

/** Resolve once Skeletor has removed a persisted model. */
function destroy(model) {
    return new Promise((resolve, reject) => model.destroy({ success: () => resolve(), error: (_m, e) => reject(e) }));
}

export default ScheduledMessages;
