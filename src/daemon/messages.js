/**
 * The `messages.*` methods.
 * @module @converse/daemon/messages
 */
import { api, converse } from '@converse/headless';
import { getID, isFailedSend, toConversationDTO, toMessageDTO, toRoomDTO } from './dto.js';
import { findMessage, findOwn, findTarget, notRetracted, ownedBy } from './find.js';
import { hasArchivedMessages, isMessage } from './history.js';
import { ERRORS, RPCError } from './protocol.js';
import { resolveJID } from './resolve.js';
import { searchMessages } from './search.js';
import { requireConnected, rosterLoaded } from './session.js';
import {
    attempt,
    checkMessage,
    ownMessagesOnly,
    resendUnencrypted,
    retractMessage,
    sendMessage,
    sendReaction,
} from './send.js';

const { u } = converse.env;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 1000;

/**
 * @param {Object} deps
 * @param {ReturnType<typeof import('./routing.js').createSendRouter>} deps.routeSend
 * @param {ReturnType<typeof import('./audit.js').createAudit>} deps.audit
 * @param {ReturnType<typeof import('./drafts.js').createDrafter>} deps.queueDraft
 * @param {import('./types').Mode} deps.mode
 * @param {boolean} deps.allow_unencrypted_resend - Whether the owner may send a failed send in the clear
 */
