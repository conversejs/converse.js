/**
 * A real Prosody for tests, in a Docker container: started, waited on,
 * stopped, and given fresh accounts.
 *
 * Shared by every real-server test, whatever it tests, so it knows nothing of
 * the daemon or of Converse. Also a command line for CI:
 *
 *     node tests/prosody/server.js start|stop
 *
 * @module tests/prosody/server
 */
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

/**
 * The same Prosody as xmpp.docker uses, pinned by digest.
 */
const IMAGE = 'prosodyim/prosody:13.0@sha256:e44a7dfedb776c8945b5c6401a3437a009b549923f7bbcb5a480c2de5f86e5d7';
const CONFIG = fileURLToPath(new URL('./prosody.cfg.lua', import.meta.url));

const CONTAINER = process.env.CONVERSE_PROSODY_CONTAINER || 'converse-test-prosody';
const PORT = Number(process.env.CONVERSE_PROSODY_PORT || 15280);
const READY_TIMEOUT = 30000;

export const DOMAIN = 'localhost';
export const MUC_DOMAIN = 'conference.localhost';
export const WEBSOCKET_URL = `ws://127.0.0.1:${PORT}/xmpp-websocket`;

/**
 * @param {string[]} args
 */
async function docker(...args) {
    const { stdout } = await promisify(execFile)('docker', args);
    return stdout.trim();
}

/**
 * @returns {Promise<boolean>}
 */
export async function isRunning() {
    try {
        return (await docker('inspect', '--format', '{{.State.Running}}', CONTAINER)) === 'true';
    } catch {
        return false;
    }
}

/**
 * Starts the container, unless it's running already, and waits until Prosody
 * serves the websocket.
 * @returns {Promise<boolean>} Whether this call started it.
 */
export async function start() {
    if (await isRunning()) {
        await waitUntilReady();
        return false;
    }
    await docker(
        'run',
        '--detach',
        '--rm',
        '--name',
        CONTAINER,
        '--publish',
        `127.0.0.1:${PORT}:5280`,
        '--volume',
        `${CONFIG}:/etc/prosody/prosody.cfg.lua:ro`,
        IMAGE,
    );
    await waitUntilReady();
    return true;
}

export async function stop() {
    if (await isRunning()) await docker('stop', CONTAINER);
}

async function waitUntilReady() {
    const deadline = Date.now() + READY_TIMEOUT;
    for (;;) {
        try {
            // Prosody answers a plain GET on its websocket endpoint.
            if ((await fetch(`http://127.0.0.1:${PORT}/xmpp-websocket`)).ok) return;
        } catch {
            // Not listening yet
        }
        if (Date.now() > deadline) {
            const logs = await docker('logs', '--tail', '30', CONTAINER).catch(() => '');
            throw new Error(`Prosody didn't come up within ${READY_TIMEOUT / 1000}s.\n${logs}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
}

/**
 * Registers a new account with a random name, so that tests share no state.
 * @param {string} [prefix] - Makes the JID say what it's for, in logs.
 * @returns {Promise<{ jid: string, password: string }>}
 */
export async function registerAccount(prefix = 'user') {
    const local = `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
    const password = crypto.randomBytes(12).toString('hex');
    await docker('exec', CONTAINER, 'prosodyctl', 'register', local, DOMAIN, password);
    return { jid: `${local}@${DOMAIN}`, password };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const command = process.argv[2];
    if (command === 'start') {
        await start();
        process.stdout.write(`Prosody is up at ${WEBSOCKET_URL}\n`);
    } else if (command === 'stop') {
        await stop();
    } else {
        process.stderr.write('Usage: node tests/prosody/server.js start|stop\n');
        process.exitCode = 1;
    }
}
