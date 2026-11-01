/**
 * The `rooms.*` methods: joining and leaving rooms, who is in them, and which
 * rooms a service hosts. A room's occupants all see us come and go, so
 * restricted access may join and leave only the rooms in "policy.rooms".
 *
 * The rooms the daemon is meant to be in are kept on disk, so that a restart
 * rejoins them. Leaving on shutdown doesn't forget them: only `rooms.leave` does.
 * @module @converse/daemon/rooms
 */
import { converse, log } from '@converse/headless';
import { toRoomDTO } from './dto.js';
import { ERRORS, RPCError } from './protocol.js';
import { parseJID, resolveRoomJID } from './resolve.js';
import { readStateFile, writeStateFile } from './state-file.js';

const { ROOMSTATUS } = converse;

/** How long a join may take before we stop waiting for the room to confirm it. */
const JOIN_TIMEOUT = 20000;
/** How long a service may take to list its rooms. */
const DISCOVER_TIMEOUT = 10000;

/** Why a room turned a join down, by the status it left the room in. */
const REFUSALS = {
    [ROOMSTATUS.NICKNAME_REQUIRED]: 'the nickname is taken, or none was given',
    [ROOMSTATUS.PASSWORD_REQUIRED]: 'it needs a password, which the daemon does not have',
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
 * Rejoins the rooms the daemon is meant to be in, all at once, so a room that
 * doesn't answer doesn't hold up the rest. Called once it has logged in. A
 * room that can't be rejoined is logged and left for another time.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {ReturnType<typeof createRoomStore>} store
 */
export async function rejoinRooms(_converse, store) {
    await Promise.all(
        store.list().map(async ({ jid, nick }) => {
            try {
                const room = await _converse.api.rooms.get(jid, { nick }, true);
                // A leave while we were getting the room means it's not to be rejoined.
                if (!store.get(jid)) return;

                await enter(room, nick);
                // Or a leave while the room was letting us in.
                if (!store.get(jid)) await room.leave();
            } catch (e) {
                log.warn(`Couldn't rejoin ${jid}: ${e.message}`);
            }
        }),
    );
}

/**
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {Object} deps
 * @param {import('./types').Config} deps.config
 * @param {ReturnType<typeof import('./policy.js').createPolicy>} deps.policy
 * @param {ReturnType<typeof createRoomStore>} deps.store
 */
export function roomMethods(_converse, { config, policy, store }) {
    const { api } = _converse;

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

    const requireConnected = () => {
        if (!api.connection.connected()) {
            throw new RPCError(
                ERRORS.NOT_CONNECTED,
                'The daemon is not connected to the server, so nothing was done. ' +
                    'Check "daemon.status", then try again.',
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
         * @param {string} [params.nick] - The nickname to use there. Defaults to the consumer's name.
         * @param {import('./types').Client} client
         * @returns {Promise<{ conversation: import('./types').ConversationDTO, nick: string }>}
         */
        async 'rooms.join'({ room, nick }, client) {
            const jid = parseJID(room, 'room');
            if (nick !== undefined && (typeof nick !== 'string' || !nick.trim())) {
                throw new RPCError(ERRORS.INVALID_PARAMS, '"nick" must be a nickname.');
            }
            checkAccess(client, jid);
            requireConnected();

            const nickname = (nick ?? config.consumer).trim();
            const existing = await api.rooms.get(jid);
            // Getting a room we're in with a nickname would overwrite the one we have there.
            const model = existing?.isEntered() ? existing : await api.rooms.get(jid, { nick: nickname }, true);
            if (!model.isEntered()) {
                const before = store.get(jid);
                store.add(jid, nickname);
                try {
                    await enter(model, nickname);
                } catch (e) {
                    if (e.code === ERRORS.JOIN_REFUSED) {
                        if (before) store.add(before.jid, before.nick);
                        else store.remove(jid);
                    }
                    throw e;
                }
                if (!store.get(jid)) {
                    // A leave came while the room was letting us in, and it's the last word.
                    await model.leave();
                    throw new RPCError(ERRORS.NOT_FOUND, `${jid} was left while we were joining it.`);
                }
            }
            // The nickname we have there, which the room may have changed from the one asked for.
            const used = model.getOwnOccupant()?.get('nick') ?? model.get('nick') ?? nickname;
            store.add(jid, used);
            return { conversation: toRoomDTO(model), nick: used };
        },

        /**
         * Leaves a room, and forgets it, so that a restart doesn't rejoin it.
         * A room we're meant to be in but aren't, because it wouldn't let us
         * back in or we haven't rejoined it yet, is forgotten all the same.
         * @param {Object} params
         * @param {string} params.room - The room's JID, or the name of one we know
         * @param {import('./types').Client} client
         * @returns {Promise<{ conversation: import('./types').ConversationDTO, was_in: boolean }>}
         */
        async 'rooms.leave'({ room }, client) {
            const jid = await resolveRoomJID(_converse, room, 'room');
            checkAccess(client, jid);
            const model = await api.rooms.get(jid);
            const entered = model?.isEntered() ?? false;
            if (!entered && !store.get(jid)) {
                throw new RPCError(ERRORS.NOT_FOUND, `We aren't in ${jid}, so there is nothing to leave.`);
            }
            if (entered) await model.leave();
            store.remove(jid);
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
            const jid = await resolveRoomJID(_converse, room, 'room');
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
            requireConnected();
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
