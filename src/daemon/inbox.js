/**
 * The `conversations.*` and `inbox.*` methods: what a consumer has and hasn't
 * read. A consumer is the name a client gives at `hello`, and each one has its
 * own read cursors, separate from the user's read state in other clients,
 * which these methods never change.
 * @module @converse/daemon/inbox
 */
import { isMessage } from './history.js';
import { _converse, api, constants } from '@converse/headless';
import { isFailedSend, toConversationDTO, toMessageDTO, toRoomDTO } from './dto.js';
import { ERRORS, RPCError } from './protocol.js';
import { resolveJID } from './resolve.js';
import { rosterLoaded } from './session.js';

/**
 * The message attribute holding when the daemon got the message, as a mark
 * from `cursors.nextArrival`. Kept with the message, so that it outlives a restart.
 */
const ARRIVED = 'daemon_arrived';

/** @param {import('@converse/headless').ChatBox} box - A chat or a room */
const isRoom = (box) => box.get('type') === constants.CHATROOMS_TYPE;

/** @param {import('@converse/headless').BaseMessage} message */
const isIncoming = (message) => message.get('sender') !== 'me';

/**
 * A message from before arrivals were marked counts as arrived before any cursor.
 * @param {import('@converse/headless').BaseMessage} message
 * @returns {number}
 */
const arrivalOf = (message) => message.get(ARRIVED) ?? 0;

/**
 * @param {ReturnType<typeof import('./cursors.js').createCursors>} cursors
 * @param {ReturnType<typeof import('./events.js').createEvents>} events - Which `inbox.subscribe` streams through
 */
