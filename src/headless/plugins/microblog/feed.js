/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { Model } from '@converse/skeletor';
import { Strophe } from 'strophe.js';
import sizzle from 'sizzle';
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
    GALLERY_TYPE,
    MICROBLOG_NODE,
    MICROBLOG_PUBLISH_OPTIONS,
    NS_ATOM,
    POSTS_MAX_WITHOUT_RSM,
    POSTS_PAGE_SIZE,
} from './constants.js';
import PubsubPlaceholderMessage from './placeholder.js';
import { buildTagId, extractHashtags } from './utils.js';

const { stx, Stanza } = converse.env;

// One detached browse feed per JID + node, reused across profile-view opens (the
// same pattern MicroblogProfile uses): re-visiting an unfollowed author gets the
// already-fetched feed instead of a blank refetch, and the set of browsed-but-not-
// followed feeds becomes enumerable (see {@link PubSubFeed.browseFeeds}). Session-
// scoped: cleared on logout via {@link PubSubFeed.clearBrowseFeeds}.
const browse_feeds = new Map();

/**
 * One PubSub feed: a single node at a single JID (your own
 * `urn:xmpp:microblog:0`, a contact's microblog, or a community node).
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

    /**
     * The collection class backing {@link messages}. {@link CommentFeed} overrides
     * this so a thread's items are {@link PostComment}s (which carry comment-only
     * behaviour like `isLike`), while a timeline feed's items are plain
     * {@link PubSubMessage}s.
     * @returns {typeof PubSubMessages}
     */
    get messagesCollectionClass() {
        return PubSubMessages;
    }

    initialize() {
        super.initialize();
        const MessagesCollection = this.messagesCollectionClass;

        // Unfollowed feeds are stored in-memory and not persisted
        const id = this.get('in_memory') ? undefined : this.getMessagesCacheKey();
        /** @type {PubSubMessages} */
        this.messages = new MessagesCollection(null, { id });
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
     * Get (creating + caching if necessary) the detached, in-memory browse feed
     * for a JID + node the user does *not* follow. Deliberately kept out of
     * `_converse.state.pubsubfeeds` (that collection is persisted and aggregated
     * wholesale into the timeline), but cached here so re-opening a profile is
     * warm and browsed feeds are enumerable for e.g. mention completion.
     * @param {string} jid
     * @param {string} node
     * @returns {PubSubFeed}
     */
    static getBrowseFeed(jid, node) {
        const id = `${jid}/${node}`;
        let feed = browse_feeds.get(id);
        if (!feed) {
            feed = new PubSubFeed({ jid, node, in_memory: true });
            browse_feeds.set(id, feed);
        }
        return feed;
    }

    /**
     * Drop a cached browse feed, e.g. when a follow supersedes it with the
     * shared feed from `_converse.state.pubsubfeeds`.
     * @param {string} jid
     * @param {string} node
     */
    static dropBrowseFeed(jid, node) {
        browse_feeds.delete(`${jid}/${node}`);
    }

    /**
     * The feeds browsed this session without following them.
     * @returns {PubSubFeed[]}
     */
    static browseFeeds() {
        return [...browse_feeds.values()];
    }

    /**
     * Drop every cached browse feed and its listeners (on logout / session clear).
     */
    static clearBrowseFeeds() {
        browse_feeds.forEach((feed) => {
            feed.messages?.stopListening();
            feed.stopListening();
        });
        browse_feeds.clear();
    }

    /**
     * Whether this feed is the logged-in user's own microblog (a PEP node).
     * @returns {boolean}
     */
    isOwnFeed() {
        return Strophe.getBareJidFromJid(this.get('jid')) === _converse.session.get('bare_jid');
    }

    /**
     * Whether this feed is an XEP-0472 **gallery** node (its items are images),
     * as opposed to a text microblog/social feed. Drives the image-grid rendering
     * in the profile view; depends on {@link discoverType} having run.
     * @returns {boolean}
     */
    isGallery() {
        return this.get('type') === GALLERY_TYPE;
    }

    /**
     * Learn this node's XEP-0472 profile from its `pubsub#type` (XEP-0060 § 5.4
     * node metadata) and cache it on the model, so the UI can tell a gallery node
     * from a text feed. Best-effort and skipped once known.
     * @returns {Promise<string|undefined>}
     */
    async discoverType() {
        const known = this.get('type');
        if (known) return known;

        try {
            const stanza = await api.disco.info(this.get('jid'), this.get('node'));
            const type =
                sizzle('x[type="result"] field[var="pubsub#type"] value', stanza)[0]?.textContent?.trim() || undefined;
            if (type) this.set({ type });

            return type;
        } catch (e) {
            log.debug(`discoverType: could not read pubsub#type for ${this.get('jid')} (${this.get('node')}): ${e}`);
            return undefined;
        }
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
            // Record why the fetch failed so the UI can tell an empty feed apart
            // from one we're not allowed to read.
            this.set('fetch_error', /** @type {any} */ (e)?.name || 'error');
            log.error(e);
            return;
        }
        this.set({
            supports_rsm: !!result.rsm,
            fetch_error: null,
        });
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
     * Publish a new post to this feed's node.
     *
     * With no `xhtml` the post is a plain-text `<title>` (the historical short-post
     * form). With `xhtml` (a well-formed `<div xmlns="…xhtml">…</div>` fragment,
     * produced by the rich composer) the post carries Movim-compatible **dual
     * content**: `<content type="text">` (the markdown source in `body`) plus
     * `<content type="xhtml">` (the rendered fragment). See {@link parseAtomEntry}'s
     * `pickTextConstruct`, which reads exactly that pair back.
     * @param {string} body - Plain text, or the markdown source when `xhtml` is set.
     * @param {object} [opts]
     * @param {string} [opts.xhtml] - A well-formed XHTML `<div>` fragment for a rich post.
     * @param {import('./types').PubSubEnclosure[]} [opts.enclosures] - Media attachments
     *      (e.g. XEP-0363-uploaded files), emitted as `<link rel="enclosure">`.
     * @returns {Promise<void>}
     */
    async publishPost(body, { xhtml, enclosures } = {}) {
        const text = body?.trim();
        // A post needs either text or at least one media attachment.
        if (!text && !enclosures?.length) return;

        const id = getUniqueId();
        // Provision the post's open comments node so *others* can reply.
        this.ensureCommentsNode(id);

        const item = this.createPostStanza({ body: text, xhtml, enclosures, id });
        // Publish with the XEP-0472 Base-profile node config so our node stays a
        // well-formed social feed that contacts can subscribe to. Non-strict:
        // if the server can't honour the publish-options precondition we still
        // publish the post.
        await api.pubsub.publish(this.get('jid'), this.get('node'), item, MICROBLOG_PUBLISH_OPTIONS, false);

        // Optimistically render our own post; the PEP echo (if any) will merge
        // by id rather than duplicate.
        const [added] = await this.addItems([item.tree()]);

        // Pin + subscribe to our own post's comments thread
        if (added && this.isOwnFeed()) api.microblog.comments.pin(added).catch((e) => log.error(e));
    }

    /**
     * Edit one of our own posts. Republish to the same PubSub item id,
     * preserving the entry's `atom:id` and original `published` time while
     * stamping a fresh `updated`. Per XEP-0060 a publish to an existing item id
     * replaces it, and {@link addItems} merges the new payload into the cached
     * post by id, so the timeline updates in place without reordering. The
     * post's comments node (keyed by the same id) is untouched.
     * @param {string} id - The PubSub item id of the post to edit.
     * @param {string} body - Plain text, or the markdown source when `xhtml` is set.
     * @param {object} [opts]
     * @param {string} [opts.xhtml] - A well-formed XHTML `<div>` fragment for a rich post.
     * @param {import('./types').PubSubEnclosure[]} [opts.enclosures] - Media attachments.
     * @returns {Promise<void>}
     */
    async editPost(id, body, { xhtml, enclosures } = {}) {
        const text = body?.trim();
        // An edited post, like a new one, needs either text or a media attachment.
        if (!text && !enclosures?.length) return;

        const existing = this.messages.get(id);
        const item = this.createPostStanza({
            body: text,
            xhtml,
            enclosures,
            id,
            // Keep the entry's stable identity and creation time; only `updated` moves.
            atom_id: existing?.get('atom_id'),
            published: existing?.get('published') || existing?.get('time'),
            updated: new Date().toISOString(),
        });
        await api.pubsub.publish(this.get('jid'), this.get('node'), item, MICROBLOG_PUBLISH_OPTIONS, false);
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

        // A rich post carries dual content (Movim-compatible): the markdown source
        // as `<content type="text">` plus the rendered `<content type="xhtml">`.
        // The xhtml fragment is injected raw (it's already well-formed XML built by
        // the composer); the plain-text path keeps the historical `<title>` form.
        const body = attrs.xhtml
            ? stx`<content type="text">${attrs.body}</content>${Stanza.unsafeXML(
                  `<content type="xhtml">${attrs.xhtml}</content>`,
              )}`
            : stx`<title type="text">${attrs.body}</title>`;

        // Media attachments (RFC 4287 / XEP-0277) as `<link rel="enclosure">`; the
        // reader renders images/audio/video inline (see the social message template).
        const enclosures = (attrs.enclosures || []).map(
            (e) => stx`<link rel="enclosure" href="${e.href}" type="${e.type || ''}" title="${e.title || ''}"/>`,
        );

        // The body's inline #hashtags, also emitted as machine-readable Atom
        // `<category>` terms (XEP-0277 § Post Categories) so aggregators/bridges
        // can read a post's tags without scraping its text.
        const categories = extractHashtags(attrs.body).map((term) => stx`<category term="${term}"/>`);

        return stx`
            <item id="${id}">
                <entry xmlns="${NS_ATOM}">
                    ${body}
                    ${enclosures}
                    ${categories}
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
