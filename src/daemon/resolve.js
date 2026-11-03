/**
 * Turns what a client gave for a conversation, contact or room into a bare JID.
 * A client may give a JID, or a name: the name of a roster contact, or of a
 * room the daemon knows. The contact matching is headless's
 * (`api.contacts.resolve`), and the room matching is by the room's name. This
 * module decides what a match, or the lack of one, means for the request.
 * @module @converse/daemon/resolve
 */
import { api, converse } from '@converse/headless';
import { ERRORS, RPCError } from './protocol.js';
import { requireConnected } from './session.js';

const { Strophe, u } = converse.env;

/**
 * @param {unknown} value
 * @param {string} name - The parameter's name, for the error message.
 * @returns {string} The bare JID
 */
export function parseJID(value, name) {
    const jid = typeof value === 'string' ? Strophe.getBareJidFromJid(value.trim()).toLowerCase() : '';
    if (!u.isValidJID(jid)) {
        throw new RPCError(ERRORS.INVALID_PARAMS, `"${name}" must be a JID such as "juliet@capulet.lit".`);
    }
    return jid;
}

/**
 * A JID is taken as it is, whether or not it's on the roster. Anything else
 * is a name, and must match exactly one contact or room: a name matching
 * none, or several, is refused rather than guessed at. A JID that is also the
 * name of some other contact is refused too, since the text could mean either.
 * @param {unknown} value
 * @param {string} name - The parameter's name, for the error message.
 * @returns {Promise<string>} The bare JID
 */
export async function resolveJID(value, name) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) {
        throw new RPCError(ERRORS.INVALID_PARAMS, `"${name}" must be a JID, or the name of a contact or room.`);
    }
    if (u.isValidJID(text)) return checkJIDIsNotAName(parseJID(text, name), text);

    // Names are looked up in the roster and the rooms, which only the server can supply.
    requireConnection(text);

    const matches = await matchNames(text);
    if (matches.length === 1) return matches[0].jid.toLowerCase();
    if (matches.length === 0) {
        throw new RPCError(
            ERRORS.NOT_FOUND,
            `No contact or room is called "${text}". Check the spelling, or list your contacts ` +
                'with "contacts.list".',
            { see: ['contacts.list'] },
        );
    }
    throw new RPCError(
        ERRORS.AMBIGUOUS,
        `"${text}" matches more than one contact or room. Use the JID of the one you mean.`,
        { candidates: matches.map(({ jid, name }) => (name ? `${name} <${jid}>` : jid)) },
    );
}

/**
 * What a command takes for a room: a JID, or the name of a room the daemon
 * knows. Unlike {@link resolveJID}, a contact's name doesn't count.
 * @param {unknown} value
 * @param {string} name - The parameter's name, for the error message.
 * @returns {Promise<string>} The bare JID of the room
 */
export async function resolveRoomJID(value, name) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) {
        throw new RPCError(ERRORS.INVALID_PARAMS, `"${name}" must be the JID of a room, or the name of one you know.`);
    }
    if (u.isValidJID(text)) return parseJID(text, name);

    requireConnection(text);
    const matches = await roomsNamed(text);
    if (matches.length === 1) return matches[0].jid;
    if (matches.length === 0) {
        throw new RPCError(
            ERRORS.NOT_FOUND,
            `No room is called "${text}". Give the room's JID, such as "garden@conference.capulet.lit".`,
        );
    }
    throw new RPCError(ERRORS.AMBIGUOUS, `"${text}" matches more than one room. Use the JID of the one you mean.`, {
        candidates: matches.map(({ jid, name }) => (name ? `${name} <${jid}>` : jid)),
    });
}

/**
 * Refuses a JID that is also the name of another contact, since the text could
 * mean either. Without a connection there's no roster to check, so the JID is
 * taken as it is.
 * @param {string} jid - The bare JID the text parses to
 * @param {string} text - What the client typed
 * @returns {Promise<string>}
 */
async function checkJIDIsNotAName(jid, text) {
    if (!api.connection.connected()) return jid;

    const named = (await api.contacts.resolve({ name: text })).filter((match) => match.jid !== jid);
    if (named.length === 0) return jid;

    throw new RPCError(
        ERRORS.AMBIGUOUS,
        `"${text}" is a JID, and also the name of another contact. Use the JID of the one you mean.`,
        { candidates: [jid, ...named.map(({ jid, name }) => (name ? `${name} <${jid}>` : jid))] },
    );
}

/**
 * Names are looked up in the roster and the rooms, which only the server can supply.
 * @param {string} text
 */
function requireConnection(text) {
    requireConnected(`the name "${text}" can't be looked up in your contacts and rooms. Use a JID instead`);
}

/**
 * The contacts and rooms a name matches, by JID, without duplicates.
 * @param {string} text
 * @returns {Promise<{jid: string, name: string|null}[]>}
 */
async function matchNames(text) {
    const contacts = await api.contacts.resolve({ name: text });
    const by_jid = new Map(contacts.map((match) => [match.jid, match]));
    for (const room of await roomsNamed(text)) by_jid.set(room.jid, room);
    return [...by_jid.values()];
}

/**
 * The rooms the daemon knows whose name is the text, ignoring case.
 * @param {string} text
 * @returns {Promise<{jid: string, name: string|null}[]>}
 */
async function roomsNamed(text) {
    const wanted = text.toLowerCase();
    const rooms = /** @type {import('@converse/headless').MUC[]} */ (await api.rooms.get());
    return rooms
        .filter((room) => (room.get('name') ?? '').trim().toLowerCase() === wanted)
        .map((room) => ({ jid: room.get('jid'), name: room.get('name').trim() }));
}
