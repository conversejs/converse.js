/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api, log } from '@converse/headless';
import { SignalWatcher } from '@lit-labs/signals';
import { CustomElement } from 'shared/components/element.js';
import { collectionSignal } from 'shared/signals.js';
import tplFeed from './templates/feed.js';

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
        this.posts = collectionSignal(this.model.messages);
        this.requestUpdate();
        // Backfill history from the node (best-effort; live items arrive via PEP).
        this.model.fetchPosts();
    }

    render() {
        if (!this.model) return '';
        return tplFeed(this);
    }
}

api.elements.define('converse-social-feed', SocialFeed);
