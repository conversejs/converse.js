/**
 * The accounts, and how each is configured: what its config file says, and
 * where its sockets and files go. Kept free of any `@converse/headless`
 * import: clients need it to find the socket.
 * @module @converse/daemon/config
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getRuntimeDir } from './registry.js';

const DEFAULT_RESOURCE = 'agent';
const DEFAULT_CONSUMER = 'agent';
const ACCESS_LEVELS = ['restricted', 'full'];
const MODES = ['owner_only', 'bot', 'as_user'];
const BARE_JID = /^[^@/\s]+@[^@/\s]+$/;

/**
 * Agents get restricted access and may send to nobody until the user lists
 * them, so a fresh install can't send anything. Every restricted send to
 * someone else is a draft, delivered to the owner, so the allowlist is who a
 * draft may be for.
 */
const DEFAULT_POLICY = {
    allow: [], // Contacts a restricted send may be drafted for
    direct: [], // Contacts restricted access may message directly, in "bot" mode
    rooms: [], // Rooms restricted access may send to, and join or leave
    rate_limit: { per_conversation: 5, per_room: 2, overall: 20, window: 60 }, // Sends per window, in seconds
    presence: false, // Whether restricted access may change our availability and status message
};

/**
 * The longest unix socket path every platform accepts (macOS allows 104 bytes).
 */
const MAX_SOCKET_PATH = 103;

/**
 * What an account may be called: the name of its file in the accounts
 * directory, without the ".json".
 */
const ACCOUNT_NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

/**
 * The account used when none is named and there are several.
 */
const DEFAULT_ACCOUNT = 'default';

/**
 * Raised when the account asked for isn't configured, or none was asked for
 * and there's no telling which one is meant. Lists the accounts there are.
 */
export class AccountError extends Error {
    name = 'AccountError';

