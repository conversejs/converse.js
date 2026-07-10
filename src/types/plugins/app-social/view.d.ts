export default SocialApp;
/**
 * The Social app container. Owns "which view is showing": the timeline, an
 * author profile, a post detail, or a hashtag-filtered timeline.
 *
 * URL-based routing can be enabled via `enable_url_routing`.
 * Then `location.hash` is the single source of truth.
 */
declare class SocialApp extends CustomElement {
    static get properties(): {
        open_post: {
            type: ObjectConstructor;
            state: boolean;
        };
        open_profile: {
            type: StringConstructor;
            state: boolean;
        };
        profile_node: {
            type: StringConstructor;
            state: boolean;
        };
        profile_tab: {
            type: StringConstructor;
            state: boolean;
        };
        filter: {
            type: StringConstructor;
            state: boolean;
        };
        _resolving: {
            type: BooleanConstructor;
            state: boolean;
        };
    };
    open_post: any;
    open_profile: string;
    profile_node: string;
    profile_tab: string;
    filter: string;
    _resolving: boolean;
    router: HashRouter;
    render(): import("lit-html/directive.js").DirectiveResult<{
        new (_partInfo: import("lit-html/directive.js").PartInfo): import("lit-html/directives/keyed.js").Keyed<import("lit-html").TemplateResult<1>>;
    }>;
    /**
     * @param {string} jid
     * @param {string} [node=MICROBLOG_NODE] the node to show (a community feed if
     *      not the microblog node)
     * @param {'posts'|'following'} [tab='posts'] which tab to open the profile on
     */
    onProfileSelected(jid: string, node?: string, tab?: "posts" | "following"): void;
    onCloseProfile(): void;
    /**
     * Switch the open profile's tab (bubbled from its tab bar). Same JID, so the
     * keyed profile element stays mounted and only re-renders with the new tab.
     * @param {'posts'|'following'} tab
     */
    onProfileTab(tab: "posts" | "following"): void;
    /** @param {import('@converse/headless').PubSubMessage} post */
    onPostSelected(post: import("@converse/headless").PubSubMessage): void;
    onClosePost(): void;
    /** @param {string} tag */
    onHashtagSelected(tag: string): void;
    onClearFilter(): void;
    /**
     * Build the hash for a route and hand it to the router, which assigns
     * `location.hash` (pushing a history entry and firing `hashchange`, which
     * drives `applyRoute`) and dedupes redundant entries.
     * @param {import('./types.ts').SocialRoute} route
     */
    navigate(route: import("./types.ts").SocialRoute): void;
    /**
     * Derive the view from the current hash. A hash that isn't a Social route
     * (an empty fragment after `history.back()`, or another app's route while
     * this app unmounts) resolves to the timeline: the view is a function of the
     * hash, and without a Social sub-route there's nothing but the timeline to show.
     */
    syncFromHash(): void;
    /**
     * The single place Social view state is set from a route.
     * @param {import('./types.ts').SocialRoute} route
     */
    applyRoute(route: import("./types.ts").SocialRoute): void;
    _resolve_seq: any;
    /**
     * The route for a post, from its owning feed's identity plus its item id.
     * @param {import('@converse/headless').PubSubMessage} post
     * @returns {import('./types.ts').SocialRoute}
     */
    routeForPost(post: import("@converse/headless").PubSubMessage): import("./types.ts").SocialRoute;
    /**
     * Whether an already-open post matches a post route (avoids a refetch/flicker).
     * @param {import('@converse/headless').PubSubMessage} post
     * @param {import('./types.ts').SocialRoute} route
     * @returns {boolean}
     */
    postMatchesRoute(post: import("@converse/headless").PubSubMessage, route: import("./types.ts").SocialRoute): boolean;
    /**
     * Resolve a deep-linked post into `open_post`. Locate its feed, use the cached
     * model if present, else fetch exactly that item (XEP-0060 § 6.5.7) and add it.
     * On a miss or access error, drop the dead entry and show the timeline.
     * @param {import('./types.ts').SocialRoute} route
     */
    resolvePost(route: import("./types.ts").SocialRoute): Promise<void>;
}
import { CustomElement } from 'shared/components/element.js';
import { HashRouter } from '../rootview/routing.js';
//# sourceMappingURL=view.d.ts.map