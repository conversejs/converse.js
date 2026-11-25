/**
 * Sending through headless: messages, retractions and reactions, and the
 * errors that a send which didn't go out is reported with.
 * @module @converse/daemon/send
 */
import { api, constants, converse } from '@converse/headless';
import { getID, isRoomMessage, toMessageDTO } from './dto.js';
import { notRetracted } from './find.js';
import { ERRORS, RPCError } from './protocol.js';
import { notJoined } from './routing.js';
import { getRooms, requireConnected } from './session.js';

const { Strophe, u } = converse.env;

/**
 * The version of each message being corrected that its recipients have. Headless
 * forgets it once a correction goes out, but a room can still turn the
 * correction down, and discarding it must then bring that version back.
 * @type {WeakMap<import('@converse/headless').BaseMessage, Object>}
 */
const delivered_versions = new WeakMap();

/**
 * Notes the delivered version of a message that is about to be corrected, or
 * resent as a correction. A failed or pending message has none of its own: only
 * the one headless kept from before its correction, if any.
 * @param {import('@converse/headless').BaseMessage} message
 */
export function rememberDeliveredVersion(message) {
    const version = message.get('send_status')
        ? message.get('before_correction')
        : Object.fromEntries(constants.CORRECTED_ATTRS.map((k) => [k, message.get(k)]));
    if (version) delivered_versions.set(message, version);
}

/**
 * How long, in milliseconds, {@link confirmDelivery} waits for a room to echo
 * a message back. An object, so that specs can shorten it.
 */
export const ROOM_ECHO = { timeout: 5000 };

/**
 * Sends a message from the account. Restricted connections only reach this
 * where the policy routes a send directly.
 * @param {string} jid - Bare JID
 * @param {string} body
 * @param {Object} [targets] - Messages of the same conversation
 * @param {import('@converse/headless').BaseMessage} [targets.replying_to]
 * @param {import('@converse/headless').BaseMessage} [targets.correcting] - One of ours
 * @param {Record<string, any>} [attributes] - More outgoing message attributes, such as an XEP-0066 URL
 * @param {import('./types').SendType} [type] - Whether it's meant for a MUC, or as a chat
 * @returns {Promise<import('@converse/headless').BaseMessage>}
 */
export async function sendMessage(jid, body, targets = {}, attributes = {}, type) {
    requireConnected('nothing was sent');

    const muc = await checkSendType(jid, type);
    const chatbox = muc ?? (await api.chats.get(jid, {}, true));
    await chatbox.initialized;
    return send(chatbox, { body, ...attributes }, targets);
}

/**
 * Refuses a send to one occupant of a MUC, such as "lobby@conference.example.org/juliet".
 * The daemon doesn't send MUC private messages yet, and taken as the MUC's JID,
 * what was meant for one occupant would reach all of them.
 * @param {unknown} to - The recipient as the client gave it, before it's resolved
 * @param {import('./types').SendType} [type]
 * @throws {RPCError} INVALID_PARAMS for an occupant's JID
 */
export async function refuseOccupant(to, type) {
    if (typeof to !== 'string' || !u.isValidJID(to.trim())) return;

    const nick = Strophe.getResourceFromJid(to.trim());
    if (!nick) return;

    const muc = Strophe.getBareJidFromJid(to.trim()).toLowerCase();
    if (type === 'groupchat' || (await getRooms(muc))) {
        throw new RPCError(
            ERRORS.INVALID_PARAMS,
            `"${to.trim()}" is an occupant of ${muc}. Private messages to MUC occupants aren't supported ` +
                'yet, so nothing was sent.',
        );
    }
}

/**
 * Checks that a message of the given type can go to a JID, and returns the MUC
 * it goes to, if any. Without a type, a MUC the daemon knows gets a MUC message
 * and any other JID a chat: the daemon doesn't guess whether an unknown JID is
 * a MUC, so a send to one it isn't in should say "groupchat", to be refused
 * rather than sent as a chat that reaches nobody.
 * @param {string} jid - Bare JID
 * @param {import('./types').SendType} [type]
 * @returns {Promise<import('@converse/headless').MUC|null>}
 * @throws {RPCError} NOT_JOINED for a MUC we aren't in, INVALID_PARAMS for a chat to a MUC
 */
export async function checkSendType(jid, type) {
    if (type !== undefined && type !== 'chat' && type !== 'groupchat') {
        throw new RPCError(ERRORS.INVALID_PARAMS, '"type" must be "chat" or "groupchat".');
    }
    const muc = /** @type {import('@converse/headless').MUC|undefined} */ (await getRooms(jid));
    if (type === 'chat') {
        if (muc) {
            throw new RPCError(
                ERRORS.INVALID_PARAMS,
                `${jid} is a MUC, so a chat to it would reach nobody. Send it as "groupchat".`,
            );
        }
        return null;
    }
    if (type === 'groupchat' || muc) {
        if (!muc?.isEntered()) throw notJoined(jid);
        return muc;
    }
    return null;
}

