export default PubSubFeed;
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
declare class PubSubFeed extends Model<import("@converse/skeletor").ModelAttributes> {
    constructor(attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
    defaults(): {
        node: string;
    };
    initialize(): void;
    /** @type {PubSubMessages} */
    messages: PubSubMessages;
    /**
     * @returns {string}
     */
    getMessagesCacheKey(): string;
    /**
     * Whether this feed is the logged-in user's own microblog (a PEP node).
     * @returns {boolean}
     */
    isOwnFeed(): boolean;
    /**
     * Parse incoming PubSub `<item>` elements into posts, add/merge them into the
     * feed, and persist them to the offline cache. Used both for retrieve-items
     * backfill and live PEP events.
     * @param {Element[]} items
     * @returns {Promise<import('./message').default[]>}
     */
    addItems(items: Element[]): Promise<import("./message").default[]>;
    /**
     * The feed's cached posts (excluding placeholders), newest-first.
     * @returns {import('./message').default[]}
     */
    getPosts(): import("./message").default[];
    /**
     * The newest cached post (or undefined if the feed is empty). The collection is
     * sorted newest-first, so scan from the front for the first non-placeholder.
     * @returns {import('./message').default|undefined}
     */
    getNewestPost(): import("./message").default | undefined;
    /**
     * The oldest cached post (or undefined if the feed is empty). Scan from the back
     * of the newest-first collection for the first non-placeholder.
     * @returns {import('./message').default|undefined}
     */
    getOldestPost(): import("./message").default | undefined;
    /**
     * Whether an older-frontier ("load older") placeholder is already present.
     * @returns {boolean}
     */
    hasScrolldownPlaceholder(): boolean;
    /**
     * Persist the opaque RSM cursor of a fetched page's oldest item onto that post,
     * so we can page *older* than it later. No-op without RSM.
     * @param {import('./message').default[]} added
     * @param {import('../pubsub/types.ts').PubSubItemsResult} result
     * @returns {import('./message').default|undefined} The oldest post of the page.
     */
    storePageCursor(added: import("./message").default[], result: import("../pubsub/types.ts").PubSubItemsResult): import("./message").default | undefined;
    /**
     * Fetch the newest page of the feed's history and merge it in (XEP-0060 § 6.5).
     * Uses native `max_items` since not all servers support RSM pubsub (e.g. Prosody).
     * @returns {Promise<void>}
     */
    fetchPosts(): Promise<void>;
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
    fetchOlder(placeholder: PubsubPlaceholderMessage): Promise<void>;
    /**
     * Seed the per-feed "load older" placeholder at the feed's oldest-loaded post.
     * Positioned in the aggregate timeline by the oldest post's time, so it sits at
     * the point where *this* feed's loaded history ends and interleaves correctly.
     */
    createScrolldownPlaceholder(): void;
    /**
     * Mark a newer-than-cache gap: a placeholder positioned just below the newest
     * page that pages the missing range until it reaches the cached posts.
     * @param {import('./message').default} page_oldest - Oldest post of the newest page.
     * @param {string} stop_at_time - Time of the newest cached post (the gap's floor).
     */
    createGapPlaceholder(page_oldest: import("./message").default, stop_at_time: string): void;
    /**
     * Remove posts from the feed by id, e.g. in response to a retraction event.
     * @param {string[]} ids
     */
    removeItems(ids: string[]): void;
    /**
     * Retract (delete) one of our own posts: remove it from the node and drop
     * the locally-cached copy.
     * @param {string} id - The PubSub item id of the post
     * @returns {Promise<void>}
     */
    retractPost(id: string): Promise<void>;
    /**
     * Tear the feed down (when unfollowing): clear its cached posts and remove
     * the feed itself from the feeds collection / offline cache.
     * @returns {Promise<void>}
     */
    close(): Promise<void>;
    /**
     * Publish a new plain-text post to this feed's node.
     * @param {string} body
     * @returns {Promise<void>}
     */
    publishPost(body: string): Promise<void>;
    /**
     * Construct the PubSub `<item>` for a new plain-text post on this feed's
     * node. `author` is intentionally omitted for own-feed posts (the node owner
     * is implied per XEP-0277).
     * @param {import('./types').PubSubPublishAttrs} attrs
     * @returns {import('strophe.js').Stanza}
     */
    createPostStanza(attrs: import("./types").PubSubPublishAttrs): import("strophe.js").Stanza;
    /**
     * Repeat (repost) an existing post into this feed's node (XEP-0277 §
     * Repeating a Post). Publishes a new item attributed to the original author
     * with a `rel="via"` link, then optimistically renders it.
     * @param {import('./message').default} post - The post to repost.
     * @returns {Promise<void>}
     */
    repostPost(post: import("./message").default): Promise<void>;
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
    createRepostStanza(post: import("./message").default): import("strophe.js").Stanza;
}
import { Model } from '@converse/skeletor';
import PubSubMessages from './messages.js';
import PubsubPlaceholderMessage from './placeholder.js';
//# sourceMappingURL=feed.d.ts.map