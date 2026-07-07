import log from '@converse/log';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { getUniqueId } from '../../utils/index.js';
import { COMMENTS_PUBLISH_OPTIONS, POSTS_MAX_WITHOUT_RSM } from './constants.js';
import PubSubFeed from './feed.js';
import PostComments from './post-comments.js';
import { buildTagId } from './utils.js';

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
     * Fetch this thread's comments (one shot, newest first). The node may not
     * exist yet which surfaces as an error here, treated as an empty thread.
     *
     * Marks the thread as fetching for the duration so a concurrent
     * {@link CommentFeeds.pruneThreads} can't evict it mid-fetch.
     * @returns {Promise<void>}
     */
    async fetchComments() {
        const { jid, node } = this.attrs;
        this._fetching = true;
        try {
            const result = await api.pubsub.items.get(jid, node, { max_items: POSTS_MAX_WITHOUT_RSM });
            await this.addItems(result.items);
        } catch (e) {
            log.debug(`CommentFeed.fetchComments: no readable comments node ${node} at ${jid}: ${e}`);
        } finally {
            this._fetching = false;
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
     * This thread's real comments (every item except ♥ likes).
     * @returns {import('./post-comment').default[]}
     */
    getComments() {
        return this.comments.filter((m) => !m.isLike());
    }

    /**
     * The ♥ likes in this thread authored by me. There should be at most one,
     * but duplicates can accrue (e.g. liking from a second device).
     * {@link _converse.api.microblog.unlike} retracts all of them.
     * @returns {import('./post-comment').default[]}
     */
    getMyLikes() {
        return this.comments.filter((m) => m.isLike() && m.get('is_mine'));
    }

    /**
     * Denormalised comment/like counts for this thread, partitioning its items
     * into real comments and ♥ likes. Written onto the post by
     * {@link syncCommentSummary} so the timeline can show counts without opening
     * the thread.
     *
     * Likes are counted by **distinct liker**, not raw ♥ items: a post can carry
     * several ♥ from the same person (e.g. liked from multiple devices, or a
     * client that doesn't guard against it), and that's one like, not several.
     * @returns {{ comment_count: number, like_count: number, liked_by_me: boolean, my_like_id: (string|undefined) }}
     */
    summarize() {
        let comment_count = 0;
        let liked_by_me = false;
        let my_like_id;
        const likers = new Set();
        this.comments.forEach((m) => {
            if (m.isLike()) {
                // Dedupe by the liker's bare JID; fall back to the item id when
                // the author is unknown, so unattributable likes still count once
                // each rather than collapsing together.
                const jid = m.getAuthorJID();
                likers.add(jid ? Strophe.getBareJidFromJid(jid) : `id:${m.get('id')}`);
                if (m.get('is_mine')) {
                    liked_by_me = true;
                    my_like_id = m.get('id');
                }
            } else {
                comment_count++;
            }
        });
        return { comment_count, like_count: likers.size, liked_by_me, my_like_id };
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
     * Construct the PubSub `<item>` for a new comment (XEP-0277 § Adding a
     * Comment): an Atom entry carrying the commenter's `<author>` and text. The
     * `<author><uri>` lets readers run the XEP-0277 § Comment Author check
     * (see {@link PubSubMessage.getAuthorMismatch}).
     * @param {import('./types').PubSubCommentAttrs} attrs
     * @returns {import('strophe.js').Stanza}
     */
    createCommentStanza(attrs) {
        const id = attrs.id || getUniqueId();
        const now = attrs.published || new Date().toISOString();
        const tag_id = buildTagId(this.get('jid'), id);
        return stx`
            <item id="${id}">
                <entry xmlns="${Strophe.NS.ATOM}">
                    <author>
                        <name>${attrs.author_name || attrs.author_jid}</name>
                        <uri>xmpp:${attrs.author_jid}</uri>
                    </author>
                    <title type="text">${attrs.body}</title>
                    <id>${tag_id}</id>
                    <published>${now}</published>
                    <updated>${now}</updated>
                </entry>
            </item>`;
    }
}

export default CommentFeed;
