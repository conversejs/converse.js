/**
 * One cached verdict on whether a contact has a followable microblog feed,
 * learned by probing their `urn:xmpp:microblog:0` node during a manual "find
 * people to follow" sweep.
 * @extends {Model}
 */
export class FollowableContact extends Model<import("@converse/skeletor").ModelAttributes> {
    constructor(attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
    defaults(): {
        /** Whether the contact has a readable microblog feed with content. */
        followable: boolean;
        /** Whether the user dismissed this suggestion (snooze-until-new). */
        snoozed: boolean;
        /** ISO time of the newest post seen, for preview/sort (optional). */
        latest: any;
    };
}
export default FollowableCache;
import { Model } from '@converse/skeletor';
/**
 * The per-account, persisted cache of microblog-followability verdicts, keyed by
 * bare JID. Registered as `_converse.state.followablecache`. It lets a manual
 * sweep avoid re-probing contacts it already checked, and backs the recurring
 * "Accounts you might like to follow" widget (including its snooze state).
 *
 * Mirrors the {@link import('./feeds.js').default} persistence pattern.
 * @extends {Collection<FollowableContact>}
 */
declare class FollowableCache extends Collection<FollowableContact> {
    constructor(models?: import("@converse/skeletor").ModelAttributes | import("@converse/skeletor").ModelAttributes[] | FollowableContact | FollowableContact[], options?: import("@converse/skeletor").CollectionOptions<FollowableContact>);
    get model(): typeof FollowableContact;
    initialize(): void;
    /**
     * Whether this JID has been snoozed by the user.
     * @param {string} jid
     * @returns {boolean}
     */
    isSnoozed(jid: string): boolean;
    /**
     * Upsert a probe verdict.
     * @param {string} jid
     * @param {{ followable: boolean, latest?: string|null }} verdict
     */
    record(jid: string, { followable, latest }: {
        followable: boolean;
        latest?: string | null;
    }): void;
    /**
     * The bare JIDs known followable and not snoozed.
     * @returns {string[]}
     */
    candidates(): string[];
    /**
     * Snooze the given JIDs so they stop being suggested until a *new* candidate
     * is discovered. Creates a cache entry for JIDs not probed yet (e.g. an
     * online-caps hit), so the snooze sticks.
     * @param {string[]} jids
     */
    snooze(jids: string[]): void;
}
import { Collection } from '@converse/skeletor';
//# sourceMappingURL=followable.d.ts.map