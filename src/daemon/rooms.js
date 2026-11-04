/**
 * The `rooms.*` methods: joining and leaving rooms, who is in them, and which
 * rooms a service hosts. A room's occupants all see us come and go, so
 * restricted access may join and leave only the rooms in "policy.rooms".
 *
 * The rooms the daemon is meant to be in are kept on disk, so that a restart
 * rejoins them, along with the rooms under "rooms" in the config. Leaving on
 * shutdown doesn't forget them: only `rooms.leave` does, and a room in the
 * config comes back on the next start.
 * @module @converse/daemon/rooms
 */
import { api, constants, converse, log } from '@converse/headless';
import { toRoomDTO } from './dto.js';
import { ERRORS, RPCError } from './protocol.js';
import { parseJID, resolveRoomJID } from './resolve.js';
import { requireConnected } from './session.js';
import { readStateFile, writeStateFile } from './state-file.js';

const { ROOMSTATUS } = converse;

/** How long a join may take before we stop waiting for the room to confirm it. */
const JOIN_TIMEOUT = 20000;
/** How long a service may take to list its rooms. */
const DISCOVER_TIMEOUT = 10000;

/** Why a room turned a join down, by the status it left the room in. */
const REFUSALS = {
    [ROOMSTATUS.NICKNAME_REQUIRED]: 'the nickname is taken, or none was given',
    [ROOMSTATUS.PASSWORD_REQUIRED]: 'it needs a password, and the one under "rooms" in the config is missing or wrong',
    [ROOMSTATUS.BANNED]: 'we are banned from it',
    [ROOMSTATUS.DESTROYED]: 'it no longer exists',
};

/**
 * The rooms the daemon is meant to be in, and the nickname it uses in each.
 * @param {string} file
 */
export function createRoomStore(file) {
    /** @type {{ jid: string, nick: string }[]} */
    let rooms = readStateFile(file, { rooms: [] }, 'the joined rooms').rooms ?? [];
    const save = () => writeStateFile(file, { rooms });

    return {
        /** @returns {{ jid: string, nick: string }[]} */
        list: () => rooms.map((room) => ({ ...room })),

        /**
         * @param {string} jid
         * @returns {{ jid: string, nick: string }|undefined}
         */
        get(jid) {
            const room = rooms.find((room) => room.jid === jid);
            return room && { ...room };
        },

        /**
         * @param {string} jid
         * @param {string} nick
         */
        add(jid, nick) {
            rooms = [...rooms.filter((room) => room.jid !== jid), { jid, nick }];
            save();
        },

        /** @param {string} jid */
        remove(jid) {
            rooms = rooms.filter((room) => room.jid !== jid);
            save();
        },
    };
}

/**
 * The rooms the daemon is meant to be in: those a client joined, from the
 * store, and those under "rooms" in the config, which aren't stored, so that
 * taking one out of the config is enough to stop joining it. A config room
 * that is left stays out until the next start. Joining one under the default
 * nickname stores nothing, since the config already says to be in it, even
 * if the room gave us another nickname.
 * @param {ReturnType<typeof createRoomStore>} store
 * @param {string[]} configured - The rooms under "rooms" in the config
 * @param {string} nick - The nickname for the config's rooms
 */
export function withConfigRooms(store, configured, nick) {
    /** The config's rooms that were left since the daemon started. */
    const left = new Set();
    const fromConfig = (jid) => configured.includes(jid) && !left.has(jid) && { jid, nick };

    return {
        list: () => [
            ...store.list(),
            ...configured.filter((jid) => !store.get(jid)).flatMap((jid) => fromConfig(jid) || []),
        ],

        get: (jid) => store.get(jid) ?? (fromConfig(jid) || undefined),

        /**
         * @param {string} jid
         * @param {string} room_nick - The nickname we have there
         * @param {string} [asked] - The nickname that was asked for, if the room may have given us another
         */
        add(jid, room_nick, asked = room_nick) {
            left.delete(jid);
            if (configured.includes(jid) && asked === nick) store.remove(jid);
            else store.add(jid, room_nick);
        },

        remove(jid) {
            if (configured.includes(jid)) left.add(jid);
            store.remove(jid);
        },
    };
}

