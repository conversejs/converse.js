declare const SocialProfile_base: typeof CustomElement & (new (...args: any[]) => import("@lit-labs/signals").SignalWatcherApi);
/**
 * An author's profile view: a header (avatar, display name, JID and a
 * follow/unfollow toggle) above that author's microblog posts, newest-first.
 * Opened by clicking a post author's avatar or name; the back button returns to
 * the timeline.
 *
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
    };
    jid: any;
    /** @type {import('@converse/headless').MicroblogProfile} */
    profile: import("@converse/headless").MicroblogProfile;
    /** @type {import('@converse/headless').PubSubFeed} */
    feed: import("@converse/headless").PubSubFeed;
    posts: import("@lit-labs/signals").Signal.State<import("@converse/skeletor").Model<import("@converse/skeletor").ModelAttributes>[]>;
    _busy: boolean;
    initialize(): Promise<void>;
    /**
     * Resolve the feed backing the post list — the shared feed when we follow
     * the author (or it's us), a detached browse-only feed otherwise — and
     * backfill it. Re-run after a follow/unfollow so the view re-points to
     * whichever feed now holds the author's posts.
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
     * The author's posts, newest-first (may include paging placeholders, which
     * the template renders distinctly). Reading the signal here keeps it
     * auto-tracked by `SignalWatcher`.
     * @returns {import('@converse/headless').PubSubMessage[]}
     */
    get authorPosts(): import("@converse/headless").PubSubMessage[];
    render(): import("lit-html").TemplateResult<1> | "";
    /** Return to the timeline. */
    goBack(): void;
    /**
     * Follow or unfollow this author. The button is disabled while in flight so a
     * double-click can't fire two follows. On success the feed is re-resolved so
     * the post list re-points to the now-shared (or, after unfollow, detached)
     * feed.
     */
    onToggleFollow(): Promise<void>;
}
import { CustomElement } from 'shared/components/element.js';
export {};
//# sourceMappingURL=profile.d.ts.map