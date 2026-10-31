/**
 * The daemon: one headless session, shared over a unix socket.
 * @module @converse/daemon/daemon
 */
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { _converse, api, converse, log } from '@converse/headless';
import { createAudit } from './audit.js';
import { contactMethods } from './contacts.js';
import { checkRuntimeDir, findDaemon, getGroupId, getPassword, isRunning } from './config.js';
import { createCursors } from './cursors.js';
import { createDrafter, createDraftStore, draftMethods } from './drafts.js';
import { createEvents } from './events.js';
import { fileMethods } from './files.js';
import { inboxMethods } from './inbox.js';
import { messageMethods } from './messages.js';
import { omemoMethods } from './omemo.js';
import { presenceMethods } from './presence.js';
import { createRoomStore, rejoinRooms, roomMethods } from './rooms.js';
import { createPolicy } from './policy.js';
import { ERRORS, MAX_LINE_LENGTH, PROTOCOL_VERSION, RPCError } from './protocol.js';
import { createSendRouter } from './routing.js';
import { scheduleMethods } from './schedules.js';

/**
 * How long shutdown waits for the server to see us leave before giving up.
 */
const SHUTDOWN_TIMEOUT = 5000;

/**
 * Methods that restricted connections may not call. Restricted access covers
 * reads and drafted sends. Stopping the daemon, reviewing, sending or dropping
 * drafts, and sending or discarding a failed send again, are the user's to do.
 */
const FULL_ACCESS_METHODS = [
    'daemon.stop',
    'drafts.get',
    'drafts.list',
    'drafts.reject',
    'drafts.send',
    'messages.discard',
    'messages.resend',
    'omemo.devices.trust',
];

/**
 * The full access methods restricted connections may call in "as_user" mode.
 * There the drafts wait in the daemon, so the agent may see which are still
 * waiting, but not send or drop them.
 */
const AS_USER_RESTRICTED_METHODS = ['drafts.get', 'drafts.list'];

/**
 * How the daemon's connection identifies itself to contacts, as a bot. This
 * is a label for other clients to show, not a permission: it's self-declared.
 */
const BOT_IDENTITY = { category: 'client', type: 'bot', name: 'Converse daemon' };

/**
 * Starts the daemon for the configured account: claims its pidfile, logs in,
 * and serves the socket until {@link Daemon.stop} is called.
 * @param {import('./types').Config} config
 */
export async function start(config) {
    const { paths } = config;
    if (config.sockets) {
        // Such a config is a client's copy, for reaching a daemon that runs on another host.
        throw new Error(
            `${paths.config} names the sockets of a daemon elsewhere ("socket" or "restricted_socket"), ` +
                'so a daemon for it runs on that host, not here. Remove them to run the daemon on this host.',
        );
    }
    if (config.mode === 'as_user') {
        log.warn(
            `The daemon acts as ${config.jid} itself ("mode": "as_user"). Restricted access is only as strong ` +
                `as the agent's isolation from the full access socket, ${paths.socket}: an agent that can reach ` +
                'it can approve its own drafts.',
        );
    }
    await fs.mkdir(paths.runtime_dir, { recursive: true, mode: 0o700 });
    // mkdir leaves an existing directory alone, whoever made it, and whatever its mode.
    checkRuntimeDir(paths.runtime_dir, { check_mode: false });
    await fs.chmod(paths.runtime_dir, 0o700);
    await claimPidfile(config);
    try {
        await writeRecord(config);
        const gid = await prepareRestrictedDir(config);
        return await serve(config, gid);
    } catch (e) {
        await removeRecord(config);
        await fs.rm(paths.pidfile, { force: true });
        throw e;
    }
}

/**
 * Makes the restricted socket's directory, or takes the one the config names,
 * and opens it to the configured group, if there is one. A directory that
 * isn't ours, such as one another user made first in a shared place like
 * `/tmp`, is refused rather than used.
 * @param {import('./types').Config} config
 * @returns {Promise<number|null>} The id of the group the restricted socket is for, if any
 */
async function prepareRestrictedDir({ paths, socket_group }) {
    const dir = paths.restricted_dir;
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const stat = await fs.lstat(dir);
    if (!stat.isDirectory() || stat.uid !== process.getuid()) {
        throw new Error(
            `${dir}, the restricted socket's directory, isn't a directory of the daemon's own user. ` +
                'Remove it, or set "restricted_dir" to another path.',
        );
    }
    if (socket_group === null) {
        await fs.chmod(dir, 0o700);
        return null;
    }
    const gid = await getGroupId(socket_group);
    if (!process.getgroups().includes(gid)) {
        throw new Error(
            `The daemon's user isn't in the group "${socket_group}" that "socket_group" names. ` +
                'Add it to the group (and log in again), or name another group.',
        );
    }
    if (dir.startsWith(paths.runtime_dir + path.sep)) {
        log.warn(
            `The restricted socket's directory is inside ${paths.runtime_dir}, which only the daemon's user ` +
                `can enter, so another user in "${socket_group}" can't reach it. Set "restricted_dir" ` +
                'to a directory outside it.',
        );
    }
    await fs.chown(dir, -1, gid);
    await fs.chmod(dir, 0o750);
    return gid;
}

