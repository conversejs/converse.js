/**
 * What the daemon needs to know about its headless session: our own JID, and
 * whether the connection and the roster are there yet.
 * @module @converse/daemon/session
 */
import { _converse, api } from '@converse/headless';
import { ERRORS, RPCError } from './protocol.js';

/**
 * @returns {string} Our own bare JID
 */
export function ownJID() {
    return _converse.session.get('bare_jid');
}

/**
 * Refuses what needs the server while the daemon isn't connected to it.
 * @param {string} consequence - What didn't happen because of it, such as "nothing was sent"
 */
export function requireConnected(consequence) {
    if (!api.connection.connected()) {
        throw new RPCError(
            ERRORS.NOT_CONNECTED,
            `The daemon isn't connected to the server, so ${consequence}. Check "daemon.status", then try again.`,
            { see: ['daemon.status'] },
        );
    }
}

/**
 * @param {string} name - The name of a promise of headless's
 */
function isSettled(name) {
    // `waitUntil` hands back the open promise itself, which says whether it has settled.
    const promise = /** @type {{ isResolved?: boolean }|null} */ (api.waitUntil(name));
    return !!promise?.isResolved;
}

/**
 * Whether the roster has been loaded. Headless loads it when the daemon first
 * connects, so until then, waiting for it, as `api.contacts.get` does, never ends.
 */
export function rosterLoaded() {
    return isSettled('rosterContactsFetched');
}

/**
 * Whether the conversations have been loaded, which headless does when the
 * daemon first connects. Until then, waiting for them, as `api.rooms.get` and
 * `api.chats.get` do, never ends.
 */
export function chatsLoaded() {
    return isSettled('chatBoxesFetched');
}

/**
 * Refuses what needs the conversations when they aren't loaded and there's no
 * connection to load them. While connected, they're on their way.
 * @param {string} [consequence] - What didn't happen because of it, such as "nothing was sent"
 */
export function requireChats(consequence = "your conversations haven't been loaded yet") {
    if (!chatsLoaded()) requireConnected(consequence);
}

/**
 * `api.rooms.get`, refusing where that would wait forever.
 * @param {Parameters<typeof api.rooms.get>} args
 * @returns {ReturnType<typeof api.rooms.get>}
 */
export function getRooms(...args) {
    requireChats();
    return api.rooms.get(...args);
}

/**
 * `api.chats.get`, refusing where that would wait forever.
 * @param {Parameters<typeof api.chats.get>} args
 * @returns {ReturnType<typeof api.chats.get>}
 */
export function getChats(...args) {
    requireChats();
    return api.chats.get(...args);
}

/**
 * @param {string} what - What needs the roster, for the error message
 */
export function requireRoster(what) {
    if (!rosterLoaded()) {
        throw new RPCError(
            ERRORS.NOT_CONNECTED,
            `${what} needs your contacts, which the daemon loads when it first connects, and it hasn't ` +
                'connected yet. Check "daemon.status", then try again.',
            { see: ['daemon.status'] },
        );
    }
}
