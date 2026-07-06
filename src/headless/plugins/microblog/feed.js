/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { Model } from '@converse/skeletor';
import { Strophe } from 'strophe.js';
import _converse from '../../shared/_converse.js';
import converse from '../../shared/api/public.js';
import api from '../../shared/api/index.js';
import log from '@converse/log';
import { getUniqueId } from '../../utils/index.js';
import PubSubMessages from './messages.js';
import { parseAtomEntry } from './parsers.js';
import {
    COMMENTS_NODE_PREFIX,
    COMMENTS_PUBLISH_OPTIONS,
    MICROBLOG_NODE,
    MICROBLOG_PUBLISH_OPTIONS,
    NS_ATOM,
    POSTS_MAX_WITHOUT_RSM,
    POSTS_PAGE_SIZE,
} from './constants.js';
import PubsubPlaceholderMessage from './placeholder.js';
import { buildTagId } from './utils.js';

const { stx } = converse.env;

/**
 * One PubSub feed: a single node at a single JID (your own
 * `urn:xmpp:microblog:0`, a contact's microblog, or a community node).
 *
 * Rather than the chat-oriented `ModelWithMessages` mixin (which is coupled to
 * `<message>` stanzas, chat states, receipts and HTTP file uploads), the feed
 * owns its `.messages` collection directly — posts are PubSub items, published
 * via `api.pubsub.publish`.
 *
 * @extends {Model}
 */
class PubSubFeed extends Model {
    get idAttribute() {
        return 'id';
    }

    defaults() {
        return {
            node: MICROBLOG_NODE,
        };
    }

    initialize() {
        super.initialize();
        /** @type {PubSubMessages} */
        this.messages = new PubSubMessages(null, { id: this.getMessagesCacheKey() });
        this.messages.feed = this;
    }

    /**
     * @returns {string}
     */
    getMessagesCacheKey() {
        const bare_jid = _converse.session.get('bare_jid');
        return `converse.pubsub-messages-${this.get('jid')}-${this.get('node')}-${bare_jid}`;
    }

    /**
     * Whether this feed is the logged-in user's own microblog (a PEP node).
     * @returns {boolean}
     */
    isOwnFeed() {
        return Strophe.getBareJidFromJid(this.get('jid')) === _converse.session.get('bare_jid');
    }

    /**
     * Parse incoming PubSub `<item>` elements into posts, add/merge them into the
     * feed, and persist them to the offline cache. Used both for retrieve-items
     * backfill and live PEP events.
     * @param {Element[]} items
     * @returns {Promise<import('./message').default[]>}
     */
    async addItems(items) {
        await this.messages.hydrated;

        const from = this.get('jid');
        const node = this.get('node');

        const saves = [];
        const added = items
            .map((item) => {
                try {
                    const attrs = parseAtomEntry(item, { from, node });
                    const existing = this.messages.get(attrs.id);
                    const message = /** @type {import('./message').default} */ (
                        this.messages.add(attrs, { merge: true })
                    );
                    // Persist new posts and real updates; skip unchanged re-fetches.
                    // Comment threads keep their messages in memory (no store), so
                    // there's nothing to persist to — skip the save there.
                    if (this.messages.storage && message && (!existing || message.hasChanged())) {
                        saves.push(message.save(null, { promise: true }));
                    }
                    return message;
                } catch (e) {
                    log.error(e);
                    return null;
                }
            })
            .filter(Boolean);
        await Promise.all(saves);
        return added;
    }

    /**
     * The feed's cached posts (excluding placeholders), newest-first.
     * @returns {import('./message').default[]}
     */
    getPosts() {
        return this.messages.models.filter((m) => !(m instanceof PubsubPlaceholderMessage));
    }

    /**
     * The newest cached post (or undefined if the feed is empty). The collection is
     * sorted newest-first, so scan from the front for the first non-placeholder.
     * @returns {import('./message').default|undefined}
     */
    getNewestPost() {
        return this.messages.models.find((m) => !(m instanceof PubsubPlaceholderMessage));
    }

    /**
     * The oldest cached post (or undefined if the feed is empty). Scan from the back
     * of the newest-first collection for the first non-placeholder.
     * @returns {import('./message').default|undefined}
     */
    getOldestPost() {
        const models = this.messages.models;
        for (let i = models.length - 1; i >= 0; i--) {
            if (!(models[i] instanceof PubsubPlaceholderMessage)) return models[i];
        }
        return undefined;
    }

    /**
     * Whether an older-frontier ("load older") placeholder is already present.
     * @returns {boolean}
     */
    hasScrolldownPlaceholder() {
        return this.messages.models.some((m) => m instanceof PubsubPlaceholderMessage && !m.get('stop_at_time'));
    }

