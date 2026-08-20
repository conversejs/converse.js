/**
 * Whether URL routing (hash fragments, browser history) is enabled. Off by
 * default so an embedded Converse leaves the host page's URL untouched: URL
 * ownership can't be reliably detected at runtime, so it must be declared.
 * @returns {boolean}
 */
export function isURLRoutingEnabled(): boolean;
/**
 * The app a `#converse/...` hash selects by its leading segment, or null when the
 * hash names no app route (e.g. `#converse?loglevel=`, an empty fragment). A MUC
 * (`room`) is part of the chat app.
 * @param {string} [hash=location.hash]
 * @returns {'chat'|'social'|null}
 */
export function appOfHash(hash?: string): "chat" | "social" | null;
/**
 * hashchange + boot handler: switch to the app the hash names. A no-op unless
 * routing is enabled and the view mode is fullscreen (the switcher, and thus more
 * than one app, only exists there). Returns early when the hash names no app, so
 * a plain reload preserves the persisted `active_app` instead of forcing chat.
 */
export function routeApp(): void;
/** Forget the remembered per-app routes (e.g. on logout, to avoid restoring the
 * previous user's chat). */
export function clearAppRoutes(): void;
/**
 * The hash to open when switching to `name`: the app's last sub-route (the open
 * chat, a focused Social post) if we've been there, else its bare root.
 * @param {string} name
 * @returns {string}
 */
export function appRouteFor(name: string): string;
/**
 * Switch to an app by pushing its remembered route into the hash (a history entry,
 * so browser back/forward walks the app history and the app reopens where you left
 * it). The outgoing app's route is stashed first so the reverse switch restores it
 * too. Used by the app-switcher when URL routing is on.
 * @param {string} name
 */
export function navigateToApp(name: string): void;
/**
 * `appSwitch` handler: reflect a programmatic app switch into the URL without a
 * loop. `replaceState` fires no `hashchange` (so `routeApp` doesn't re-run), and
 * comparing only the hash's leading segment avoids clobbering a sub-route such as
 * `#converse/social/profile/...`.
 *
 * The outgoing app's sub-route is stashed before it's overwritten, and the incoming
 * app's last route restored, so a programmatic Chat -> Social -> Chat reopens the
 * conversation you left. (The app-switcher UI takes {@link navigateToApp} instead,
 * to get a history entry.)
 * @param {import('./types').App} app
 */
export function syncAppToHash(app: import("./types").App): void;
/**
 * A generic per-app hash router that an app view (e.g. "Chat" or "Social") can
 * delegate to. It owns the transport (the `hashchange` lifecycle plus the
 * browser-history mechanics of forward/back navigation), gated by
 * {@link isURLRoutingEnabled}. The app supplies the route *grammar*
 * (how it maps `location.hash` to a view) via the `onRoute` callback.
 *
 * The app is expected to gate its navigation intents on {@link HashRouter#enabled}
 * so that, when routing is off, it keeps its original in-memory behavior and this
 * router stays dormant (no listener, no URL writes).
 */
export class HashRouter {
    /**
     * @param {object} opts
     * @param {string} opts.root - The app's base hash (e.g. `#converse/social`),
     *      used to dedupe navigations and as {@link HashRouter#goBack}'s fallback
     *      when there's no in-app history entry to pop.
     * @param {() => void} opts.onRoute - Invoked on `hashchange` and once on
     *      {@link HashRouter#start}: the app re-derives its view from `location.hash`.
     */
    constructor({ root, onRoute }: {
        root: string;
        onRoute: () => void;
    });
    root: string;
    onRoute: () => void;
    _navigated_within: boolean;
    _listener: () => void;
    /** Whether URL routing is enabled at all. */
    get enabled(): boolean;
    /** Begin listening for hashchange and do an initial sync. A no-op when off. */
    start(): void;
    /** Stop listening (safe to call unconditionally). */
    stop(): void;
    /**
     * Navigate to a hash, pushing a history entry. Deduped so we never push a
     * redundant entry for the hash we're already on.
     * @param {string} hash
     */
    navigate(hash: string): void;
    /**
     * Replace the current hash without a history entry (e.g. to drop a dead
     * deep-link from the back stack). Fires no `hashchange`.
     * @param {string} hash
     */
    replace(hash: string): void;
    /**
     * Go back one entry: `history.back()` when we navigated in-app this session (so
     * it matches the browser back button), else to the app root (a cold deep-link
     * has no in-app entry to pop, so back must not leave the app).
     */
    goBack(): void;
}
//# sourceMappingURL=routing.d.ts.map