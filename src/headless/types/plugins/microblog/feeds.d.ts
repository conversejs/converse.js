export default PubSubFeeds;
/**
 * The set of PubSub feeds the user is reading — their own microblog plus any
 * contacts'/communities' nodes. Registered as `_converse.state.pubsubfeeds`.
 *
 * @extends {Collection<PubSubFeed>}
 */
declare class PubSubFeeds extends Collection<PubSubFeed> {
    /**
     * Build the canonical feed id for a JID + node pair.
     * @param {string} jid
     * @param {string} node
     * @returns {string}
     */
    static getFeedId(jid: string, node: string): string;
    constructor(models?: import("@converse/skeletor").ModelAttributes | import("@converse/skeletor").ModelAttributes[] | PubSubFeed | PubSubFeed[], options?: import("@converse/skeletor").CollectionOptions<PubSubFeed>);
    get model(): typeof PubSubFeed;
    initialize(): void;
    /**
     * Get an existing feed, or create and add it.
     * @param {string} jid - The feed's JID (bare JID for the user's own PEP feed).
     * @param {string} [node=MICROBLOG_NODE]
     * @param {boolean} [create=true]
     * @returns {PubSubFeed|undefined|Promise<PubSubFeed|void>}
     */
    getFeed(jid: string, node?: string, create?: boolean): PubSubFeed | undefined | Promise<PubSubFeed | void>;
}
import PubSubFeed from './feed.js';
import { Collection } from '@converse/skeletor';
//# sourceMappingURL=feeds.d.ts.map