/**
 * What became of a send that headless accepted. A message is pending when the
 * session dropped before it went out: headless sends it once it's connected again.
 * @param {import('@converse/headless').BaseMessage} message
 * @returns {'sent'|'pending'}
 */
export function outcomeOf(message) {
    return message.get('send_status') === 'pending' ? 'pending' : 'sent';
}

/**
 * Sends through headless, which rejects with a coded error when a send fails,
 * such as an OMEMO send that couldn't be encrypted. The code is kept for
 * clients to act on. The words are the daemon's own, never headless's.
 * @param {import('@converse/headless').ChatBox|import('@converse/headless').MUC} chatbox
 * @param {Record<string, any>} attrs
 * @param {Record<string, any>} targets
 * @returns {Promise<import('@converse/headless').BaseMessage>}
 */
async function send(chatbox, attrs, targets) {
    if (targets.correcting) rememberDeliveredVersion(targets.correcting);

    const message = await attempt(() => chatbox.sendMessage(attrs, targets));
    if (!message) throw new RPCError(ERRORS.INTERNAL_ERROR, UNSENT.unexpected, { code: null });
    return message;
}

/**
 * Waits for a room to echo back a message we sent it, which is how a room
 * shows that it passed the message on to its occupants (XEP-0045 § 7.4). A
 * message in a chat is returned as it is: its recipient confirms it with a
 * receipt, if at all, which can come much later. So is a pending message,
 * which hasn't gone out yet.
 *
 * A room that turns the message down, or turns out not to have us, leaves it
 * a failed send, which can be sent again once we're back in the room. A room
 * that doesn't answer within {@link ROOM_ECHO} leaves it as it is, sent but
 * not delivered, since the echo may still come.
 * @param {import('@converse/headless').BaseMessage} message - A message we just sent
 * @returns {Promise<import('./types').MessageDTO>} The message as it is now
 * @throws {RPCError} NOT_JOINED or UNDELIVERED, when the room didn't take it
 */
export async function confirmDelivery(message) {
    const dto = toMessageDTO(message);
    if (dto.status !== 'sent' || !isRoomMessage(message)) return dto;

    const room = /** @type {import('@converse/headless').MUC} */ (message.collection.chatbox);
    const outcome = await awaitEcho(room, message);
    const delivered = delivered_versions.get(message);
    delivered_versions.delete(message);
    // Clearing the room's messages while we waited took this one too, so there's nothing left to confirm.
    if (!message.collection) return dto;

    if (outcome === 'not_joined') {
        markFailed(message, 'not-in-room', delivered);
        throw new RPCError(
            ERRORS.NOT_JOINED,
            `${dto.conversation} says we aren't in it, so the message didn't reach it. It's kept as a ` +
                'failed send: join the room again with "rooms.join", then send it with "messages.resend".',
            { id: dto.id, see: ['rooms.join', 'messages.resend'] },
        );
    }
    if (outcome === 'bounced') {
        const condition = message.get('error_condition') ?? 'undefined-condition';
        markFailed(message, condition, delivered);
        throw new RPCError(
            ERRORS.UNDELIVERED,
            `${dto.conversation} turned the message down (${condition}), so it didn't reach anyone. ` +
                'It\'s kept as a failed send, which "messages.resend" sends again.',
            { id: dto.id, condition, see: ['messages.resend'] },
        );
    }
    return toMessageDTO(message);
}

/**
 * Waits, as {@link confirmDelivery} does, for the room to take a message we
 * just sent, then records the send in the audit log: as failed, with the
 * reason, if the room didn't take it.
 * @param {import('@converse/headless').BaseMessage} message - A message we just sent
 * @param {ReturnType<typeof import('./audit.js').createAudit>} audit
 * @param {Omit<import('./types').AuditEntry, 'outcome'|'id'>} entry
 * @returns {Promise<import('./types').MessageDTO>} The message as it is now
 * @throws {RPCError} NOT_JOINED or UNDELIVERED, when the room didn't take it
 */
export async function confirmAndRecord(message, audit, entry) {
    // A room that doesn't take the message never gives it an id of its own.
    const id = getID(message);
    try {
        const dto = await confirmDelivery(message);
        audit.record({ ...entry, outcome: outcomeOf(message), id: dto.id });
        return dto;
    } catch (e) {
        const error = /** @type {import('./protocol.js').RPCError} */ (e);
        const error_code =
            error.code === ERRORS.NOT_JOINED
                ? 'not-in-room'
                : /** @type {{ condition?: string } | undefined} */ (error.data)?.condition;
        audit.record({ ...entry, outcome: 'failed', id, error_code });
        throw e;
    }
}

/**
 * @param {import('@converse/headless').MUC} room
 * @param {import('@converse/headless').BaseMessage} message
 * @returns {Promise<'echoed'|'bounced'|'not_joined'|'unconfirmed'>}
 */
