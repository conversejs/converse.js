/**
 * What the daemon needs to know about its headless session: our own JID, and
 * whether the connection and the roster are there yet.
 * @module @converse/daemon/session
 */
import { _converse, api, converse } from '@converse/headless';
import { ERRORS, RPCError } from './protocol.js';
import { withTimeout } from './timeout.js';

const { Strophe } = converse.env;

/**
 * @returns {string} Our own bare JID
 */
export function ownJID() {
    return _converse.session.get('bare_jid');
}

/**
 * How long a request waits for the roster or the conversations to load, while
 * the daemon is logging in or loading them.
 */
const LOAD_TIMEOUT = 15000;

/** @type {Promise<unknown>|null} */
let starting = null;

/**
 * Marks the daemon as logging in for as long as `login` takes, so that requests
 * made before it has got as far as connecting wait for it.
 * @template T
 * @param {() => Promise<T>} login
 * @returns {Promise<T>}
 */
export function whileStarting(login) {
    const promise = login();
    starting = promise.catch(() => {}).finally(() => (starting = null));
    return promise;
}

/**
 * @param {string} consequence - What didn't happen because of it, such as "nothing was sent"
 */
export function notConnected(consequence) {
    return new RPCError(
        ERRORS.NOT_CONNECTED,
        `The daemon isn't connected to the server, so ${consequence}. Check "daemon.status", then try again.`,
        { see: ['daemon.status'] },
    );
}

/**
 * Refuses what needs the server while the daemon isn't connected to it.
 * @param {string} consequence - What didn't happen because of it, such as "nothing was sent"
 */
export function requireConnected(consequence) {
    if (!api.connection.authenticated()) throw notConnected(consequence);
}

/**
 * Whether the daemon is logged in, or on its way there: starting up, or in a
 * connection attempt that hasn't failed.
 */
function connecting() {
    const { CONNECTING, AUTHENTICATING } = Strophe.Status;
    const status = _converse.state.connfeedback.get('connection_status');
    return !!(starting || status === CONNECTING || status === AUTHENTICATING || api.connection.authenticated());
}

/**
 * Whether a promise of headless's has settled for the session that's open.
 * What it stands for is unloaded when a session ends, which doesn't always
 * replace the promise.
 * @param {string} name - The name of the promise
 */
function isLoaded(name) {
    // `waitUntil` hands back the open promise itself, which says whether it has settled.
    const promise = /** @type {{ isResolved?: boolean }|null} */ (api.waitUntil(name));
    return api.connection.hasSession() && !!promise?.isResolved;
}

/**
 * Waits for a promise of headless's for as long as the daemon is logging in
 * or loading, rather than for as long as the server is out of reach.
 * @param {string} name - The name of the promise
 * @returns {Promise<boolean>} Whether it has settled
 */
async function loads(name) {
    if (isLoaded(name)) return true;

    if (!connecting()) return false;

    const { promise, resolve } = Promise.withResolvers();
    const check = () => {
        if (isLoaded(name)) resolve(true);
        else if (!connecting()) resolve(false);
    };
    api.listen.on('connfeedback', check);
    api.waitUntil(name).then(check);
    starting?.then(check);
    try {
        return (await withTimeout(promise, LOAD_TIMEOUT)) === true;
    } finally {
        api.listen.not('connfeedback', check);
    }
}

/**
 * Whether the roster has been loaded. Headless loads it when the daemon first
 * connects, so until then, waiting for it, as `api.contacts.get` does, never ends.
 */
export function rosterLoaded() {
    return isLoaded('rosterContactsFetched');
}

/**
 * Whether the roster is loaded, once the daemon is done logging in and loading it.
 * @returns {Promise<boolean>}
 */
export function awaitRoster() {
    return loads('rosterContactsFetched');
}

/**
 * Whether the conversations are loaded, once the daemon is done logging in
 * and loading them. Headless loads them when the daemon first connects, so
 * with no connection, waiting for them, as `api.rooms.get` and `api.chats.get`
 * do, never ends.
 * @returns {Promise<boolean>}
 */
export function awaitChats() {
    return loads('chatBoxesFetched');
}

/**
 * Refuses what needs the conversations when they aren't loaded and there's no
 * connection to load them. While logging in or loading, it waits for them.
 * @param {string} [consequence] - What didn't happen because of it, such as "nothing was sent"
 */
export async function requireChats(consequence = "your conversations haven't been loaded yet") {
    if (!(await awaitChats())) throw notConnected(consequence);
}

/**
 * `api.rooms.get`, refusing where that would wait for the server to be reached.
 * @param {Parameters<typeof api.rooms.get>} args
 * @returns {Promise<Awaited<ReturnType<typeof api.rooms.get>>>}
 */
export async function getRooms(...args) {
    await requireChats();
    return api.rooms.get(...args);
}

/**
 * `api.chats.get`, refusing where that would wait for the server to be reached.
 * @param {Parameters<typeof api.chats.get>} args
 * @returns {Promise<Awaited<ReturnType<typeof api.chats.get>>>}
 */
export async function getChats(...args) {
    await requireChats();
    return api.chats.get(...args);
}

/**
 * Refuses what needs the roster when it isn't loaded and there's no connection
 * to load it. While logging in or loading, it waits for it.
 * @param {string} what - What needs the roster, for the error message
 */
export async function requireRoster(what) {
    if (!(await awaitRoster())) {
        throw new RPCError(
            ERRORS.NOT_CONNECTED,
            `${what} needs your contacts, which the daemon loads when it first connects, and it hasn't ` +
                'connected yet. Check "daemon.status", then try again.',
            { see: ['daemon.status'] },
        );
    }
}
