/**
 * The mapping from headless's models to the DTOs clients see.
 * @module @converse/daemon/dto
 */
import { converse } from '@converse/headless';
import { isUndecryptable } from './history.js';

const { Strophe } = converse.env;

/**
 * The ids a message can be addressed by, its DTO id first.
 * @param {import('@converse/headless').Message} message
 */
export function getIDs(message) {
    return [message.getArchiveID(), message.get('origin_id'), message.get('msgid')].filter(Boolean);
}

/**
 * A message in a room is one a room's occupants exchange, not a chat.
 * @param {import('@converse/headless').Message} message
 */
export function isRoomMessage(message) {
    return message.get('type') === 'groupchat';
}

/**
 * @param {import('@converse/headless').Message} message
 * @returns {string} The bare JID of the conversation the message is in
 */
export const conversationOf = (message) => message.collection.chatbox.get('jid');

/**
 * @param {string} jid
 * @param {import('@converse/headless').RosterContact|null} contact - Its roster name is set by the user
 * @returns {import('./types').ConversationDTO}
 */
export function toConversationDTO(jid, contact) {
    return { jid, type: 'chat', name: contact?.get('nickname') || null };
}

/**
 * @param {import('@converse/headless').ChatRoom} room
 * @returns {import('./types').ConversationDTO}
 */
export function toRoomDTO(room) {
    return { jid: room.get('jid'), type: 'groupchat', name: room.get('name')?.trim() || null };
}

/**
 * @param {import('@converse/headless').Message} message
 * @param {string} conversation - Bare JID of the conversation
 * @param {string} own_jid
 * @returns {import('./types').MessageDTO}
 */
export function toMessageDTO(message, conversation, own_jid) {
    const outgoing = message.get('sender') === 'me';
    const id = getIDs(message)[0];
    const retracted = message.isRetracted();
    const undecryptable = isUndecryptable(message);
    const rest = {
        direction: outgoing ? 'outgoing' : 'incoming',
        time: message.get('time'),
        // What was retracted was withdrawn by its sender, so it isn't passed on.
        // A reply quotes what it answers for clients that don't know replies. That's what reply_to is for.
        // An encrypted message's text is its plaintext, and one that couldn't be decrypted has none.
        body: retracted || undecryptable ? null : (message.stripReplyFallback(getText(message)) ?? null),
        encryption: getEncryption(message),
        reply_to: getReplyTarget(message),
        edited: message.get('edited') ?? null,
        retracted: retracted ? (message.get('retracted') ?? message.get('time')) : null,
        reactions: getReactions(message),
        status: getStatus(message),
        error_code: isFailedSend(message) ? (message.get('send_error_code') ?? null) : null,
    };
    if (isRoomMessage(message)) {
        // The sender of a room message is its occupant, so the JID is the room's with the nickname.
        const from = message.get('from');
        return { id, conversation, from, nick: message.get('nick') ?? Strophe.getResourceFromJid(from), ...rest };
    }
    const from = outgoing ? own_jid : Strophe.getBareJidFromJid(message.get('from'));
    return { id, conversation, from, nick: null, ...rest };
}

/**
 * @param {import('@converse/headless').Message} message
 * @returns {import('./types').MessageDTO['status']}
 */
function getStatus(message) {
    if (message.get('sender') !== 'me') return 'received';
    return isFailedSend(message) ? 'failed' : 'sent';
}

/**
 * A send that didn't go out. Headless keeps it, with the reason, so that it can
 * be shown and sent again.
 * @param {import('@converse/headless').Message} message
 */
export function isFailedSend(message) {
    return message.get('send_status') === 'failed';
}

/**
 * The text a message says: its plaintext if it was encrypted, else its body.
 * @param {import('@converse/headless').Message} message
 * @returns {string|undefined}
 */
export function getText(message) {
    return message.get('is_encrypted') ? message.get('plaintext') : message.get('body');
}

/**
 * How a message was encrypted, and whether it could be read. Null for a plain
 * message. A message that couldn't be decrypted is kept, with its reason, so
 * that it doesn't read as a gap in the conversation.
 * @param {import('@converse/headless').Message} message
 * @returns {import('./types').Encryption|null}
 */
function getEncryption(message) {
    if (isUndecryptable(message)) {
        return { scheme: 'omemo', status: 'undecryptable', error: message.get('error_text') ?? null };
    }
    if (message.get('is_encrypted')) {
        return { scheme: 'omemo', status: 'decrypted', error: null };
    }
    return null;
}

/**
 * Who reacted to a message with which emoji (XEP-0444), keyed by emoji. Headless
 * keys them by reactor instead, and in a room by whatever identifies the
 * occupant best, so a room's reactors are named here the way a room message's
 * sender is: by occupant JID, where the occupant can be found.
 * @param {import('@converse/headless').Message} message
 * @returns {Record<string, string[]>}
 */
function getReactions(message) {
    /** @type {Record<string, string[]>} */
    const by_emoji = {};
    const chatbox = message.collection?.chatbox;
    for (const [key, emojis] of Object.entries(message.get('reactions') ?? {})) {
        const reactor = isRoomMessage(message) ? toOccupantJID(chatbox, key) : key;
        for (const emoji of emojis) {
            (by_emoji[emoji] ??= []).push(reactor);
        }
    }
    return by_emoji;
}

/**
 * @param {import('@converse/headless').ChatRoom} room
 * @param {string} key - An occupant id, a bare JID, or already an occupant JID
 */
function toOccupantJID(room, key) {
    const occupant =
        room?.occupants.findWhere({ occupant_id: key }) ??
        (key.includes('/') ? undefined : room?.occupants.findWhere({ jid: key }));
    return occupant?.get('nick') ? `${room.get('jid')}/${occupant.get('nick')}` : key;
}

/**
 * The DTO id of the message a reply answers, if we hold it, so that it can be
 * found in what `read` shows. Otherwise the id the reply gave, which is the
 * best there is.
 * @param {import('@converse/headless').Message} message
 * @returns {string|null}
 */
function getReplyTarget(message) {
    const reply_to_id = message.get('reply_to_id');
    if (!reply_to_id) return null;

    const target = message.collection?.chatbox?.getReferencedMessage(reply_to_id);
    return target ? getIDs(target)[0] : reply_to_id;
}
