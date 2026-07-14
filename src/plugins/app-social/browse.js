/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api, log } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { isURLRoutingEnabled } from '../rootview/routing.js';
import { buildSocialRoute } from './routing.js';
import tplBrowse from './templates/browse.js';

// A single "Browse" / "Load more" click fetches at most this many disco#items
// pages while skipping past comment-only pages (which yield no feeds and cost no
// info probes). Bounds the round-trips per click; if we hit it with more pages
// left, the "Load more" button stays so the user can keep going.
const MAX_PAGES_PER_LOAD = 10;

/**
 * The "Browse a service" control in the Discover modal: the user types a pubsub
 * service JID (e.g. a community/news server), and this lists the feed nodes hosted
 * there ({@link _converse.api.microblog.browseFeeds}) so they can follow one
 * without knowing its node id. The listing is RSM-paged: each browse/"Load more"
 * appends the next page. Feeds (Atom nodes) show by default; a toggle reveals the
 * service's other nodes.
 */
export default class SocialBrowse extends CustomElement {
    constructor() {
        super();
        /** @type {string} */
        this.service = '';
        this.browsing = false;
        this.loading_more = false;
        /** @type {import('./types').BrowsableFeed[]} */
        this.results = [];
        /** @type {string|null} */
        this.cursor = null;
        this.has_more = false;
        /** @type {string|null} */
        this.error = null;
        this.show_all = false;
        /** @type {AbortController|null} */
        this.abort = null;
        // Dedupe accumulated feeds across pages, keyed `${jid}/${node}`.
        /** @type {Set<string>} */
        this.seen = new Set();
        // Per-row follow status, keyed `${jid}/${node}`: 'pending' | 'done' | 'error'.
        /** @type {Map<string, string>} */
        this.follow_state = new Map();
    }

    render() {
        return tplBrowse(this);
    }

    get busy() {
        return this.browsing || this.loading_more;
    }

    /**
     * @param {Event} ev
     */
    onServiceInput(ev) {
        this.service = /** @type {HTMLInputElement} */ (ev.target).value;
        this.requestUpdate();
    }

    /**
     * Start a fresh browse from the first page.
     * @param {Event} [ev]
     */
    async browse(ev) {
        ev?.preventDefault();
        if (this.busy || !this.service.trim()) return;
        this.results = [];
        this.seen = new Set();
        this.cursor = null;
        this.has_more = false;
        this.error = null;
        this.follow_state.clear();
        await this.fetchFrom(undefined, 'browsing');
    }

    /** Append the next page(s). */
    async loadMore() {
        if (this.busy || !this.has_more) return;
        await this.fetchFrom(this.cursor, 'loading_more');
    }

    /**
     * Fetch pages from the given RSM cursor, appending new feeds. Skips past
     * comment-only pages (they yield no feeds) so a click surfaces something to
     * show, but stops at MAX_PAGES_PER_LOAD so the round-trips stay bounded.
     * @param {string|undefined} after
     * @param {'browsing'|'loading_more'} flag
     */
    async fetchFrom(after, flag) {
        // The controller doubles as an ownership token (as in SocialScan): once
        // it's no longer `this.abort`, this run's callbacks stop driving the UI.
        const controller = new AbortController();
        this.abort = controller;
        this[flag] = true;
        this.requestUpdate();
        try {
            let cursor = after;
            let added_any = false;
            let pages = 0;
            do {
                const { feeds, cursor: next, has_more } = await api.microblog.browseFeeds(this.service.trim(), {
                    after: cursor,
                    signal: controller.signal,
                });
                if (this.abort !== controller) return;
                for (const feed of feeds) {
                    const key = `${feed.jid}/${feed.node}`;
                    if (this.seen.has(key)) continue;
                    this.seen.add(key);
                    this.results.push(feed);
                    added_any = true;
                }
                cursor = next;
                this.cursor = next;
                this.has_more = has_more;
                pages++;
                this.requestUpdate();
            } while (this.has_more && !added_any && pages < MAX_PAGES_PER_LOAD && this.abort === controller);
        } catch (e) {
            if (this.abort !== controller) return;
            log.error(e);
            this.error =
                /** @type {Error} */ (e)?.name === 'InvalidFeedAddress'
                    ? __('Please enter a valid service address')
                    : __('Could not browse that service');
        } finally {
            if (this.abort === controller) {
                this[flag] = false;
                this.abort = null;
                this.requestUpdate();
            }
        }
    }

    cancel() {
        this.abort?.abort();
        this.abort = null;
        this.browsing = false;
        this.loading_more = false;
        this.requestUpdate();
    }

    toggleShowAll() {
        this.show_all = !this.show_all;
        this.requestUpdate();
    }

    /**
     * The in-app URL (hash route) for a feed's read-only view, so each row is a
     * real link that can be middle-/⌘-clicked into a new tab. Only meaningful
     * when URL routing is on: otherwise the app's state isn't in the URL, so a
     * new tab couldn't restore it, and we render a plain button instead.
     * @param {import('./types').BrowsableFeed} feed
     * @returns {string|undefined}
     */
    hrefFor(feed) {
        if (!isURLRoutingEnabled()) return undefined;
        return buildSocialRoute({ view: 'profile', jid: feed.jid, node: feed.node }) ?? undefined;
    }

    /**
     * Open a browsed node in the Social app's read-only ("browse") feed view,
     * without following it (the same detached, in-memory feed the profile view
     * shows for a feed we don't follow). The Discover modal renders in the modal
     * portal, outside the Social app, so a `profileselected`-style event can't
     * bubble to it; we dispatch `feedselected` and let the modal bridge it over
     * the event bus (and close itself).
     *
     * A modifier/middle click is left for the browser to open in a new tab via
     * the row's `href` (a bare middle-click fires `auxclick`, not `click`, so it
     * never reaches here at all); only a plain click opens the feed in place.
     * @param {import('./types').BrowsableFeed} feed
     * @param {MouseEvent} [ev]
     */
    openFeed(feed, ev) {
        if (ev && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button > 0)) return;
        ev?.preventDefault();
        this.dispatchEvent(
            new CustomEvent('feedselected', {
                bubbles: true,
                composed: true,
                detail: { jid: feed.jid, node: feed.node },
            }),
        );
    }

    /**
     * Keyboard activation for a row: Enter/Space opens the feed in place, matching
     * a plain click. `preventDefault` stops an `<a>`'s native activation (and
     * Space from scrolling) so it doesn't also fire a synthesized click.
     * @param {KeyboardEvent} ev
     * @param {import('./types').BrowsableFeed} feed
     */
    onRowKeydown(ev, feed) {
        if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            this.openFeed(feed);
        }
    }

    /**
     * Follow one browsed node, tracking a per-row status so the button reflects
     * progress and failure without disturbing the rest of the list.
     * @param {import('./types').BrowsableFeed} feed
     */
    async follow(feed) {
        const key = `${feed.jid}/${feed.node}`;
        if (this.follow_state.get(key) === 'pending' || api.microblog.isFollowing(feed.jid, feed.node)) return;
        this.follow_state.set(key, 'pending');
        this.requestUpdate();
        try {
            await api.microblog.follow(feed.jid, { node: feed.node, title: feed.title || feed.name });
            this.follow_state.set(key, 'done');
            api.toast.show('feed-followed', { type: 'success', body: __('Now following this feed') });
        } catch (e) {
            log.error(e);
            this.follow_state.set(key, 'error');
        }
        this.requestUpdate();
    }
}

api.elements.define('converse-social-browse', SocialBrowse);
