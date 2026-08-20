/**
 * One entry in the durable XEP-0330 follow list: a PubSub node the user follows
 * (a contact's `urn:xmpp:microblog:0`, or any `server`/`node` pair).
 * @extends {Model}
 */
export class FollowedFeed extends Model<import("@converse/skeletor").ModelAttributes> {
    constructor(attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
    defaults(): {
        node: string;
    };
}
export default Following;
import { Model } from '@converse/skeletor';
/**
 * A local, persisted mirror of the durable XEP-0330 follow list.
 * The source of truth for whom the user follows. Registered as `_converse.state.following`.
 *
 * Consulted by {@link _converse.api.microblog.isFollowing}, so "do we follow this
 * author" is decoupled from "do we happen to have a feed loaded for them" (a
 * browse-only profile feed exists without a follow). Kept in sync two ways:
 * {@link Following#track}/{@link Following#untrack} on this device's own
 * follow/unfollow, and {@link Following#reconcile}, which reconciles the whole
 * mirror against the server list read on `initFollowing` (catching
 * follows/unfollows made on another device or client, e.g. Movim).
 *
 * Mirrors the {@link import('./feeds.js').default} persistence pattern.
 * @extends {Collection<FollowedFeed>}
 */
declare class Following extends Collection<FollowedFeed> {
    /**
     * The canonical entry id for a follow: `server/node`, matching a feed's id.
     * @param {string} server
     * @param {string} node
     * @returns {string}
     */
    static getId(server: string, node: string): string;
    constructor(models?: import("@converse/skeletor").ModelAttributes | import("@converse/skeletor").ModelAttributes[] | FollowedFeed | FollowedFeed[], options?: import("@converse/skeletor").CollectionOptions<FollowedFeed>);
    get model(): typeof FollowedFeed;
    initialize(): void;
    /**
     * Whether the given node is in the follow list.
     * @param {string} server
     * @param {string} [node=MICROBLOG_NODE]
     * @returns {boolean}
     */
    isFollowing(server: string, node?: string): boolean;
    /**
     * Record (add or update the title of) a follow.
     * @param {{ server: string, node?: string, title?: string }} attrs
     * @returns {FollowedFeed|Promise<FollowedFeed|void>}
     */
    track({ server, node, title }: {
        server: string;
        node?: string;
        title?: string;
    }): FollowedFeed | Promise<FollowedFeed | void>;
    /**
     * Drop a follow from the mirror.
     * @param {string} server
     * @param {string} [node=MICROBLOG_NODE]
     */
    untrack(server: string, node?: string): void;
    /**
     * Reconcile the mirror against the authoritative XEP-0330 list read from the
     * server: upsert every entry present and drop any local entry no longer in the list.
     * @param {Array<{ server: string, node: string, title?: string }>} entries
     * @returns {Promise<void>}
     */
    reconcile(entries: Array<{
        server: string;
        node: string;
        title?: string;
    }>): Promise<void>;
}
import { Collection } from '@converse/skeletor';
//# sourceMappingURL=following.d.ts.map