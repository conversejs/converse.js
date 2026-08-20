import log from '@converse/log';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { getUniqueId } from '../../utils/index.js';
import { COMMENTS_PUBLISH_OPTIONS, NS_THREAD, ORPHAN_RESOLVE_ROUNDS } from './constants.js';
import PubSubFeed from './feed.js';
import PostComments from './post-comments.js';
import { buildTagId } from './utils.js';
import { computeThreadCounts } from './utils/thread.js';

const { stx, Strophe } = converse.env;

/**
 * A single post's comments thread (XEP-0277 § Comments): a {@link PubSubFeed}
 * over that post's comments node. Kept in a collection separate from the
 * timeline feeds ({@link CommentFeeds}) so comments never surface in the
 * aggregated feed.
 *
 * @extends {PubSubFeed}
 */
class CommentFeed extends PubSubFeed {
    /**
     * A thread's items are {@link PostComment}s (they carry `isLike`), not the
     * plain {@link PubSubMessage}s a timeline feed holds.
     * @returns {typeof import('./messages').default}
     */
    get messagesCollectionClass() {
        return PostComments;
    }

    /**
     * Fetch this thread and make it complete enough to render as a tree. Drives
     * the inherited {@link PubSubFeed.fetchPosts} paging (RSM where the comments
     * service supports it, else the newest-`POSTS_MAX_WITHOUT_RSM` window with
     * `history_complete`), then {@link resolveOrphans} to reconnect a reply whose
     * parent fell outside the window on a non-RSM node. The node may not exist yet
     * (an empty thread), which `fetchPosts` records as `fetch_error` rather than
     * throwing.
     *
     * Marks the thread as fetching for the duration so a concurrent
     * {@link CommentFeeds.pruneThreads} can't evict it mid-fetch.
     * @returns {Promise<void>}
     */
    async fetchComments() {
        this._fetching = true;
        try {
            await this.fetchPosts();
            await this.resolveOrphans();
        } finally {
            this._fetching = false;
        }
    }

    /**
     * Reconnect orphans (replies whose in-thread parent isn't loaded) by fetching
     * the missing ancestors by item id, walking up the chain until each branch
     * reaches a loaded root or a retracted (not-found) ancestor.
     *
     * **Non-RSM only.** On an RSM-capable node normal "load older" paging brings
     * parents in *in order*, so a targeted id-fetch is unnecessary and harmful: an
     * out-of-order item carries no `rsm_cursor` and lands at an arbitrary time
     * position, polluting the anchors and gap detection `fetchOlder` relies on. So
     * this early-returns when the node paged via RSM and lets paging adopt orphans.
     *
     * A parent that comes back not-found is recorded in an in-memory absent-set so
     * it isn't re-requested; its orphan stays kept-but-hidden (see buildCommentTree).
     * @returns {Promise<void>}
     */
    async resolveOrphans() {
        if (this.get('supports_rsm')) return; // paging adopts orphans in order

        const { jid, node } = this.attrs;
        this._absent_parents ||= new Set();
        for (let round = 0; round < ORPHAN_RESOLVE_ROUNDS; round++) {
            await this.messages.hydrated;
            const present = new Set(this.messages.models.map((m) => m.get('id')));
            const missing = new Set();
            for (const m of this.messages.models) {
                const parent = m.get('in_reply_to');
                if (!parent || present.has(parent) || this._absent_parents.has(parent)) continue;
                // Only chase a same-thread (nesting) pointer; a cross-node pointer
                // is a Movim-style post-reply, not a missing thread ancestor.
                const p_node = m.get('in_reply_to_node');
                const p_jid = m.get('in_reply_to_jid');
                if ((p_node && p_node !== node) || (p_jid && p_jid !== jid)) continue;
                missing.add(parent);
            }
            if (!missing.size) return;

            let result;
            try {
                result = await api.pubsub.items.get(jid, node, { item_ids: [...missing] });
            } catch (e) {
                log.debug(`CommentFeed.resolveOrphans: item fetch failed for ${node} at ${jid}: ${e}`);
                return;
            }
            const fetched = new Set((result.items ?? []).map((el) => el.getAttribute('id')));
            // A requested id the server didn't return is retracted: stop asking.
            for (const id of missing) if (!fetched.has(id)) this._absent_parents.add(id);
            if (!result.items?.length) return;
            await this.addItems(result.items);
            // Loop to resolve any grandparents the just-fetched items now reference.
        }
    }

    /**
     * Whether a {@link fetchComments} is currently in flight. Consulted by
     * {@link CommentFeeds.pruneThreads} to exempt an actively-fetching thread
     * from eviction.
     * @returns {boolean}
     */
    isFetching() {
        return !!this._fetching;
    }

    /**
     * This thread's items as {@link PostComment}s (the collection's element
     * type; the base `messages` is typed as the timeline {@link PubSubMessage}).
     * @returns {import('./post-comment').default[]}
     */
    get comments() {
        return /** @type {import('./post-comment').default[]} */ (this.messages.models);
    }

