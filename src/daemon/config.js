/**
 * Where the daemon's account configuration and files live. Kept free of any
 * `@converse/headless` import: clients need it to find the socket.
 * @module @converse/daemon/config
 */
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const DEFAULT_RESOURCE = 'claude';
const DEFAULT_CONSUMER = 'claude';

/**
 * The longest unix socket path every platform accepts (macOS allows 104 bytes).
 */
const MAX_SOCKET_PATH = 103;

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {string}
 */
export function getConfigPath(env = process.env) {
    const config_home = env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    return path.join(config_home, 'converse', 'daemon.json');
}

/**
 * Reads and validates the account configuration. The password is not
 * resolved here, only by the daemon (see {@link getPassword}), so that a
 * client never touches it.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {import('./types').Config}
 */
export function loadConfig(env = process.env) {
    const config_path = getConfigPath(env);
    let raw;
    try {
        raw = JSON.parse(fs.readFileSync(config_path, 'utf8'));
    } catch (e) {
        if (e.code === 'ENOENT') {
            throw new Error(
                `No account configured. Create ${config_path} containing at least ` +
                    `{"jid": "you@example.org", "websocket_url": "wss://example.org/xmpp-websocket"}.`,
                { cause: e },
            );
        }
        throw new Error(`Could not read ${config_path}: ${e.message}`, { cause: e });
    }

    const jid = typeof raw.jid === 'string' ? raw.jid.trim().toLowerCase() : '';
    if (!(/^[^@/\s]+@[^@/\s]+$/).test(jid)) {
        throw new Error(`"jid" in ${config_path} must be a bare JID such as "you@example.org".`);
    }

    return {
        jid,
        password: raw.password,
        websocket_url: raw.websocket_url,
        resource: raw.resource || DEFAULT_RESOURCE,
        consumer: raw.consumer || DEFAULT_CONSUMER,
        settings: raw.settings ?? {},
        paths: getPaths(jid, env),
    };
}

/**
 * The runtime directory holds the socket and pidfile, one pair per account.
 * It's created owner-only, which is what keeps other local users off the
 * socket.
 * @param {string} jid
 * @param {NodeJS.ProcessEnv} env
 * @returns {import('./types').Paths}
 */
function getPaths(jid, env) {
    const runtime_dir = env.XDG_RUNTIME_DIR
        ? path.join(env.XDG_RUNTIME_DIR, 'converse')
        : path.join(os.tmpdir(), `converse-${process.getuid()}`);
    const state_home = env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
    // A unix socket's path can't be longer than about 104 bytes (108 on Linux,
    // less the terminator), so a long JID gets a hash of it instead.
    const fits = Buffer.byteLength(path.join(runtime_dir, `${jid}.sock`)) <= MAX_SOCKET_PATH;
    const name = fits ? jid : crypto.createHash('sha256').update(jid).digest('hex').slice(0, 16);
    return {
        config: getConfigPath(env),
        runtime_dir,
        socket: path.join(runtime_dir, `${name}.sock`),
        pidfile: path.join(runtime_dir, `${name}.pid`),
        log: path.join(state_home, 'converse', `${jid}.log`),
        cursors: path.join(state_home, 'converse', `${name}.cursors.json`),
    };
}

/**
 * The account password: from the config file if it has one, otherwise from
 * the system keyring (libsecret's `secret-tool` on Linux, `security` on
 * macOS), under service "converse" and the bare JID as account.
 * @param {import('./types').Config} config
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<string>}
 */
export async function getPassword(config, env = process.env) {
    if (config.password) return config.password;

    const [cmd, args, store_hint] =
        process.platform === 'darwin'
            ? [
                  'security',
                  ['find-generic-password', '-s', 'converse', '-a', config.jid, '-w'],
                  `security add-generic-password -s converse -a ${config.jid} -w`,
              ]
            : [
                  'secret-tool',
                  ['lookup', 'service', 'converse', 'account', config.jid],
                  `secret-tool store --label=Converse service converse account ${config.jid}`,
              ];
    try {
        const { stdout } = await promisify(execFile)(cmd, args, { env });
        const password = stdout.replace(/\n$/, '');
        if (password) return password;
    } catch {
        // Not installed, or no such entry: both end in the error below.
    }
    throw new Error(
        `No password for ${config.jid}. Store one in the system keyring with "${store_hint}", ` +
            `or set "password" in ${config.paths.config}.`,
    );
}
