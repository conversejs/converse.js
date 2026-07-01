/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { Model } from '@converse/skeletor';
import { Strophe } from 'strophe.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import log from '@converse/log';
import PubSubMessages from './messages.js';
import { buildItem, parseAtomEntry } from './parsers.js';
import { MICROBLOG_NODE, MICROBLOG_PUBLISH_OPTIONS, POSTS_MAX_WITHOUT_RSM, POSTS_PAGE_SIZE } from './constants.js';
import PubsubPlaceholderMessage from './placeholder.js';

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
                    if (message && (!existing || message.hasChanged())) {
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
     * so we can page *older* than it later (and after a reload). No-op without RSM.
     *
     * The server returns items oldest→newest and reports the page's `<first>` as the
     * cursor of the oldest item (verified: Prosody has no RSM; ejabberd uses opaque
     * creation-timestamp cursors). We treat the cursor as opaque and echo it back.
     *
     * @param {import('./message').default[]} added
     * @param {import('../pubsub/types.ts').PubSubItemsResult} result
     * @returns {import('./message').default|undefined} The oldest post of the page.
     */
    storePageCursor(added, result) {
        if (!added.length) return undefined;
        // RSM returns each page in a stable order (that's what makes cursor paging
        // work), so the oldest item is at one end — we just don't know which. Compare
        // the ends; `<first>`/`<last>` are the cursors of the first/last *returned*
        // items (XEP-0059 § 2.1), so the oldest post and the cursor to page past it
        // are the same end.
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

        const item = buildItem({ body: text, from: this.get('jid') });
        // Publish with the XEP-0472 Base-profile node config so our node stays a
        // well-formed social feed that contacts can subscribe to. Non-strict:
        // if the server can't honour the publish-options precondition we still
        // publish the post.
        await api.pubsub.publish(this.get('jid'), this.get('node'), item, MICROBLOG_PUBLISH_OPTIONS, false);

        // Optimistically render our own post; the PEP echo (if any) will merge
        // by id rather than duplicate.
        await this.addItems([item.tree()]);
    }
}

export default PubSubFeed;
