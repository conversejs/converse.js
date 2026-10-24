/**
 * The `conversations.*` and `inbox.*` methods: what a consumer has and hasn't
 * read. A consumer is the name a client gives at `hello`, and each one has its
 * own read cursors, separate from the user's read state in other clients,
 * which these methods never change.
 * @module @converse/daemon/inbox
 */
import { isMessage } from './history.js';
import { toConversationDTO, toMessageDTO } from './messages.js';
import { ERRORS, RPCError } from './protocol.js';

/**
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {ReturnType<typeof import('./cursors.js').createCursors>} cursors
 */
export function inboxMethods(_converse, cursors) {
    const { api } = _converse;
    const ownJID = () => _converse.session.get('bare_jid');

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
     * Every 1:1 chat with messages in it, most recent first. All the awaits
     * happen here. What the consumer has seen is worked out after them, in
     * the same tick as the caller moves its cursors, so that two reads from
     * one consumer can't both return the same message.
     */
    async function survey() {
        const surveyed = [];
        for (const chat of (await api.chats.get()) ?? []) {
            await chat.messages.fetched;
            const jid = chat.get('jid');
            const contact = await api.contacts.get(jid);
            const messages = chat.messages.models.filter(isMessage).map((m) => toMessageDTO(m, jid, ownJID()));
            if (messages.length) {
                surveyed.push({ jid, conversation: toConversationDTO(jid, contact), messages, last: messages.at(-1) });
            }
        }
        return surveyed.sort((a, b) => Date.parse(b.last.time) - Date.parse(a.last.time));
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
                    unread: unseenFor(consumer, c).filter((m) => m.direction === 'incoming').length,
                    last_activity: c.last.time,
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
                cursors.set(consumer, c.jid, { id: c.last.id, time: c.last.time });
                const incoming = unseen.filter((m) => m.direction === 'incoming');
                if (incoming.length) conversations.push({ conversation: c.conversation, messages: incoming });
            }
            return { conversations };
        },
    };
}

/**
 * The messages after a cursor, oldest first. Without a cursor, that's every
 * message from the consumer's first sight of the account onwards. If the
 * message a cursor names is gone, it's the messages newer than the cursor's time.
 * @param {import('./types').MessageDTO[]} messages - Oldest first
 * @param {import('./types').Cursor|undefined} cursor
 * @param {string} since - ISO 8601
 */
function unseenIn(messages, cursor, since) {
    if (!cursor) {
        // Inclusive: a message can share the millisecond of the first sight.
        return messages.filter((m) => Date.parse(m.time) >= Date.parse(since));
    }
    const index = messages.findIndex((m) => m.id === cursor.id);
    if (index !== -1) return messages.slice(index + 1);
    return messages.filter((m) => Date.parse(m.time) > Date.parse(cursor.time));
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
