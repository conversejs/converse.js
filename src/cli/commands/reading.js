/**
 * Reading: conversations, the inbox, a conversation's history, search and waiting for a message.
 * @module @converse/cli/commands/reading
 */
import { connect } from '@converse/daemon/client';
import { accessFor, parseLimit, request, takeOne, UsageError } from '../context.js';
import { EXIT } from '../exit-codes.js';
import { formatConversation, formatJSON, formatMessage, parseSince } from '../format.js';
import { flag, option } from '../options.js';
import { FULL, LOOKUP_EXITS, TARGET } from './shared.js';

/** @type {Record<string, import('../types').Command>} */
export const READING_COMMANDS = {
    conversations: {
        summary: 'List your conversations, with what is unread for you',
        description:
            'List your 1:1 chats and rooms, most recent first. Each line shows the JID, the name if ' +
            'there is one (quoted, as someone else chose it), how many messages are unread for this ' +
            "consumer, and when the conversation was last active. Unread counts are this consumer's " +
            'own: reading them here changes nothing in your other clients.',
        examples: ['converse-cli conversations'],
        async run(ctx) {
            const { options, out, err } = ctx;
            /** @type {{ conversations: import('@converse/daemon/types').ConversationSummary[] }} */
            const { conversations } = await request(ctx, 'conversations.list');
            if (options.json) {
                conversations.forEach((c) => out(formatJSON(c)));
            } else if (conversations.length) {
                const now = new Date();
                conversations.forEach((c) => out(formatConversation(c, { now })));
            } else {
                err('No conversations.\n');
            }
            return EXIT.OK;
        },
    },
    inbox: {
        summary: "Show the incoming messages you haven't seen yet, and mark them seen",
        description:
            "Show the incoming messages this consumer hasn't seen yet, grouped by conversation " +
            'under a "== <jid> (<n> new)" line, and mark them seen, so the next inbox shows only ' +
            "what arrived after. Messages you sent aren't shown. Your read state in other clients " +
            'is unchanged.\n\n' +
            'Start here to catch up. For the context around a new message, use read on its conversation.\n\n' +
            'A consumer starts counting when the daemon first sees it: messages from before its first ' +
            'command are history, which inbox and the unread counts leave out. On a first run, look ' +
            'at conversations and read the recent ones.',
        options: [FULL],
        examples: ['converse-cli inbox'],
        async run(ctx) {
            const { options, out, err } = ctx;
            /** @type {import('@converse/daemon/types').Inbox} */
            const { conversations } = await request(ctx, 'inbox.read');
            if (options.json) {
                conversations.forEach((group) => out(formatJSON(group)));
            } else if (conversations.length) {
                const now = new Date();
                for (const { conversation, messages } of conversations) {
                    out(`== ${conversation.jid} (${messages.length} new)\n`);
                    messages.forEach((m) => out(formatMessage(m, { full: options.full, now })));
                }
            } else {
                err('No new messages.\n');
            }
            return EXIT.OK;
        },
    },
    read: {
        summary: 'Show the recent messages of a conversation',
        description:
            'Show the recent messages of a conversation, oldest first, yours included. Nothing is ' +
            'marked as seen. Messages not held locally are fetched from the server archive.',
        args: [TARGET],
        options: [
            option('limit', '<n>', 'At most this many (default 20)'),
            option(
                'before',
                '<id>',
                'Only messages older than this one. To page back, pass the oldest id the previous read showed',
            ),
            option(
                'since',
                '<time>',
                'Only messages since an ISO 8601 time, or since a duration ago such as 30m, 2h or 7d',
            ),
            FULL,
        ],
        exits: LOOKUP_EXITS,
        examples: [
            'converse-cli read "Juliet Capulet" --since 2h',
            'converse-cli read juliet@capulet.lit --before 01a183d1-2cc2-74f2-8de3-fd8a38834143',
        ],
        async run(ctx) {
            const { options, out, err } = ctx;
            const conversation = takeOne(ctx, 'JID to read');
            const limit = parseLimit(options.limit);
            let since;
            try {
                since = options.since === undefined ? undefined : parseSince(options.since);
            } catch (e) {
                throw new UsageError(e.message);
            }
            /** @type {import('@converse/daemon/types').MessageList} */
            const { messages } = await request(ctx, 'messages.list', {
                conversation,
                limit,
                before: options.before,
                since,
            });

            if (options.json) {
                messages.forEach((m) => out(formatJSON(m)));
            } else if (messages.length) {
                const now = new Date();
                messages.forEach((m) => out(formatMessage(m, { full: options.full, now })));
            } else {
                err('No messages.\n');
            }
            return EXIT.OK;
        },
    },
    search: {
        summary: 'Find messages by their text',
        description:
            "Find messages whose text has every word of <query>, ignoring case and accents. The server's " +
            'own full-text search of its archive is used where it offers one (XEP-0431), else the ' +
            'messages held locally. The first line says which was searched. Matches are oldest first, ' +
            'in the same format as read, each with the conversation it is in. With --json, one object ' +
            'holds the method and the messages.',
        args: [['<query>', 'The words to look for']],
        options: [
            option('conversation', '<contact|room>', 'Only in this conversation'),
            option('limit', '<n>', 'At most this many, the newest (default 20)'),
            FULL,
        ],
        exits: LOOKUP_EXITS,
        examples: ['converse-cli search balcony --conversation "Juliet Capulet"'],
        async run(ctx) {
            const { args, options, out, err } = ctx;
            if (args.length === 0) throw new UsageError('Expected what to search for.');
            /** @type {import('@converse/daemon/types').SearchResult} */
            const result = await request(ctx, 'messages.search', {
                query: args.join(' '),
                conversation: options.conversation,
                limit: parseLimit(options.limit),
            });
            if (options.json) {
                out(formatJSON(result));
                return EXIT.OK;
            }
            out(SEARCHED[result.method] + '\n');
            if (result.messages.length) {
                const now = new Date();
                result.messages.forEach((m) => out(formatMessage(m, { full: options.full, now, conversation: true })));
            } else {
                err('No messages match.\n');
            }
            return EXIT.OK;
        },
    },
    wait: {
        summary: 'Wait for the next incoming message that matches, and print it',
        description:
            'Wait for the next incoming message that matches, print it and exit. Messages in the ' +
            'rooms you have joined count too. Only messages that arrive after wait starts are ' +
            'considered: use read or inbox for earlier ones. The message is printed as read prints ' +
            'one. If none arrives in time, nothing is printed on stdout and the exit code is 2. A ' +
            "message wait printed isn't marked seen, so a later inbox shows it again.\n\n" +
            'To wait for the answer to a send, start wait before the send, in the background, so ' +
            'that an answer quicker than the next command is not missed.',
        options: [
            option(
                'from',
                '<contact>',
                "Only messages from this contact. In a room, only where the room shows the sender's JID",
            ),
            option('conversation', '<contact|room>', 'Only messages in this conversation or room'),
            flag(
                'mention',
                "Only messages that name you, as a whole word: your nickname in a room, else your JID's name",
            ),
            option('timeout', '<s>', 'Give up after this many seconds (default 60)'),
            FULL,
        ],
        exits: [EXIT.TIMEOUT, ...LOOKUP_EXITS],
        examples: [
            'converse-cli wait --from juliet@capulet.lit --timeout 300',
            'converse-cli wait --from juliet@capulet.lit > answer.txt & converse-cli send juliet@capulet.lit "Ready?"; wait $!',
        ],
        async run(ctx) {
            const { options, out, err, env } = ctx;
            let seconds = 60;
            if (options.timeout !== undefined) {
                seconds = Number(options.timeout);
                if (!(seconds > 0)) throw new UsageError(`--timeout "${options.timeout}" isn't a number of seconds.`);
            }
            const filter = { from: options.from, conversation: options.conversation, mention: !!options.mention };

            const client = await connect({ env, access: accessFor(env) });
            let message;
            try {
                message = await waitForMessage(client, { ...filter, direction: 'incoming' }, seconds);
            } finally {
                client.close();
            }
            if (!message) {
                err(
                    `No matching message within ${seconds}s. Check the --from, --conversation and --mention ` +
                        'filters, or wait longer with --timeout.\n',
                );
                return EXIT.TIMEOUT;
            }
            if (options.json) {
                out(formatJSON(message));
            } else {
                out(formatMessage(message, { full: options.full }));
            }
            return EXIT.OK;
        },
    },
};

/** What `search` says it searched, as the first line of its output. */
const SEARCHED = {
    server: "Searched the server's archive, with its full-text search (XEP-0431).",
    local: "Searched the messages held locally, as the server's full-text search wasn't available.",
};

/**
 * Subscribes for the first incoming message that matches, and resolves with
 * it, or with null once `seconds` have passed.
 * @param {import('@converse/daemon/client').Client} client
 * @param {Object} filter - The subscription's filter, as `events.subscribe` takes it
 * @param {number} seconds
 * @returns {Promise<import('@converse/daemon/types').MessageDTO|null>}
 */
async function waitForMessage(client, filter, seconds) {
    const { promise, resolve, reject } = Promise.withResolvers();
    const timer = setTimeout(() => resolve(null), seconds * 1000);
    // The subscription is this connection's only one, so its events are ours.
    client.onEvent((event) => event.type === 'message' && resolve(event.message));
    client.closed.catch(reject);
    try {
        await client.request('events.subscribe', { ...filter, once: true });
        return await promise;
    } finally {
        clearTimeout(timer);
    }
}
