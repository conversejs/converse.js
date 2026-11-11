/**
 * The remembered session: the bare JID of the last session on this device
 * that logged in and wasn't logged out. While there is one, a start-up may
 * resume it, loading it from the cache before connecting (see
 * `resumeSession` in `utils/init.js`).
 *
 * The marker isn't a security boundary, since on a device that keeps a cache
 * that cache can be read from storage anyway. What it guarantees is that a
 * logout is honoured, and that nothing is loaded before the server has checked
 * a password typed into the login form.
 *
 * In the browser it's kept in localStorage, under the key Converse has always
 * used for it. Under Node it's kept in the persistent store.
 *
 * @module utils/remembered-session
 */
import { getNodeStore } from './node-store.js';
import { getLocalStorageItem, IS_BROWSER, removeLocalStorageItem, setLocalStorageItem } from './environment.js';

const KEY = 'conversejs-session-jid';

/**
 * @returns {Promise<string|null>} The bare JID of the remembered session, if there is one.
 */
export async function getRememberedSession() {
    if (IS_BROWSER) return getLocalStorageItem(KEY);
    return (await getNodeStore().getItem(KEY)) ?? null;
}

/**
 * @param {string} bare_jid
 */
export async function rememberSession(bare_jid) {
    if (IS_BROWSER) return setLocalStorageItem(KEY, bare_jid);
    await getNodeStore().setItem(KEY, bare_jid);
}

export async function forgetSession() {
    if (IS_BROWSER) return removeLocalStorageItem(KEY);
    await getNodeStore().removeItem(KEY);
}
