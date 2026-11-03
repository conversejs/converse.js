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
 */
export function inboxMethods(cursors) {
    markArrivals(cursors);

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
     */
    async function survey() {
        const surveyed = [];
        const conversations = [...((await api.chats.get()) ?? []), ...((await api.rooms.get()) ?? [])];
        for (const chat of conversations) {
            await chat.messages.fetched;
            const jid = chat.get('jid');
            // A failed send never went out, so it isn't news, and it isn't the conversation's activity.
            const messages = chat.messages.models.filter((m) => isMessage(m) && !isFailedSend(m));
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
            const surveyed = await survey();

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
            return { conversations };
        },
    };
}

/**
 * Marks each message with when the daemon got it, as it's added to its
 * conversation. That's what read cursors go by, rather than the message's
 * own time, which can be earlier than a message already read: one caught up
 * from the archive after a reconnect, or one the server delivered late.
 * @param {ReturnType<typeof import('./cursors.js').createCursors>} cursors
 */
function markArrivals(cursors) {
    const { chatboxes } = _converse.state;

    /** @param {import('@converse/headless').ChatBox} box */
    const watch = (box) => {
        const { messages } = box;
        if (!messages) return;

        messages.on('add', (/** @type {import('@converse/headless').BaseMessage} */ message) => {
            // Until the conversation's messages are read from storage, what's
            // added comes from there: it arrived before, and keeps its mark.
            if (!messages.fetched?.isResolved) return;
            // Set, not saved: a new message is saved by whatever creates it, just after this.
            if (message.get(ARRIVED) === undefined) message.set(ARRIVED, cursors.nextArrival());
        });
    };
    chatboxes.forEach(watch);
    chatboxes.on('add', watch);
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