    /**
     * Persist the opaque RSM cursor of a fetched page's oldest item onto that post,
     * so we can page *older* than it later. No-op without RSM.
     * @param {import('./message').default[]} added
     * @param {import('../pubsub/types.ts').PubSubItemsResult} result
     * @returns {import('./message').default|undefined} The oldest post of the page.
     */
    storePageCursor(added, result) {
        if (!added.length) return undefined;
        // Determine on which end is the oldest message
        const first = added[0];
        const last = added[added.length - 1];
        const ascending = (first.get('time') ?? '') <= (last.get('time') ?? '');
        const oldest = ascending ? first : last;
        const cursor = ascending ? result.rsm?.result?.first : result.rsm?.result?.last;
        if (cursor && oldest.get('rsm_cursor') !== cursor) {
            oldest.save({ rsm_cursor: cursor });
        }
        return oldest;
    }

    /**
     * Fetch the newest page of the feed's history and merge it in (XEP-0060 § 6.5).
     * Uses native `max_items` since not all servers support RSM pubsub (e.g. Prosody).
     * @returns {Promise<void>}
     */
    async fetchPosts() {
        const { jid, node } = this.attrs;
        // Kick off the network fetch immediately so it runs in parallel with
        // hydration (and so callers can observe the request without awaiting).
        const promise = api.pubsub.items.get(jid, node, { max_items: POSTS_PAGE_SIZE });

        await this.messages.hydrated;
        // Newest post we already have, to detect a gap the newest page won't reach.
        const cached_newest_time = this.getNewestPost()?.get('time');

        let result;
        try {
            result = await promise;
        } catch (e) {
            log.error(e);
            return;
        }

        this.set('supports_rsm', !!result.rsm);
        const added = await this.addItems(result.items);
        const page_oldest = this.storePageCursor(added, result);

        if (!this.get('supports_rsm')) {
            // Without RSM we can't page efficiently (native `max_items` only ever
            // returns the newest N, so paging backwards re-fetches everything). When
            // the newest page is full there may be more history, so load a single
            // larger window up front, then disable paging.
            if (result.items.length >= POSTS_PAGE_SIZE) {
                try {
                    const full = await api.pubsub.items.get(jid, node, { max_items: POSTS_MAX_WITHOUT_RSM });
                    await this.addItems(full.items);
                } catch (e) {
                    log.error(e);
                }
            }
            this.set('history_complete', true);
            return;
        }

        const complete = result.items.length < POSTS_PAGE_SIZE;
        this.set('history_complete', complete);
        if (complete) return;

        // A gap exists when the newest page's oldest post is still newer than the
        // posts we already had cached (i.e. it didn't reach them).
        if (
            cached_newest_time &&
            page_oldest &&
            new Date(page_oldest.get('time')).getTime() > new Date(cached_newest_time).getTime()
        ) {
            this.createGapPlaceholder(page_oldest, cached_newest_time);
        }
        this.createScrolldownPlaceholder();
    }

    /**
     * Load one page of posts *older* than `placeholder`'s cursor and merge them in.
     * Shared by the older-frontier and gap placeholders.
     *
     * Pages via the opaque RSM `before` cursor. Placeholders only exist on
     * RSM-capable servers (see {@link fetchPosts}), so no `max_items` fallback is
     * needed here. Re-seeds a follow-on placeholder of the same kind when more
     * history remains.
     * @param {PubsubPlaceholderMessage} placeholder
     * @returns {Promise<void>}
     */
    async fetchOlder(placeholder) {
        await this.messages.hydrated;
        const { jid, node } = this.attrs;
        const before_cursor = placeholder.get('before_cursor');
        const stop_at_time = placeholder.get('stop_at_time');
        // No cursor ⇒ nothing to page against (shouldn't happen: placeholders are
        // only created when RSM is supported and a cursor was captured).
        if (!before_cursor) return;

        let result;
        try {
            result = await api.pubsub.items.get(jid, node, { rsm: { before: before_cursor, max: POSTS_PAGE_SIZE } });
        } catch (e) {
            log.error(e);
            return;
        }

        const added = await this.addItems(result.items);
        const page_oldest = this.storePageCursor(added, result);

        const more = result.items.length >= POSTS_PAGE_SIZE;
        const reached_cache = !!(
            stop_at_time &&
            page_oldest &&
            new Date(page_oldest.get('time')).getTime() <= new Date(stop_at_time).getTime()
        );

        if (more && !reached_cache && page_oldest) {
            // Re-seed a follow-on placeholder of the same kind at the new oldest post.
            // `storePageCursor` has already stored this page's older-frontier cursor
            // onto `page_oldest`, so read it back rather than re-deriving it.
            this.messages.add(
                new PubsubPlaceholderMessage({
                    before_cursor: page_oldest.get('rsm_cursor'),
                    ...(stop_at_time ? { stop_at_time } : {}),
                    time: new Date(new Date(page_oldest.get('time')).getTime() - 1).toISOString(),
                }),
            );
        } else if (!stop_at_time) {
            // The older frontier is exhausted (start of the node reached).
            this.set('history_complete', true);
        }
    }

