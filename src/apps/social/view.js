import { _converse, api, log } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { HashRouter } from 'plugins/rootview/routing.js';
import { SOCIAL_ROUTE_ROOT, buildSocialRoute, parseSocialRoute } from './routing.js';
import tplSocial from './templates/social.js';
import { MICROBLOG_NODE } from './constants.js';

// A post queued by the desktop-notification click (see requestOpenPost). The
// (re)mounting SocialApp consumes it in connectedCallback and opens that thread.
let pending_open_ref = null;

/**
 * Queue a post to open, then bring the Social app forward. Called via the
 * `openMicroblogPost` event from the desktop-notification click for a comment on
 * one of our posts. By the notification's own visibility gate the app is almost
 * always not mounted, so the intent is consumed when the element next mounts.
 * @param {{ feedJid: string, node?: string, itemId: string }} ref
 */
export function requestOpenPost(ref) {
    if (!ref?.feedJid || !ref?.itemId) return;
    pending_open_ref = ref;
    api.apps.switch('social');
}

import './compose-rich.js';
import './message.js';
import './feed.js';
import './post.js';
import './profile.js';
import './placeholder.js';
import './styles/social.scss';

/**
 * The Social app container. Owns "which view is showing": the timeline, an
 * author profile, a post detail, or a hashtag-filtered timeline.
 *
 * URL-based routing can be enabled via `enable_url_routing`.
 * Then `location.hash` is the single source of truth.
 */
class SocialApp extends CustomElement {
    static get properties() {
        return {
            // The post whose detail view (comment thread) is open, or null.
            open_post: { type: Object, state: true },
            // The JID whose profile view is open, or null.
            open_profile: { type: String, state: true },
            // The pubsub node the open profile shows: the microblog node (a
            // person's feed) or a community/topic node (a feed we follow).
            profile_node: { type: String, state: true },
            // Which profile tab is shown: 'posts' (the feed) or 'following'.
            profile_tab: { type: String, state: true },
            // The active hashtag filter (without the leading `#`), or null. Owned
            // here (not the feed) so it is routable and works from any Social view.
            filter: { type: String, state: true },
            // True while a deep-linked post is being resolved from the URL.
            _resolving: { type: Boolean, state: true },
        };
    }

    constructor() {
        super();
        this.open_post = null;
        this.open_profile = null;
        this.profile_node = MICROBLOG_NODE;
        this.profile_tab = 'posts';
        this.filter = null;
        this._resolving = false;
        this.router = new HashRouter({ root: SOCIAL_ROUTE_ROOT, onRoute: () => this.syncFromHash() });
    }

    initialize() {
        this.listenTo(_converse, 'connected', () => this.requestUpdate());
        this.listenTo(_converse, 'reconnected', () => this.requestUpdate());
        this.listenTo(_converse, 'disconnected', () => this.requestUpdate());

        // A feed picked in the Discover modal, which renders in the modal portal
        // (outside this element) and so can't reach us by DOM bubbling. Opens the
        // feed's read-only view (a detached, browse-only feed when unfollowed).
        this.listenTo(_converse, 'openSocialFeed', ({ jid, node }) => this.onProfileSelected(jid, node));

        // Navigation events bubble up from posts / profile / post-detail / feed.
        this.addEventListener('profileselected', (ev) => {
            const { jid, node, tab } = /** @type {CustomEvent} */ (ev).detail;
            this.onProfileSelected(jid, node, tab);
        });
        this.addEventListener('closeprofile', () => this.onCloseProfile());
        this.addEventListener('profiletab', (ev) => this.onProfileTab(/** @type {CustomEvent} */ (ev).detail.tab));
        this.addEventListener('postselected', (ev) => this.onPostSelected(/** @type {CustomEvent} */ (ev).detail.post));
        this.addEventListener('closepost', () => this.onClosePost());
        this.addEventListener('hashtagselected', (ev) =>
            this.onHashtagSelected(/** @type {CustomEvent} */ (ev).detail.tag),
        );
        this.addEventListener('clearfilter', () => this.onClearFilter());
    }

    connectedCallback() {
        super.connectedCallback();

        // Starts the hashchange listener and does the initial deep-link sync
        // (no-op when routing is off). Paired with stop() below since a raw window
        // listener isn't auto-cleaned and the element is recreated on app switch.
        this.router.start();

        // Open a post queued while the app was unmounted (a desktop-notification
        // click on a comment for one of our posts).
        if (pending_open_ref) {
            const ref = pending_open_ref;
            pending_open_ref = null;
            this.openPostByRef(ref);
        }
    }

    disconnectedCallback() {
        this.router.stop();
        super.disconnectedCallback();
    }

    render() {
        return tplSocial(this);
    }

    /**
     * @param {string} jid
     * @param {string} [node=MICROBLOG_NODE] the node to show (a community feed if
     *      not the microblog node)
     * @param {'posts'|'following'} [tab='posts'] which tab to open the profile on
     */
    onProfileSelected(jid, node, tab) {
        node = node || MICROBLOG_NODE;
        tab = tab || 'posts';
        if (this.router.enabled) {
            this.navigate({ view: 'profile', jid, node, tab });
            return;
        }
        this.open_post = null;
        this.profile_node = node;
        this.profile_tab = tab;
        this.open_profile = jid;
    }

    onCloseProfile() {
        if (this.router.enabled) {
            this.router.goBack();
            return;
        }
        this.open_post = null;
        this.open_profile = null;
    }

