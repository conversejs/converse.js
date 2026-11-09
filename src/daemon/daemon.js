/**
 * The daemon: one headless session, shared over a unix socket.
 * @module @converse/daemon/daemon
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { _converse, api, converse, log } from '@converse/headless';
import { checkMethodAccess } from './access.js';
import { createAudit } from './audit.js';
import { contactMethods } from './contacts.js';
import { createCursors } from './cursors.js';
import { createDispatcher } from './dispatch.js';
import { createDrafter, createDraftStore, draftMethods } from './drafts.js';
import { createEvents } from './events.js';
import { fileMethods } from './files.js';
import { getGroupId } from './groups.js';
import { inboxMethods } from './inbox.js';
import { messageMethods } from './messages.js';
import { omemoMethods } from './omemo.js';
import { presenceMethods } from './presence.js';
import { checkRuntimeDir, removeRecord, writeRecord } from './registry.js';
import { createJoins, createRoomStore, limitRoomsTo, rejoinRooms, roomMethods, withConfigRooms } from './rooms.js';
import { claimPidfile } from './pidfile.js';
import { createPolicy } from './policy.js';
import { createSendRouter } from './routing.js';
import { scheduleMethods } from './schedules.js';
import { getPassword, getRoomPasswords } from './secrets.js';
import { TIMED_OUT, withTimeout } from './timeout.js';
import { createLineBudget, listen, serveClient } from './transport.js';

/**
 * How long shutdown waits for the server to see us leave before giving up.
 */
const SHUTDOWN_TIMEOUT = 5000;

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
    await claimPidfile(paths.pidfile, { account: config.account });
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
    const room_passwords = getRoomPasswords(config);
    const started = new Date();

    await converse.initialize({
        websocket_url: config.websocket_url,
        storage_path: paths.storage,
        // Leaving a room mustn't lose its messages: those of an OMEMO room can't be fetched again.
        muc_clear_messages_on_leave: false,
        // The daemon decides which rooms it's in, from its own store. Bookmarks
        // would join the account's bookmarked rooms, and bookmark every room
        // it joins, for the account's other clients to join too.
        allow_bookmarks: false,
        // The daemon outlives outages, including one that's going on when it starts.
        retry_initial_connection: true,
        ...config.settings,
    });

    const events = createEvents({ mode: config.mode });
    const policy = createPolicy(config);
    const audit = createAudit(paths.audit);
    const drafts = createDraftStore(paths.drafts);
    const rooms = withConfigRooms(createRoomStore(paths.rooms), config.rooms, config.consumer);
    const joining = createJoins();
    limitRoomsTo(rooms, joining);
    const cursors = createCursors(paths.cursors);
    const routeSend = createSendRouter({ policy, audit, mode: config.mode });
    const queueDraft = createDrafter({ drafts, audit, events, owner: config.owner, mode: config.mode });
    // Headless sets up its client identity on connect, so the bot identity has to be set after that.
    api.listen.on('addClientFeatures', () => {
        api.disco.own.identities.clear();
        api.disco.own.identities.add(BOT_IDENTITY.category, BOT_IDENTITY.type, BOT_IDENTITY.name);
    });
    const messages = messageMethods({
        routeSend,
        audit,
        queueDraft,
        mode: config.mode,
        allow_unencrypted_resend: config.allow_unencrypted_resend,
    });
    const schedules = scheduleMethods({
        routeSend,
        sendNow: messages['messages.send'],
        mode: config.mode,
    });
    const methods = {
        ...messages,
        ...schedules.methods,
        ...fileMethods({ routeSend, audit, queueDraft }),
        ...draftMethods({ drafts, audit, events, owner: config.owner, mode: config.mode }),
        ...inboxMethods(cursors, events),
        ...contactMethods(),
        ...presenceMethods({ config }),
        ...omemoMethods(),
        ...roomMethods({ config, policy, store: rooms, passwords: room_passwords, joining }),
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

    checkMethodAccess(Object.keys(methods));

    const getJID = () => (api.connection.connected() ? _converse.session.get('jid') : null);

    /** @type {Set<import('node:net').Socket>} */
    const clients = new Set();
    const budget = createLineBudget();
    /** @param {import('./types').Access} access */
    const onConnection = (access) => (socket) => {
        clients.add(socket);
        socket.on('close', () => clients.delete(socket));
        socket.on('error', (e) => log.debug(`Client socket error: ${e.message}`));
        serveClient(socket, budget, (notify, writable) => {
            const { client, handle } = createDispatcher({ access, config, methods, getJID, notify, writable });
            socket.once('close', () => {
                client.closed = true;
                events.forget(client);
            });
            return handle;
        });
    };
    // Each access level has its own socket, so the level belongs to the connection.
    const servers = [
        await listen(paths.socket, onConnection('full')),
        await listen(paths.restricted_socket, onConnection('restricted'), gid),
    ];

    await api.user.login(`${config.jid}/${config.resource}`, password);
    // Not awaited: a room that takes a while to confirm mustn't hold up the socket.
    rejoinRooms(rooms, room_passwords, joining);

    const { promise: stopped, resolve: resolveStopped } = Promise.withResolvers();
    let stopping;

    function stop() {
        stopping ??= (async () => {
            servers.forEach((server) => server.close());
            clients.forEach((socket) => socket.end());
            try {
                if (api.connection.connected()) {
                    if ((await withTimeout(leave(), SHUTDOWN_TIMEOUT)) === TIMED_OUT) {
                        log.warn(`Gave up waiting to leave after ${SHUTDOWN_TIMEOUT}ms`);
                    }
                }
            } catch (e) {
                // Still clean up below: a daemon left with its pidfile behind blocks the next one.
                log.error(`Couldn't leave cleanly: ${e.message}`);
            } finally {
                cursors.flush();
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
 * Leaves every joined MUC, then logs out, which sends unavailable presence.
 */
async function leave() {
    const rooms = /** @type {any[]} */ (await api.rooms.get());
    await Promise.all(rooms.filter((room) => room.isEntered()).map((room) => room.leave()));
    await api.user.logout();
}
