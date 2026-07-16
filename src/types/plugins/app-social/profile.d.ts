declare const SocialProfile_base: typeof CustomElement & (new (...args: any[]) => import("@lit-labs/signals").SignalWatcherApi);
/**
 * An author's profile view, or a followed community feed (when {@link node} is
 * not the microblog node). A header above the feed, newest-first. `SignalWatcher`
 * auto-tracks the `collectionSignal` over the feed's messages, so the post list
 * re-renders as posts are backfilled or pushed live.
 */
export default class SocialProfile extends SocialProfile_base {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
        node: {
            type: StringConstructor;
        };
        tab: {
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
        _banner_error: {
            type: BooleanConstructor;
            state: boolean;
        };
        _following_count: {
            type: NumberConstructor;
            state: boolean;
        };
    };
    jid: any;
    node: string;
    tab: string;
    /** @type {import('@converse/headless').MicroblogProfile} */
    profile: import("@converse/headless").MicroblogProfile;
    /** @type {import('@converse/headless').PubSubFeed} */
    feed: import("@converse/headless").PubSubFeed;
    posts: import("signal-polyfill").Signal.State<import("@converse/skeletor").Model<import("@converse/skeletor").ModelAttributes>[]>;
    _busy: boolean;
    _loaded: boolean;
    _banner_error: boolean;
    _following_count: any;
    initialize(): Promise<void>;
    /**
     * Whether this is a followed community/topic feed (a non-microblog node)
     * rather than a person's profile. Feed mode drops the person-only chrome
     * (message, add-contact, following tab) and labels the header by the node.
     * @returns {boolean}
     */
    get isFeed(): boolean;
    /**
     * Read the author's follow-list count once (best-effort). Their XEP-0330 node
     * is presence-access, so this is refused for strangers; on any failure the
     * count stays null and the "Following" link is simply hidden.
     * @returns {Promise<void>}
     */
    fetchFollowingCount(): Promise<void>;
    /**
     * How many accounts this author follows. Our own is the live mirror (reactive
     * to follow/unfollow); another author's is the fetched snapshot.
     * @returns {number}
     */
    get followingCount(): number;
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
     * Whether we currently follow this author (or community feed).
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
    /**
     * Whether the author is already in our roster (so we hide "Add to contacts").
     * @returns {boolean}
     */
    get isContact(): boolean;
    render(): import("lit-html").TemplateResult<1> | "";
    /**
     * The banner image failed to load (e.g. a dead link / 404). Fall back to the
     * logo watermark rather than leave a broken-image placeholder in the header.
     */
    onBannerError(): void;
    /** Return to the timeline. */
    goBack(): void;
    /**
     * Switch between this profile's "Posts" and "Following" tabs. SocialApp owns
     * the tab (so it's routable), so we bubble the choice up rather than set it here.
     * @param {'posts'|'following'} tab
     */
    onTab(tab: "posts" | "following"): void;
    /**
     * Open a 1:1 chat with the author and switch to the Chat app.
     * @param {Event} [ev]
     */
    onMessage(ev?: Event): Promise<void>;
    /**
     * Add the author to the roster (a chat contact). Opens the add-contact modal
     * pre-filled with their address so the user can confirm / name them.
     * @param {Event} [ev]
     */
    onAddContact(ev?: Event): void;
    /**
     * Edit the logged-in user's own profile (avatar, nickname). Reuses the
     * existing profile modal, opened on its "Profile" tab.
     * @param {Event} [ev]
     */
    onEditProfile(ev?: Event): void;
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