function awaitEcho(room, message) {
    return new Promise((resolve) => {
        const check = () => {
            if (message.get('received')) settle('echoed');
            // A room answers a send from someone who isn't in it with <not-acceptable/> (XEP-0045 § 7.4).
            else if (message.get('error_condition') === 'not-acceptable') settle('not_joined');
            // Headless records a room's error on the message it answers.
            else if (message.get('error_condition') || message.get('error')) settle('bounced');
            // Losing the connection takes us out of every room, which says nothing about the message.
            else if (!api.connection.connected()) settle('unconfirmed');
            // A room that says we aren't in it is rejoined, or left, by headless.
            else if (!room.isEntered()) settle('not_joined');
        };
        const settle = (outcome) => {
            clearTimeout(timer);
            message.off('change', check);
            room.session.off('change:connection_status', check);
            resolve(outcome);
        };
        const timer = setTimeout(() => settle('unconfirmed'), ROOM_ECHO.timeout);
        message.on('change', check);
        room.session.on('change:connection_status', check);
        check();
    });
}

/**
 * Makes a message the room didn't take a failed send, the way headless makes
 * one it couldn't send, so that it can be sent again or discarded. The room's
 * error is moved into the failure, so that a resend starts afresh. A turned
 * down correction gets back the version that was delivered before it, which
 * discarding it restores.
 * @param {import('@converse/headless').BaseMessage} message
 * @param {string} code
 * @param {Record<string, any>} [before_correction] - What the room's occupants have of it
 */
function markFailed(message, code, before_correction) {
    message.save({
        ...(before_correction ? { before_correction } : {}),
        send_status: 'failed',
        send_error_code: code,
        error: undefined,
        error_condition: undefined,
        error_text: undefined,
        error_type: undefined,
        is_error: undefined,
    });
}

/**
 * Retracts one of our messages (XEP-0424).
 * @param {import('@converse/headless').BaseMessage} message - One of ours
 * @param {string} id - The id it was asked for by, for the error messages
 * @returns {Promise<import('./types').MessageDTO>} The message, retracted
 */
export async function retractMessage(message, id) {
    notRetracted(message, id);
    requireConnected('nothing was sent');

    const chatbox = message.collection.chatbox;
    await chatbox.retractOwnMessage(message);
    if (!message.get('retracted')) {
        // A room that doesn't answer in time has the retraction undone.
        throw new RPCError(
            ERRORS.INTERNAL_ERROR,
            `The room didn't confirm the retraction of "${id}", so it may not have happened. Try again.`,
        );
    }
    return toMessageDTO(message);
}

/**
 * Gives a message a reaction (XEP-0444), or withdraws one, keeping the other
 * reactions we gave it.
 * @param {import('@converse/headless').BaseMessage} message
 * @param {string} reaction - An emoji
 * @param {boolean} remove - Whether to withdraw it
 * @returns {Promise<import('./types').MessageDTO>} The message reacted to
 */
export async function sendReaction(message, reaction, remove) {
    requireConnected('nothing was sent');

    const chatbox = message.collection.chatbox;
    const mine = message.get('reactions')?.[u.reactions.getOwnReactionJID(chatbox)] ?? [];
    const emojis = remove ? mine.filter((e) => e !== reaction) : [...new Set([...mine, reaction])];
    await api.reactions.send(message, emojis);
    return toMessageDTO(message);
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
 * @param {import('@converse/headless').BaseMessage} message
 */
export async function resendUnencrypted(chatbox, message) {
    const { handled } = await api.hook('resendFailedMessageUnencrypted', chatbox, {
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
    if (code === 'not-connected') {
        return new RPCError(ERRORS.NOT_CONNECTED, UNSENT[code], { code, see: ['daemon.status'] });
    }
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
    'not-connected': "Nothing was sent: the daemon isn't connected to the server. Try again.",
    'no-omemo-devices': 'Nothing was sent: there are no OMEMO devices to encrypt for.',
    'omemo-key-fetch-failed': "Nothing was sent: the recipient's encryption keys couldn't be fetched. Try again.",
    'omemo-subscription-required': "Nothing was sent: the recipient's encryption keys need a presence subscription.",
    'omemo-remote-server-not-found': "Nothing was sent: the recipient's server couldn't be found.",
    'omemo-encrypt-failed': 'Nothing was sent: the message could not be encrypted. Try again.',
    'omemo-groupchat-not-eligible': 'Nothing was sent: not everyone in the room can receive encrypted messages.',
    unexpected: 'Nothing was sent, for an unexpected reason. Try again.',
};

/**
 * Refuses a message there's nothing in, or that both replies and corrects.
 * @param {unknown} body
 * @param {unknown} reply_to
 * @param {unknown} correct
 * @param {string} verb - What would be done with it, such as "send" or "schedule"
 */
export function checkMessage(body, reply_to, correct, verb) {
    if (typeof body !== 'string' || !body.trim()) {
        throw new RPCError(ERRORS.INVALID_PARAMS, `There is nothing to ${verb}: "body" is empty.`);
    }
    if (reply_to !== undefined && correct !== undefined) {
        throw new RPCError(
            ERRORS.INVALID_PARAMS,
            'A message either replies or corrects: pass one of "reply_to" and "correct".',
        );
    }
}