/**
 * The rooms a join is under way in, by JID. One left meanwhile is forgotten
 * once the join settles, by whatever made it: forgotten before, while headless
 * may still be sending the join, the join could reach the room after the
 * leave. Counted, since a client may join a room that is being rejoined. One
 * per daemon, so that a stopped daemon's joins don't count for the next.
 */
export function createJoins() {
    /** @type {Map<string, number>} */
    const counts = new Map();

    return {
        /** @param {string} jid */
        has: (jid) => counts.has(jid),

        /**
         * Runs `join` with the room counted as being joined.
         * @template T
         * @param {string} jid
         * @param {() => Promise<T>} join
         * @returns {Promise<T>}
         */
        async during(jid, join) {
            counts.set(jid, (counts.get(jid) ?? 0) + 1);
            try {
                return await join();
            } finally {
                const count = counts.get(jid) - 1;
                if (count) counts.set(jid, count);
                else counts.delete(jid);
            }
        },
    };
}

/**
 * Enters a room with a nickname, and waits for the room to confirm it. Does
 * nothing if we're already in it.
 * @param {import('@converse/headless').MUC} room
 * @param {string} nick
 */
export async function enter(room, nick) {
    if (room.isEntered()) return;
    await room.join(nick);
    const status = await settledStatus(room);
    if (status === ROOMSTATUS.ENTERED) return;

    if (status !== null) {
        throw new RPCError(
            ERRORS.JOIN_REFUSED,
            `The room ${room.get('jid')} wouldn't let us in, because ${REFUSALS[status]}.`,
        );
    }
    throw new RPCError(
        ERRORS.NOT_CONNECTED,
        `The room ${room.get('jid')} didn't confirm the join within ${JOIN_TIMEOUT / 1000} seconds. ` +
            'It may still let us in, and the daemon will try it again after a restart, until you ' +
            'leave it. Check "daemon.status", then try again.',
        { see: ['daemon.status'] },
    );
}

/**
 * Waits for the room to let us in or turn us away.
 * @param {import('@converse/headless').MUC} room
 * @returns {Promise<number|null>} The room's status then, or null if neither happened within {@link JOIN_TIMEOUT}
 */
function settledStatus(room) {
    return new Promise((resolve) => {
        const check = () => {
            const status = room.session.get('connection_status');
            if (status === ROOMSTATUS.ENTERED || Object.hasOwn(REFUSALS, status)) settle(status);
        };
        const settle = (status) => {
            clearTimeout(timer);
            room.session.off('change:connection_status', check);
            resolve(status);
        };
        const timer = setTimeout(() => settle(null), JOIN_TIMEOUT);
        room.session.on('change:connection_status', check);
        check();
    });
}

/**
 * Leaves a room, and drops it from headless's own store, which otherwise
 * joins every room it holds as the daemon starts. Its messages are kept, as
 * the daemon starts headless with `muc_clear_messages_on_leave` off: those of
 * an OMEMO room couldn't be read again from the archive.
 * @param {import('@converse/headless').MUC} room
 */
function forget(room) {
    const jid = room.get('jid');
    const closed = room.close().finally(() => {
        if (forgetting.get(jid) === closed) forgetting.delete(jid);
    });
    forgetting.set(jid, closed);
    return closed;
}

/**
 * Forgets a room once a join of it has settled, without hiding why the join
 * failed, if it did, behind a failure to close the room.
 * @param {import('@converse/headless').MUC} room
 */
async function forgetAfterJoin(room) {
    try {
        await forget(room);
    } catch (e) {
        log.error(`Couldn't forget ${room.get('jid')}: ${e.message}`);
    }
}

/**
 * The rooms being forgotten, by JID. Until one is closed, headless still holds
 * it, so a join made meanwhile would get the room that's being closed.
 * @type {Map<string, Promise<void>>}
 */
const forgetting = new Map();

/**
 * Gets a room, once any leave of it has finished closing it.
 * @param {string} jid
 * @param {Object} [attrs]
 * @param {boolean} [create]
 * @returns {Promise<import('@converse/headless').MUC|undefined>}
 */
async function getRoom(jid, attrs, create) {
    await forgetting.get(jid)?.catch(() => {});
    return api.rooms.get(jid, attrs, create);
}

