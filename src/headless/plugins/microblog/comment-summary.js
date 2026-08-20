/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import log from '@converse/log';
import _converse from '../../shared/_converse.js';
import { safeSave } from '../../utils/init.js';
import { COMMENT_SUMMARY_CONCURRENCY, COMMENTS_NODE_PREFIX } from './constants.js';
import { computeThreadCounts } from './utils/thread.js';

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
                    (e) => log.error(e),
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
    // Detached browse-feed posts (a non-followed author's) are in-memory with no
    // store, so persist only when the post is store-backed; else set reactively.
    if (changed) safeSave(post, summary);
}

/**
 * Recompute and persist each comment's own denormalised counts (`reply_count`,
 * `like_count`, `liked_by_me`, `my_like_id`) from the thread, so the drill-down
 * view can show a reply/like tally on every row without re-walking the node.
 * @param {import('./comment-feed').default} [feed]
 */
export function syncCommentCounts(feed) {
    if (!feed) return;

    const { byComment } = computeThreadCounts(feed.comments);
    for (const comment of feed.getComments()) {
        const counts = byComment.get(comment.get('id'));
        if (!counts) continue;

        const changed = Object.keys(counts).some((k) => comment.get(k) !== counts[k]);
        if (changed) safeSave(comment, counts);
    }
}

/**
 * Find the loaded post a comments node belongs to, by scanning the timeline
 * feeds for a post whose comments node + service match. Returns undefined when
 * the post isn't loaded (its counts then simply aren't synced live).
 * @param {string} service - The comments service JID.
 * @param {string} node - The comments node.
 * @returns {import('./message').default|undefined}
 */
export function findPostForThread(service, node) {
    const feeds = _converse.state.pubsubfeeds;
    if (!feeds || !node?.startsWith(COMMENTS_NODE_PREFIX)) return undefined;
    const post_id = node.slice(COMMENTS_NODE_PREFIX.length);
    for (const feed of feeds.models) {
        const post = feed.messages?.get(post_id);
        // Item ids are only unique within a node, so confirm the post actually
        // points at this comments node/service before syncing it.
        if (post && post.getCommentsNode() === node && post.getCommentsService() === service) {
            return post;
        }
    }
    return undefined;
}

/**
 * The loaded comment that owns a **Libervia child node** (a comment which
 * advertised its own replies node, see {@link PostComment.getRepliesRef}), by
 * scanning the materialised comment threads. Returns undefined when no such
 * comment is loaded. Bounded by `social_max_comment_threads`; only run on live
 * events / a child-node fetch.
 * @param {string} service - The child comments node's service JID.
 * @param {string} node - The child comments node.
 * @returns {import('./post-comment').default|undefined}
 */
function findOwningComment(service, node) {
    const feeds = _converse.state.commentfeeds;
    if (!feeds) return undefined;
    for (const feed of feeds.models) {
        for (const m of feed.messages?.models ?? []) {
            const ref = typeof (/** @type {any} */ (m).getRepliesRef) === 'function' ? m.getRepliesRef() : null;
            if (ref && ref.node === node && ref.jid === service) return m;
        }
    }
    return undefined;
}

/**
 * The loaded entity a comments node hangs off: a post (the common per-post node),
 * or, for a Libervia child node, the comment that advertised it. Distinguished by
 * whether the returned model carries `getRepliesRef` (only a {@link PostComment} does).
 * @param {string} service - The comments service JID.
 * @param {string} node - The comments node.
 * @returns {import('./message').default|import('./post-comment').default|undefined}
 */
export function findParentForThread(service, node) {
    return findPostForThread(service, node) || findOwningComment(service, node);
}

/**
 * Write a Libervia owning comment's denormalised counts from its child node,
 * whose top-level items are that comment's direct replies (and post-level ♥ its
 * likes). This is how a comment whose replies live in a *separate* node gets a
 * `reply_count` / `like_count`, which the flat model computes locally instead.
 * @param {import('./post-comment').default} comment
 * @param {import('./comment-feed').default} [child] - The comment's replies node.
 */
export function syncOwningComment(comment, child) {
    if (!comment || !child) return;
    const { post } = computeThreadCounts(child.comments);
    const attrs = {
        reply_count: post.comment_count,
        like_count: post.like_count,
        liked_by_me: post.liked_by_me,
        my_like_id: post.my_like_id,
    };
    const changed = Object.keys(attrs).some((k) => comment.get(k) !== attrs[k]);
    if (changed) safeSave(comment, attrs);
}

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
export function syncCommentThread(service, node, feed) {
    feed = feed || _converse.state.commentfeeds?.getFeed(service, node, false);
    // Per-comment counts drive the thread view and don't depend on the owner
    // being loaded, so sync them whenever the thread is materialised.
    if (feed) syncCommentCounts(feed);

    const parent = findParentForThread(service, node);
    if (!parent) return;
    if (typeof (/** @type {any} */ (parent).getRepliesRef) === 'function') {
        syncOwningComment(/** @type {import('./post-comment').default} */ (parent), feed);
    } else {
        syncCommentSummary(/** @type {import('./message').default} */ (parent), feed);
    }
}