    /**
     * This thread's real comments (every item except ♥ likes). Excludes any
     * "load older" placeholders the inherited paging seeds into the collection.
     * @returns {import('./post-comment').default[]}
     */
    getComments() {
        return this.comments.filter((m) => typeof m.isLike === 'function' && !m.isLike());
    }

    /**
     * The ♥ likes authored by me that target `parent_id` (a comment's item id),
     * or the *post* when `parent_id` is omitted. There should be at most one, but
     * duplicates can accrue (e.g. liking from a second device);
     * {@link _converse.api.microblog.unlike} retracts all of them. Matches on the
     * raw `in_reply_to` since our own likes always carry the target's item id.
     * @param {string} [parent_id] - A comment's item id; omit for the post.
     * @returns {import('./post-comment').default[]}
     */
    getMyLikes(parent_id) {
        return this.comments.filter(
            (m) =>
                typeof m.isLike === 'function' &&
                m.isLike() &&
                m.get('is_mine') &&
                (parent_id ? m.get('in_reply_to') === parent_id : !m.get('in_reply_to')),
        );
    }

    /**
     * Denormalised counts for one target in this thread: the **post** (omit
     * `parent_id`) or a specific **comment** (its item id). Written onto the post
     * by {@link syncCommentSummary} and onto each comment by
     * {@link syncCommentCounts}, so the timeline/thread can show counts without
     * re-walking the node.
     *
     * A ♥ is attributed to the item it targets, so a like on a comment no longer
     * inflates the post's like count; likes are counted by **distinct liker** (a
     * person liking from two devices is one like). See {@link computeThreadCounts}.
     * @param {string} [parent_id] - A comment's item id; omit for the post.
     * @returns {{ comment_count?: number, reply_count?: number, like_count: number, liked_by_me: boolean, my_like_id: (string|undefined) }}
     */
    summarize(parent_id) {
        const { post, byComment } = computeThreadCounts(this.comments);
        if (!parent_id) return post;
        return byComment.get(parent_id) ?? { reply_count: 0, like_count: 0, liked_by_me: false, my_like_id: undefined };
    }

    /**
     * Publish a comment to this thread's node and optimistically render it.
     * @param {import('./types').PubSubCommentAttrs} attrs
     * @returns {Promise<import('./message').default|undefined>}
     */
    async publishComment(attrs) {
        const id = attrs.id || getUniqueId();
        const item = this.createCommentStanza({ ...attrs, id });
        // Non-strict: on someone else's PEP comments node we can't reconfigure
        // it, but if the author created it publish_model=open our publish lands.
        await api.pubsub.publish(this.get('jid'), this.get('node'), item, COMMENTS_PUBLISH_OPTIONS, false);

        const [added] = await this.addItems([item.tree()]);
        // The server stamps `publisher` on the echo; set it locally too so our
        // optimistic copy is recognised as ours (is_mine) before any echo.
        added?.set({ publisher: attrs.author_jid });
        return added;
    }

    /**
     * Construct the PubSub `<item>` for a new comment (XEP-0277 § Adding a Comment).
     * an Atom entry carrying the commenter's `<author>` and text.
     * The `<author><uri>` lets readers run the XEP-0277 § Comment Author check
     * (see {@link PubSubMessage.getAuthorMismatch}).
     * @param {import('./types').PubSubCommentAttrs} attrs
     * @returns {import('strophe.js').Stanza}
     */
    createCommentStanza(attrs) {
        const id = attrs.id || getUniqueId();
        const now = attrs.published || new Date().toISOString();
        const tag_id = buildTagId(this.get('jid'), id);

        const parent = attrs.in_reply_to;
        // The pointer's href locates the parent item in *this* comments node.
        const reply_href = parent
            ? `xmpp:${this.get('jid')}?;node=${encodeURIComponent(this.get('node'))};item=${encodeURIComponent(parent)}`
            : null;
        const reply_el = !parent
            ? ''
            : attrs.in_reply_to_ref
              ? stx`<thr:in-reply-to xmlns:thr="${NS_THREAD}" ref="${attrs.in_reply_to_ref}" href="${reply_href}"/>`
              : stx`<thr:in-reply-to xmlns:thr="${NS_THREAD}" href="${reply_href}"/>`;

        return stx`
            <item id="${id}">
                <entry xmlns="${Strophe.NS.ATOM}">
                    <author>
                        <name>${attrs.author_name || attrs.author_jid}</name>
                        <uri>xmpp:${attrs.author_jid}</uri>
                    </author>
                    <title type="text">${attrs.body}</title>
                    ${reply_el}
                    <id>${tag_id}</id>
                    <published>${now}</published>
                    <updated>${now}</updated>
                </entry>
            </item>`;
    }
}

export default CommentFeed;
