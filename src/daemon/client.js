/**
 * The client side of the daemon's socket protocol, shared by the CLI and any
 * other client. Kept free of any `@converse/headless` import, so that a
 * short-lived client doesn't load an XMPP stack.
 * @module @converse/daemon/client
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { findDaemon, getSocketFromEnv, loadConfig } from './config.js';
import { PROTOCOL_VERSION, RPCError } from './protocol.js';

export {
    AccountError,
    getConfigDir,
    getConfigPath,
    getSocketFromEnv,
    listAccounts,
    listDaemons,
    loadConfig,
} from './config.js';

const DAEMON_BIN = fileURLToPath(new URL('./bin/converse-daemon.js', import.meta.url));

/**
 * How long to wait for an auto-spawned daemon to open its socket.
 */
const SPAWN_TIMEOUT = 10000;

/**
 * Raised when no daemon answers on the socket (and none could be started).
 */
export class DaemonUnavailableError extends Error {
    name = 'DaemonUnavailableError';
}

/**
 * Connects to the daemon for the configured account and completes the
 * handshake. If no daemon is running, one is started first, unless
 * `spawn` is false.
 *
 * With `CONVERSE_SOCKET` set, the client connects to that socket instead, and
 * doesn't read the account's config: `access` and `spawn` are then moot. When
 * the config names the sockets, the client connects to those, and never starts
 * a daemon: it runs on another host.
 * @param {Object} [options]
 * @param {string} [options.consumer] - Who is connecting; defaults to the configured consumer.
 * @param {import('./types').Access} [options.access='full'] - Which socket to connect to
 * @param {boolean} [options.spawn=true]
 * @param {NodeJS.ProcessEnv} [options.env]
 */
export async function connect({ consumer, access = 'full', spawn: may_spawn = true, env = process.env } = {}) {
    const socket_from_env = getSocketFromEnv(env);
    if (socket_from_env) {
        let socket;
        try {
            socket = await openSocket(socket_from_env);
        } catch (e) {
            // Without the account's config there's no password to start a daemon with.
            throw new DaemonUnavailableError(
                `No daemon answers on ${socket_from_env}, the socket CONVERSE_SOCKET names (${e.code}). ` +
                    'This client has no account config to start one with: ask the user to start the daemon, ' +
                    'and check that this path is its restricted socket.',
                { cause: e },
            );
        }
        return handshake(socket, socket_from_env, consumer);
    }

    const config = loadConfig(env);
    if (config.sockets) return connectConfigured(config, access, consumer);

    // A running daemon is found by its account's name, in case the config's JID changed since it started.
    const sockets = findDaemon(config) ?? config.paths;
    const socket_path = access === 'restricted' ? sockets.restricted_socket : sockets.socket;
    let socket;
    try {
        socket = await openSocket(socket_path);
    } catch (e) {
        if (access === 'full' && (await answers(sockets.restricted_socket))) {
            throw new FullAccessUnreachableError(e);
        }
        if (!may_spawn) {
            throw new DaemonUnavailableError(
                `The daemon for ${config.jid} isn't running. Start it with "converse-cli daemon start".`,
                { cause: e },
            );
        }
        socket = await spawnDaemon(config, socket_path, env);
    }
    return handshake(socket, socket_path, consumer ?? config.consumer);
}

/**
 * The daemon is running, and this client can't reach its full access socket,
 * such as an agent in a sandbox given only the restricted one, or a tunnel
 * that forwards only that one.
 */
class FullAccessUnreachableError extends Error {
    /**
     * @param {Error} [cause]
     */
    constructor(cause) {
        super(
            'This needs full access, and this client can only reach the restricted socket. ' +
                "It is the owner's to do, from a client with full access.",
            { cause },
        );
    }
}

/**
 * Connects to a socket the config names, a daemon's on another host that is
 * forwarded here. A daemon is never started for it: there's none to start on
 * this host.
 * @param {import('./types').Config} config
 * @param {import('./types').Access} access
 * @param {string} [consumer]
 * @returns {Promise<Client>}
 */
