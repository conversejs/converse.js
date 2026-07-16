/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { _converse, api, converse, log } from '@converse/headless';
import { __ } from 'i18n';
import { collectionSignal } from 'shared/signals.js';
import { WindowedListElement } from './windowed.js';
import 'shared/components/logo.js';
import 'shared/components/dropdown.js';
import './following.js';
import tplProfile from './templates/profile.js';
import { MICROBLOG_NODE } from './constants.js';

const { Strophe } = converse.env;

/**
 * An author's profile view, or a followed community feed (when {@link node} is
 * not the microblog node). A header above the feed, newest-first. `SignalWatcher`
 * auto-tracks the `collectionSignal` over the feed's messages, so the post list
 * re-renders as posts are backfilled or pushed live. Only a window of the feed
 * is in the DOM at a time (see {@link WindowedListElement}).
 */
export default class SocialProfile extends WindowedListElement {
    static get properties() {
        return {
            ...super.properties,
            jid: { type: String },
            node: { type: String },
            tab: { type: String },
            _busy: { type: Boolean, state: true },
            _loaded: { type: Boolean, state: true },
            _banner_error: { type: Boolean, state: true },
            _following_count: { type: Number, state: true },
        };
    }

    constructor() {
        super();
        this.jid = null;
        this.node = MICROBLOG_NODE;
        this.tab = 'posts';
        /** @type {import('@converse/headless').MicroblogProfile} */
        this.profile = null;
        /** @type {import('@converse/headless').PubSubFeed} */
        this.feed = null;
        this.posts = null;
        this._busy = false;
        this._loaded = false;
        this._banner_error = false;
        this._following_count = null;
    }

    async initialize() {
        this.profile = api.microblog.profile.get(this.jid);

        this.listenTo(this.profile, 'vcard:add', () => this.requestUpdate());
        this.listenTo(this.profile, 'vcard:change', () => this.requestUpdate());
        this.listenTo(this.profile, 'contact:add', () => this.requestUpdate());
        this.listenTo(this.profile, 'contact:change', () => this.requestUpdate());

        // Fetch the author's banner and re-render if one resolves.
        this.listenTo(this.profile, 'change:banner_url', () => {
            this._banner_error = false;
            this.requestUpdate();
        });
        this.profile.fetchBanner();

        // Re-render the follow toggle when the follow list changes
        this.listenTo(_converse.state.following, 'add', () => this.requestUpdate());
        this.listenTo(_converse.state.following, 'remove', () => this.requestUpdate());

        // Re-render the "Add to contacts" menu item as the roster changes
        if (_converse.state.roster) {
            this.listenTo(_converse.state.roster, 'add', () => this.requestUpdate());
            this.listenTo(_converse.state.roster, 'remove', () => this.requestUpdate());
        }

        // Best-effort "Following · N" count for another author (our own comes
        // from the live mirror; see {@link followingCount}). A community feed
        // isn't a person, so it has no follow list.
        if (!this.isOwn && !this.isFeed) this.fetchFollowingCount();

        await this.setupFeed();
    }

    /**
     * Whether this is a followed community/topic feed (a non-microblog node)
     * rather than a person's profile. Feed mode drops the person-only chrome
     * (message, add-contact, following tab) and labels the header by the node.
     * @returns {boolean}
     */
    get isFeed() {
        return !!this.node && this.node !== MICROBLOG_NODE;
    }

    /**
     * Read the author's follow-list count once (best-effort). Their XEP-0330 node
     * is presence-access, so this is refused for strangers; on any failure the
     * count stays null and the "Following" link is simply hidden.
     * @returns {Promise<void>}
     */
    async fetchFollowingCount() {
        try {
            const list = await api.microblog.following(this.jid);
            this._following_count = list.length;
        } catch {
            this._following_count = null;
        }
    }

    /**
     * How many accounts this author follows. Our own is the live mirror (reactive
     * to follow/unfollow); another author's is the fetched snapshot.
     * @returns {number}
     */
    get followingCount() {
        return this.isOwn ? (_converse.state.following?.length ?? 0) : (this._following_count ?? 0);
    }

    /**
     * Resolve the feed backing the post list (shared feed when we follow
     * the author, a detached browse-only feed otherwise) and backfill it. The
     * backfill is awaited so the empty state can distinguish an author with no
     * posts from one whose feed we're not allowed to read (see {@link accessDenied}).
     * @returns {Promise<void>}
     */
    async setupFeed() {
        let feed;
        try {
            feed = await api.microblog.profile.getFeed(this.jid, this.node);
        } catch (e) {
            log.error(e);
            this._loaded = true;
            return;
        }

        const previous = this.feed;
        if (previous && previous !== feed) {
            // Following (or unfollowing) swaps the detached browse feed for the
            // shared, live one (or vice versa). Seed the newly-resolved feed with
            // the posts we already have so the list doesn't blank while the new
            // feed backfills in the background.
            await feed.messages.hydrated;
            if (!feed.messages.length && previous.getPosts().length) {
                feed.messages.add(
                    previous.getPosts().map((m) => ({ ...m.attributes })),
                    { merge: true },
                );
            }
            this.stopListening(previous);
        }

        this.feed = feed;
        this.posts = collectionSignal(this.feed.messages);
        // Only show the loading placeholder when there's nothing to show yet, so a
        // re-point after follow (or a warm cache) doesn't flash "Loading…".
        this._loaded = this.feed.messages.length > 0;

        // Re-render if the fetch outcome changes (e.g. a later refetch is refused).
        this.listenTo(this.feed, 'change:fetch_error', () => this.requestUpdate());
        this.requestUpdate();

        try {
            await this.feed.fetchPosts();
        } finally {
            this._loaded = true;
        }
    }