export function inboxMethods(cursors, events) {
    const markedBefore = markArrivals(cursors);

    /**
     * The name of the consumer making a request. Its first request sets its
     * baseline, even if there's nothing to report yet.
     * @param {import('./types').Client} client
     */
    const claim = (client) => {
        const consumer = requireConsumer(client);
        cursors.since(consumer);
        return consumer;
    };

    /**
     * Every chat and room with messages in it, most recent first. All the
     * awaits happen here. What the consumer has seen is worked out after
     * them, in the same tick as the caller moves its cursors, so that two
     * reads from one consumer can't both return the same message. The
     * messages stay models: only those a caller returns become DTOs.
     * @param {string} [only] - Only this conversation's JID
     */
    async function survey(only) {
        const surveyed = [];
        const conversations = [...((await api.chats.get()) ?? []), ...((await api.rooms.get()) ?? [])];
        for (const chat of conversations) {
            if (only && chat.get('jid') !== only) continue;

            await chat.messages.fetched;
            const jid = chat.get('jid');
            const messages = chat.messages.models.filter(isNews);
            const last = messages.at(-1);
            if (last) {
                const conversation = isRoom(chat)
                    ? toRoomDTO(chat)
                    : toConversationDTO(jid, rosterLoaded() ? await api.contacts.get(jid) : null);
                surveyed.push({ jid, conversation, messages, last_activity: last.get('time') });
            }
        }
        return surveyed.sort((a, b) => Date.parse(b.last_activity) - Date.parse(a.last_activity));
    }

    /**
     * @param {string} consumer
     * @param {Awaited<ReturnType<typeof survey>>[number]} conversation
     */
    const unseenFor = (consumer, { jid, messages }) =>
        unseenIn(messages, cursors.get(consumer, jid), cursors.since(consumer));

    return {
        /**
         * The conversations with messages, most recent first, each with how
         * many incoming messages are unread for this consumer.
         * @param {Object} _params
         * @param {import('./types').Client} client
         * @returns {Promise<{ conversations: import('./types').ConversationSummary[] }>}
         */
        async 'conversations.list'(_params, client) {
            const consumer = claim(client);
            const surveyed = await survey();
            return {
                conversations: surveyed.map((c) => ({
                    ...c.conversation,
                    unread: unseenFor(consumer, c).filter(isIncoming).length,
                    last_activity: c.last_activity,
                })),
            };
        },

        /**
         * The incoming messages this consumer hasn't seen, grouped by
         * conversation, and then marks them seen. Messages it sent, from any
         * client, are passed over without being shown.
         * @param {Object} _params
         * @param {import('./types').Client} client
         * @returns {Promise<import('./types').Inbox>}
         */
        async 'inbox.read'(_params, client) {
            const consumer = claim(client);
            return { conversations: readUnseen(consumer, await survey()) };
        },

        /**
         * What `inbox.read` returns, and then each message as it arrives,
         * as an `event` notification of type "message", until the connection
         * closes. Each message given, either way, is marked seen for this
         * consumer, so that a later read or subscription doesn't give it
         * again, and restarting a subscription loses nothing in between.
         * Messages it sent, from any client, are passed over without being
         * sent, as `inbox.read` passes over them.
         *
         * Live messages that arrive while the inbox is read are sent after
         * the answer. What the server's archive returns on a reconnect isn't
         * sent as it comes, but in a conversation that then gets a live
         * message, it's sent before that one. Otherwise, the next read or
         * subscription gives it.
         * @param {Object} params
         * @param {string} [params.conversation] - Only this conversation: a JID, or a contact's name
         * @param {import('./types').Client} client
         * @param {import('./types').Call} call
         * @returns {Promise<import('./types').InboxSubscription>}
         */
        async 'inbox.subscribe'(params, client, call) {
            const others = Object.keys(params).filter((name) => name !== 'conversation');
            if (others.length) {
                throw new RPCError(
                    ERRORS.INVALID_PARAMS,
                    `"inbox.subscribe" takes only "conversation", not ${others.map((n) => `"${n}"`).join(', ')}: ` +
                        'the messages another filter left out would be marked seen too. For those, use ' +
                        '"events.subscribe", which marks nothing.',
                    { see: ['events.subscribe'] },
                );
            }
            const consumer = claim(client);
            const jid =
                params.conversation === undefined ? undefined : await resolveJID(params.conversation, 'conversation');

            /** @type {Parameters<import('./types').MessageListener>[]|null} */
            let held = [];
            /** @type {import('./types').MessageListener} */
            const give = (chatbox, message, dto) => {
                // Checked before anything is marked seen: what can't be written would be lost.
                if (!deliverable()) return;

                // What it gives is usually this message, whose DTO is made already.
                takeLive(consumer, chatbox, message).forEach((m) => send(m === message ? dto : toMessageDTO(m)));
            };
            const { subscription, send, deliverable, end } = events.listen(client, (chatbox, message, dto) => {
                if (jid && dto.conversation !== jid) return;

                if (held) held.push([chatbox, message, dto]);
                else give(chatbox, message, dto);
            });
            let surveyed;
            try {
                surveyed = await survey(jid);
                // Gone while the survey ran: what would be marked seen could reach no one.
                if (client.closed) throw new Error('The connection closed.');
            } catch (e) {
                end();
                throw e;
            }
            // In the same tick as the survey's last await, as `inbox.read` does.
            const conversations = readUnseen(consumer, surveyed);
            call.afterReply(() => {
                const early = held;
                held = null;
                early.forEach((args) => give(...args));
            });
            return { subscription, conversations };
        },
    };

    /**
     * The unseen incoming messages of each conversation surveyed, which are
     * then marked seen. The messages we sent are marked seen too.
     * @param {string} consumer
     * @param {Awaited<ReturnType<typeof survey>>} surveyed
     * @returns {import('./types').InboxGroup[]}
     */
    function readUnseen(consumer, surveyed) {
        const conversations = [];
        for (const c of surveyed) {
            const unseen = unseenFor(consumer, c);
            if (unseen.length === 0) continue;
            const arrived = unseen.reduce(
                (max, m) => Math.max(max, arrivalOf(m)),
                cursors.get(consumer, c.jid)?.arrived ?? 0,
            );
            cursors.set(consumer, c.jid, { arrived });
            const incoming = unseen.filter(isIncoming).map(toMessageDTO);
            if (incoming.length) conversations.push({ conversation: c.conversation, messages: incoming });
        }
        return conversations;
    }

    /**
     * What to give a consumer for a message that has just arrived: the
     * conversation's unseen messages up to it, oldest first, which are then
     * marked seen. That's usually only this one, but it can include what
     * the archive returned on a reconnect, which isn't streamed by itself, and
     * which marking this one seen would otherwise skip.
     * @param {string} consumer
     * @param {import('@converse/headless').ChatBox} chatbox
     * @param {import('@converse/headless').BaseMessage} message
     * @returns {import('@converse/headless').BaseMessage[]}
     */
    function takeLive(consumer, chatbox, message) {
        if (!isNews(message)) return [];
        // Not marked yet, so no cursor can have passed it.
        if (message.get(ARRIVED) === undefined) return isIncoming(message) ? [message] : [];

        const jid = chatbox.get('jid');
        const cursor = cursors.get(consumer, jid);
        const since = cursors.since(consumer);
        // Usually the cursor has passed every other message in the conversation, so
        // that this one is the only one it can give, without looking through the rest.
        const unseen =
            cursor && cursor.arrived >= (markedBefore(message) ?? Infinity)
                ? unseenIn([message], cursor, since)
                : unseenAmong(chatbox, message, cursor, since);
        if (unseen.length === 0) return [];

        cursors.set(consumer, jid, { arrived: arrivalOf(unseen.at(-1)) });
        return unseen.filter(isIncoming);
    }
}

