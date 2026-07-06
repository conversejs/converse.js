/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import log from '@converse/log';
import _converse from '../../shared/_converse.js';
import { COMMENT_SUMMARY_CONCURRENCY } from './constants.js';

/**
 * A bounded, deduped work queue. Runs at most `concurrency` tasks at once, and
 * each distinct `key` at most once *successfully* (until {@link DedupeQueue#reset}),
 * so the same post's comments aren't re-fetched every time it scrolls back into
 * view. A task that fails isn't marked done, so a later {@link DedupeQueue#add}
 * for that key retries it.
 *
 * Like the `scanFollowable` worker pool, but a long-lived streaming queue rather
 * than a one-shot sweep: the greedy on-visible fetch enqueues continuously as
 * posts enter the viewport.
 */
export class DedupeQueue {
    /**
     * @param {number} [concurrency]
     */
    constructor(concurrency = COMMENT_SUMMARY_CONCURRENCY) {
        this.concurrency = concurrency;
        /** @type {Array<{ key: string, task: () => Promise<void>, resolve: () => void }>} */
        this._queue = [];
        /** @type {Map<string, Promise<void>>} keys queued or in flight */
        this._pending = new Map();
        /** @type {Set<string>} keys that ran successfully this session */
        this._done = new Set();
        this._active = 0;
    }

    /**
     * Enqueue `task` under `key`. Returns a promise that settles once the task
     * has run. A key already queued/in-flight returns that same promise; a key
     * that already ran successfully resolves immediately without re-running (a
     * key whose task failed is re-enqueueable).
     * @param {string} key
     * @param {() => Promise<void>} task
     * @returns {Promise<void>}
     */
    add(key, task) {
        if (!key || this._done.has(key)) return Promise.resolve();
        const existing = this._pending.get(key);
        if (existing) return existing;

        let resolve;
        const promise = new Promise((r) => (resolve = r));
        this._pending.set(key, promise);
        this._queue.push({ key, task, resolve });
        this._drain();
        return promise;
    }

    _drain() {
        while (this._active < this.concurrency && this._queue.length) {
            const { key, task, resolve } = this._queue.shift();
            this._active++;
            Promise.resolve()
                .then(task)
                .then(
                    // Only mark done on success; a failed task (e.g. a transient
                    // fetch error) stays re-enqueueable so a later visibility can
                    // retry rather than caching "never fetched" for the session.
                    () => this._done.add(key),
                    (e) => log.error(e)
                )
                .finally(() => {
                    this._active--;
                    this._pending.delete(key);
                    resolve();
                    this._drain();
                });
        }
    }

    /**
     * Drop all queue state (on session clear) so a fresh login re-fetches.
     */
    reset() {
        this._queue = [];
        this._pending.clear();
        this._done.clear();
        this._active = 0;
    }
}

/**
 * The singleton queue funnelling per-post comment-summary fetches.
 */
export const comment_summary_queue = new DedupeQueue();

/**
 * Recompute a post's denormalised comment/like counts from its comment thread
 * and persist them onto the post (the timeline's display source of truth). The
 * thread stays the source; these attrs are a synced cache that survives reload
 * and thread eviction. A no-op when the thread isn't materialised.
 *
 * Called explicitly at each mutation point (after a summary fetch, after our own
 * comment; later slices add live-event and like calls) rather than via a
 * `feed.messages` listener, which would fire once per item during a bulk fetch.
 * @param {import('./message').default} post
 * @param {import('./comment-feed').default} [feed] - The post's thread, if already resolved.
 */
export function syncCommentSummary(post, feed) {
    feed = feed || _converse.state.commentfeeds?.getFeed(post.getCommentsService(), post.getCommentsNode(), false);
    if (!feed) return;
    const summary = feed.summarize();
    const changed = Object.keys(summary).some((k) => post.get(k) !== summary[k]);
    if (changed) post.save(summary);
}
