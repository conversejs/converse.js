/**
 * The `messages.*` methods, and the mapping from headless's models to the
 * DTOs clients see.
 * @module @converse/daemon/messages
 */
import { converse, log } from '@converse/headless';
import { getPage, hasArchivedMessages, isMessage } from './history.js';
import { draftNotice } from './notices.js';
import { ERRORS, RPCError } from './protocol.js';
import { resolveJID } from './resolve.js';
import { notJoined } from './routing.js';

const { Strophe, u } = converse.env;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 1000;

/**
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {Object} deps
 * @param {ReturnType<typeof import('./routing.js').createSendRouter>} deps.routeSend
 * @param {ReturnType<typeof import('./audit.js').createAudit>} deps.audit
 * @param {ReturnType<typeof import('./drafts.js').createDraftStore>} deps.drafts
 * @param {ReturnType<typeof import('./events.js').createEvents>} deps.events
 * @param {string} deps.owner - Bare JID of the user, to whom drafts are delivered
 */
export function messageMethods(_converse, { routeSend, audit, drafts, events, owner }) {
    const { api } = _converse;
    const ownJID = () => _converse.session.get('bare_jid');

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
            const jid = await resolveJID(_converse, conversation, 'conversation');
            if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
                throw new RPCError(ERRORS.INVALID_PARAMS, `"limit" must be a whole number from 1 to ${MAX_LIMIT}.`);
            }
            const since_ms = since === undefined ? undefined : Date.parse(since);
            if (Number.isNaN(since_ms)) {
                throw new RPCError(ERRORS.INVALID_PARAMS, '"since" must be an ISO 8601 time.');
            }

            const room = await api.rooms.get(jid);
            if (room) {
                const messages = await getPage(room, {
                    limit,
                    since: since_ms,
                    before: before === undefined ? undefined : (models) => findMessage(models, before, ownJID()),
                });
                return {
                    conversation: toRoomDTO(room),
                    messages: messages.map((m) => toMessageDTO(m, jid, ownJID())),
                };
            }

            let chat = await api.chats.get(jid);
            const contact = await api.contacts.get(jid);
            if (!chat) {
                // Opening a conversation just to look would leave it behind,
                // so for a stranger check the archive has something first.
                if (!contact && !api.connection.connected()) {
                    // Without the server there's no archive to look in, so "no messages" would be false.
                    throw new RPCError(
                        ERRORS.NOT_CONNECTED,
                        `There's no conversation with ${jid} stored locally, and the daemon isn't connected ` +
                            'to the server to look in its archive. Check "converse-cli daemon status", then try again.',
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

            const messages = await getPage(chat, {
                limit,
                since: since_ms,
                before: before === undefined ? undefined : (models) => findMessage(models, before, ownJID()),
            });
            return {
                conversation: toConversationDTO(jid, contact),
                messages: messages.map((m) => toMessageDTO(m, jid, ownJID())),
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
            const jid = conversation === undefined ? undefined : await resolveJID(_converse, conversation, 'conversation');
            const text = query.trim();

            const found = await searchServer(_converse, text, jid, limit);
            if (found) {
                return { method: 'server', messages: found.map((m) => toMessageDTO(m, conversationOf(m), ownJID())) };
            }
            const held = await searchLocal(_converse, text, jid, limit);
            return { method: 'local', messages: held.map((m) => toMessageDTO(m, conversationOf(m), ownJID())) };
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
         *  this replaces. A draft can't correct a message, so this is only sent directly.
         * @param {import('./types').Client} client
         * @returns {Promise<import('./types').SendResult>}
         */
        async 'messages.send'({ to, body, reply_to, correct }, client) {
            const jid = await resolveJID(_converse, to, 'to');
            if (typeof body !== 'string' || !body.trim()) {
                throw new RPCError(ERRORS.INVALID_PARAMS, 'There is nothing to send: "body" is empty.');
            }
            if (reply_to !== undefined && correct !== undefined) {
                throw new RPCError(
                    ERRORS.INVALID_PARAMS,
                    'A message either replies or corrects: pass one of "reply_to" and "correct".',
                );
            }
            const replying_to = reply_to === undefined ? undefined : await findTarget(_converse, reply_to, jid);
            const send = async (routing) => {
                const correcting =
                    correct === undefined ? undefined : await findOwn(_converse, correct, jid, 'correct');
                // Taken before the send: a correction gets a new origin-id, which can change the message's id.
                const target = replying_to ?? correcting;
                const action = target
                    ? { action: replying_to ? 'reply' : 'correct', target: getIDs(target, ownJID())[0] }
                    : {};
                const dto = await sendMessage(_converse, jid, body, { replying_to, correcting });
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
            return routeSend(client, jid, {
                direct: send,
                draft:
                    correct === undefined
                        ? (routing) => draft(client, { to: jid, body, reply_to: replying_to }, routing)
                        : undefined,
                cannot_draft: ownMessagesOnly('correct'),
            });
        },

        /**
         * Withdraws one of our messages (XEP-0424). Restricted access can only
         * do it where the policy sends directly, since a draft can't retract.
         * @param {Object} params
         * @param {string} params.id - The message's id
         * @param {string} [params.conversation] - A JID, or a contact's name. Without it, the
         *  message is looked for in every conversation.
         * @param {import('./types').Client} client
         * @returns {Promise<import('./types').SendResult>}
         */
        async 'messages.retract'({ id, conversation }, client) {
            const jid =
                conversation === undefined ? undefined : await resolveJID(_converse, conversation, 'conversation');
            const found = await findTarget(_converse, id, jid);
            const to = found.collection.chatbox.get('jid');
            const retract = async (routing) => {
                const message = ownedBy(found, id, 'retract');
                if (message.isRetracted()) {
                    throw new RPCError(ERRORS.INVALID_PARAMS, `Message "${id}" has already been retracted.`);
                }
                if (!api.connection.connected()) throw notConnected();

                const chatbox = message.collection.chatbox;
                const target = getIDs(message, ownJID())[0];
                await chatbox.retractOwnMessage(message);
                if (!message.get('retracted')) {
                    // A room that doesn't answer in time has the retraction undone.
                    throw new RPCError(
                        ERRORS.INTERNAL_ERROR,
                        `The room didn't confirm the retraction of "${id}", so it may not have happened. Try again.`,
                    );
                }
                audit.record({ consumer: client.consumer, to, outcome: 'sent', action: 'retract', target, ...routing });
                return { outcome: 'sent', message: toMessageDTO(message, to, ownJID()) };
            };
            return routeSend(client, to, { direct: retract, cannot_draft: ownMessagesOnly('retract') });
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
         * @param {boolean} [params.remove] - Withdraw this reaction instead. A draft can't withdraw one.
         * @param {import('./types').Client} client
         * @returns {Promise<import('./types').SendResult>} When sent, the message reacted to
         */
        async 'messages.react'({ id, emoji, conversation, remove = false }, client) {
            const reaction = await toEmoji(_converse, emoji);
            const jid =
                conversation === undefined ? undefined : await resolveJID(_converse, conversation, 'conversation');
            const message = await findTarget(_converse, id, jid);
            const chatbox = message.collection.chatbox;
            const to = chatbox.get('jid');
            const react = async (routing) => {
                if (!api.connection.connected()) throw notConnected();

                const mine = message.get('reactions')?.[u.reactions.getOwnReactionJID(chatbox)] ?? [];
                const emojis = remove ? mine.filter((e) => e !== reaction) : [...new Set([...mine, reaction])];
                await api.reactions.send(message, emojis);
                const target = getIDs(message, ownJID())[0];
                audit.record({ consumer: client.consumer, to, outcome: 'sent', action: 'react', target, ...routing });
                return { outcome: 'sent', message: toMessageDTO(message, to, ownJID()) };
            };
            return routeSend(client, to, {
                direct: react,
                draft: remove
                    ? undefined
                    : (routing) => draft(client, { to, body: reaction, reaction_to: message }, routing),
                cannot_draft: new RPCError(
                    ERRORS.ACCESS_DENIED,
                    "Restricted access can't remove reactions: its reactions are drafts, which the owner gives " +
                        "or doesn't.",
                ),
            });
        },
    };

    /**
     * A restricted send that the policy routes to the owner: its text goes to
     * the owner, who sends it or doesn't.
     * @param {import('./types').Client} client
     * @param {Object} send
     * @param {string} send.to - Bare JID
     * @param {string} send.body - For a reaction, the emoji
     * @param {import('@converse/headless').Message} [send.reply_to]
     * @param {import('@converse/headless').Message} [send.reaction_to]
     * @param {import('./types').Routing} routing
     * @returns {Promise<import('./types').SendResult>}
     */
    async function draft(client, { to, body, reply_to, reaction_to }, routing) {
        const target_model = reply_to ?? reaction_to;
        const target = target_model ? toMessageDTO(target_model, to, ownJID()) : null;
        /** @type {import('./types').DraftAction} */
        const action = target
            ? { action: reaction_to ? 'react' : 'reply', body, target: target.id }
            : { action: 'send', body };
        const added = drafts.add({ to, consumer: client.consumer, ...action });
        try {
            await sendMessage(_converse, owner, draftNotice(added, target));
        } catch (e) {
            // Without the owner's copy, the draft would be one nobody can see, so it's dropped.
            drafts.remove(added.id);
            throw e;
        }
        audit.record({ consumer: client.consumer, to, outcome: 'draft', draft: added.id, ...routing });
        events.publishDraft('queued', added);
        return { outcome: 'draft', draft_id: added.id };
    }
}

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
        throw new RPCError(ERRORS.INVALID_PARAMS, 'A message id must be one that "converse-cli read" showed.');
    }
    const messages = (await heldConversations(_converse, jid)).flatMap((c) => c.messages.models.filter(isMessage));
    const where = jid ? 'in this conversation' : 'in any conversation';
    return findMessage(messages, id, _converse.session.get('bare_jid'), where);
}

/**
 * The conversations held locally, with their messages fetched: the one with
 * `jid`, or every one.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {string} [jid] - The bare JID of the conversation
 * @returns {Promise<(import('@converse/headless').ChatBox|import('@converse/headless').ChatRoom)[]>}
 */
async function heldConversations(_converse, jid) {
    const { api } = _converse;
    const chatboxes = jid
        ? [(await api.rooms.get(jid)) ?? (await api.chats.get(jid))].filter(Boolean)
        : [...((await api.chats.get()) ?? []), ...((await api.rooms.get()) ?? [])];
    await Promise.all(chatboxes.map((c) => c.messages.fetched));
    return chatboxes;
}

/**
 * The matches for `text` that the server's archive holds, or null where the
 * server can't search it. A search that fails is logged, and is treated the same.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {string} text
 * @param {string} [jid] - The bare JID of the conversation to search, else every one
 * @param {number} limit
 * @returns {Promise<import('@converse/headless').Message[]|null>}
 */
async function searchServer(_converse, text, jid, limit) {
    const { api } = _converse;
    if (!api.connection.connected()) return null;
    try {
        // Created, so that each match is held, and its id works with the other commands.
        const result = await api.archive.search(text, { with: jid, max: limit, create: true });
        return result?.messages ?? null;
    } catch (e) {
        log.warn(`The server couldn't search its archive, so the messages held locally are searched: ${e.message}`);
        return null;
    }
}

/**
 * The newest `limit` messages held locally whose text has every word of `text`,
 * oldest first.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {string} text
 * @param {string} [jid] - The bare JID of the conversation to search, else every one
 * @param {number} limit
 * @returns {Promise<import('@converse/headless').Message[]>}
 */
async function searchLocal(_converse, text, jid, limit) {
    const words = fold(text).split(/\s+/);
    return (await heldConversations(_converse, jid))
        .flatMap((c) => c.messages.models.filter(isMessage))
        .filter((m) => !m.isRetracted())
        .filter((m) => {
            const body = fold(m.stripReplyFallback(m.get('body')) ?? '');
            return words.every((word) => body.includes(word));
        })
        .sort((a, b) => Date.parse(a.get('time')) - Date.parse(b.get('time')))
        .slice(-limit);
}

/**
 * Text as a search compares it: neither case nor accents count.
 * @param {string} text
 */
const fold = (text) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * @param {import('@converse/headless').Message} message
 * @returns {string} The bare JID of the conversation the message is in
 */
const conversationOf = (message) => message.collection.chatbox.get('jid');

/**
 * A reaction is a single emoji (XEP-0444). A shortname such as ":thumbsup:"
 * is turned into the emoji it names.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {unknown} emoji
 * @returns {Promise<string>}
 */
async function toEmoji(_converse, emoji) {
    const invalid = () =>
        new RPCError(
            ERRORS.INVALID_PARAMS,
            '"emoji" must be a single emoji, such as 👍, or its shortname, such as :thumbsup:.',
        );
    if (typeof emoji !== 'string') throw invalid();

    await _converse.api.emojis.initialize();
    const text = u.emojis.shortnamesToUnicode(emoji.trim());
    if (!(/^\p{RGI_Emoji}$/v).test(text)) throw invalid();

    return text;
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
function ownedBy(message, id, verb) {
    if (message.get('sender') !== 'me') {
        throw new RPCError(
            ERRORS.INVALID_PARAMS,
            `Message "${id}" was sent by someone else, and only our own messages can be ${verb}ed.`,
        );
    }
    return message;
}

/**
 * A draft can't correct, retract or remove a reaction, so where the policy
 * would make a restricted send a draft, these are refused instead.
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
        const message = await room.sendMessage({ body, ...attributes }, targets);
        if (!message) {
            throw new RPCError(ERRORS.INTERNAL_ERROR, "The message couldn't be built, so nothing was sent. Try again.");
        }
        return toMessageDTO(message, jid, _converse.session.get('bare_jid'));
    }
    const chat = await api.chats.get(jid, {}, true);
    await chat.initialized;
    const message = await chat.sendMessage({ body, ...attributes }, targets);
    // Headless returns nothing when it can't build the stanza, and then nothing was sent.
    if (!message) {
        throw new RPCError(ERRORS.INTERNAL_ERROR, "The message couldn't be built, so nothing was sent. Try again.");
    }
    return toMessageDTO(message, jid, _converse.session.get('bare_jid'));
}

function notConnected() {
    return new RPCError(
        ERRORS.NOT_CONNECTED,
        'The daemon is not connected to the server, so nothing was sent. ' +
            'Check "converse-cli daemon status", then try again.',
    );
}

/**
 * The ids a message can be addressed by, its DTO id first.
 * @param {import('@converse/headless').Message} message
 * @param {string} own_jid
 */
function getIDs(message, own_jid) {
    const stanza_id_by = isRoomMessage(message) ? Strophe.getBareJidFromJid(message.get('from')) : own_jid;
    return [message.get(`stanza_id ${stanza_id_by}`), message.get('origin_id'), message.get('msgid')].filter(Boolean);
}

/**
 * A message in a room is one a room's occupants exchange, not a chat.
 * @param {import('@converse/headless').Message} message
 */
export function isRoomMessage(message) {
    return message.get('type') === 'groupchat';
}

/**
 * Finds a message by any of its ids, or by a unique prefix of its DTO id.
 * @param {import('@converse/headless').Message[]} messages
 * @param {string} id
 * @param {string} own_jid
 * @param {string} [where] - Where the messages are from, for the error message
 */
function findMessage(messages, id, own_jid, where = 'in this conversation') {
    const exact = messages.find((m) => getIDs(m, own_jid).includes(id));
    if (exact) return exact;

    const matches = id ? messages.filter((m) => getIDs(m, own_jid)[0]?.startsWith(id)) : [];
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
        throw new RPCError(ERRORS.AMBIGUOUS, `More than one message has an id starting with "${id}".`, {
            candidates: matches.map((m) => getIDs(m, own_jid)[0]),
        });
    }
    throw new RPCError(ERRORS.NOT_FOUND, `No message with id "${id}" ${where}.`);
}

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
    const id = getIDs(message, own_jid)[0];
    const retracted = message.isRetracted();
    const rest = {
        direction: outgoing ? 'outgoing' : 'incoming',
        time: message.get('time'),
        // What was retracted was withdrawn by its sender, so it isn't passed on.
        // A reply quotes what it answers for clients that don't know replies. That's what reply_to is for.
        body: retracted ? null : (message.stripReplyFallback(message.get('body')) ?? null),
        reply_to: getReplyTarget(message, own_jid),
        edited: message.get('edited') ?? null,
        retracted: retracted ? (message.get('retracted') ?? message.get('time')) : null,
        reactions: getReactions(message),
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
 * @param {string} own_jid
 * @returns {string|null}
 */
function getReplyTarget(message, own_jid) {
    const reply_to_id = message.get('reply_to_id');
    if (!reply_to_id) return null;

    const target = message.collection?.chatbox?.getReferencedMessage(reply_to_id);
    return target ? getIDs(target, own_jid)[0] : reply_to_id;
}