/**
 * The messages of a conversation a cursor hasn't passed, up to `message`,
 * oldest first.
 * @param {import('@converse/headless').ChatBox} chatbox
 * @param {import('@converse/headless').BaseMessage} message
 * @param {import('./types').Cursor|undefined} cursor
 * @param {string} since - ISO 8601
 */
function unseenAmong(chatbox, message, cursor, since) {
    const candidates = chatbox.messages.models.filter(isNews);
    if (!candidates.includes(message)) candidates.push(message);
    return unseenIn(candidates, cursor, since)
        .filter((m) => arrivalOf(m) <= arrivalOf(message))
        .sort((a, b) => arrivalOf(a) - arrivalOf(b));
}

/**
 * Whether a message is what the inbox shows. A failed send never went out,
 * so it isn't news, and it isn't the conversation's activity.
 * @param {import('@converse/headless').BaseMessage} message
 */
const isNews = (message) => isMessage(message) && !isFailedSend(message);

/**
 * Marks each message with when the daemon got it, as it's added to its
 * conversation. That's what read cursors go by, rather than the message's
 * own time, which can be earlier than a message already read: one caught up
 * from the archive after a reconnect, or one the server delivered late.
 * @param {ReturnType<typeof import('./cursors.js').createCursors>} cursors
 * @returns {(message: import('@converse/headless').BaseMessage) => number|undefined} The highest mark
 *  among the news in a message's conversation when it was marked, or undefined for one this didn't mark
 */
function markArrivals(cursors) {
    const { chatboxes } = _converse.state;
    /**
     * @type {WeakMap<object, number>} The last mark given to news in each conversation's
     *  messages. What isn't news, such as an info message, moves no cursor, so it mustn't
     *  count: the next message would have to look through the conversation.
     */
    const last = new WeakMap();
    /** @type {WeakMap<import('@converse/headless').BaseMessage, number>} */
    const before = new WeakMap();

    /** @param {import('@converse/headless').ChatBox} box */
    const watch = (box) => {
        const { messages } = box;
        if (!messages) return;

        messages.on('add', (/** @type {import('@converse/headless').BaseMessage} */ message) => {
            // Until the conversation's messages are read from storage, what's
            // added comes from there: it arrived before, and keeps its mark.
            if (!messages.fetched?.isResolved) return;
            if (message.get(ARRIVED) !== undefined) return;

            // Until a mark is given here, the highest is among those the messages kept in storage.
            if (!last.has(messages)) {
                last.set(
                    messages,
                    messages.models.reduce((max, m) => (isNews(m) ? Math.max(max, arrivalOf(m)) : max), 0),
                );
            }
            const mark = cursors.nextArrival();
            // Set, not saved: a new message is saved by whatever creates it, just after this.
            message.set(ARRIVED, mark);
            before.set(message, last.get(messages));
            if (isNews(message)) last.set(messages, mark);
        });
    };
    chatboxes.forEach(watch);
    chatboxes.on('add', watch);
    return (message) => before.get(message);
}

/**
 * The messages a consumer hasn't been given, oldest first: those that arrived
 * after its cursor, or every one without a cursor. Either way, only from the
 * consumer's first sight of the account onwards, so that history paged in
 * from the archive isn't news.
 * @param {import('@converse/headless').BaseMessage[]} messages - Oldest first
 * @param {import('./types').Cursor|undefined} cursor
 * @param {string} since - ISO 8601
 */
function unseenIn(messages, cursor, since) {
    const since_ms = Date.parse(since);
    return messages.filter(
        // Inclusive: a message can share the millisecond of the first sight.
        (m) => Date.parse(m.get('time')) >= since_ms && (!cursor || arrivalOf(m) > cursor.arrived),
    );
}

/**
 * @param {import('./types').Client} client
 * @returns {string}
 */
function requireConsumer(client) {
    if (!client.consumer) {
        throw new RPCError(ERRORS.HELLO_REQUIRED, 'Send "hello" with the protocol version first.');
    }
    return client.consumer;
}