/**
 * @param {import('./types').Config} config
 * @param {number|null} gid - The group the restricted socket is for, if any
 */
async function serve(config, gid) {
    const { paths } = config;
    const password = await getPassword(config);
    const started = new Date();

    await converse.initialize({
        websocket_url: config.websocket_url,
        ...(paths.storage ? { storage_path: paths.storage } : {}),
        ...config.settings,
    });

    const events = createEvents(_converse);
    const policy = createPolicy(config);
    const audit = createAudit(paths.audit);
    const drafts = createDraftStore(paths.drafts);
    const rooms = createRoomStore(paths.rooms);
    const routeSend = createSendRouter(_converse, { policy, audit, mode: config.mode });
    const queueDraft = createDrafter(_converse, { drafts, audit, events, owner: config.owner, mode: config.mode });
    // Headless sets up its client identity on connect, so the bot identity has to be set after that.
    api.listen.on('addClientFeatures', () => {
        api.disco.own.identities.clear();
        api.disco.own.identities.add(BOT_IDENTITY.category, BOT_IDENTITY.type, BOT_IDENTITY.name);
    });
    const messages = messageMethods(_converse, {
        routeSend,
        audit,
        queueDraft,
        mode: config.mode,
        allow_unencrypted_resend: config.allow_unencrypted_resend,
    });
    const schedules = scheduleMethods(_converse, {
        routeSend,
        sendNow: messages['messages.send'],
        mode: config.mode,
    });
    api.listen.on('scheduledMessageDue', schedules.onDue);
    const methods = {
        ...messages,
        ...schedules.methods,
        ...fileMethods(_converse, { routeSend, audit, queueDraft }),
        ...draftMethods(_converse, { drafts, audit, events, owner: config.owner, mode: config.mode }),
        ...inboxMethods(_converse, createCursors(paths.cursors)),
        ...contactMethods(_converse),
        ...presenceMethods(_converse, { config }),
        ...omemoMethods(_converse),
        ...roomMethods(_converse, { config, policy, store: rooms }),
        ...events.methods,
        /** @returns {import('./types').Status} */
        'daemon.status': () => ({
            connected: api.connection.connected(),
            jid: getJID(),
            resumed: !!(api.connection.connected() && api.connection.get().hasResumed()),
            pid: process.pid,
            started: started.toISOString(),
            uptime: Math.floor((Date.now() - started.getTime()) / 1000),
        }),
        'daemon.stop': () => {
            // Reply first; the response can't be written once the socket is closed.
            setImmediate(stop);
            return {};
        },
    };

    const getJID = () => (api.connection.connected() ? _converse.session.get('jid') : null);

    /** @type {Set<net.Socket>} */
    const clients = new Set();
    /** @param {import('./types').Access} access */
    const onConnection = (access) => (socket) => {
        clients.add(socket);
        socket.on('close', () => clients.delete(socket));
        socket.on('error', (e) => log.debug(`Client socket error: ${e.message}`));
        serveClient(socket, { access, config, methods, getJID, events });
    };
    // Each access level has its own socket, so the level belongs to the connection.
    const servers = [
        await listen(paths.socket, onConnection('full')),
        await listen(paths.restricted_socket, onConnection('restricted'), gid),
    ];

    await api.user.login(`${config.jid}/${config.resource}`, password);
    // Not awaited: a room that takes a while to confirm mustn't hold up the socket.
    rejoinRooms(_converse, rooms);

    const { promise: stopped, resolve: resolveStopped } = Promise.withResolvers();
    let stopping;

    function stop() {
        stopping ??= (async () => {
            servers.forEach((server) => server.close());
            clients.forEach((socket) => socket.end());
            try {
                if (api.connection.connected()) {
                    await withTimeout(leave(), SHUTDOWN_TIMEOUT);
                }
            } catch (e) {
                // Still clean up below: a daemon left with its pidfile behind blocks the next one.
                log.error(`Couldn't leave cleanly: ${e.message}`);
            } finally {
                await fs.rm(paths.socket, { force: true });
                await fs.rm(paths.restricted_socket, { force: true });
                await removeRecord(config);
                await fs.rm(paths.pidfile, { force: true });
                resolveStopped(undefined);
            }
        })();
        return stopping;
    }

    return {
        /** Resolves once the daemon has stopped, whoever stopped it. */
        stopped,
        /** Leaves MUCs, logs out and stops serving the socket. */
        stop,
    };
}

