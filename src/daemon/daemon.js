/**
 * The daemon: one headless session, shared over a unix socket.
 * @module @converse/daemon/daemon
 */
import fs from 'node:fs/promises';
import net from 'node:net';
import readline from 'node:readline';
import { _converse, api, converse, log } from '@converse/headless';
import { createAudit } from './audit.js';
import { contactMethods } from './contacts.js';
import { getPassword } from './config.js';
import { createCursors } from './cursors.js';
import { createDraftStore, draftMethods } from './drafts.js';
import { createEvents } from './events.js';
import { inboxMethods } from './inbox.js';
import { messageMethods } from './messages.js';
import { presenceMethods } from './presence.js';
import { createRoomStore, rejoinRooms, roomMethods } from './rooms.js';
import { createPolicy } from './policy.js';
import { ERRORS, PROTOCOL_VERSION, RPCError } from './protocol.js';

/**
 * How long shutdown waits for the server to see us leave before giving up.
 */
const SHUTDOWN_TIMEOUT = 5000;

/**
 * Methods that restricted connections may not call. Restricted access covers
 * reads and drafted sends. Stopping the daemon, and reviewing or dropping
 * drafts, are the user's to do.
 */
const FULL_ACCESS_METHODS = ['daemon.stop', 'drafts.list', 'drafts.reject'];

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
    await fs.mkdir(paths.runtime_dir, { recursive: true, mode: 0o700 });
    // mkdir leaves the mode of an existing directory alone.
    await fs.chmod(paths.runtime_dir, 0o700);
    await claimPidfile(config);
    try {
        return await serve(config);
    } catch (e) {
        await fs.rm(paths.pidfile, { force: true });
        throw e;
    }
}

/**
 * @param {import('./types').Config} config
 */
async function serve(config) {
    const { paths } = config;
    const password = await getPassword(config);
    const started = new Date();

    await converse.initialize({
        websocket_url: config.websocket_url,
        ...config.settings,
    });

    const events = createEvents(_converse);
    const policy = createPolicy(config);
    const audit = createAudit(paths.audit);
    const drafts = createDraftStore(paths.drafts);
    const rooms = createRoomStore(paths.rooms);
    // Headless sets up its client identity on connect, so the bot identity has to be set after that.
    api.listen.on('addClientFeatures', () => {
        api.disco.own.identities.clear();
        api.disco.own.identities.add(BOT_IDENTITY.category, BOT_IDENTITY.type, BOT_IDENTITY.name);
    });
    const methods = {
        ...messageMethods(_converse, { policy, audit, drafts, events, owner: config.owner }),
        ...draftMethods(_converse, { drafts, audit, events, owner: config.owner }),
        ...inboxMethods(_converse, createCursors(paths.cursors)),
        ...contactMethods(_converse),
        ...presenceMethods(_converse, { config }),
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
        await listen(paths.restricted_socket, onConnection('restricted')),
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
 * Listens on a unix socket, readable and writable by its owner only.
 * @param {string} socket_path
 * @param {(socket: net.Socket) => void} onConnection
 * @returns {Promise<net.Server>}
 */
async function listen(socket_path, onConnection) {
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
                              'Point XDG_RUNTIME_DIR at a shorter directory.',
                          { cause: e },
                      )
                    : e,
            ),
        );
        server.listen(socket_path, () => resolve(undefined));
    });
    await fs.chmod(socket_path, 0o600);
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
        if (FULL_ACCESS_METHODS.includes(method) && access !== 'full') {
            throw new RPCError(
                ERRORS.ACCESS_DENIED,
                `"${method}" is only available at full access, and this connection is restricted.`,
            );
        }
        return methods[method](params ?? {}, client);
    };

    readline.createInterface({ input: socket, crlfDelay: Infinity }).on('line', async (line) => {
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
 * @param {number} pid
 */
function isRunning(pid) {
    if (!pid) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return e.code === 'EPERM';
    }
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
