/**
 * Daemons on the test Prosody (tests/prosody), one process per account,
 * since headless can host only one account per process. Each is a real
 * daemon, started the way a client starts one, and driven through its socket.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { connect, stopDaemon } from '../client.js';
import { registerAccount, WEBSOCKET_URL } from '../../../tests/prosody/server.js';

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
 * Starts a daemon for an account, waits until it's connected, and returns a
 * client connected to it.
 * @param {{ jid: string, password: string }} account
 * @param {Object} [options]
 * @param {string} [options.resource]
 */
export async function startDaemon(account, { resource = 'claude' } = {}) {
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
            password: account.password,
            websocket_url: WEBSOCKET_URL,
            resource,
            settings: { discover_connection_methods: false, loglevel: 'info' },
        }),
    );

    const client = await connect({ env });
    const log = path.join(env.XDG_STATE_HOME, 'converse', `${account.jid}.log`);
    try {
        await eventually(async () => (await client.request('daemon.status')).connected, {
            timeout: 15000,
            what: `${account.jid} to connect`,
        });
    } catch (e) {
        const output = await fs.readFile(log, 'utf8').catch(() => '');
        throw new Error(`${e.message}. Daemon log:\n${output}`, { cause: e });
    }

    return {
        jid: account.jid,
        full_jid: `${account.jid}/${resource}`,
        /**
         * @param {string} method
         * @param {Object} [params]
         */
        request: (method, params) => client.request(method, params),
        async stop() {
            client.close();
            await stopDaemon({ env });
            await fs.rm(dir, { recursive: true, force: true });
        },
    };
}

/**
 * Registers a fresh account and starts a daemon for it.
 * @param {string} name - Used in the JID, so logs say who's who.
 */
export async function startDaemonForNewAccount(name) {
    return startDaemon(await registerAccount(name));
}

export { registerAccount };
