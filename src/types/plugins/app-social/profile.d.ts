declare const SocialProfile_base: typeof CustomElement & (new (...args: any[]) => import("@lit-labs/signals").SignalWatcherApi);
/**
 * An author's profile view. A header above that author's feed, newest-first.
 * `SignalWatcher` auto-tracks the `collectionSignal` over the profile feed's
 * messages, so the post list re-renders as posts are backfilled or pushed live.
 */
export default class SocialProfile extends SocialProfile_base {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
        _busy: {
            type: BooleanConstructor;
            state: boolean;
        };
        _loaded: {
            type: BooleanConstructor;
            state: boolean;
        };
    };
    jid: any;
    /** @type {import('@converse/headless').MicroblogProfile} */
    profile: import("@converse/headless").MicroblogProfile;
    /** @type {import('@converse/headless').PubSubFeed} */
    feed: import("@converse/headless").PubSubFeed;
    posts: import("@lit-labs/signals").Signal.State<import("@converse/skeletor").Model<import("@converse/skeletor").ModelAttributes>[]>;
    _busy: boolean;
    _loaded: boolean;
    initialize(): Promise<void>;
    /**
     * Resolve the feed backing the post list (shared feed when we follow
     * the author, a detached browse-only feed otherwise) and backfill it. The
     * backfill is awaited so the empty state can distinguish an author with no
     * posts from one whose feed we're not allowed to read (see {@link accessDenied}).
     * @returns {Promise<void>}
     */
    setupFeed(): Promise<void>;
    /**
     * Whether this is the logged-in user's own profile (no follow toggle).
     * @returns {boolean}
     */
    get isOwn(): boolean;
    /**
     * Whether we currently follow this author.
     * @returns {boolean}
     */
    get isFollowing(): boolean;
    /**
     * The author's posts, newest-first.
     * Reading the signal here keeps it auto-tracked by `SignalWatcher`.
     * @returns {import('@converse/headless').PubSubMessage[]}
     */
    get authorPosts(): import("@converse/headless").PubSubMessage[];
    /**
     * Whether the backfill was refused because we're not allowed to read this feed
     * @returns {boolean}
     */
    get accessDenied(): boolean;
    render(): import("lit-html").TemplateResult<1> | "";
    /** Return to the timeline. */
    goBack(): void;
    /**
     * Follow or unfollow this author. The button is disabled while in flight so a
     * double-click can't fire two follows. On success the feed is re-resolved so
     * the post list re-points to the now-shared (or, after unfollow, detached) feed.
     */
    onToggleFollow(): Promise<void>;
}
import { CustomElement } from 'shared/components/element.js';
export {};
//# sourceMappingURL=profile.d.ts.map