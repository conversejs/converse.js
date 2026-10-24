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
import { loadConfig } from './config.js';
import { PROTOCOL_VERSION, RPCError } from './protocol.js';

export { getConfigPath, loadConfig } from './config.js';

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
 * @param {Object} [options]
 * @param {string} [options.consumer] - Who is connecting; defaults to the configured consumer.
 * @param {boolean} [options.spawn=true]
 * @param {NodeJS.ProcessEnv} [options.env]
 */
export async function connect({ consumer, spawn: may_spawn = true, env = process.env } = {}) {
    const config = loadConfig(env);
    let socket;
    try {
        socket = await openSocket(config.paths.socket);
    } catch (e) {
        if (!may_spawn) {
            throw new DaemonUnavailableError(
                `The daemon for ${config.jid} isn't running. Start it with "converse-cli daemon start".`,
                { cause: e },
            );
        }
        socket = await spawnDaemon(config, env);
    }
    const client = new Client(socket);
    try {
        client.hello = await client.request('hello', {
            protocol: PROTOCOL_VERSION,
            consumer: consumer ?? config.consumer,
        });
    } catch (e) {
        client.close();
        throw e;
    }
    return client;
}

/**
 * Asks the daemon for the configured account to stop, and waits until it has
 * logged out and released its pidfile.
 * @param {Object} [options]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @returns {Promise<boolean>} False if no daemon was running.
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
    client.close();

    const { paths } = loadConfig(env);
    const deadline = Date.now() + SPAWN_TIMEOUT;
    while (fs.existsSync(paths.pidfile)) {
        if (Date.now() > deadline) {
            throw new Error(`The daemon didn't stop within ${SPAWN_TIMEOUT / 1000}s. See ${paths.log}.`);
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return true;
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
     */
    constructor(socket) {
        this.socket = socket;
        readline.createInterface({ input: socket, crlfDelay: Infinity }).on('line', (line) => this.#onLine(line));
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
 * Starts a detached daemon writing to the account's log file, and waits until
 * its socket accepts a connection. Fails early if the daemon exits first,
 * pointing at the log, which says why.
 * @param {import('./types').Config} config
 * @param {NodeJS.ProcessEnv} env
 * @returns {Promise<net.Socket>}
 */
async function spawnDaemon(config, env) {
    const { paths } = config;
    fs.mkdirSync(path.dirname(paths.log), { recursive: true });
    const log_fd = fs.openSync(paths.log, 'a', 0o600);
    const child = spawn(process.execPath, [DAEMON_BIN], {
        detached: true,
        stdio: ['ignore', log_fd, log_fd],
        env,
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
            return await openSocket(paths.socket);
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
    }
    throw new DaemonUnavailableError(
        `The daemon didn't open ${paths.socket} within ${SPAWN_TIMEOUT / 1000}s. See ${paths.log}.`,
    );
}
