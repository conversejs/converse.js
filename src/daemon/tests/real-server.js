/**
 * Daemons on the test Prosody (tests/prosody), one process per account,
 * since headless can host only one account per process. Each is a real
 * daemon, started the way a client starts one, and driven through its socket.
 */
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { connect, stopDaemon } from '../client.js';
import { registerAccount, WEBSOCKET_URL } from '../../../tests/prosody/server.js';

export { registerAccount };

/**
 * Polls until `fn` returns something truthy, treating a throw as "not yet".
 * @template T
 * @param {() => Promise<T>} fn
 * @param {Object} [options]
 * @param {number} [options.timeout]
 * @param {string} [options.what] - What's being waited for, for the error.
 * @returns {Promise<T>}
 */
export async function eventually(fn, { timeout = 10000, what = 'the condition' } = {}) {
    const deadline = Date.now() + timeout;
    let last_error;
    for (;;) {
        try {
            const result = await fn();
            if (result) return result;
        } catch (e) {
            last_error = e;
        }
        if (Date.now() > deadline) {
            throw new Error(`Timed out waiting for ${what}`, { cause: last_error });
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
}

/**
 * Starts a daemon for an account and waits until it's connected.
 * @param {{ jid: string, password: string }} account
 * @param {Object} [options]
 * @param {string} [options.resource]
 * @param {string} [options.websocket_url] - To reach Prosody another way, e.g. through a {@link startProxy}
 * @param {Partial<import('../types').Policy>} [options.policy] - The send policy, from the config file
 */
export async function startDaemon(account, { resource = 'claude', websocket_url = WEBSOCKET_URL, policy } = {}) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'converse-prosody-test-'));
    const env = {
        ...process.env,
        XDG_CONFIG_HOME: path.join(dir, 'config'),
        XDG_RUNTIME_DIR: path.join(dir, 'run'),
        XDG_STATE_HOME: path.join(dir, 'state'),
    };
    await fs.mkdir(path.join(env.XDG_CONFIG_HOME, 'converse'), { recursive: true });
    await fs.writeFile(
        path.join(env.XDG_CONFIG_HOME, 'converse', 'daemon.json'),
        JSON.stringify({
            jid: account.jid,
            owner: 'benvolio@montague.lit',
            password: account.password,
            websocket_url,
            resource,
            settings: { discover_connection_methods: false, loglevel: 'info' },
            ...(policy ? { policy } : {}),
        }),
    );
    const log = path.join(env.XDG_STATE_HOME, 'converse', `${account.jid}.log`);

    const connectAndWait = async () => {
        const client = await connect({ env });
        try {
            await eventually(async () => (await client.request('daemon.status')).connected, {
                timeout: 15000,
                what: `${account.jid} to connect`,
            });
        } catch (e) {
            const output = await fs.readFile(log, 'utf8').catch(() => '');
            throw new Error(`${e.message}. Daemon log:\n${output}`, { cause: e });
        }
        return client;
    };
    let client = await connectAndWait();
    // Full and restricted connections, made when first needed. `request` is full access, as the CLI's is not.
    let full, restricted;

    return {
        jid: account.jid,
        /** The environment the daemon's config and sockets live in, for running the CLI against it. */
        env,
        /**
         * @param {string} method
         * @param {Object} [params]
         */
        request: (method, params) => client.request(method, params),
        /**
         * As `request`, but on a full-access connection.
         * @param {string} method
         * @param {Object} [params]
         */
        requestFull: async (method, params) => {
            full ??= await connect({ env, access: 'full', spawn: false });
            return full.request(method, params);
        },
        /**
         * As `request`, but on a restricted connection, as an agent's is.
         * @param {string} method
         * @param {Object} [params]
         */
        requestRestricted: async (method, params) => {
            restricted ??= await connect({ env, access: 'restricted', spawn: false });
            return restricted.request(method, params);
        },
        /**
         * Calls `listener` with each event the daemon sends, from the
         * subscriptions made on the current connection. A restart ends it.
         * @param {(event: import('../types').Event) => void} listener
         */
        onEvent: (listener) => client.onEvent(listener),
        /**
         * Stops the daemon, runs `meanwhile`, and starts it again on the same
         * account files, as a user's daemon would be.
         * @param {() => Promise<void>} [meanwhile]
         */
        async restart(meanwhile) {
            client.close();
            full?.close();
            restricted?.close();
            full = restricted = undefined;
            await stopDaemon({ env });
            await meanwhile?.();
            client = await connectAndWait();
        },
        async stop() {
            client.close();
            full?.close();
            restricted?.close();
            await stopDaemon({ env });
            await fs.rm(dir, { recursive: true, force: true });
        },
    };
}

/**
 * A TCP proxy in front of Prosody's websocket, so that a spec can cut a
 * daemon's connection the way a network would: abruptly, with no closing
 * handshake from either side.
 */
export async function startProxy() {
    const target = new URL(WEBSOCKET_URL);
    /** @type {Set<net.Socket>} */
    const sockets = new Set();
    const server = net.createServer((client) => {
        const upstream = net.connect(Number(target.port), target.hostname);
        for (const [a, b] of [
            [client, upstream],
            [upstream, client],
        ]) {
            sockets.add(a);
            a.pipe(b);
            a.on('error', () => b.destroy());
            a.on('close', () => {
                sockets.delete(a);
                b.destroy();
            });
        }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(undefined)));
    const { port } = /** @type {net.AddressInfo} */ (server.address());

    return {
        websocket_url: `ws://127.0.0.1:${port}${target.pathname}`,
        /** Cuts every connection through the proxy, which keeps accepting new ones. */
        drop() {
            sockets.forEach((s) => s.resetAndDestroy());
        },
        close() {
            sockets.forEach((s) => s.destroy());
            return new Promise((resolve) => server.close(() => resolve(undefined)));
        },
    };
}