    /**
     * Seed the per-feed "load older" placeholder at the feed's oldest-loaded post.
     * Positioned in the aggregate timeline by the oldest post's time, so it sits at
     * the point where *this* feed's loaded history ends and interleaves correctly.
     */
    createScrolldownPlaceholder() {
        if (this.get('history_complete') || this.hasScrolldownPlaceholder()) return;
        const oldest = this.getOldestPost();
        if (!oldest) return;
        this.messages.add(
            new PubsubPlaceholderMessage({
                before_cursor: oldest.get('rsm_cursor'),
                time: new Date(new Date(oldest.get('time')).getTime() - 1).toISOString(),
            }),
        );
    }

    /**
     * Mark a newer-than-cache gap: a placeholder positioned just below the newest
     * page that pages the missing range until it reaches the cached posts.
     * @param {import('./message').default} page_oldest - Oldest post of the newest page.
     * @param {string} stop_at_time - Time of the newest cached post (the gap's floor).
     */
    createGapPlaceholder(page_oldest, stop_at_time) {
        // `storePageCursor` already stored the page's older-frontier cursor onto
        // `page_oldest`; the gap pages older from there until it reaches the cache.
        const before_cursor = page_oldest.get('rsm_cursor');
        const time = new Date(new Date(page_oldest.get('time')).getTime() - 1).toISOString();
        const exists = this.messages.models.some(
            (m) =>
                m instanceof PubsubPlaceholderMessage &&
                m.get('time') === time &&
                m.get('stop_at_time') === stop_at_time,
        );
        if (exists) return;
        this.messages.add(new PubsubPlaceholderMessage({ before_cursor, stop_at_time, time }));
    }

    /**
     * Remove posts from the feed by id, e.g. in response to a retraction event.
     * @param {string[]} ids
     */
    removeItems(ids) {
        ids.forEach((id) => this.messages.get(id)?.destroy());
    }

    /**
     * Retract (delete) one of our own posts: remove it from the node and drop
     * the locally-cached copy.
     * @param {string} id - The PubSub item id of the post
     * @returns {Promise<void>}
     */
    async retractPost(id) {
        await api.pubsub.retract(this.get('jid'), this.get('node'), id);
        this.messages.get(id)?.destroy();
    }

    /**
     * Tear the feed down (when unfollowing): clear its cached posts and remove
     * the feed itself from the feeds collection / offline cache.
     * @returns {Promise<void>}
     */
    async close() {
        this.messages.clearStore?.({ silent: true });
        await this.destroy();
    }

    /**
     * Publish a new plain-text post to this feed's node.
     * @param {string} body
     * @returns {Promise<void>}
     */
    async publishPost(body) {
        const text = body?.trim();
        if (!text) return;

        const id = getUniqueId();
        // Provision the post's open comments node so *others* can reply: a
        // foreign commenter can't create a node on our PEP service, so the
        // author provisions it up front (XEP-0277 § Comments). Fired alongside
        // the publish (not before it) so it doesn't add a round-trip of latency,
        // and non-fatal — the post still publishes if it fails; only foreign
        // commenting would then be unavailable.
        this.ensureCommentsNode(id);

        const item = this.createPostStanza({ body: text, id });
        // Publish with the XEP-0472 Base-profile node config so our node stays a
        // well-formed social feed that contacts can subscribe to. Non-strict:
        // if the server can't honour the publish-options precondition we still
        // publish the post.
        await api.pubsub.publish(this.get('jid'), this.get('node'), item, MICROBLOG_PUBLISH_OPTIONS, false);

        // Optimistically render our own post; the PEP echo (if any) will merge
        // by id rather than duplicate.
        await this.addItems([item.tree()]);
    }

    /**
     * Create this post's open comments node so others can add comments.
     * Best-effort and swallows errors (the node may already exist,
     * or the server may refuse). Returns the in-flight promise for callers that
     * want to await it (e.g. tests), but {@link publishPost} deliberately does not.
     * @param {string} id - The post's PubSub item id.
     * @returns {Promise<void>}
     */
    ensureCommentsNode(id) {
        return api.pubsub
            .create(this.get('jid'), COMMENTS_NODE_PREFIX + id, COMMENTS_PUBLISH_OPTIONS)
            .catch((e) => log.debug(`ensureCommentsNode: could not create the comments node for ${id}: ${e}`));
    }

