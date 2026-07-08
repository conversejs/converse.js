declare const SocialFeed_base: typeof CustomElement & (new (...args: any[]) => import("@lit-labs/signals").SignalWatcherApi);
/**
 * Renders the social timeline: a compose box plus the merged list of posts from
 * the user's own feed and every feed they follow, newest-first.
 *
 * Also serves as a reference adoption of TC39 Signals in a Converse component:
 * `SignalWatcher` auto-tracks the `aggregatedCollectionSignal` read during
 * render, so the timeline re-renders precisely when a feed is followed/unfollowed
 * or any feed gains/loses a post.
 *
 * @param {string} [jid] attribute — the compose feed's JID; defaults to the
 *      user's own. (The timeline itself always aggregates all feeds.)
 */
export default class SocialFeed extends SocialFeed_base {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
        filter: {
            type: StringConstructor;
        };
    };
    jid: any;
    filter: any;
    /** @type {import('@converse/headless').PubSubFeed} */
    model: import("@converse/headless").PubSubFeed;
    posts: import("@lit-labs/signals").Signal.Computed<import("@converse/skeletor").Model<import("@converse/skeletor").ModelAttributes>[]>;
    initialize(): Promise<void>;
    /**
     * The posts to show. Either the full aggregated timeline, or filtered by a
     * hashtag. * Reading the signal here keeps it auto-tracked by `SignalWatcher`
     * (called from `render`).
     * @returns {import('@converse/headless').PubSubMessage[]}
     */
    get visiblePosts(): import("@converse/headless").PubSubMessage[];
    render(): import("lit-html").TemplateResult<1> | "";
}
import { CustomElement } from 'shared/components/element.js';
export {};
//# sourceMappingURL=feed.d.ts.map