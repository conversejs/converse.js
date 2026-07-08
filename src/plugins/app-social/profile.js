/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { _converse, api, converse, log } from '@converse/headless';
import { SignalWatcher } from '@lit-labs/signals';
import { __ } from 'i18n';
import { CustomElement } from 'shared/components/element.js';
import { collectionSignal } from 'shared/signals.js';
import tplProfile from './templates/profile.js';

const { Strophe } = converse.env;

/**
 * An author's profile view. A header above that author's feed, newest-first.
 * `SignalWatcher` auto-tracks the `collectionSignal` over the profile feed's
 * messages, so the post list re-renders as posts are backfilled or pushed live.
 */
export default class SocialProfile extends SignalWatcher(CustomElement) {
    static get properties() {
        return {
            jid: { type: String },
            _busy: { type: Boolean, state: true },
            // Whether the initial post backfill has settled. Until then we hold
            // off on the "no posts" / "not public" empty states.
            _loaded: { type: Boolean, state: true },
        };
    }

    constructor() {
        super();
        this.jid = null;
        /** @type {import('@converse/headless').MicroblogProfile} */
        this.profile = null;
        /** @type {import('@converse/headless').PubSubFeed} */
        this.feed = null;
        this.posts = null;
        this._busy = false;
        this._loaded = false;
    }

    async initialize() {
        this.profile = api.microblog.profile.get(this.jid);

        // Re-render when the author's vCard/contact (avatar, display name) resolves.
        this.listenTo(this.profile, 'vcard:add', () => this.requestUpdate());
        this.listenTo(this.profile, 'vcard:change', () => this.requestUpdate());
        this.listenTo(this.profile, 'contact:add', () => this.requestUpdate());
        this.listenTo(this.profile, 'contact:change', () => this.requestUpdate());

        // Re-render the follow toggle when the follow list (isFollowing's source
        // of truth) changes, e.g. a follow/unfollow from elsewhere.
        this.listenTo(_converse.state.following, 'add', () => this.requestUpdate());
        this.listenTo(_converse.state.following, 'remove', () => this.requestUpdate());

        await this.setupFeed();
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
            feed = await api.microblog.profile.getFeed(this.jid);
        } catch (e) {
            log.error(e);
            this._loaded = true;
            return;
        }

        if (this.feed) this.stopListening(this.feed);

        this.feed = feed;
        this.posts = collectionSignal(this.feed.messages);
        this._loaded = false;

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
     * Whether we currently follow this author.
     * @returns {boolean}
     */
    get isFollowing() {
        return api.microblog.isFollowing(this.jid);
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
     * Whether the backfill was refused because we're not allowed to read this feed
     * @returns {boolean}
     */
    get accessDenied() {
        const err = this.feed?.get('fetch_error');
        return err === 'forbidden' || err === 'not-authorized';
    }

    render() {
        if (!this.jid || !this.profile) return '';
        return tplProfile(this);
    }

    /** Return to the timeline. */
    goBack() {
        this.dispatchEvent(new CustomEvent('closeprofile', { bubbles: true, composed: true }));
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
            await (following ? api.microblog.unfollow(this.jid) : api.microblog.follow(this.jid));
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