/**
 * Has headless restore only the rooms the daemon is meant to be in, or is
 * joining. Headless keeps every room the daemon was in, and restores and
 * joins them when it starts, which would bring back a room that was taken
 * out of the config. To be called once headless is initialized, before
 * logging in.
 * @param {ReturnType<typeof withConfigRooms>} store
 * @param {ReturnType<typeof createJoins>} joining
 */
export function limitRoomsTo(store, joining) {
    const { CHATROOMS_TYPE } = constants;
    const MUC = api.chatboxes.registry.get(CHATROOMS_TYPE);
    api.chatboxes.registry.add(
        CHATROOMS_TYPE,
        class extends MUC {
            /** @param {import('@converse/skeletor').ModelAttributes} attrs */
            static shouldCreate(attrs) {
                return super.shouldCreate(attrs) && (!!store.get(attrs.jid) || joining.has(attrs.jid));
            }
        },
    );
}

/**
 * The attributes to get a room with: the nickname, and the room's password if
 * the config has one. The password is kept on the room, so that headless sends
 * it again when it rejoins by itself, after a reconnection. Without one, a
 * password kept from before is cleared, so that the room follows the config.
 * @param {Map<string, string>} passwords - Room passwords, by room JID
 * @param {string} jid
 * @param {string} nick
 */
function roomAttrs(passwords, jid, nick) {
    return { nick, password: passwords.get(jid) };
}

/**
 * Rejoins the rooms the daemon is meant to be in, all at once, so a room that
 * doesn't answer doesn't hold up the rest. Called once it has logged in. A
 * room that can't be rejoined is logged and left for another time.
 * @param {ReturnType<typeof withConfigRooms>} store
 * @param {Map<string, string>} passwords - Room passwords, by room JID
 * @param {ReturnType<typeof createJoins>} joining
 */
export async function rejoinRooms(store, passwords, joining) {
    await Promise.all(
        store.list().map(async ({ jid, nick }) => {
            try {
                const room = await getRoom(jid, roomAttrs(passwords, jid, nick), true);
                // A leave while we were getting the room means it's not to be rejoined.
                if (!store.get(jid)) return;

                try {
                    await joining.during(jid, () => enter(room, nick));
                } finally {
                    // A leave while the room was letting us in.
                    if (!store.get(jid)) await forgetAfterJoin(room);
                }
            } catch (e) {
                log.warn(`Couldn't rejoin ${jid}: ${e.message}`);
            }
        }),
    );
}

/**
 * @param {Object} deps
 * @param {import('./types').Config} deps.config
 * @param {ReturnType<typeof import('./policy.js').createPolicy>} deps.policy
 * @param {ReturnType<typeof withConfigRooms>} deps.store
 * @param {Map<string, string>} deps.passwords - Room passwords, by room JID
 * @param {ReturnType<typeof createJoins>} deps.joining
 */
