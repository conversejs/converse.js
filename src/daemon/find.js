/**
 * Finding the messages that a request names by id.
 * @module @converse/daemon/find
 */
import { conversationOf, getIDs } from './dto.js';
import { isMessage } from './history.js';
import { ERRORS, RPCError } from './protocol.js';

/**
 * Finds a message by its id, or a unique prefix of it, among those held for
 * one conversation, or for all of them.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {unknown} id
 * @param {string} [jid] - The bare JID of the conversation to look in
 * @returns {Promise<import('@converse/headless').Message>}
 */
export async function findTarget(_converse, id, jid) {
    if (typeof id !== 'string' || !id) {
        throw new RPCError(ERRORS.INVALID_PARAMS, 'A message id must be one that "messages.list" gave.');
    }
    const messages = (await heldConversations(_converse, jid)).flatMap((c) => c.messages.models.filter(isMessage));
    const where = jid ? 'in this conversation' : 'in any conversation';
    return findMessage(messages, id, where);
}

/**
 * The conversations held locally, with their messages fetched: the one with
 * `jid`, or every one.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {string} [jid] - The bare JID of the conversation
 * @returns {Promise<(import('@converse/headless').ChatBox|import('@converse/headless').ChatRoom)[]>}
 */
export async function heldConversations(_converse, jid) {
    const { api } = _converse;
    const chatboxes = jid
        ? [(await api.rooms.get(jid)) ?? (await api.chats.get(jid))].filter(Boolean)
        : [...((await api.chats.get()) ?? []), ...((await api.rooms.get()) ?? [])];
    await Promise.all(chatboxes.map((c) => c.messages.fetched));
    return chatboxes;
}

/**
 * Like {@link findTarget}, for a message that must be one we sent.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {unknown} id
 * @param {string|undefined} jid - The bare JID of the conversation to look in, else all of them
 * @param {string} verb - What's to be done to it, for the error message
 */
export async function findOwn(_converse, id, jid, verb) {
    return ownedBy(await findTarget(_converse, id, jid), id, verb);
}

/**
 * @param {import('@converse/headless').Message} message - Found by the id given
 * @param {string} id
 * @param {string} verb
 */
export function ownedBy(message, id, verb) {
    if (message.get('sender') !== 'me') {
        throw new RPCError(
            ERRORS.INVALID_PARAMS,
            `Message "${id}" was sent by someone else, and only our own messages can be ${verb}ed.`,
        );
    }
    return message;
}

/**
 * @param {import('@converse/headless').Message} message
 * @param {string} id - The id it was asked for by
 */
export function notRetracted(message, id) {
    if (message.isRetracted()) {
        throw new RPCError(ERRORS.INVALID_PARAMS, `Message "${id}" has already been retracted.`);
    }
    return message;
}

/**
 * Finds a message by any of its ids, or by a unique prefix of its DTO id.
 *
 * An archive gives a message its id, but its sender chooses its origin-id and
 * msgid, and can choose one that another message has. So a message is looked
 * for by its archive id first, and one found by an id that more than one
 * message has isn't taken.
 * @param {import('@converse/headless').Message[]} messages
 * @param {string} id
 * @param {string} [where] - Where the messages are from, for the error message
 */
export function findMessage(messages, id, where = 'in this conversation') {
    const archived = messages.filter((m) => m.getArchiveID() === id);
    const exact = archived.length ? archived : messages.filter((m) => getIDs(m).includes(id));
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) {
        throw new RPCError(ERRORS.AMBIGUOUS, `More than one message has the id "${id}" ${where}.`, {
            candidates: exact.map((m) => `${getIDs(m)[0]} in ${conversationOf(m)}`),
        });
    }

    const matches = id ? messages.filter((m) => getIDs(m)[0]?.startsWith(id)) : [];
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
        throw new RPCError(ERRORS.AMBIGUOUS, `More than one message has an id starting with "${id}".`, {
            candidates: matches.map((m) => getIDs(m)[0]),
        });
    }
    throw new RPCError(ERRORS.NOT_FOUND, `No message with id "${id}" ${where}.`);
}
