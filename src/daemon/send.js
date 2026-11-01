/**
 * Sending through headless: messages, retractions and reactions, and the
 * errors that a send which didn't go out is reported with.
 * @module @converse/daemon/send
 */
import { converse } from '@converse/headless';
import { toMessageDTO } from './dto.js';
import { notRetracted } from './find.js';
import { ERRORS, RPCError } from './protocol.js';
import { notJoined } from './routing.js';

const { u } = converse.env;

/**
 * Sends a message from the account. Restricted connections only reach this
 * where the policy routes a send directly.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {string} jid - Bare JID
 * @param {string} body
 * @param {Object} [targets] - Messages of the same conversation
 * @param {import('@converse/headless').Message} [targets.replying_to]
 * @param {import('@converse/headless').Message} [targets.correcting] - One of ours
 * @param {Object} [attributes] - More outgoing message attributes, such as an XEP-0066 URL
 * @returns {Promise<import('./types').MessageDTO>}
 */
export async function sendMessage(_converse, jid, body, targets = {}, attributes = {}) {
    const { api } = _converse;
    if (!api.connection.connected()) throw notConnected();

    const room = await api.rooms.get(jid);
    if (room) {
        if (!room.isEntered()) throw notJoined(jid);
        const message = await send(room, { body, ...attributes }, targets);
        return toMessageDTO(message, jid, _converse.session.get('bare_jid'));
    }
    const chat = await api.chats.get(jid, {}, true);
    await chat.initialized;
    const message = await send(chat, { body, ...attributes }, targets);
    return toMessageDTO(message, jid, _converse.session.get('bare_jid'));
}

/**
 * Sends through headless, which rejects with a coded error when a send fails,
 * such as an OMEMO send that couldn't be encrypted. The code is kept for
 * clients to act on. The words are the daemon's own, never headless's.
 * @param {import('@converse/headless').ChatBox|import('@converse/headless').MUC} chatbox
 * @param {Object} attrs
 * @param {Object} targets
 * @returns {Promise<import('@converse/headless').Message>}
 */
async function send(chatbox, attrs, targets) {
    const message = await attempt(() => chatbox.sendMessage(attrs, targets));
    if (!message) throw new RPCError(ERRORS.INTERNAL_ERROR, UNSENT.unexpected, { code: null });
    return message;
}

/**
 * Retracts one of our messages (XEP-0424).
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {import('@converse/headless').Message} message - One of ours
 * @param {string} id - The id it was asked for by, for the error messages
 * @returns {Promise<import('./types').MessageDTO>} The message, retracted
 */
export async function retractMessage(_converse, message, id) {
    notRetracted(message, id);
    if (!_converse.api.connection.connected()) throw notConnected();

    const chatbox = message.collection.chatbox;
    await chatbox.retractOwnMessage(message);
    if (!message.get('retracted')) {
        // A room that doesn't answer in time has the retraction undone.
        throw new RPCError(
            ERRORS.INTERNAL_ERROR,
            `The room didn't confirm the retraction of "${id}", so it may not have happened. Try again.`,
        );
    }
    return toMessageDTO(message, chatbox.get('jid'), _converse.session.get('bare_jid'));
}

/**
 * Gives a message a reaction (XEP-0444), or withdraws one, keeping the other
 * reactions we gave it.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {import('@converse/headless').Message} message
 * @param {string} reaction - An emoji
 * @param {boolean} remove - Whether to withdraw it
 * @returns {Promise<import('./types').MessageDTO>} The message reacted to
 */
export async function sendReaction(_converse, message, reaction, remove) {
    const { api } = _converse;
    if (!api.connection.connected()) throw notConnected();

    const chatbox = message.collection.chatbox;
    const mine = message.get('reactions')?.[u.reactions.getOwnReactionJID(chatbox)] ?? [];
    const emojis = remove ? mine.filter((e) => e !== reaction) : [...new Set([...mine, reaction])];
    await api.reactions.send(message, emojis);
    return toMessageDTO(message, chatbox.get('jid'), _converse.session.get('bare_jid'));
}

/**
 * Runs a send that headless may refuse with a code, and turns a refusal into
 * the daemon's own error. Only the code is passed on, never headless's words.
 * @template T
 * @param {() => Promise<T>} send
 * @returns {Promise<T>}
 */
export async function attempt(send) {
    try {
        return await send();
    } catch (e) {
        throw e instanceof RPCError ? e : unsent(e);
    }
}

/**
 * Sends a failed send again in the clear. Headless only does this for a message
 * that was refused for encryption, and says so by not handling the request.
 * @param {import('@converse/headless').ChatBox|import('@converse/headless').MUC} chatbox
 * @param {import('@converse/headless').Message} message
 */
export async function resendUnencrypted(_converse, chatbox, message) {
    const { handled } = await _converse.api.hook('resendFailedMessageUnencrypted', chatbox, {
        message,
        handled: false,
    });
    if (!handled) {
        throw new RPCError(
            ERRORS.INVALID_PARAMS,
            "This failed send wasn't refused for encryption, so it can only be sent encrypted.",
        );
    }
}

/**
 * @param {unknown} e - What headless rejected a send with
 */
function unsent(e) {
    const code = /** @type {{code?: string}} */ (e)?.code;
    return new RPCError(ERRORS.INTERNAL_ERROR, UNSENT[code] ?? UNSENT.unexpected, { code: code ?? null });
}

/**
 * A draft the owner sends by hand can't correct, retract or remove a reaction,
 * so where the policy would make a restricted send a draft, these are refused
 * instead. Only "as_user" mode, where the daemon sends approved drafts, drafts them.
 * @param {string} verb
 */
export function ownMessagesOnly(verb) {
    return new RPCError(
        ERRORS.ACCESS_DENIED,
        `Restricted access can't ${verb} messages: its sends are drafts, which the owner sends or doesn't. ` +
            'Draft a new message instead.',
    );
}

/**
 * What the daemon tells a client about a send that didn't go out, by the code headless gave it.
 * Scripts can branch on the `code` in the error's data instead of reading these words.
 */
const UNSENT = {
    'no-omemo-devices': 'Nothing was sent: there are no OMEMO devices to encrypt for.',
    'omemo-key-fetch-failed': "Nothing was sent: the recipient's encryption keys couldn't be fetched. Try again.",
    'omemo-subscription-required': "Nothing was sent: the recipient's encryption keys need a presence subscription.",
    'omemo-remote-server-not-found': "Nothing was sent: the recipient's server couldn't be found.",
    'omemo-encrypt-failed': 'Nothing was sent: the message could not be encrypted. Try again.',
    'omemo-groupchat-not-eligible': 'Nothing was sent: not everyone in the room can receive encrypted messages.',
    unexpected: 'Nothing was sent, for an unexpected reason. Try again.',
};

export function notConnected() {
    return new RPCError(
        ERRORS.NOT_CONNECTED,
        'The daemon is not connected to the server, so nothing was sent. Check "daemon.status", then try again.',
    );
}
