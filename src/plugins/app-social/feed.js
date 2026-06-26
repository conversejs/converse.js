/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { _converse, api, log } from '@converse/headless';
import { SignalWatcher } from '@lit-labs/signals';
import { CustomElement } from 'shared/components/element.js';
import { aggregatedCollectionSignal } from 'shared/signals.js';
import tplFeed from './templates/feed.js';

/** Sort posts newest-first by their ISO-8601 `time` (published/updated). */
const byTimeDesc = (a, b) => (b.get('time') ?? '').localeCompare(a.get('time') ?? '');

/**
 * Renders the social timeline: a compose box plus the merged list of posts from
 * the user's own feed and every feed they follow, newest-first.
 *
 * This is the reference adoption of TC39 Signals in a Converse component:
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
        };
    }

    constructor() {
        super();
        this.jid = null;
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
        // The timeline is the union of the own feed and every followed feed,
        // newest-first. Under the no-firehose model every feed in the collection
        // is own-or-followed (strict PEP routing creates no others), so
        // aggregating all of them is exactly the timeline.
        this.posts = aggregatedCollectionSignal(_converse.state.pubsubfeeds, (f) => f.messages, byTimeDesc);
        this.requestUpdate();
        // Materialise + backfill the own feed and every followed feed (including
        // follows made on other devices, via the durable XEP-0330 list).
        // Idempotent, so it's safe to call on every mount.
        api.microblog.initFollowing();
    }

    render() {
        if (!this.model) return '';
        return tplFeed(this);
    }
}

api.elements.define('converse-social-feed', SocialFeed);
