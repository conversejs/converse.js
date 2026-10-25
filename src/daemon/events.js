/**
 * The `events.*` methods: a live stream of what the session receives, sent to
 * each subscribed client as JSON-RPC notifications. Subscriptions belong to
 * the connection that made them and end with it.
 * @module @converse/daemon/events
 */
import { constants, converse } from '@converse/headless';
import { toMessageDTO } from './messages.js';
import { ERRORS, RPCError } from './protocol.js';
import { resolveJID } from './resolve.js';

const { Strophe } = converse.env;
const { CHATROOMS_TYPE } = constants;

const EVENT_TYPES = ['message', 'draft'];
const DIRECTIONS = ['incoming', 'outgoing'];

/**
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 */
export function createEvents(_converse) {
    const { api } = _converse;
    const ownJID = () => _converse.session.get('bare_jid');

    let next_id = 1;
    /** @type {Map<number, import('./types').Subscription>} */
    const subscriptions = new Map();

    // This is a hook, so the message it's given must be returned for the next
    // listener in the chain.
    api.listen.on('afterMessageCreated', (chatbox, message) => {
        publish(chatbox, message);
        return message;
    });
    // What we send doesn't pass through afterMessageCreated, so it's published from here.
    api.listen.on('sendMessage', ({ chatbox, message }) => publish(chatbox, message));

    /**
     * Only messages stored as they arrive. What the archive returns when we
     * catch up is history, not news, and would flood a subscriber that
     * connected a moment ago.
     */
    function publish(chatbox, message) {
        // Groupchats are ticket 12's.
        if (chatbox.get('type') === CHATROOMS_TYPE || message.get('is_archived')) return;

        const dto = toMessageDTO(message, chatbox.get('jid'), ownJID());
        notify('message', dto, { message: dto });
    }

    /**
     * Calls each subscription of `type` whose filter accepts the event. Ends
     * the ones that were made to take only one.
     * @param {import('./types').Subscription['type']} type
     * @param {import('./types').MessageDTO} dto - What the filters are matched against
     * @param {Record<string, unknown>} fields - The event's own fields
     */
    function notify(type, dto, fields) {
        for (const [subscription, sub] of subscriptions) {
            if (sub.type !== type || !matches(sub.filter, dto, ownJID())) continue;
            sub.client.notify({ subscription, type, ...fields });
            if (sub.once) subscriptions.delete(subscription);
        }
    }

    return {
        /**
         * Announces a draft to draft subscribers. A draft is an outgoing
         * message from us, so the filters read it as one: the conversation
         * filter is against whom it's addressed.
         * @param {'queued'|'edited'|'approved'|'rejected'} action
         * @param {import('./types').Draft} draft
         */
        publishDraft(action, draft) {
            const as_message = {
                id: draft.id,
                conversation: draft.to,
                from: ownJID(),
                direction: 'outgoing',
                time: draft.created,
                body: draft.body,
            };
            notify('draft', as_message, { action, draft });
        },

        methods: {
            /**
             * @param {Object} params
             * @param {string} [params.type] - "message" (the default) or "draft"
             * @param {string} [params.conversation] - A JID, or a contact's name
             * @param {string} [params.from] - A JID, or a contact's name
             * @param {'incoming'|'outgoing'} [params.direction]
             * @param {boolean} [params.mention] - Whether the body names our account
             * @param {boolean} [params.once] - End the subscription after the first event
             * @param {import('./types').Client} client
             * @returns {{ subscription: number }}
             */
            async 'events.subscribe'(params, client) {
                const { type, filter, once } = await parseSubscription(_converse, params);
                const subscription = next_id++;
                subscriptions.set(subscription, { client, type, filter, once });
                return { subscription };
            },

            /**
             * Does nothing for a subscription that has already ended, or that
             * another client made: neither is this client's to end.
             * @param {{ subscription: number }} params
             * @param {import('./types').Client} client
             */
            'events.unsubscribe'({ subscription }, client) {
                if (subscriptions.get(subscription)?.client === client) subscriptions.delete(subscription);
                return {};
            },
        },

        /**
         * Ends every subscription a client made, when its connection closes.
         * @param {import('./types').Client} client
         */
        forget(client) {
            for (const [subscription, sub] of subscriptions) {
                if (sub.client === client) subscriptions.delete(subscription);
            }
        },
    };
}

/**
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {Object} params
 * @returns {Promise<{ type: import('./types').Subscription['type'], filter: import('./types').EventFilter, once: boolean }>}
 */
async function parseSubscription(
    _converse,
    { type = 'message', conversation, from, direction, mention = false, once = false },
) {
    if (!EVENT_TYPES.includes(type)) {
        throw new RPCError(ERRORS.INVALID_PARAMS, `"type" must be one of: ${EVENT_TYPES.join(', ')}.`);
    }
    if (direction !== undefined && !DIRECTIONS.includes(direction)) {
        throw new RPCError(ERRORS.INVALID_PARAMS, '"direction" must be "incoming" or "outgoing".');
    }
    if (typeof mention !== 'boolean' || typeof once !== 'boolean') {
        throw new RPCError(ERRORS.INVALID_PARAMS, '"mention" and "once" must be true or false.');
    }
    return {
        type,
        filter: {
            conversation:
                conversation === undefined ? undefined : await resolveJID(_converse, conversation, 'conversation'),
            from: from === undefined ? undefined : await resolveJID(_converse, from, 'from'),
            direction,
            mention,
        },
        once,
    };
}

/**
 * @param {import('./types').EventFilter} filter
 * @param {import('./types').MessageDTO} message
 * @param {string} own_jid
 */
function matches({ conversation, from, direction, mention }, message, own_jid) {
    if (conversation && message.conversation !== conversation) return false;
    if (from && message.from !== from) return false;
    if (direction && message.direction !== direction) return false;
    if (mention && !mentions(message.body, own_jid)) return false;
    return true;
}

/**
 * Whether a body names our account, as a whole word: the local part of our
 * JID, which is the name people address us by in a 1:1 chat.
 * @param {string|null} body
 * @param {string} own_jid
 */
function mentions(body, own_jid) {
    if (!body) return false;

    const nick = Strophe.getNodeFromJid(own_jid).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${nick}\\b`, 'i').test(body);
}