/**
 * Listens on a unix socket, readable and writable by its owner only, or also
 * by the group `gid` if one is given.
 * @param {string} socket_path
 * @param {(socket: net.Socket) => void} onConnection
 * @param {number|null} [gid]
 * @returns {Promise<net.Server>}
 */
async function listen(socket_path, onConnection, gid = null) {
    const server = net.createServer(onConnection);
    // A socket file left behind by a daemon that died isn't in use: the pidfile
    // we hold says no other daemon is running.
    await fs.rm(socket_path, { force: true });
    await new Promise((resolve, reject) => {
        server.once('error', (e) =>
            reject(
                e.code === 'EINVAL'
                    ? new Error(
                          `Can't listen on ${socket_path}: the path is too long for a unix socket. ` +
                              'Point XDG_RUNTIME_DIR, or "restricted_dir", at a shorter directory.',
                          { cause: e },
                      )
                    : e,
            ),
        );
        server.listen(socket_path, () => resolve(undefined));
    });
    if (gid === null) {
        await fs.chmod(socket_path, 0o600);
    } else {
        await fs.chown(socket_path, -1, gid);
        await fs.chmod(socket_path, 0o660);
    }
    return server;
}

/**
 * Leaves every joined MUC, then logs out, which sends unavailable presence.
 */
async function leave() {
    const rooms = /** @type {any[]} */ (await api.rooms.get());
    await Promise.all(rooms.filter((room) => room.isEntered()).map((room) => room.leave()));
    await api.user.logout();
}

/**
 * Speaks JSON-RPC 2.0 to one client, one message per line. The first request
 * must be `hello`, which settles the protocol version.
 * @param {net.Socket} socket
 * @param {Object} context
 * @param {import('./types').Config} context.config
 * @param {import('./types').Access} context.access - The level of the socket this client connected to
 * @param {Record<string, (params: any, client: import('./types').Client) => unknown>} context.methods
 * @param {() => string|null} context.getJID
 * @param {ReturnType<typeof createEvents>} context.events
 */
