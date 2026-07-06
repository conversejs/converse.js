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
export function syncCommentSummary(post: import("./message").default, feed?: import("./comment-feed").default): void;
/**
 * Find the loaded post a comments node belongs to, by scanning the timeline
 * feeds for a post whose comments node + service match. Returns undefined when
 * the post isn't loaded (its counts then simply aren't synced live).
 * @param {string} service - The comments service JID.
 * @param {string} node - The comments node.
 * @returns {import('./message').default|undefined}
 */
export function findPostForThread(service: string, node: string): import("./message").default | undefined;
/**
 * Sync a comment thread's counts onto its post after a live event routed into
 * the thread (see `handleMicroblogEvent`). A no-op when the owning post isn't
 * loaded in any timeline feed.
 * @param {string} service - The comments service JID.
 * @param {string} node - The comments node.
 * @param {import('./comment-feed').default} [feed] - The thread, if already resolved.
 */
export function syncCommentThread(service: string, node: string, feed?: import("./comment-feed").default): void;
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
    constructor(concurrency?: number);
    concurrency: number;
    /** @type {Array<{ key: string, task: () => Promise<void>, resolve: () => void }>} */
    _queue: Array<{
        key: string;
        task: () => Promise<void>;
        resolve: () => void;
    }>;
    /** @type {Map<string, Promise<void>>} keys queued or in flight */
    _pending: Map<string, Promise<void>>;
    /** @type {Set<string>} keys that ran successfully this session */
    _done: Set<string>;
    _active: number;
    /**
     * Enqueue `task` under `key`. Returns a promise that settles once the task
     * has run. A key already queued/in-flight returns that same promise; a key
     * that already ran successfully resolves immediately without re-running (a
     * key whose task failed is re-enqueueable).
     * @param {string} key
     * @param {() => Promise<void>} task
     * @returns {Promise<void>}
     */
    add(key: string, task: () => Promise<void>): Promise<void>;
    _drain(): void;
    /**
     * Drop all queue state (on session clear) so a fresh login re-fetches.
     */
    reset(): void;
}
/**
 * The singleton queue funnelling per-post comment-summary fetches.
 */
export const comment_summary_queue: DedupeQueue;
//# sourceMappingURL=comment-summary.d.ts.map