async function connectConfigured(config, access, consumer) {
    const { socket, restricted_socket } = config.sockets;
    const [key, socket_path] = access === 'restricted' ? ['restricted_socket', restricted_socket] : ['socket', socket];
    const restricted_answers = async () =>
        access === 'full' && restricted_socket !== null && (await answers(restricted_socket));
    if (!socket_path) {
        if (await restricted_answers()) throw new FullAccessUnreachableError();

        throw new DaemonUnavailableError(
            `${config.paths.config} names no "${key}", for ${access} access, and this client doesn't start a ` +
                `daemon when the config names a socket. Add the path of the forwarded socket as "${key}", ` +
                'or remove "socket" and "restricted_socket" to use a daemon on this host.',
        );
    }
    try {
        return await handshake(await openSocket(socket_path), socket_path, consumer ?? config.consumer);
    } catch (e) {
        if (e instanceof RPCError) throw e;

        if (await restricted_answers()) throw new FullAccessUnreachableError(e);

        // A tunnel that's up accepts the connection, and closes it when nothing answers on the other host.
        const reason = e instanceof DaemonUnavailableError ? 'the connection was closed' : e.code;
        throw new DaemonUnavailableError(
            `No daemon answers on ${socket_path}, the "${key}" that ${config.paths.config} names (${reason}). ` +
                "Check that the tunnel to the daemon's host is up, and that the daemon runs on that host. " +
                "This client doesn't start a daemon when the config names a socket.",
            { cause: e },
        );
    }
}

/**
 * @param {net.Socket} socket
 * @param {string} socket_path - Where the socket was reached
 * @param {string} [consumer] - Unset leaves it to the daemon's config
 * @returns {Promise<Client>}
 */
async function handshake(socket, socket_path, consumer) {
    const client = new Client(socket, socket_path);
    try {
        client.hello = await client.request('hello', { protocol: PROTOCOL_VERSION, consumer });
    } catch (e) {
        client.close();
        throw e;
    }
    return client;
}

/**
 * Asks the daemon for the configured account to stop, and waits until it has
 * logged out and released its pidfile. A daemon reached through a socket that
 * `CONVERSE_SOCKET` or the config names may run on another host, where its
 * pidfile is out of reach: for that one, this waits until the daemon has
 * closed the connection.
 * @param {Object} [options]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @returns {Promise<'stopped'|'asked'|false>} Whether it stopped, was asked to, or wasn't running.
 */
