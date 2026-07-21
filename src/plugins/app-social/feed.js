/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { _converse, api, log } from '@converse/headless';
import { aggregatedCollectionSignal } from 'shared/signals.js';
import { postMatchesHashtag } from './texture.js';
import tplFeed from './templates/feed.js';
import { WindowedListElement } from './windowed.js';
import { byTimeDesc } from 'utils/time.js';

/**
 * Renders the social timeline: a compose box plus the merged list of posts from
 * the user's own feed and every feed they follow, newest-first. Only a window
 * of the timeline is in the DOM at a time (see {@link WindowedListElement}).
 *
 * Also serves as a reference adoption of TC39 Signals in a Converse component:
 * `SignalWatcher` auto-tracks the `aggregatedCollectionSignal` read during
 * render, so the timeline re-renders precisely when a feed is followed/unfollowed
 * or any feed gains/loses a post.
 *
 * @param {string} [jid] attribute — the compose feed's JID; defaults to the
 *      user's own. (The timeline itself always aggregates all feeds.)
 */
export default class SocialFeed extends WindowedListElement {
    static get properties() {
        return {
            ...super.properties,
            jid: { type: String },
            // The active hashtag filter (without the leading `#`), or null for the
            // full timeline.
            filter: { type: String },
        };
    }

    constructor() {
        super();
        this.jid = null;
        this.filter = null;
        /** @type {import('@converse/headless').PubSubFeed} */
        this.model = null;
        this.posts = null;
    }

    async initialize() {
        try {
            this.model = await api.microblog.feeds.get(this.jid);
        } catch (e) {
            log.error(e);
            return;
        }
        // The timeline is the union of the own feed and every followed feed, newest-first.
        this.posts = aggregatedCollectionSignal(_converse.state.pubsubfeeds, (f) => f.messages, byTimeDesc);
        this.requestUpdate();

        // Materialise + backfill the own feed and every followed feed.
        // Idempotent, so it's safe to call on every mount.
        api.microblog.initFollowing();
    }

    /**
     * The posts to show. Either the full aggregated timeline, or filtered by a
     * hashtag. * Reading the signal here keeps it auto-tracked by `SignalWatcher`
     * (called from `render`).
     * @returns {import('@converse/headless').PubSubMessage[]}
     */
    get visiblePosts() {
        const posts = /** @type {import('@converse/headless').PubSubMessage[]} */ (this.posts?.get() ?? []);
        return this.filter ? posts.filter((p) => postMatchesHashtag(p, this.filter)) : posts;
    }

    /**
     * The full timeline the render window slides over (see {@link WindowedListElement}).
     * @returns {import('@converse/headless').PubSubMessage[]}
     */
    get virtualizedItems() {
        return this.visiblePosts;
    }

    /** @returns {HTMLElement|null} */
    get itemsContainer() {
        return this.querySelector('.social-feed__posts');
    }

    /**
     * @param {import('lit').PropertyValues} changed
     */
    willUpdate(changed) {
        if (changed.has('filter') && this.hasUpdated) this.resetWindow();

        super.willUpdate(changed);
    }

    render() {
        // `_converse.state.profile` can be torn down a tick before this element is
        // removed, while a `SignalWatcher` recompute still fires one last render;
        // the template dereferences it (the own-feed avatar), so bail rather than
        // throw. In normal operation the profile is always present here.
        if (!this.model || !_converse.state.profile) return '';

        return tplFeed(this);
    }
}

api.elements.define('converse-social-feed', SocialFeed);
