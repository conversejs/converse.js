declare const SocialFeed_base: typeof CustomElement & (new (...args: any[]) => import("@lit-labs/signals").SignalWatcherApi);
/**
 * Renders a microblog feed: a compose box plus the list of posts.
 *
 * This is the reference adoption of TC39 Signals in a Converse component:
 * `SignalWatcher` auto-tracks the `collectionSignal` read during render, so the
 * post list re-renders precisely when posts are added/removed/reset — no manual
 * `listenTo(... 'add remove')` + `requestUpdate()` wiring.
 *
 * @param {string} [jid] attribute — the feed JID; defaults to the user's own.
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
    posts: import("@lit-labs/signals").Signal.State<import("@converse/skeletor").Model<import("@converse/skeletor").ModelAttributes>[]>;
    initialize(): Promise<void>;
    render(): import("lit-html").TemplateResult<1> | "";
}
import { CustomElement } from 'shared/components/element.js';
export {};
//# sourceMappingURL=feed.d.ts.map