/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { _converse, api, log } from '@converse/headless';
import { SignalWatcher } from '@lit-labs/signals';
import { CustomElement } from 'shared/components/element.js';
import { aggregatedCollectionSignal } from 'shared/signals.js';
import { postMatchesHashtag } from './texture.js';
import tplFeed from './templates/feed.js';

/** Sort posts newest-first by their ISO-8601 `time` (published/updated). */
const byTimeDesc = (a, b) => (b.get('time') ?? '').localeCompare(a.get('time') ?? '');

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
export default class SocialFeed extends SignalWatcher(CustomElement) {
    static get properties() {
        return {
            jid: { type: String },
            // The active hashtag filter (without the leading `#`), or null for the
            // full timeline. A reactive property, so setting it re-renders.
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
        // Clicking a hashtag (rendered in a post body) bubbles up to here; filter
        // the timeline to posts carrying that tag until the user clears it.
        this.addEventListener('hashtagselected', (ev) => {
            this.filter = /** @type {CustomEvent} */ (ev).detail.tag;
        });

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

    /** Clear the active hashtag filter and return to the full timeline. */
    clearFilter() {
        this.filter = null;
    }

    render() {
        if (!this.model) return '';
        return tplFeed(this);
    }
}

api.elements.define('converse-social-feed', SocialFeed);