export function messageMethods({ routeSend, audit, queueDraft, mode, allow_unencrypted_resend }) {
    // Acting as the user, a draft waits for the user's approval, and is then
    // sent as it was asked for. So corrections, retractions and withdrawn
    // reactions can be drafted too. Elsewhere the owner sends a draft by hand,
    // which only works for a new message or a reaction.
    const drafts_any_action = mode === 'as_user';

    return {
        /**
         * The recent messages of a conversation: from the local store, and
         * from the server's archive where that falls short.
         * @param {Object} params
         * @param {string} params.conversation - A JID, or a contact's name
         * @param {number} [params.limit]
         * @param {string} [params.before] - Only messages older than the one with this id
         * @param {string} [params.since] - Only messages at or after this ISO 8601 time
         * @returns {Promise<import('./types').MessageList>}
         */
        async 'messages.list'({ conversation, limit = DEFAULT_LIMIT, before, since }) {
            const jid = await resolveJID(conversation, 'conversation');
            if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
                throw new RPCError(ERRORS.INVALID_PARAMS, `"limit" must be a whole number from 1 to ${MAX_LIMIT}.`);
            }
            const since_ms = since === undefined ? undefined : Date.parse(since);
            if (Number.isNaN(since_ms)) {
                throw new RPCError(ERRORS.INVALID_PARAMS, '"since" must be an ISO 8601 time.');
            }

            const room = await api.rooms.get(jid);
            if (room) {
                const messages = await readPage(room, { limit, before, since: since_ms });
                return {
                    conversation: toRoomDTO(room),
                    messages: messages.map(toMessageDTO),
                };
            }

            let chat = await api.chats.get(jid);
            // Without the roster, which only a first connection loads, nobody is known to be a contact.
            const contact = rosterLoaded() ? await api.contacts.get(jid) : null;
            if (!chat) {
                // Opening a conversation just to look would leave it behind,
                // so for a stranger check the archive has something first.
                if (!contact && !api.connection.connected()) {
                    // Without the server there's no archive to look in, so "no messages" would be false.
                    throw new RPCError(
                        ERRORS.NOT_CONNECTED,
                        `There's no conversation with ${jid} stored locally, and the daemon isn't connected ` +
                            'to the server to look in its archive. Check "daemon.status", then try again.',
                        { see: ['daemon.status'] },
                    );
                }
                if (!contact && !(await hasArchivedMessages(jid))) {
                    throw new RPCError(
                        ERRORS.NOT_FOUND,
                        `There's no conversation with ${jid}, they aren't a contact, and the server's archive ` +
                            'has no messages with them. Check the JID, or send them a message to start a conversation.',
                    );
                }
                chat = await api.chats.get(jid, {}, true);
                await chat.initialized;
            }

            const messages = await readPage(chat, { limit, before, since: since_ms });
            return {
                conversation: toConversationDTO(jid, contact),
                messages: messages.map(toMessageDTO),
            };
        },

        /**
         * The messages whose text has every word of `query`, ignoring case and
         * accents. The server's full-text search of its archive is used where the
         * server offers it. Otherwise, or if the server's search fails, the messages
         * held locally are searched.
         * @param {Object} params
         * @param {string} params.query
         * @param {string} [params.conversation] - A JID, or a contact's name. Without it, every conversation is searched
         * @param {number} [params.limit] - The newest matches, at most this many
         * @returns {Promise<import('./types').SearchResult>}
         */
        async 'messages.search'({ query, conversation, limit = DEFAULT_LIMIT }) {
            if (typeof query !== 'string' || !query.trim()) {
                throw new RPCError(ERRORS.INVALID_PARAMS, 'There is nothing to search for: "query" is empty.');
            }
            if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
                throw new RPCError(ERRORS.INVALID_PARAMS, `"limit" must be a whole number from 1 to ${MAX_LIMIT}.`);
            }
            const jid = conversation === undefined ? undefined : await resolveJID(conversation, 'conversation');
            const text = query.trim();

            const { method, messages } = await searchMessages(text, jid, limit);
            return { method, messages: messages.map(toMessageDTO) };
        },

        /**
         * Restricted connections are held to the send policy, which decides
         * whether the message goes out directly, is queued as a draft for the
         * owner, or is refused. A refusal is a result, not an error.
         * @param {Object} params
         * @param {string} params.to - A JID, or a contact's name
         * @param {string} params.body
         * @param {string} [params.reply_to] - The id of a message in the conversation that this replies to
         * @param {string} [params.correct] - The id of one of our messages in the conversation, which
         *  this replaces. Only "as_user" mode drafts a correction. Elsewhere it's only sent directly.
         * @param {unknown} [params.at] - Refused: a later send is for "schedules.create"
         * @param {import('./types').Client} client
         * @returns {Promise<import('./types').SendResult>}
         */
        async 'messages.send'({ to, body, reply_to, correct, at }, client) {
            // Refused, rather than ignored, which would send now what was meant for later.
            if (at !== undefined) {
                throw new RPCError(ERRORS.INVALID_PARAMS, '"at" is for "schedules.create", which sends it later.', {
                    see: ['schedules.create'],
                });
            }
            const jid = await resolveJID(to, 'to');
            checkMessage(body, reply_to, correct, 'send');
            const replying_to = reply_to === undefined ? undefined : await findTarget(reply_to, jid);
            /** @type {import('./types').SendRoute} */
            const send = async (routing) => {
                const correcting = correct === undefined ? undefined : await findOwn(correct, jid, 'correct');
                // Taken before the send: a correction gets a new origin-id, which can change the message's id.
                const target = replying_to ?? correcting;
                /** @type {{ action?: 'reply'|'correct', target?: string }} */
                const action = target ? { action: replying_to ? 'reply' : 'correct', target: getID(target) } : {};
                const dto = await sendMessage(jid, body, { replying_to, correcting });
                audit.record({
                    consumer: client.consumer,
                    to: jid,
                    outcome: 'sent',
                    id: dto.id,
                    ...action,
                    ...routing,
                });
                return { outcome: 'sent', message: dto };
            };
            const draft = async (routing) => {
                const correcting = correct === undefined ? undefined : await findOwn(correct, jid, 'correct');
                const target_model = replying_to ?? correcting;
                const target = target_model ? toMessageDTO(target_model) : null;
                /** @type {import('./types').DraftAction} */
                const action = target
                    ? { action: replying_to ? 'reply' : 'correct', body, target: target.id }
                    : { action: 'send', body };
                return queueDraft(client, { to: jid, ...action }, routing, target);
            };
            return routeSend(client, jid, {
                direct: send,
                draft: correct === undefined || drafts_any_action ? draft : undefined,
                cannot_draft: ownMessagesOnly('correct'),
            });
        },

        /**
         * Withdraws one of our messages (XEP-0424). Restricted access can only
         * do it where the policy sends directly, since a draft can't retract,
         * except in "as_user" mode, where it's drafted for the user to approve.
         * @param {Object} params
         * @param {string} params.id - The message's id
         * @param {string} [params.conversation] - A JID, or a contact's name. Without it, the
         *  message is looked for in every conversation.
         * @param {import('./types').Client} client
         * @returns {Promise<import('./types').SendResult>}
         */
        async 'messages.retract'({ id, conversation }, client) {
            const jid = conversation === undefined ? undefined : await resolveJID(conversation, 'conversation');
            const found = await findTarget(id, jid);
            const to = found.collection.chatbox.get('jid');
            /** @type {import('./types').SendRoute} */
            const retract = async (routing) => {
                const message = ownedBy(found, id, 'retract');
                const target = getID(message);
                const dto = await retractMessage(message, id);
                audit.record({ consumer: client.consumer, to, outcome: 'sent', action: 'retract', target, ...routing });
                return { outcome: 'sent', message: dto };
            };
            const draft = (routing) => {
                const message = notRetracted(ownedBy(found, id, 'retract'), id);
                const target = toMessageDTO(message);
                return queueDraft(client, { to, action: 'retract', target: target.id }, routing, target);
            };
            return routeSend(client, to, {
                direct: retract,
                draft: drafts_any_action ? draft : undefined,
                cannot_draft: ownMessagesOnly('retract'),
            });
        },

        /**
         * Reacts to a message with an emoji (XEP-0444), keeping the reactions
         * we gave it before. Restricted access reacts as the policy routes it:
         * directly, or as a draft for the owner to give.
         * @param {Object} params
         * @param {string} params.id - The message's id
         * @param {string} params.emoji - An emoji, or its shortname such as ":thumbsup:"
         * @param {string} [params.conversation] - A JID, or a contact's name. Without it, the
         *  message is looked for in every conversation.
         * @param {boolean} [params.remove] - Withdraw this reaction instead. Only "as_user" mode drafts a withdrawal.
         * @param {import('./types').Client} client
         * @returns {Promise<import('./types').SendResult>} When sent, the message reacted to
         */
        async 'messages.react'({ id, emoji, conversation, remove = false }, client) {
            // A string such as "false" would otherwise count as true, and withdraw the reaction.
            if (typeof remove !== 'boolean') {
                throw new RPCError(ERRORS.INVALID_PARAMS, '"remove" must be true or false.');
            }
            const reaction = await toEmoji(emoji);
            const jid = conversation === undefined ? undefined : await resolveJID(conversation, 'conversation');
            const message = await findTarget(id, jid);
            const chatbox = message.collection.chatbox;
            const to = chatbox.get('jid');
            /** @type {import('./types').SendRoute} */
            const react = async (routing) => {
                const dto = await sendReaction(message, reaction, remove);
                const target = getID(message);
                audit.record({ consumer: client.consumer, to, outcome: 'sent', action: 'react', target, ...routing });
                return { outcome: 'sent', message: dto };
            };
            const draft = (routing) => {
                const target = toMessageDTO(message);
                return queueDraft(
                    client,
                    { to, action: 'react', body: reaction, target: target.id, remove: !!remove },
                    routing,
                    target,
                );
            };
            return routeSend(client, to, {
                direct: react,
                draft: !remove || drafts_any_action ? draft : undefined,
                cannot_draft: new RPCError(
                    ERRORS.ACCESS_DENIED,
                    "Restricted access can't remove reactions: its reactions are drafts, which the owner gives " +
                        "or doesn't.",
                ),
            });
        },

        /**
         * Sends a failed send again. Only the owner's full access connection may
         * do it, and nothing resends a failed send on its own. It's sent encrypted,
         * unless `unencrypted` asks otherwise, which the config must allow.
         * @param {Object} params
         * @param {string} params.id - The id of the failed send, as `messages.list` shows it
         * @param {string} [params.conversation] - A JID, or a contact's name. Without it, the
         *  message is looked for in every conversation.
         * @param {boolean} [params.unencrypted] - Send it in the clear, if it was refused for encryption
         * @param {import('./types').Client} client
         * @returns {Promise<import('./types').SendResult>}
         */
        async 'messages.resend'({ id, conversation, unencrypted = false }, client) {
            if (typeof unencrypted !== 'boolean') {
                throw new RPCError(ERRORS.INVALID_PARAMS, '"unencrypted" must be true or false.');
            }
            if (unencrypted && !allow_unencrypted_resend) {
                throw new RPCError(
                    ERRORS.ACCESS_DENIED,
                    'Sending a failed send in the clear is off. To allow it, set "allow_unencrypted_resend" ' +
                        'to true in the daemon config.',
                );
            }
            const jid = conversation === undefined ? undefined : await resolveJID(conversation, 'conversation');
            const message = failedSendOf(await findTarget(id, jid), id, 'sent again');
            requireConnected('nothing was sent');

            const chatbox = message.collection.chatbox;
            const to = chatbox.get('jid');
            await attempt(() =>
                unencrypted ? resendUnencrypted(chatbox, message) : chatbox.resendFailedMessage(message),
            );
            const dto = toMessageDTO(message);
            audit.record({
                consumer: client.consumer,
                to,
                outcome: 'sent',
                id: dto.id,
                action: 'resend',
                ...(unencrypted ? { unencrypted: true } : {}),
            });
            return { outcome: 'sent', message: dto };
        },

        /**
         * Removes a failed send from the history. Only the owner's full access
         * connection may do it.
         * @param {Object} params
         * @param {string} params.id - The id of the failed send, as `messages.list` shows it
         * @param {string} [params.conversation] - A JID, or a contact's name. Without it, the
         *  message is looked for in every conversation.
         * @returns {Promise<{ message: import('./types').MessageDTO }>} The message as it was
         */
        async 'messages.discard'({ id, conversation }) {
            const jid = conversation === undefined ? undefined : await resolveJID(conversation, 'conversation');
            const message = failedSendOf(await findTarget(id, jid), id, 'discarded');
            const chatbox = message.collection.chatbox;
            const dto = toMessageDTO(message);
            chatbox.discardFailedMessage(message);
            return { message: dto };
        },
    };
}

