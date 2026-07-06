import log from '@converse/log';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { getUniqueId } from '../../utils/index.js';
import { COMMENTS_PUBLISH_OPTIONS, POSTS_MAX_WITHOUT_RSM } from './constants.js';
import PubSubFeed from './feed.js';
import { buildTagId } from './utils.js';

const { stx, Strophe } = converse.env;

/**
 * A single post's comments thread (XEP-0277 § Comments): a {@link PubSubFeed}
 * over that post's comments node. Kept in a collection separate from the
 * timeline feeds so comments never surface in the aggregated feed, and held
 * fully in memory (no offline store) — a thread is cheap to refetch when
 * reopened, avoiding unbounded storage growth from browsing many posts.
 *
 * @extends {PubSubFeed}
 */
class CommentFeed extends PubSubFeed {
    /**
     * In-memory only: returning no cache key means the messages collection
     * creates no backing store (see {@link PubSubMessages}).
     * @returns {undefined}
     */
    getMessagesCacheKey() {
        return undefined;
    }

    /**
     * Fetch this thread's comments (one shot, newest first). The node may not
     * exist yet — nobody has commented, or a non-Converse author never
     * provisioned it — which surfaces as an error here, treated as an empty
     * thread.
     * @returns {Promise<void>}
     */
    async fetchComments() {
        const { jid, node } = this.attrs;
        try {
            const result = await api.pubsub.items.get(jid, node, { max_items: POSTS_MAX_WITHOUT_RSM });
            await this.addItems(result.items);
        } catch (e) {
            log.debug(`CommentFeed.fetchComments: no readable comments node ${node} at ${jid}: ${e}`);
        }
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