function serveClient(socket, { access, config, methods, getJID, events }) {
    /** @type {import('./types').Hello|null} */
    let hello = null;

    const send = (message) => socket.writable && socket.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
    /** @type {import('./types').Client} */
    const client = { access, consumer: null, notify: (params) => send({ method: 'event', params }) };
    socket.once('close', () => events.forget(client));

    const call = (method, params) => {
        if (method === 'hello') {
            if (params?.protocol !== PROTOCOL_VERSION) {
                throw new RPCError(
                    ERRORS.PROTOCOL_MISMATCH,
                    `This daemon speaks protocol version ${PROTOCOL_VERSION} but the client asked for ` +
                        `${params?.protocol}. Upgrade whichever is older; to restart the daemon, ` +
                        `run "converse-cli daemon stop".`,
                    { protocol: PROTOCOL_VERSION },
                );
            }
            hello = {
                protocol: PROTOCOL_VERSION,
                consumer: typeof params.consumer === 'string' && params.consumer ? params.consumer : config.consumer,
                access,
                mode: config.mode,
                jid: getJID(),
            };
            client.consumer = hello.consumer;
            return hello;
        }
        if (!hello) {
            throw new RPCError(ERRORS.HELLO_REQUIRED, 'Send "hello" with the protocol version first.');
        }
        if (!Object.hasOwn(methods, method)) {
            throw new RPCError(ERRORS.METHOD_NOT_FOUND, `Unknown method "${method}".`);
        }
        if (access !== 'full' && FULL_ACCESS_METHODS.includes(method) && !restrictedMayCall(method, config.mode)) {
            throw new RPCError(
                ERRORS.ACCESS_DENIED,
                `"${method}" is only available at full access, and this connection is restricted.`,
            );
        }
        return methods[method](params ?? {}, client);
    };

    const onTooLong = () => {
        const message = {
            id: null,
            error: {
                code: ERRORS.INVALID_REQUEST,
                message:
                    `The request is longer than the ${MAX_LINE_LENGTH} bytes the daemon accepts, so it was ` +
                    'refused and the connection closed.',
            },
        };
        socket.end(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
    };

    readLines(socket, onTooLong, async (line) => {
        let request;
        try {
            request = JSON.parse(line);
        } catch {
            return send({ id: null, error: { code: ERRORS.PARSE_ERROR, message: 'Not valid JSON.' } });
        }
        const { id = null, method, params } = request ?? {};
        if (request?.jsonrpc !== '2.0' || typeof method !== 'string') {
            return send({ id, error: { code: ERRORS.INVALID_REQUEST, message: 'Not a JSON-RPC 2.0 request.' } });
        }
        try {
            const result = await call(method, params);
            // A request without an id is a notification, which gets no response.
            if (id !== null) send({ id, result });
        } catch (e) {
            const { code, message, data } =
                e instanceof RPCError ? e : { code: ERRORS.INTERNAL_ERROR, message: e.message, data: undefined };
            if (id !== null) send({ id, error: { code, message, data } });
            if (code === ERRORS.PROTOCOL_MISMATCH) socket.end();
        }
    });
}

/**
 * Whether a restricted connection may call one of the full access methods, in this mode.
 * @param {string} method
 * @param {import('./types').Mode} mode
 */
const restrictedMayCall = (method, mode) => mode === 'as_user' && AS_USER_RESTRICTED_METHODS.includes(method);

/**
 * Calls `onLine` with each line `socket` sends, like `readline` does, but
 * without buffering a line past {@link MAX_LINE_LENGTH} bytes: a client could
 * otherwise make the daemon hold as much as it cares to send. At that length
 * it calls `onTooLong` instead and drops whatever else comes.
 * @param {net.Socket} socket
 * @param {() => void} onTooLong
 * @param {(line: string) => void} onLine
 */
function readLines(socket, onTooLong, onLine) {
    /** @type {Buffer[]} */
    let chunks = [];
    let length = 0;
    let too_long = false;

    const emit = () => {
        const line = Buffer.concat(chunks).toString('utf8');
        chunks = [];
        length = 0;
        onLine(line.endsWith('\r') ? line.slice(0, -1) : line);
    };

    socket.on('data', (/** @type {Buffer} */ data) => {
        let start = 0;
        while (!too_long) {
            const end = data.indexOf(0x0a, start);
            const piece = data.subarray(start, end === -1 ? data.length : end);
            length += piece.length;
            if (length > MAX_LINE_LENGTH) {
                too_long = true;
                chunks = [];
                return onTooLong();
            }
            if (piece.length) chunks.push(piece);
            if (end === -1) return;

            emit();
            start = end + 1;
        }
    });
    socket.on('end', () => !too_long && length && emit());
}

/**
 * Takes the account's pidfile, so that a second daemon for the same account
 * refuses to start. A pidfile naming a process that's gone is stale and
 * gets replaced.
 * @param {import('./types').Config} config
 */
async function claimPidfile({ jid, paths }) {
    try {
        await fs.writeFile(paths.pidfile, `${process.pid}\n`, { flag: 'wx', mode: 0o600 });
    } catch (e) {
        if (e.code !== 'EEXIST') throw e;

        const pid = parseInt(await fs.readFile(paths.pidfile, 'utf8'), 10);
        if (isRunning(pid)) {
            throw new Error(
                `A daemon for ${jid} is already running (pid ${pid}). Stop it with "converse-cli daemon stop".`,
                { cause: e },
            );
        }
        await fs.rm(paths.pidfile, { force: true });
        await fs.writeFile(paths.pidfile, `${process.pid}\n`, { flag: 'wx', mode: 0o600 });
    }
}

/**
 * Leaves a record of this daemon under its account's name, so that clients
 * find it by name: a daemon outlives a change to its config's JID. Another
 * daemon still running for the account, under another JID, is refused.
 * @param {import('./types').Config} config
 */
async function writeRecord(config) {
    const { account, jid, paths } = config;
    const running = findDaemon(config);
    if (running && running.pid !== process.pid) {
        throw new Error(
            `A daemon for the account "${account}" is already running, as ${running.jid} (pid ${running.pid}). ` +
                'Stop it with "converse-cli daemon stop".',
        );
    }
    /** @type {import('./types').DaemonRecord} */
    const record = {
        account,
        jid,
        pid: process.pid,
        started: new Date().toISOString(),
        socket: paths.socket,
        restricted_socket: paths.restricted_socket,
        pidfile: paths.pidfile,
        log: paths.log,
    };
    await fs.mkdir(path.dirname(paths.record), { recursive: true, mode: 0o700 });
    // Written whole, then renamed, so that a client never reads half of it.
    const tmp = `${paths.record}.${process.pid}`;
    await fs.writeFile(tmp, JSON.stringify(record) + '\n', { mode: 0o600 });
    await fs.rename(tmp, paths.record);
}

/**
 * Removes this daemon's record, and leaves another daemon's alone.
 * @param {import('./types').Config} config
 */
async function removeRecord(config) {
    if (findDaemon(config)?.pid === process.pid) await fs.rm(config.paths.record, { force: true });
}

/**
 * @param {Promise<unknown>} promise
 * @param {number} ms
 */
function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((resolve) => {
        timer = setTimeout(() => {
            log.warn(`Gave up waiting after ${ms}ms`);
            resolve(undefined);
        }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