    /**
     * @param {string} message
     * @param {'not_found'|'ambiguous'} reason
     * @param {string[]} candidates - The names of the accounts there are
     */
    constructor(message, reason, candidates) {
        super(message);
        this.reason = reason;
        this.candidates = candidates;
    }
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {string} The directory that holds the accounts directory
 */
export function getConfigDir(env = process.env) {
    const config_home = env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    return path.join(config_home, 'converse');
}

/**
 * The configured accounts: each file in the accounts directory, by name.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {import('./types').Account[]}
 */
export function listAccounts(env = process.env) {
    const dir = getConfigDir(env);
    /** @type {import('./types').Account[]} */
    const accounts = [];
    let files = [];
    try {
        files = fs.readdirSync(path.join(dir, 'accounts'));
    } catch (e) {
        if (e.code !== 'ENOENT') throw e;
    }
    for (const file of files.filter((f) => f.endsWith('.json')).sort()) {
        const name = file.slice(0, -'.json'.length);
        if (!ACCOUNT_NAME.test(name)) continue;

        accounts.push({ name, config: path.join(dir, 'accounts', file), default: false });
    }
    // The account "default" if there is one, otherwise the only account.
    const fallback = accounts.find((a) => a.name === DEFAULT_ACCOUNT) ?? (accounts.length === 1 ? accounts[0] : null);
    if (fallback) fallback.default = true;
    return accounts;
}

/**
 * The account to use: the one `CONVERSE_ACCOUNT` names (which `--account`
 * sets), otherwise the default one.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {import('./types').Account}
 */
export function getAccount(env = process.env) {
    const accounts = listAccounts(env);
    const names = accounts.map((a) => a.name);
    const wanted = env.CONVERSE_ACCOUNT;
    const dir = getConfigDir(env);
    if (wanted) {
        const account = accounts.find((a) => a.name === wanted);
        if (account) return account;

        const file = path.join(dir, 'accounts', `${wanted}.json`);
        throw new AccountError(
            names.length
                ? `No account is called "${wanted}". Pick one of these with --account <name>, or create ${file}.`
                : `No account is called "${wanted}", and none is configured. Create ${file}.`,
            'not_found',
            names,
        );
    }
    const account = accounts.find((a) => a.default);
    if (account) return account;

    if (accounts.length) {
        throw new AccountError(
            'Several accounts are configured, and none is the default. Pick one of these with ' +
                '--account <name>, or CONVERSE_ACCOUNT=<name>.',
            'ambiguous',
            names,
        );
    }
    throw new Error(
        `No account configured. Create ${path.join(dir, 'accounts', `${DEFAULT_ACCOUNT}.json`)} containing at least ` +
            `{"jid": "agent@example.org", "owner": "you@example.org", "websocket_url": "wss://example.org/xmpp-websocket"}.`,
    );
}

/**
 * The config file of the account to use. With no account configured, where
 * the default one goes.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function getConfigPath(env = process.env) {
    try {
        return getAccount(env).config;
    } catch {
        return path.join(getConfigDir(env), 'accounts', `${DEFAULT_ACCOUNT}.json`);
    }
}

/**
 * Reads and validates the account configuration. The password is not
 * resolved here, only by the daemon (see {@link getPassword}), so that a
 * client never touches it.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {import('./types').Config}
 */
export function loadConfig(env = process.env) {
    const account = getAccount(env);
    const config_path = account.config;
    let raw;
    try {
        raw = JSON.parse(fs.readFileSync(config_path, 'utf8'));
    } catch (e) {
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

    const mode = raw.mode ?? 'owner_only';
    if (!MODES.includes(mode)) {
        throw new Error(`"mode" in ${config_path} must be one of: ${MODES.join(', ')}.`);
    }

    // In "owner_only" and "bot", drafts are delivered to the owner, and direct
    // sends to the owner go there, so the agent's own account must never be
    // the owner. In "as_user" the account is the user's own, so it's the owner
    // too, and that's the only owner it can have.
    const owner = typeof raw.owner === 'string' ? raw.owner.trim().toLowerCase() : mode === 'as_user' ? jid : '';
    if (!BARE_JID.test(owner)) {
        throw new Error(`"owner" in ${config_path} must be your bare JID, such as "you@example.org".`);
    }
    if (mode === 'as_user' && owner !== jid) {
        throw new Error(
            `"owner" in ${config_path} must be the same account as "jid" in "as_user" mode, where the agent ` +
                'acts as you. Leave "owner" out, or set it to your own JID.',
        );
    }
    if (mode !== 'as_user' && owner === jid) {
        throw new Error(`"owner" in ${config_path} must be a different account from "jid", the agent's own.`);
    }

    // A group id may be given as a number or a string of digits.
    const socket_group = Number.isInteger(raw.socket_group) ? String(raw.socket_group) : (raw.socket_group ?? null);
    if (socket_group !== null && !(typeof socket_group === 'string' && socket_group.trim())) {
        throw new Error(`"socket_group" in ${config_path} must be the name or number of a group you're in.`);
    }
    const restricted_dir = raw.restricted_dir ?? null;
    if (restricted_dir !== null && !(typeof restricted_dir === 'string' && path.isAbsolute(restricted_dir))) {
        throw new Error(`"restricted_dir" in ${config_path} must be an absolute path.`);
    }

    const sockets = parseSockets(raw, config_path);

    const allow_unencrypted_resend = raw.allow_unencrypted_resend ?? false;
    if (typeof allow_unencrypted_resend !== 'boolean') {
        throw new Error(`"allow_unencrypted_resend" in ${config_path} must be true or false.`);
    }

    return {
        account: account.name,
        jid,
        owner,
        websocket_url: raw.websocket_url,
        resource: raw.resource || DEFAULT_RESOURCE,
        consumer: raw.consumer || DEFAULT_CONSUMER,
        // The access level the CLI connects at. Restricted unless the user says otherwise.
        access,
        mode,
        allow_unencrypted_resend,
        socket_group: socket_group?.trim() ?? null,
        sockets,
        policy: parsePolicy(raw.policy, config_path, mode),
        settings: raw.settings ?? {},
        paths: getPaths(account, env, restricted_dir),
    };
}

/**
 * The sockets the config names, which replace the derived ones for a client:
 * where to reach a daemon on another host, through an SSH socket forward.
 * @param {Record<string, unknown>} raw - The config file's contents
 * @param {string} config_path
 * @returns {import('./types').Sockets|null} Null if the config names neither
 */
function parseSockets(raw, config_path) {
    const sockets = { socket: raw.socket ?? null, restricted_socket: raw.restricted_socket ?? null };
    for (const [key, value] of Object.entries(sockets)) {
        if (value !== null && !(typeof value === 'string' && path.isAbsolute(value))) {
            throw new Error(`"${key}" in ${config_path} must be an absolute path.`);
        }
    }
    if (sockets.socket === null && sockets.restricted_socket === null) return null;

    return /** @type {import('./types').Sockets} */ (sockets);
}

/**
 * @param {Record<string, any>|undefined} raw - The "policy" object from the config file, if any
 * @param {string} config_path
 * @param {import('./types').Mode} mode
 * @returns {import('./types').Policy}
 */
function parsePolicy(raw, config_path, mode) {
    const allow = raw?.allow ?? DEFAULT_POLICY.allow;
    const direct = raw?.direct ?? DEFAULT_POLICY.direct;
    const rooms = raw?.rooms ?? DEFAULT_POLICY.rooms;
    const rate_limit = { ...DEFAULT_POLICY.rate_limit, ...(raw?.rate_limit ?? {}) };
    if (!Array.isArray(allow) || !allow.every((jid) => typeof jid === 'string' && BARE_JID.test(jid.trim()))) {
        throw new Error(`"policy.allow" in ${config_path} must be a list of bare JIDs.`);
    }
    if (!Array.isArray(direct) || !direct.every((jid) => typeof jid === 'string' && BARE_JID.test(jid.trim()))) {
        throw new Error(`"policy.direct" in ${config_path} must be a list of bare JIDs.`);
    }
    // Acting as the user, nothing goes out without the user's approval, so
    // there's nobody the agent may message directly.
    if (mode === 'as_user' && direct.length) {
        throw new Error(
            `"policy.direct" in ${config_path} can't be used in "as_user" mode, where every restricted send ` +
                'is a draft for you to approve. Remove it, or list those contacts in "policy.allow".',
        );
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
        direct: direct.map((jid) => jid.trim().toLowerCase()),
        rooms: rooms.map((jid) => jid.trim().toLowerCase()),
        rate_limit,
        presence,
    };
}

/**
 * Everything the daemon keeps is under its account's name, so that a change
 * to the config's JID or a rename of its file never splits it up.
 *
 * The runtime directory holds the full access socket and the pidfile, one pair
 * per account. It's created owner-only, which is what keeps other local users
 * off the full access socket. The restricted socket is in a directory of its
 * own, inside the runtime directory unless the config puts it elsewhere, so
 * that a sandbox can be given that directory alone. Beside them, a running
 * daemon leaves a record (see {@link findDaemon}).
 *
 * What outlasts the daemon is in the account's state directory: the headless
 * database, and the daemon's own files beside it.
 * @param {import('./types').Account} account
 * @param {NodeJS.ProcessEnv} env
 * @param {string|null} restricted_dir - The directory the config names for the restricted socket, if any
 * @returns {import('./types').Paths}
 */
function getPaths(account, env, restricted_dir) {
    const runtime_dir = getRuntimeDir(env);
    const state_home = env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
    const state_dir = path.join(state_home, 'converse', 'accounts', account.name);
    // A unix socket's path can't be longer than about 104 bytes (108 on Linux,
    // less the terminator), so a long account name gets a hash of it instead.
    const fits = Buffer.byteLength(path.join(runtime_dir, `${account.name}.restricted`, 'sock')) <= MAX_SOCKET_PATH;
    const name = fits ? account.name : crypto.createHash('sha256').update(account.name).digest('hex').slice(0, 16);
    restricted_dir ??= path.join(runtime_dir, `${name}.restricted`);
    return {
        config: account.config,
        runtime_dir,
        socket: path.join(runtime_dir, `${name}.sock`),
        restricted_dir,
        restricted_socket: path.join(restricted_dir, 'sock'),
        pidfile: path.join(runtime_dir, `${name}.pid`),
        record: path.join(runtime_dir, 'accounts', `${account.name}.json`),
        storage: state_dir,
        log: path.join(state_dir, 'daemon.log'),
        cursors: path.join(state_dir, 'cursors.json'),
        audit: path.join(state_dir, 'audit.jsonl'),
        drafts: path.join(state_dir, 'drafts.json'),
        rooms: path.join(state_dir, 'rooms.json'),
    };
}

/**
 * The restricted socket a client was pointed at with `CONVERSE_SOCKET`, for a
 * client without the account's config, such as an agent in a sandbox or
 * running as another OS user.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string|null}
 */
export function getSocketFromEnv(env = process.env) {
    const socket = env.CONVERSE_SOCKET;
    if (!socket) return null;

    if (!path.isAbsolute(socket)) {
        throw new Error(
            `CONVERSE_SOCKET must be the absolute path of the daemon's restricted socket, not "${socket}".`,
        );
    }
    return socket;
}
