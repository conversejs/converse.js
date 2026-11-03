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
 * Whether the roster has been loaded. Headless loads it when the daemon first
 * connects, so until then, waiting for it, as `api.contacts.get` does, never ends.
 */
export function rosterLoaded() {
    // `waitUntil` hands back the open promise itself, which says whether it has settled.
    const fetched = /** @type {{ isResolved?: boolean }|null} */ (api.waitUntil('rosterContactsFetched'));
    return !!fetched?.isResolved;
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
