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
const ACCESS_LEVELS = ['restricted', 'full'];
const BARE_JID = /^[^@/\s]+@[^@/\s]+$/;

/**
 * Agents get restricted access and may send to nobody until the user lists
 * them, so a fresh install can't send anything. Every restricted send to
 * someone else is a draft, delivered to the owner, so the allowlist is who a
 * draft may be for.
 */
const DEFAULT_POLICY = {
    allow: [],
    rooms: [], // Rooms restricted access may send to, and join or leave
    rate_limit: { per_conversation: 5, per_room: 2, overall: 20, window: 60 }, // Sends per window, in seconds
    presence: false, // Whether restricted access may change our availability and status message
};

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
                    `{"jid": "agent@example.org", "owner": "you@example.org", "websocket_url": "wss://example.org/xmpp-websocket"}.`,
                { cause: e },
            );
        }
        throw new Error(`Could not read ${config_path}: ${e.message}`, { cause: e });
    }

    const jid = typeof raw.jid === 'string' ? raw.jid.trim().toLowerCase() : '';
    if (!BARE_JID.test(jid)) {
        throw new Error(`"jid" in ${config_path} must be a bare JID such as "you@example.org".`);
    }

    const access = raw.access ?? 'restricted';
    if (!ACCESS_LEVELS.includes(access)) {
        throw new Error(`"access" in ${config_path} must be one of: ${ACCESS_LEVELS.join(', ')}.`);
    }

    // Drafts are delivered here, so the agent's own account must never be the owner.
    const owner = typeof raw.owner === 'string' ? raw.owner.trim().toLowerCase() : '';
    if (!BARE_JID.test(owner)) {
        throw new Error(`"owner" in ${config_path} must be your bare JID, such as "you@example.org".`);
    }
    if (owner === jid) {
        throw new Error(`"owner" in ${config_path} must be a different account from "jid", the agent's own.`);
    }

    return {
        jid,
        owner,
        password: raw.password,
        websocket_url: raw.websocket_url,
        resource: raw.resource || DEFAULT_RESOURCE,
        consumer: raw.consumer || DEFAULT_CONSUMER,
        // The access level the CLI connects at. Restricted unless the user says otherwise.
        access,
        policy: parsePolicy(raw.policy, config_path),
        settings: raw.settings ?? {},
        paths: getPaths(jid, env),
    };
}

/**
 * @param {unknown} raw - The "policy" object from the config file, if any
 * @param {string} config_path
 * @returns {import('./types').Policy}
 */
function parsePolicy(raw, config_path) {
    const allow = raw?.allow ?? DEFAULT_POLICY.allow;
    const rooms = raw?.rooms ?? DEFAULT_POLICY.rooms;
    const rate_limit = { ...DEFAULT_POLICY.rate_limit, ...(raw?.rate_limit ?? {}) };
    if (!Array.isArray(allow) || !allow.every((jid) => typeof jid === 'string' && BARE_JID.test(jid.trim()))) {
        throw new Error(`"policy.allow" in ${config_path} must be a list of bare JIDs.`);
    }
    if (!Array.isArray(rooms) || !rooms.every((jid) => typeof jid === 'string' && BARE_JID.test(jid.trim()))) {
        throw new Error(`"policy.rooms" in ${config_path} must be a list of room JIDs.`);
    }
    for (const key of Object.keys(DEFAULT_POLICY.rate_limit)) {
        if (!Number.isInteger(rate_limit[key]) || rate_limit[key] < 1) {
            throw new Error(`"policy.rate_limit.${key}" in ${config_path} must be a whole number of at least 1.`);
        }
    }
    const presence = raw?.presence ?? DEFAULT_POLICY.presence;
    if (typeof presence !== 'boolean') {
        throw new Error(`"policy.presence" in ${config_path} must be true or false.`);
    }
    return {
        allow: allow.map((jid) => jid.trim().toLowerCase()),
        rooms: rooms.map((jid) => jid.trim().toLowerCase()),
        rate_limit,
        presence,
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
    const fits = Buffer.byteLength(path.join(runtime_dir, `${jid}.restricted.sock`)) <= MAX_SOCKET_PATH;
    const name = fits ? jid : crypto.createHash('sha256').update(jid).digest('hex').slice(0, 16);
    return {
        config: getConfigPath(env),
        runtime_dir,
        socket: path.join(runtime_dir, `${name}.sock`),
        restricted_socket: path.join(runtime_dir, `${name}.restricted.sock`),
        pidfile: path.join(runtime_dir, `${name}.pid`),
        log: path.join(state_home, 'converse', `${jid}.log`),
        cursors: path.join(state_home, 'converse', `${name}.cursors.json`),
        audit: path.join(state_home, 'converse', `${jid}.audit.jsonl`),
        drafts: path.join(state_home, 'converse', `${name}.drafts.json`),
        rooms: path.join(state_home, 'converse', `${name}.rooms.json`),
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
