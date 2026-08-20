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
 * Recompute and persist each comment's own denormalised counts (`reply_count`,
 * `like_count`, `liked_by_me`, `my_like_id`) from the thread, so the drill-down
 * view can show a reply/like tally on every row without re-walking the node.
 * @param {import('./comment-feed').default} [feed]
 */
export function syncCommentCounts(feed?: import("./comment-feed").default): void;
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
 * The loaded entity a comments node hangs off: a post (the common per-post node),
 * or, for a Libervia child node, the comment that advertised it. Distinguished by
 * whether the returned model carries `getRepliesRef` (only a {@link PostComment} does).
 * @param {string} service - The comments service JID.
 * @param {string} node - The comments node.
 * @returns {import('./message').default|import('./post-comment').default|undefined}
 */
export function findParentForThread(service: string, node: string): import("./message").default | import("./post-comment").default | undefined;
/**
 * Write a Libervia owning comment's denormalised counts from its child node,
 * whose top-level items are that comment's direct replies (and post-level ♥ its
 * likes). This is how a comment whose replies live in a *separate* node gets a
 * `reply_count` / `like_count`, which the flat model computes locally instead.
 * @param {import('./post-comment').default} comment
 * @param {import('./comment-feed').default} [child] - The comment's replies node.
 */
export function syncOwningComment(comment: import("./post-comment").default, child?: import("./comment-feed").default): void;
/**
 * Sync a comment thread's counts onto its owning entity after a live event routed
 * into the thread (see `handleMicroblogEvent`), or after a child node is fetched.
 * Syncs the thread's own per-comment counts, then the owning post's summary, or —
 * for a Libervia child node — the owning comment's count. A no-op when the owner
 * isn't loaded.
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