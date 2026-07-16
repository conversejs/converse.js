export default PubSubFeed;
/**
 * One PubSub feed: a single node at a single JID (your own
 * `urn:xmpp:microblog:0`, a contact's microblog, or a community node).
 * @extends {Model}
 */
declare class PubSubFeed extends Model<import("@converse/skeletor").ModelAttributes> {
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
    static getBrowseFeed(jid: string, node: string): PubSubFeed;
    /**
     * Drop a cached browse feed, e.g. when a follow supersedes it with the
     * shared feed from `_converse.state.pubsubfeeds`.
     * @param {string} jid
     * @param {string} node
     */
    static dropBrowseFeed(jid: string, node: string): void;
    /**
     * The feeds browsed this session without following them.
     * @returns {PubSubFeed[]}
     */
    static browseFeeds(): PubSubFeed[];
    /**
     * Drop every cached browse feed and its listeners (on logout / session clear).
     */
    static clearBrowseFeeds(): void;
    constructor(attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
    defaults(): {
        node: string;
    };
    /**
     * The collection class backing {@link messages}. {@link CommentFeed} overrides
     * this so a thread's items are {@link PostComment}s (which carry comment-only
     * behaviour like `isLike`), while a timeline feed's items are plain
     * {@link PubSubMessage}s.
     * @returns {typeof PubSubMessages}
     */
    get messagesCollectionClass(): typeof PubSubMessages;
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
    publishPost(body: string, { xhtml, enclosures }?: {
        xhtml?: string;
        enclosures?: import("./types").PubSubEnclosure[];
    }): Promise<void>;
    /**
     * Create this post's open comments node so others can add comments.
     * Best-effort and swallows errors (the node may already exist,
     * or the server may refuse). Returns the in-flight promise for callers that
     * want to await it (e.g. tests), but {@link publishPost} deliberately does not.
     * @param {string} id - The post's PubSub item id.
     * @returns {Promise<void>}
     */
    ensureCommentsNode(id: string): Promise<void>;
    /**
     * Construct the PubSub `<item>` for a new plain-text post on this feed's
     * node. `author` is intentionally omitted for own-feed posts (the node owner
     * is implied per XEP-0277). Carries a `rel="replies"` link advertising the
     * post's comments node, so readers know where to add comments.
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