    /**
     * Switch the open profile's tab (bubbled from its tab bar). Same JID, so the
     * keyed profile element stays mounted and only re-renders with the new tab.
     * @param {'posts'|'following'} tab
     */
    onProfileTab(tab) {
        if (this.router.enabled) {
            this.navigate({ view: 'profile', jid: this.open_profile, node: this.profile_node, tab });
            return;
        }
        this.profile_tab = tab;
    }

    /**
     * Open a post's detail view (its comment thread) from a
     * `{ feedJid, node, itemId }` reference, resolving or fetching the post as
     * needed. Used by the desktop notification for a comment on one of our posts.
     * @param {{ feedJid: string, node?: string, itemId: string }} ref
     */
    openPostByRef(ref) {
        /** @type {import('./types.ts').SocialRoute} */
        const route = { view: 'post', feedJid: ref.feedJid, node: ref.node || MICROBLOG_NODE, itemId: ref.itemId };
        if (this.router.enabled) this.navigate(route);
        else this.applyRoute(route);
    }

    /** @param {import('@converse/headless').PubSubMessage} post */
    onPostSelected(post) {
        if (this.router.enabled) {
            this.navigate(this.routeForPost(post));
            return;
        }
        this.open_post = post;
    }

    onClosePost() {
        if (this.router.enabled) {
            this.router.goBack();
            return;
        }
        this.open_post = null;
    }

    /** @param {string} tag */
    onHashtagSelected(tag) {
        if (this.router.enabled) {
            this.navigate({ view: 'tag', tag });
            return;
        }
        this.filter = tag;
    }

    onClearFilter() {
        if (this.router.enabled) {
            this.router.goBack();
            return;
        }
        this.filter = null;
    }

    /**
     * Build the hash for a route and hand it to the router, which assigns
     * `location.hash` (pushing a history entry and firing `hashchange`, which
     * drives `applyRoute`) and dedupes redundant entries.
     * @param {import('./types.ts').SocialRoute} route
     */
    navigate(route) {
        this.router.navigate(buildSocialRoute(route));
    }

    /**
     * Derive the view from the current hash. A hash that isn't a Social route
     * (an empty fragment after `history.back()`, or another app's route while
     * this app unmounts) resolves to the timeline: the view is a function of the
     * hash, and without a Social sub-route there's nothing but the timeline to show.
     */
    syncFromHash() {
        this.applyRoute(parseSocialRoute(location.hash) ?? { view: 'timeline' });
    }

    /**
     * The single place Social view state is set from a route.
     * @param {import('./types.ts').SocialRoute} route
     */
    applyRoute(route) {
        // Bump the resolve token so any post resolution still in flight (from a
        // previous route) sees it's been superseded and bails.
        this._resolve_seq = (this._resolve_seq || 0) + 1;
        this.open_post = null;
        this.open_profile = null;
        this.profile_node = MICROBLOG_NODE;
        this.profile_tab = 'posts';
        this.filter = null;
        this._resolving = false;
        if (route.view === 'profile') {
            this.open_profile = route.jid;
            this.profile_node = route.node ?? MICROBLOG_NODE;
            this.profile_tab = route.tab ?? 'posts';
        } else if (route.view === 'tag') this.filter = route.tag;
        else if (route.view === 'post') this.resolvePost(route);
        this.requestUpdate();
    }

    /**
     * The route for a post, from its owning feed's identity plus its item id.
     * @param {import('@converse/headless').PubSubMessage} post
     * @returns {import('./types.ts').SocialRoute}
     */
    routeForPost(post) {
        const feed = post?.collection?.feed;
        return { view: 'post', feedJid: feed?.get('jid'), node: feed?.get('node'), itemId: post?.get('id') };
    }

    /**
     * Whether an already-open post matches a post route (avoids a refetch/flicker).
     * @param {import('@converse/headless').PubSubMessage} post
     * @param {import('./types.ts').SocialRoute} route
     * @returns {boolean}
     */
    postMatchesRoute(post, route) {
        const feed = post?.collection?.feed;
        return (
            feed?.get('jid') === route.feedJid && feed?.get('node') === route.node && post?.get('id') === route.itemId
        );
    }

    /**
     * Resolve a deep-linked post into `open_post`. Locate its feed, use the cached
     * model if present, else fetch exactly that item (XEP-0060 § 6.5.7) and add it.
     * On a miss or access error, drop the dead entry and show the timeline.
     * @param {import('./types.ts').SocialRoute} route
     */
    async resolvePost(route) {
        const { feedJid, node, itemId } = route;
        if (!feedJid || !itemId) return;
        if (this.open_post && this.postMatchesRoute(this.open_post, route)) return;

        // Token set by the applyRoute that called us; a newer navigation bumps it,
        // so an in-flight resolve that lost the race applies nothing.
        const seq = this._resolve_seq;
        const current = () => seq === this._resolve_seq;

        this._resolving = true;
        this.open_post = null;
        this.requestUpdate();
        try {
            const feed = await api.microblog.profile.getFeed(feedJid, node);
            let post = feed.messages.get(itemId);
            if (!post) {
                const { items } = await api.pubsub.items.get(feedJid, node, { item_ids: [itemId] });
                await feed.addItems(items);
                post = feed.messages.get(itemId);
            }
            if (!current()) return; // Superseded by a newer navigation.
            if (post) {
                this.open_post = post;
            } else {
                // Unresolvable id: replace (not push) so a dead link leaves no
                // back-stack entry, and fall back to the timeline.
                this.router.replace(SOCIAL_ROUTE_ROOT);
            }
        } catch (e) {
            log.error(e);
            if (current()) this.router.replace(SOCIAL_ROUTE_ROOT);
        } finally {
            if (current()) {
                this._resolving = false;
                this.requestUpdate();
            }
        }
    }
}

api.elements.define('converse-app-social', SocialApp);

export default SocialApp;