/**
 * A page of a conversation's messages, ending before the message with the id
 * `before`, if given.
 * @param {import('@converse/headless').ChatBox|import('@converse/headless').MUC} chat
 * @param {Object} options
 * @param {number} options.limit
 * @param {string} [options.before] - The id of a message held in the conversation
 * @param {number} [options.since] - Milliseconds since the epoch
 */
async function readPage(chat, { limit, before, since }) {
    await chat.messages.fetched;
    const end = before === undefined ? undefined : findMessage(chat.messages.models.filter(isMessage), before);
    return api.archive.page(chat, { limit, before: end, since, filter: isMessage });
}

/**
 * A reaction is a single emoji (XEP-0444). A shortname such as ":thumbsup:"
 * is turned into the emoji it names.
 * @param {unknown} emoji
 * @returns {Promise<string>}
 */
async function toEmoji(emoji) {
    const invalid = () =>
        new RPCError(
            ERRORS.INVALID_PARAMS,
            '"emoji" must be a single emoji, such as 👍, or its shortname, such as :thumbsup:.',
        );
    if (typeof emoji !== 'string') throw invalid();

    await api.emojis.initialize();
    const text = u.emojis.shortnamesToUnicode(emoji.trim());
    if (!(/^\p{RGI_Emoji}$/v).test(text)) throw invalid();

    return text;
}

/**
 * @param {import('@converse/headless').BaseMessage} message - Found by the id given
 * @param {string} id
 * @param {string} verb - What's to be done to it, for the error message
 */
function failedSendOf(message, id, verb) {
    if (!isFailedSend(message)) {
        throw new RPCError(
            ERRORS.NOT_FOUND,
            `Message "${id}" isn't a failed send, so it can't be ${verb}. "messages.list" gives a failed ` +
                'send the status "failed".',
            { see: ['messages.list'] },
        );
    }
    return message;
}
