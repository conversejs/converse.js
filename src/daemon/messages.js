/**
 * The `messages.*` methods, and the mapping from headless's models to the
 * DTOs clients see.
 * @module @converse/daemon/messages
 */
import { converse } from '@converse/headless';
import { getPage, hasArchivedMessages } from './history.js';
import { draftNotice } from './notices.js';
import { ERRORS, RPCError } from './protocol.js';
import { resolveJID } from './resolve.js';

const { Strophe } = converse.env;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 1000;

/**
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {Object} deps
 * @param {ReturnType<typeof import('./policy.js').createPolicy>} deps.policy
 * @param {ReturnType<typeof import('./audit.js').createAudit>} deps.audit
 * @param {ReturnType<typeof import('./drafts.js').createDraftStore>} deps.drafts
 * @param {ReturnType<typeof import('./events.js').createEvents>} deps.events
 * @param {string} deps.owner - Bare JID of the user, to whom drafts are delivered
 */
export function messageMethods(_converse, { policy, audit, drafts, events, owner }) {
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
         * Restricted connections are held to the send policy. A refusal is a
         * result, not an error, and it's audited like a send. A send the policy
         * wants a person to approve is queued as a draft instead.
         * @param {Object} params
         * @param {string} params.to - A JID, or a contact's name
         * @param {string} params.body
         * @param {import('./types').Client} client
         * @returns {Promise<import('./types').SendResult>}
         */
        async 'messages.send'({ to, body }, client) {
            const jid = await resolveJID(_converse, to, 'to');
            if (typeof body !== 'string' || !body.trim()) {
                throw new RPCError(ERRORS.INVALID_PARAMS, 'There is nothing to send: "body" is empty.');
            }
            if (client.access === 'restricted') {
                // An agent never sends to anyone directly. Its send becomes a draft, whose text goes to the owner.
                const verdict = policy.admit(jid);
                if (!verdict.allowed) {
                    audit.record({ consumer: client.consumer, to: jid, outcome: 'refused', rule: verdict.rule });
                    return { outcome: 'refused', rule: verdict.rule, message: verdict.message };
                }
                const draft = drafts.add({ to: jid, body, consumer: client.consumer });
                try {
                    await sendMessage(_converse, owner, draftNotice(draft));
                } catch (e) {
                    // Without the owner's copy, the draft would be one nobody can see, so it's dropped.
                    drafts.remove(draft.id);
                    throw e;
                }
                audit.record({ consumer: client.consumer, to: jid, outcome: 'draft', draft: draft.id });
                events.publishDraft('queued', draft);
                return { outcome: 'draft', draft_id: draft.id };
            }
            const dto = await sendMessage(_converse, jid, body);
            audit.record({ consumer: client.consumer, to: jid, outcome: 'sent', id: dto.id });
            return { outcome: 'sent', message: dto };
        },
    };
}

/**
 * Sends a message from the account. Restricted connections never reach this
 * for a recipient other than the owner: their sends become drafts.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {string} jid - Bare JID
 * @param {string} body
 * @returns {Promise<import('./types').MessageDTO>}
 */
export async function sendMessage(_converse, jid, body) {
    const { api } = _converse;
    if (!api.connection.connected()) {
        throw new RPCError(
            ERRORS.NOT_CONNECTED,
            'The daemon is not connected to the server, so nothing was sent. ' +
                'Check "converse-cli daemon status", then try again.',
        );
    }
    const chat = await api.chats.get(jid, {}, true);
    await chat.initialized;
    const message = await chat.sendMessage({ body });
    // Headless returns nothing when it can't build the stanza, and then nothing was sent.
    if (!message) {
        throw new RPCError(ERRORS.INTERNAL_ERROR, "The message couldn't be built, so nothing was sent. Try again.");
    }
    return toMessageDTO(message, jid, _converse.session.get('bare_jid'));
}

/**
 * The ids a message can be addressed by, its DTO id first.
 * @param {import('@converse/headless').Message} message
 * @param {string} own_jid
 */
function getIDs(message, own_jid) {
    return [message.get(`stanza_id ${own_jid}`), message.get('origin_id'), message.get('msgid')].filter(Boolean);
}

/**
 * Finds a message by any of its ids, or by a unique prefix of its DTO id.
 * @param {import('@converse/headless').Message[]} messages
 * @param {string} id
 * @param {string} own_jid
 */
function findMessage(messages, id, own_jid) {
    const exact = messages.find((m) => getIDs(m, own_jid).includes(id));
    if (exact) return exact;

    const matches = id ? messages.filter((m) => getIDs(m, own_jid)[0]?.startsWith(id)) : [];
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
        throw new RPCError(ERRORS.AMBIGUOUS, `More than one message has an id starting with "${id}".`, {
            candidates: matches.map((m) => getIDs(m, own_jid)[0]),
        });
    }
    throw new RPCError(ERRORS.NOT_FOUND, `No message with id "${id}" in this conversation.`);
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
 * @param {import('@converse/headless').Message} message
 * @param {string} conversation - Bare JID of the conversation
 * @param {string} own_jid
 * @returns {import('./types').MessageDTO}
 */
export function toMessageDTO(message, conversation, own_jid) {
    const outgoing = message.get('sender') === 'me';
    return {
        id: getIDs(message, own_jid)[0],
        conversation,
        from: outgoing ? own_jid : Strophe.getBareJidFromJid(message.get('from')),
        direction: outgoing ? 'outgoing' : 'incoming',
        time: message.get('time'),
        body: message.get('body') ?? null,
    };
}
