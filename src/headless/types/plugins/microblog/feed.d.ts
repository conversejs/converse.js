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
     * Parse incoming PubSub `<item>` elements into posts and add/merge them into
     * the feed. Used both for retrieve-items backfill and live PEP events.
     * @param {Element[]} items
     * @returns {import('./message').default[]}
     */
    addItems(items: Element[]): import("./message").default[];
    /**
     * Backfill the feed's history from the node (XEP-0060 § 6.5 Retrieve Items).
     * @param {object} [options]
     * @param {number} [options.max_items=20]
     * @returns {Promise<void>}
     */
    fetchPosts({ max_items }?: {
        max_items?: number;
    }): Promise<void>;
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
}
import { Model } from '@converse/skeletor';
import PubSubMessages from './messages.js';
//# sourceMappingURL=feed.d.ts.map