declare const SocialFeed_base: typeof CustomElement & (new (...args: any[]) => import("@lit-labs/signals").SignalWatcherApi);
/**
 * Renders the social timeline: a compose box plus the merged list of posts from
 * the user's own feed and every feed they follow, newest-first.
 *
 * This is the reference adoption of TC39 Signals in a Converse component:
 * `SignalWatcher` auto-tracks the `aggregatedCollectionSignal` read during
 * render, so the timeline re-renders precisely when a feed is followed/unfollowed
 * or any feed gains/loses a post — no manual `listenTo(... 'add remove')` +
 * `requestUpdate()` wiring.
 *
 * @param {string} [jid] attribute — the compose feed's JID; defaults to the
 *      user's own. (The timeline itself always aggregates all feeds.)
 */
export default class SocialFeed extends SocialFeed_base {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    /** @type {import('@converse/headless').PubSubFeed} */
    model: import("@converse/headless").PubSubFeed;
    posts: import("@lit-labs/signals").Signal.Computed<import("@converse/skeletor").Model<import("@converse/skeletor").ModelAttributes>[]>;
    initialize(): Promise<void>;
    render(): import("lit-html").TemplateResult<1> | "";
}
import { CustomElement } from 'shared/components/element.js';
export {};
//# sourceMappingURL=feed.d.ts.map