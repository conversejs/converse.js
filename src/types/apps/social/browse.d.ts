/**
 * The "Browse a service" control in the Discover modal: the user types a pubsub
 * service JID (e.g. a community/news server), and this lists the feed nodes hosted
 * there ({@link _converse.api.microblog.browseFeeds}) so they can follow one
 * without knowing its node id. The listing is RSM-paged: each browse/"Load more"
 * appends the next page. Feeds (Atom nodes) show by default; a toggle reveals the
 * service's other nodes.
 */
export default class SocialBrowse extends CustomElement {
    /** @type {string} */
    service: string;
    browsing: boolean;
    loading_more: boolean;
    /** @type {import('./types').BrowsableFeed[]} */
    results: import("./types").BrowsableFeed[];
    /** @type {string|null} */
    cursor: string | null;
    has_more: boolean;
    /** @type {string|null} */
    error: string | null;
    show_all: boolean;
    /** @type {AbortController|null} */
    abort: AbortController | null;
    /** @type {Set<string>} */
    seen: Set<string>;
    /** @type {Map<string, string>} */
    follow_state: Map<string, string>;
    render(): import("lit-html").TemplateResult<1>;
    get busy(): boolean;
    /**
     * @param {Event} ev
     */
    onServiceInput(ev: Event): void;
    /**
     * Start a fresh browse from the first page.
     * @param {Event} [ev]
     */
    browse(ev?: Event): Promise<void>;
    /** Append the next page(s). */
    loadMore(): Promise<void>;
    /**
     * Fetch pages from the given RSM cursor, appending new feeds. Skips past
     * comment-only pages (they yield no feeds) so a click surfaces something to
     * show, but stops at MAX_PAGES_PER_LOAD so the round-trips stay bounded.
     * @param {string|undefined} after
     * @param {'browsing'|'loading_more'} flag
     */
    fetchFrom(after: string | undefined, flag: "browsing" | "loading_more"): Promise<void>;
    cancel(): void;
    toggleShowAll(): void;
    /**
     * The in-app URL (hash route) for a feed's read-only view, so each row is a
     * real link that can be middle-/⌘-clicked into a new tab. Only meaningful
     * when URL routing is on: otherwise the app's state isn't in the URL, so a
     * new tab couldn't restore it, and we render a plain button instead.
     * @param {import('./types').BrowsableFeed} feed
     * @returns {string|undefined}
     */
    hrefFor(feed: import("./types").BrowsableFeed): string | undefined;
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
    openFeed(feed: import("./types").BrowsableFeed, ev?: MouseEvent): void;
    /**
     * Keyboard activation for a row: Enter/Space opens the feed in place, matching
     * a plain click. `preventDefault` stops an `<a>`'s native activation (and
     * Space from scrolling) so it doesn't also fire a synthesized click.
     * @param {KeyboardEvent} ev
     * @param {import('./types').BrowsableFeed} feed
     */
    onRowKeydown(ev: KeyboardEvent, feed: import("./types").BrowsableFeed): void;
    /**
     * Follow one browsed node, tracking a per-row status so the button reflects
     * progress and failure without disturbing the rest of the list.
     * @param {import('./types').BrowsableFeed} feed
     */
    follow(feed: import("./types").BrowsableFeed): Promise<void>;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=browse.d.ts.map