export function roomMethods({ config, policy, store, passwords, joining }) {
    /**
     * Restricted access may join and leave only the rooms it's allowed to.
     * @param {import('./types').Client} client
     * @param {string} jid
     */
    const checkAccess = (client, jid) => {
        if (client.access === 'restricted' && !policy.roomAllowed(jid)) {
            throw new RPCError(
                ERRORS.ACCESS_DENIED,
                'Restricted access can only join or leave the rooms listed in "policy.rooms" ' +
                    `in ${config.paths.config}, ` +
                    `and ${jid} isn't one of them.`,
            );
        }
    };

    return {
        /**
         * Joins a room, and remembers it, so that a restart rejoins it. It's
         * remembered before the join is sent, so that a join the room confirms
         * late is still rejoined, and forgotten again only if the room turns
         * it down. Already in the room, the nickname stays the one we have.
         * @param {Object} params
         * @param {string} params.room - The room's JID
         * @param {string} [params.nick] - The nickname to use there. Defaults to the config's "consumer".
         * @param {import('./types').Client} client
         * @returns {Promise<{ conversation: import('./types').ConversationDTO, nick: string }>}
         */
        async 'rooms.join'({ room, nick }, client) {
            const jid = parseJID(room, 'room');
            if (nick !== undefined && (typeof nick !== 'string' || !nick.trim())) {
                throw new RPCError(ERRORS.INVALID_PARAMS, '"nick" must be a nickname.');
            }
            checkAccess(client, jid);
            requireConnected('nothing was done');

            const nickname = (nick ?? config.consumer).trim();
            const existing = await getRoom(jid);
            // Getting a room we're in with a nickname would overwrite the one we have there.
            const model = existing?.isEntered()
                ? existing
                : await getRoom(jid, roomAttrs(passwords, jid, nickname), true);
            if (!model.isEntered()) {
                const before = store.get(jid);
                store.add(jid, nickname);
                try {
                    await joining.during(jid, () => enter(model, nickname));
                } catch (e) {
                    if (e.code === ERRORS.JOIN_REFUSED) {
                        if (before) store.add(before.jid, before.nick);
                        else store.remove(jid);
                    }
                    throw e;
                } finally {
                    // Turned down, or left while the room was letting us in, which is the last word.
                    if (!store.get(jid)) await forgetAfterJoin(model);
                }
                if (!store.get(jid)) {
                    throw new RPCError(ERRORS.NOT_FOUND, `${jid} was left while we were joining it.`);
                }
            }
            // The nickname we have there, which the room may have changed from the one asked for.
            const used = model.getOwnOccupant()?.get('nick') ?? model.get('nick') ?? nickname;
            store.add(jid, used, nickname);
            return { conversation: toRoomDTO(model), nick: used };
        },

        /**
         * Leaves a room, and forgets it, so that a restart doesn't rejoin it.
         * A room we're meant to be in but aren't, because it wouldn't let us
         * back in or we haven't rejoined it yet, is forgotten all the same.
         * A room under "rooms" in the config is left only until the next start.
         * @param {Object} params
         * @param {string} params.room - The room's JID, or the name of one we know
         * @param {import('./types').Client} client
         * @returns {Promise<{ conversation: import('./types').ConversationDTO, was_in: boolean }>}
         */
        async 'rooms.leave'({ room }, client) {
            const jid = await resolveRoomJID(room, 'room');
            checkAccess(client, jid);
            const model = await getRoom(jid);
            const entered = model?.isEntered() ?? false;
            if (!entered && !store.get(jid)) {
                throw new RPCError(ERRORS.NOT_FOUND, `We aren't in ${jid}, so there is nothing to leave.`);
            }
            store.remove(jid);
            // A join under way forgets the room once it settles.
            if (model && !joining.has(jid)) await forget(model);
            return {
                conversation: model ? toRoomDTO(model) : { jid, type: 'groupchat', name: null },
                was_in: entered,
            };
        },

        /**
         * Who is in a room we're in, by nickname. A JID is shown only where the room reveals it.
         * @param {Object} params
         * @param {string} params.room - The room's JID, or the name of one we know
         * @returns {Promise<{ occupants: import('./types').OccupantDTO[] }>}
         */
        async 'rooms.occupants'({ room }) {
            const jid = await resolveRoomJID(room, 'room');
            const model = await api.rooms.get(jid);
            if (!model?.isEntered()) {
                throw new RPCError(ERRORS.NOT_FOUND, `We aren't in ${jid}, so we can't see who is in it.`);
            }
            const occupants = model.occupants.models.map((occupant) => ({
                nick: occupant.get('nick'),
                jid: occupant.get('jid') ?? null,
                role: occupant.get('role') || 'none',
                affiliation: occupant.get('affiliation') || 'none',
            }));
            occupants.sort((a, b) => a.nick.localeCompare(b.nick));
            return { occupants };
        },

        /**
         * The rooms a MUC service hosts. Listing them doesn't join any.
         * @param {Object} params
         * @param {string} params.service - The service's domain, such as "conference.capulet.lit"
         * @returns {Promise<{ rooms: import('./types').RoomListing[] }>}
         */
        async 'rooms.discover'({ service }) {
            if (typeof service !== 'string' || !(/^[^\s@/]+$/).test(service.trim())) {
                throw new RPCError(
                    ERRORS.INVALID_PARAMS,
                    '"service" must be the domain of a MUC service, such as "conference.capulet.lit".',
                );
            }
            requireConnected('nothing was done');
            try {
                return { rooms: await api.rooms.discover(service.trim(), { timeout: DISCOVER_TIMEOUT }) };
            } catch (e) {
                throw new RPCError(
                    ERRORS.INTERNAL_ERROR,
                    `${service.trim()} didn't list its rooms. Check the service's domain, then try again.`,
                    { cause: e.message },
                );
            }
        },
    };
}