    /**
     * Whether this is the logged-in user's own profile (no follow toggle).
     * @returns {boolean}
     */
    get isOwn() {
        return Strophe.getBareJidFromJid(this.jid) === _converse.session.get('bare_jid');
    }

    /**
     * Whether we currently follow this author (or community feed).
     * @returns {boolean}
     */
    get isFollowing() {
        return api.microblog.isFollowing(this.jid, this.node);
    }

    /**
     * The author's posts, newest-first.
     * Reading the signal here keeps it auto-tracked by `SignalWatcher`.
     * @returns {import('@converse/headless').PubSubMessage[]}
     */
    get authorPosts() {
        return /** @type {import('@converse/headless').PubSubMessage[]} */ (this.posts?.get() ?? []);
    }

    /**
     * The full post list the render window slides over (see {@link WindowedListElement}).
     * Empty on the "Following" tab, which renders a different list entirely.
     * @returns {import('@converse/headless').PubSubMessage[]}
     */
    get virtualizedItems() {
        return this.tab === 'following' && !this.isFeed ? [] : this.authorPosts;
    }

    /** @returns {HTMLElement|null} */
    get itemsContainer() {
        return this.querySelector('.social-profile__posts');
    }

    /**
     * @param {import('lit').PropertyValues} changed
     */
    willUpdate(changed) {
        if (changed.has('tab') && this.hasUpdated) this.resetWindow();

        super.willUpdate(changed);
    }

    /**
     * Whether the backfill was refused because we're not allowed to read this feed
     * @returns {boolean}
     */
    get accessDenied() {
        const err = this.feed?.get('fetch_error');
        return err === 'forbidden' || err === 'not-authorized';
    }

    /**
     * Whether the author is already in our roster (so we hide "Add to contacts").
     * @returns {boolean}
     */
    get isContact() {
        return !!_converse.state.roster?.get(Strophe.getBareJidFromJid(this.jid));
    }

    render() {
        if (!this.jid || !this.profile) return '';
        return tplProfile(this);
    }

    /**
     * The banner image failed to load (e.g. a dead link / 404). Fall back to the
     * logo watermark rather than leave a broken-image placeholder in the header.
     */
    onBannerError() {
        if (!this._banner_error) this._banner_error = true;
    }

    /** Return to the timeline. */
    goBack() {
        this.dispatchEvent(new CustomEvent('closeprofile', { bubbles: true, composed: true }));
    }

    /**
     * Switch between this profile's "Posts" and "Following" tabs. SocialApp owns
     * the tab (so it's routable), so we bubble the choice up rather than set it here.
     * @param {'posts'|'following'} tab
     */
    onTab(tab) {
        if (tab === this.tab) return;
        this.dispatchEvent(new CustomEvent('profiletab', { detail: { tab }, bubbles: true, composed: true }));
    }

    /**
     * Open a 1:1 chat with the author and switch to the Chat app.
     * @param {Event} [ev]
     */
    async onMessage(ev) {
        ev?.preventDefault?.();
        await api.chats.open(this.jid, {}, true);
        api.apps.switch('chat');
    }

    /**
     * Add the author to the roster (a chat contact). Opens the add-contact modal
     * pre-filled with their address so the user can confirm / name them.
     * @param {Event} [ev]
     */
    onAddContact(ev) {
        ev?.preventDefault?.();
        api.modal.show('converse-add-contact-modal', { contact: this.profile }, ev);
    }

    /**
     * Edit the logged-in user's own profile (avatar, nickname). Reuses the
     * existing profile modal, opened on its "Profile" tab.
     * @param {Event} [ev]
     */
    onEditProfile(ev) {
        ev?.preventDefault?.();
        api.modal.show('converse-profile-modal', { model: _converse.state.profile, tab: 'profile' }, ev);
    }

    /**
     * Follow or unfollow this author. The button is disabled while in flight so a
     * double-click can't fire two follows. On success the feed is re-resolved so
     * the post list re-points to the now-shared (or, after unfollow, detached) feed.
     */
    async onToggleFollow() {
        if (this._busy) return;
        this._busy = true;
        const following = this.isFollowing;
        try {
            await (following
                ? api.microblog.unfollow(this.jid, { node: this.node })
                : api.microblog.follow(this.jid, { node: this.node }));
            // Re-run after a follow/unfollow so the view re-points to
            // whichever feed now holds the author's posts.
            await this.setupFeed();
        } catch (e) {
            log.error(e);
            api.toast.show('follow-failed', {
                type: 'danger',
                body: following ? __('Sorry, could not unfollow') : __('Sorry, could not follow'),
            });
        } finally {
            this._busy = false;
            this.requestUpdate();
        }
    }
}

api.elements.define('converse-social-profile', SocialProfile);
