/**
 * The `events.*` methods: a live stream of what the session receives, sent to
 * each subscribed client as JSON-RPC notifications. Subscriptions belong to
 * the connection that made them and end with it.
 * @module @converse/daemon/events
 */
import { api, converse, log } from '@converse/headless';
import { mayCall } from './access.js';
import { isRoomMessage, toMessageDTO } from './dto.js';
import { ERRORS, RPCError } from './protocol.js';
import { resolveJID } from './resolve.js';
import { ownJID } from './session.js';

const { Strophe } = converse.env;

const EVENT_TYPES = ['message', 'draft'];
const DIRECTIONS = ['incoming', 'outgoing'];

/**
 * @param {Object} options
 * @param {import('./types').Mode} options.mode - Which decides who may see drafts
 */
export function createEvents({ mode }) {
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
        if (message.get('is_archived')) return;

        const dto = toMessageDTO(message);
        const room = isRoomMessage(message);
        const sender = {
            sender: room ? roomSender(message, dto) : dto.from,
            // In a room we're addressed by our nickname there, in a chat by our JID's name.
            own_name: room ? chatbox.get('nick') : Strophe.getNodeFromJid(ownJID()),
        };
        notify('message', dto, { message: dto }, sender);
        for (const sub of subscriptions.values()) {
            if (!('listener' in sub)) continue;

            // Called from a hook: a listener's error mustn't break the hook's chain.
            try {
                sub.listener(chatbox, message, dto);
            } catch (e) {
                log.error(`A message listener failed: ${e.message}`);
            }
        }
    }

    /**
     * The bare JID of whoever sent a room message, which the room reveals
     * only to some, so it may be null.
     * @param {import('@converse/headless').BaseMessage} message
     * @param {import('./types').MessageDTO} dto
     * @returns {string|null}
     */
    function roomSender(message, dto) {
        if (dto.direction === 'outgoing') return ownJID();

        const real_jid = message.get('from_real_jid');
        return real_jid ? Strophe.getBareJidFromJid(real_jid).toLowerCase() : null;
    }

    /**
     * Calls each subscription of `type` whose filter accepts the event. Ends
     * the ones that were made to take only one.
     * @param {import('./types').EventType} type
     * @param {import('./types').FilteredMessage} dto - What the filters are matched against
     * @param {Record<string, unknown>} fields - The event's own fields
     * @param {import('./types').EventSender} sender - Who sent it, for the from and mention filters
     */
    function notify(type, dto, fields, sender) {
        for (const [subscription, sub] of subscriptions) {
            if (!('filter' in sub) || sub.type !== type || !matches(sub.filter, dto, sender)) continue;

            sub.client.notify({ subscription, type, ...fields });
            if (sub.once) subscriptions.delete(subscription);
        }
    }

    /**
     * @param {import('./types').Subscription} sub
     * @returns {number} The subscription
     */
    function subscribe(sub) {
        // Its connection closed while the method awaited, so `forget` has already run, and wouldn't end it.
        if (sub.client.closed) throw new Error('The connection closed.');

        const subscription = next_id++;
        subscriptions.set(subscription, sub);
        return subscription;
    }

    return {
        /**
         * Subscribes a client to every live message, for another module's
         * method, such as one that streams a consumer's inbox. Each is given
         * to `listener`, unfiltered, and only what it passes to `send` is
         * sent. The subscription ends with the client's connection, or with
         * `events.unsubscribe`, as any other does.
         * @param {import('./types').Client} client
         * @param {import('./types').MessageListener} listener
         * @returns {{
         *  subscription: number,
         *  send: (message: import('./types').MessageDTO) => void,
         *  deliverable: () => boolean,
         *  end: () => void,
         * }} `deliverable` says whether what's sent now still reaches the client
         */
        listen(client, listener) {
            const subscription = subscribe({ client, listener });
            const deliverable = () => subscriptions.has(subscription) && !client.closed && client.writable();
            return {
                subscription,
                send(message) {
                    if (deliverable()) client.notify({ subscription, type: 'message', message });
                },
                deliverable,
                end: () => subscriptions.delete(subscription),
            };
        },

        /**
         * Announces a draft to draft subscribers. A draft is an outgoing
         * message from us, so the filters read it as one: the conversation
         * filter is against whom it's addressed.
         * @param {'queued'|'sent'|'rejected'} action - "sent" only in "as_user" mode, where the user approves drafts
         * @param {import('./types').Draft} draft
         */
        publishDraft(action, draft) {
            /** @type {import('./types').FilteredMessage} */
            const as_message = {
                conversation: draft.to,
                direction: 'outgoing',
                body: 'body' in draft ? draft.body : null,
            };
            const sender = { sender: ownJID(), own_name: Strophe.getNodeFromJid(ownJID()) };
            notify('draft', as_message, { action, draft }, sender);
        },

        methods: {
            /**
             * @param {Object} params
             * @param {string} [params.type] - "message" (the default), or "draft" where the
             *  connection may list drafts
             * @param {string} [params.conversation] - A JID, or a contact's name
             * @param {string} [params.from] - A JID, or a contact's name. In a room, this matches only
             *  the occupants whose JID the room reveals.
             * @param {'incoming'|'outgoing'} [params.direction]
             * @param {boolean} [params.mention] - Whether the body names us: by our nickname in a room,
             *  else by our JID's name
             * @param {boolean} [params.once] - End the subscription after the first event
             * @param {import('./types').Client} client
             * @returns {Promise<{ subscription: number }>}
             */
            async 'events.subscribe'(params, client) {
                const { type, filter, once } = await parseSubscription(params);
                // A draft event carries the whole draft, so it's for those who may see the drafts.
                if (type === 'draft' && !mayCall('drafts.list', client.access, mode)) {
                    throw new RPCError(
                        ERRORS.ACCESS_DENIED,
                        'Draft events are only available where "drafts.list" is: at full access, or at ' +
                            'restricted access in "as_user" mode.',
                        { see: ['drafts.list'] },
                    );
                }
                return { subscription: subscribe({ client, type, filter, once }) };
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
 * @param {Object} params
 * @returns {Promise<{ type: import('./types').EventType, filter: import('./types').EventFilter, once: boolean }>}
 */
async function parseSubscription({ type = 'message', conversation, from, direction, mention = false, once = false }) {
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
            conversation: conversation === undefined ? undefined : await resolveJID(conversation, 'conversation'),
            from: from === undefined ? undefined : await resolveJID(from, 'from'),
            direction,
            mention,
        },
        once,
    };
}

/**
 * @param {import('./types').EventFilter} filter
 * @param {import('./types').FilteredMessage} message
 * @param {import('./types').EventSender} sender
 */
function matches({ conversation, from, direction, mention }, message, { sender, own_name }) {
    if (conversation && message.conversation !== conversation) return false;
    if (from && sender !== from) return false;
    if (direction && message.direction !== direction) return false;
    if (mention && !mentions(message.body, own_name)) return false;
    return true;
}

/**
 * Whether a body names us, as a whole word, ignoring case. A nickname may
 * start or end with a character that isn't a word character, so "whole word"
 * means not run together with one.
 * @param {string|null} body
 * @param {string|null} own_name
 */
function mentions(body, own_name) {
    if (!body || !own_name) return false;

    const name = own_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\p{L}\\p{N}_])${name}(?![\\p{L}\\p{N}_])`, 'iu').test(body);
}