export async function stopDaemon({ env = process.env } = {}) {
    let client;
    try {
        client = await connect({ spawn: false, env });
    } catch (e) {
        if (e instanceof DaemonUnavailableError) return false;
        throw e;
    }
    await client.request('daemon.stop');
    const config = getSocketFromEnv(env) ? null : loadConfig(env);
    if (!config || config.sockets) {
        // It closes every connection on its way out.
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(
                () => reject(new Error(`The daemon didn't close the connection within ${SPAWN_TIMEOUT / 1000}s.`)),
                SPAWN_TIMEOUT,
            );
        });
        try {
            await Promise.race([client.closed.catch(() => {}), timeout]);
        } finally {
            clearTimeout(timer);
            client.close();
        }
        return 'asked';
    }
    client.close();

    const { paths } = config;
    const deadline = Date.now() + SPAWN_TIMEOUT;
    while (findDaemon(config) || fs.existsSync(paths.pidfile)) {
        if (Date.now() > deadline) {
            throw new Error(`The daemon didn't stop within ${SPAWN_TIMEOUT / 1000}s. See ${paths.log}.`);
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return 'stopped';
}

export class Client {
    /** @type {import('./types').Hello} */
    hello;

    #next_id = 1;
    /** @type {Map<number, {resolve: Function, reject: Function}>} */
    #pending = new Map();
    /** @type {Set<(params: import('./types').Event) => void>} */
    #listeners = new Set();
    #closed = Promise.withResolvers();

    /**
     * @param {net.Socket} socket
     * @param {string} socket_path - Where it was reached, which may be a forward of another host's socket
     */
    constructor(socket, socket_path) {
        this.socket = socket;
        this.socket_path = socket_path;
        readline
            .createInterface({ input: socket, crlfDelay: Infinity })
            .on('line', (line) => this.#onLine(line))
            // readline passes the socket's errors on, such as writing to a tunnel the other end closed.
            .on('error', () => {});
        socket.on('close', () => {
            const error = new DaemonUnavailableError('The daemon closed the connection.');
            this.#pending.forEach(({ reject }) => reject(error));
            this.#pending.clear();
            this.#closed.reject(error);
        });
        socket.on('error', () => {}); // Surfaced through 'close'
        // Only a client waiting on it sees this, so nothing is left unhandled.
        this.#closed.promise.catch(() => {});
    }

    /**
     * Settles, rejecting with a {@link DaemonUnavailableError}, once the
     * connection closes: for a client waiting on an event when the daemon
     * goes away.
     * @returns {Promise<never>}
     */
    get closed() {
        return this.#closed.promise;
    }

    /**
     * Calls `listener` with each event the daemon sends this connection, from
     * the subscriptions it has made.
     * @param {(event: import('./types').Event) => void} listener
     */
    onEvent(listener) {
        this.#listeners.add(listener);
    }

    /**
     * @param {string} method
     * @param {Object} [params]
     * @returns {Promise<any>} The result, or rejects with an {@link RPCError}.
     */
    request(method, params) {
        const id = this.#next_id++;
        const { promise, resolve, reject } = Promise.withResolvers();
        this.#pending.set(id, { resolve, reject });
        this.socket.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
        return promise;
    }

    close() {
        this.socket.end();
    }

    /**
     * @param {string} line
     */
    #onLine(line) {
        let message;
        try {
            message = JSON.parse(line);
        } catch {
            return;
        }
        if (message.method === 'event') {
            return this.#listeners.forEach((listener) => listener(message.params));
        }
        if (message.id === null && message.error) {
            // A request the daemon couldn't read far enough to know its id.
            const { code, message: text, data } = message.error;
            this.#pending.forEach(({ reject }) => reject(new RPCError(code, text, data)));
            return this.#pending.clear();
        }
        const pending = this.#pending.get(message.id);
        if (!pending) return;

        this.#pending.delete(message.id);
        if (message.error) {
            const { code, message: text, data } = message.error;
            pending.reject(new RPCError(code, text, data));
        } else {
            pending.resolve(message.result);
        }
    }
}

/**
 * @param {string} socket_path
 * @returns {Promise<net.Socket>}
 */
function openSocket(socket_path) {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection(socket_path);
        socket.once('connect', () => {
            socket.off('error', reject);
            resolve(socket);
        });
        socket.once('error', reject);
    });
}

/**
 * @param {string} socket_path
 * @returns {Promise<boolean>} Whether a daemon accepts connections on it
 */
async function answers(socket_path) {
    // Through a tunnel, the connection is accepted even when nothing answers on the other host.
    try {
        (await handshake(await openSocket(socket_path), socket_path)).close();
        return true;
    } catch (e) {
        return e instanceof RPCError;
    }
}

/**
 * Starts a detached daemon writing to the account's log file, and waits until
 * its socket accepts a connection. Fails early if the daemon exits first,
 * pointing at the log, which says why.
 * @param {import('./types').Config} config
 * @param {string} socket_path - The socket the client is waiting for
 * @param {NodeJS.ProcessEnv} env
 * @returns {Promise<net.Socket>}
 */
async function spawnDaemon(config, socket_path, env) {
    const { paths } = config;
    fs.mkdirSync(path.dirname(paths.log), { recursive: true });
    const log_fd = fs.openSync(paths.log, 'a', 0o600);
    const child = spawn(process.execPath, [DAEMON_BIN], {
        detached: true,
        stdio: ['ignore', log_fd, log_fd],
        // Named, so that the daemon picks the same account even if which is the default changes.
        env: { ...env, CONVERSE_ACCOUNT: config.account },
    });
    fs.closeSync(log_fd);

    let exit_code = null;
    child.once('exit', (code) => (exit_code = code ?? 1));
    child.unref();

    const deadline = Date.now() + SPAWN_TIMEOUT;
    while (Date.now() < deadline) {
        if (exit_code !== null) {
            throw new DaemonUnavailableError(
                `The daemon exited with code ${exit_code} while starting. See ${paths.log} for why.`,
            );
        }
        try {
            return await openSocket(socket_path);
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
    }
    throw new DaemonUnavailableError(
        `The daemon didn't open ${socket_path} within ${SPAWN_TIMEOUT / 1000}s. See ${paths.log}.`,
    );
}
