/**
 * The event that fires when the page is going away.
 * @returns {'pagehide'|'beforeunload'|'unload'}
 */
export function getUnloadEvent(): "pagehide" | "beforeunload" | "unload";
/**
 * @param {EventListener} listener
 * @param {AddEventListenerOptions} [options]
 */
export function addUnloadListener(listener: EventListener, options?: AddEventListenerOptions): void;
/**
 * @param {EventListener} listener
 */
export function removeUnloadListener(listener: EventListener): void;
/**
 * Whether the app is currently out of sight, e.g. in a background tab.
 * @returns {boolean}
 */
export function isAppHidden(): boolean;
/**
 * @param {EventListener} listener
 */
export function addVisibilityListener(listener: EventListener): void;
/**
 * @param {EventListener} listener
 */
export function removeVisibilityListener(listener: EventListener): void;
/**
 * The URL fragment Converse routes on, e.g. `#converse/room?jid=...`.
 * @returns {string}
 */
export function getRouteHash(): string;
/**
 * @param {EventListener} listener
 */
export function addRouteListener(listener: EventListener): void;
/**
 * @param {EventListener} listener
 */
export function removeRouteListener(listener: EventListener): void;
/**
 * Reads from `localStorage`, which Converse uses to remember the JID to offer
 * at the next login. Outside a browser there's nothing to read, and nothing is
 * lost by that: a headless client is told its JID by whoever starts it.
 * @param {string} key
 * @returns {string|null}
 */
export function getLocalStorageItem(key: string): string | null;
/**
 * @param {string} key
 * @param {string} value
 */
export function setLocalStorageItem(key: string, value: string): void;
/**
 * @param {string} key
 */
export function removeLocalStorageItem(key: string): void;
/**
 * Whether the browser exposes the Credential Management API, which Converse
 * can log in with.
 * @returns {boolean}
 */
export function hasCredentialsAPI(): boolean;
/**
 * Helpers for the parts of Converse that assume a browser page.
 *
 * Converse re-joins MUCs when the tab becomes visible again, flushes storage
 * before the page goes away and reads routes off the location hash. None of
 * that exists in Node, so every call site goes through here rather than
 * touching `window`, `document` or `location` directly.
 *
 * Outside a browser the listeners are no-ops, `getRouteHash()` is empty and
 * `isAppHidden()` reports the app as visible, which is the truthful answer for
 * a process that is never backgrounded: pings keep flowing and rooms stay
 * joined, which is what a long-running headless client wants.
 *
 * @module utils/environment
 */
/**
 * Whether we're running in a browser page, as opposed to Node.js.
 * @type {boolean}
 */
export const IS_BROWSER: boolean;
//# sourceMappingURL=environment.d.ts.map