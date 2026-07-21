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
export const IS_BROWSER = typeof window !== 'undefined' && typeof window.addEventListener === 'function';

/**
 * The event that fires when the page is going away.
 * @returns {'pagehide'|'beforeunload'|'unload'}
 */
export function getUnloadEvent() {
    if (!IS_BROWSER) return 'unload';

    if ('onpagehide' in window) {
        // Pagehide gets thrown in more cases than unload. Specifically it
        // gets thrown when the page is cached and not just
        // closed/destroyed. It's the only viable event on mobile Safari.
        // https://www.webkit.org/blog/516/webkit-page-cache-ii-the-unload-event/
        return 'pagehide';
    } else if ('onbeforeunload' in window) {
        return 'beforeunload';
    }
    return 'unload';
}

/**
 * @param {EventListener} listener
 * @param {AddEventListenerOptions} [options]
 */
export function addUnloadListener(listener, options) {
    if (IS_BROWSER) window.addEventListener(getUnloadEvent(), listener, options);
}

/**
 * @param {EventListener} listener
 */
export function removeUnloadListener(listener) {
    if (IS_BROWSER) window.removeEventListener(getUnloadEvent(), listener);
}

/**
 * Whether the app is currently out of sight, e.g. in a background tab.
 * @returns {boolean}
 */
export function isAppHidden() {
    return IS_BROWSER ? document.hidden : false;
}

/**
 * @param {EventListener} listener
 */
export function addVisibilityListener(listener) {
    if (IS_BROWSER) document.addEventListener('visibilitychange', listener);
}

/**
 * @param {EventListener} listener
 */
export function removeVisibilityListener(listener) {
    if (IS_BROWSER) document.removeEventListener('visibilitychange', listener);
}

/**
 * The URL fragment Converse routes on, e.g. `#converse/room?jid=...`.
 * @returns {string}
 */
export function getRouteHash() {
    return IS_BROWSER ? location.hash : '';
}

/**
 * @param {EventListener} listener
 */
export function addRouteListener(listener) {
    if (IS_BROWSER) window.addEventListener('hashchange', listener);
}

/**
 * @param {EventListener} listener
 */
export function removeRouteListener(listener) {
    if (IS_BROWSER) window.removeEventListener('hashchange', listener);
}

/**
 * Reads from `localStorage`, which Converse uses to remember the JID to offer
 * at the next login. Outside a browser there's nothing to read, and nothing is
 * lost by that: a headless client is told its JID by whoever starts it.
 * @param {string} key
 * @returns {string|null}
 */
export function getLocalStorageItem(key) {
    return IS_BROWSER ? localStorage.getItem(key) : null;
}

/**
 * @param {string} key
 * @param {string} value
 */
export function setLocalStorageItem(key, value) {
    if (IS_BROWSER) localStorage.setItem(key, value);
}

/**
 * @param {string} key
 */
export function removeLocalStorageItem(key) {
    if (IS_BROWSER) localStorage.removeItem(key);
}

/**
 * Whether the browser exposes the Credential Management API, which Converse
 * can log in with.
 * @returns {boolean}
 */
export function hasCredentialsAPI() {
    return IS_BROWSER && 'credentials' in navigator;
}