    /**
     * Construct the PubSub `<item>` for a new plain-text post on this feed's
     * node. `author` is intentionally omitted for own-feed posts (the node owner
     * is implied per XEP-0277). Carries a `rel="replies"` link advertising the
     * post's comments node, so readers know where to add comments.
     * @param {import('./types').PubSubPublishAttrs} attrs
     * @returns {import('strophe.js').Stanza}
     */
    createPostStanza(attrs) {
        const id = attrs.id || getUniqueId();
        const now = new Date().toISOString();
        const published = attrs.published || now;
        const updated = attrs.updated || now;
        const tag_id = attrs.atom_id || buildTagId(this.get('jid'), id);
        const comments_node = COMMENTS_NODE_PREFIX + id;
        const comments_href = `xmpp:${this.get('jid')}?;node=${encodeURIComponent(comments_node)}`;

        return stx`
            <item id="${id}">
                <entry xmlns="${NS_ATOM}">
                    <title type="text">${attrs.body}</title>
                    <link rel="replies" title="comments" href="${comments_href}"/>
                    <id>${tag_id}</id>
                    <published>${published}</published>
                    <updated>${updated}</updated>
                </entry>
            </item>`;
    }

    /**
     * Repeat (repost) an existing post into this feed's node (XEP-0277 §
     * Repeating a Post). Publishes a new item attributed to the original author
     * with a `rel="via"` link, then optimistically renders it.
     * @param {import('./message').default} post - The post to repost.
     * @returns {Promise<void>}
     */
    async repostPost(post) {
        const item = this.createRepostStanza(post);
        await api.pubsub.publish(this.get('jid'), this.get('node'), item, MICROBLOG_PUBLISH_OPTIONS, false);
        await this.addItems([item.tree()]);
    }

    /**
     * Construct the PubSub `<item>` that repeats (reposts) an existing post onto
     * this feed's node (XEP-0277 § Repeating a Post): a new item carrying the
     * **original** author (`<author>`) and a `rel="via"` link back to the
     * original post, with its text constructs copied. The server stamps the reposter
     * as `publisher`, so it renders attributed to the original author with a
     * "reposted by …" eyebrow
     * (see {@link parseAtomEntry} and PubSubMessage.getReposterJID).
     * @param {import('./message').default} post - The post being reposted.
     * @returns {import('strophe.js').Stanza}
     */
    createRepostStanza(post) {
        const id = getUniqueId();
        const now = new Date().toISOString();

        const author_jid = post.getAuthorJID();
        const author_name = post.getDisplayName() || author_jid;
        const node = post.get('node') || MICROBLOG_NODE;
        const item_id = post.get('id') ?? '';

        // The via link must point at the *original* post (per XEP-0277).
        // When the post is itself a repost, propagate its via href/ref
        // verbatim so the whole chain resolves to the same original.
        const via_href =
            post.get('via_href') ||
            `xmpp:${post.get('from')}?;node=${encodeURIComponent(node)};item=${encodeURIComponent(item_id)}`;
        const via_ref = post.get('via_href') ? post.get('via_ref') : post.get('atom_id');

        // <title> is emitted even when empty — RFC 4287 requires exactly one per
        // entry, and Atom-native posts carry an empty title with the body in <content>.
        // Only the plain-text constructs are copied: the XHTML variants (XEP-0071)
        // are deliberately dropped, since that XEP is deprecated.
        const title = post.get('title');
        const summary = post.get('summary');
        const content = post.get('content');

        return stx`
            <item id="${id}">
                <entry xmlns="${NS_ATOM}">
                    ${author_jid ? stx`<author><name>${author_name}</name><uri>xmpp:${author_jid}</uri></author>` : ''}
                    <title type="text">${title ?? ''}</title>
                    ${summary !== undefined ? stx`<summary type="text">${summary}</summary>` : ''}
                    ${content !== undefined ? stx`<content type="text">${content}</content>` : ''}
                    ${
                        via_ref
                            ? stx`<link rel="via" href="${via_href}" ref="${via_ref}"/>`
                            : stx`<link rel="via" href="${via_href}"/>`
                    }
                    <id>${buildTagId(this.get('jid'), id)}</id>
                    <published>${now}</published>
                    <updated>${now}</updated>
                </entry>
            </item>`;
    }
}

export default PubSubFeed;
