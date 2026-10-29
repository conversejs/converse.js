/**
 * converse-cli: a short-lived command line client of the Converse daemon.
 * Each invocation connects to the daemon's socket (starting the daemon if
 * it isn't running), makes its request, prints the result and exits.
 *
 * There are deliberately no options for credentials: they'd end up in shell
 * history and agent transcripts. The account comes from the config file.
 */
import { parseArgs } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { connect, DaemonUnavailableError, getConfigPath, loadConfig, stopDaemon } from '@converse/daemon/client';
import { ERRORS, MAX_UPLOAD_SIZE, RPCError } from '@converse/daemon/protocol';
import pkg from './package.json' with { type: 'json' };
import { EXIT } from './exit-codes.js';
import { commandHelp, HELP, overview, PARSE_OPTIONS, unexpectedOptions } from './help.js';
import {
    formatContact,
    formatContactDetails,
    formatOccupant,
    formatRoomListing,
    formatSchedule,
    formatConversation,
    formatDraft,
    formatDraftDetails,
    formatDuration,
    formatMessage,
    parseSince,
    formatDevice,
    formatDeviceList,
} from './format.js';

/**
 * Bad usage, reported with a pointer to the help.
 */
class UsageError extends Error {}

/** How the daemon's errors map onto exit codes. Anything else is EXIT.ERROR. */
const EXIT_FOR_ERROR = {
    [ERRORS.NOT_FOUND]: EXIT.NOT_FOUND,
    [ERRORS.AMBIGUOUS]: EXIT.AMBIGUOUS,
};

/** How the outcome of a send maps onto exit codes. */
const EXIT_FOR_OUTCOME = {
    sent: EXIT.OK,
    refused: EXIT.REFUSED,
    draft: EXIT.DRAFT,
    scheduled: EXIT.OK,
};

/**
 * @param {string[]} argv - The arguments after the program name.
 * @param {import('./types').IO} io
 * @returns {Promise<number>} The exit code.
 */
export async function main(argv, io) {
    let parsed;
    try {
        parsed = parseArgs({
            args: argv,
            allowPositionals: true,
            options: PARSE_OPTIONS,
        });
    } catch (e) {
        io.err(`converse-cli: ${e.message}. Run "converse-cli --help" for usage.\n`);
        return EXIT.ERROR;
    }
    const { values, positionals } = parsed;

    if (values.version) {
        io.out(`${pkg.version}\n`);
        return EXIT.OK;
    }
    if (positionals.length === 0 || (positionals[0] === 'help' && positionals.length === 1)) {
        io.out(overview(getConfigPath(io.env)));
        return EXIT.OK;
    }

    const asking = positionals[0] === 'help';
    const [name, ...rest] = asking ? positionals.slice(1) : positionals;
    // A command is what the help documents. Only the table's own entries
    // count: "constructor" and "toString" aren't commands.
    const lookup = (key) => (Object.hasOwn(HELP, key) ? key : undefined);
    const [command, args] = lookup(name) ? [lookup(name), rest] : [lookup(`${name} ${rest[0]}`), rest.slice(1)];
    // A group such as "drafts", given without its subcommand.
    const group = command ? [] : Object.keys(HELP).filter((key) => key.startsWith(`${name} `));
    if (group.length && rest.length === 0) {
        if (asking || values.help) {
            io.out(group.map(commandHelp).join('\n'));
            return EXIT.OK;
        }
        const subcommands = group.map((key) => key.slice(name.length + 1));
        io.err(
            `converse-cli: "${name}" needs one of: ${subcommands.join(', ')}. ` +
                `Run "converse-cli help ${name}" for each one's usage.\n`,
        );
        return EXIT.ERROR;
    }
    if (!command) {
        io.err(
            `converse-cli: unknown command "${positionals.join(' ')}". Run "converse-cli --help" to list commands.\n`,
        );
        return EXIT.ERROR;
    }
    if (asking || values.help) {
        io.out(commandHelp(command));
        return EXIT.OK;
    }
    const unexpected = unexpectedOptions(command, values);
    if (unexpected.length) {
        io.err(
            `converse-cli: ${command} doesn't take ${unexpected.map((o) => `--${o}`).join(' or ')}. ` +
                `Run "converse-cli help ${command}" for its options.\n`,
        );
        return EXIT.ERROR;
    }
    try {
        return await COMMANDS[command]({ ...io, args, options: values });
    } catch (e) {
        return reportError(e, io);
    }
}

/**
 * @param {Error} e
 * @param {import('./types').IO} io
 * @returns {number} The exit code.
 */
function reportError(e, io) {
    if (e instanceof UsageError) {
        io.err(`converse-cli: ${e.message} Run "converse-cli --help" for usage.\n`);
        return EXIT.ERROR;
    }
    io.err(`converse-cli: ${e.message}\n`);
    if (e instanceof RPCError) {
        /** @type {string[]} */
        const candidates = e.data?.candidates ?? [];
        candidates.forEach((c) => io.err(`  ${c}\n`));
        return EXIT_FOR_ERROR[e.code] ?? EXIT.ERROR;
    }
    return e instanceof DaemonUnavailableError ? EXIT.DAEMON_UNAVAILABLE : EXIT.ERROR;
}

/**
 * The access level the CLI connects at: restricted, unless the config says otherwise.
 * @param {NodeJS.ProcessEnv} env
 */
const accessFor = (env) => loadConfig(env).access;

/**
 * The access level to list and show drafts at: full, as drafts are the user's
 * to decide on, except in "as_user" mode, where restricted access may see them.
 * @param {NodeJS.ProcessEnv} env
 * @returns {import('@converse/daemon/types').Access}
 */
function draftReadAccess(env) {
    const { mode, access } = loadConfig(env);
    return mode === 'as_user' ? access : 'full';
}

/**
 * Connects (starting the daemon if need be), makes one request and hangs up.
 * @param {import('./types').Context} ctx
 * @param {string} method
 * @param {Object} [params]
 * @param {Object} [options]
 * @param {boolean} [options.spawn]
 * @param {import('@converse/daemon/types').Access} [options.access] - Defaults to the configured level
 */
async function request({ env }, method, params, { spawn = true, access = accessFor(env) } = {}) {
    const client = await connect({ spawn, env, access });
    try {
        return await client.request(method, params);
    } finally {
        client.close();
    }
}

/**
 * Prints what became of a send, whether it was made or approved from a draft.
 * @param {import('@converse/daemon/types').SendResult} result
 * @param {import('./types').Context} ctx
 * @returns {number} The exit code.
 */
function reportSend(result, { options, out, err, env }) {
    if (options.json) {
        out(JSON.stringify(result) + '\n');
    } else if (result.outcome === 'sent') {
        out(`Sent to ${result.message.conversation} as ${result.message.id}\n`);
    } else if (result.outcome === 'draft') {
        out(
            loadConfig(env).mode === 'as_user'
                ? `Drafted as ${result.draft_id}. Nothing was sent: it waits for the user to approve it.\n`
                : `Drafted as ${result.draft_id}. Its text went to the owner, and nothing was sent.\n`,
        );
    } else if (result.outcome === 'scheduled') {
        const { schedule } = result;
        out(`Scheduled ${schedule.id} to ${schedule.to} for ${schedule.send_at}.\n`);
    } else {
        err(`converse-cli: ${result.message}\n`);
    }
    return EXIT_FOR_OUTCOME[result.outcome];
}

/**
 * @param {import('./types').Context} ctx
 * @param {string} what - What the argument is, for the error message.
 */
function takeOne({ args }, what) {
    if (args.length !== 1) throw new UsageError(`Expected exactly one ${what}.`);
    return args[0];
}

/**
 * @param {string} [limit] - The value of --limit
 * @returns {number|undefined}
 */
function parseLimit(limit) {
    if (limit === undefined) return undefined;
    const number = Number(limit);
    if (!Number.isInteger(number)) throw new UsageError(`--limit "${limit}" isn't a whole number.`);
    return number;
}

/** What `search` says it searched, as the first line of its output. */
const SEARCHED = {
    server: "Searched the server's archive, with its full-text search (XEP-0431).",
    local: "Searched the messages held locally, as the server's full-text search wasn't available.",
};

/** @type {Record<string, (ctx: import('./types').Context) => Promise<number>>} */
const COMMANDS = {
    async read(ctx) {
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
            messages.forEach((m) => out(JSON.stringify(m) + '\n'));
        } else if (messages.length) {
            const now = new Date();
            messages.forEach((m) => out(formatMessage(m, { full: options.full, now })));
        } else {
            err('No messages.\n');
        }
        return EXIT.OK;
    },

    async search(ctx) {
        const { args, options, out, err } = ctx;
        if (args.length === 0) throw new UsageError('Expected what to search for.');
        /** @type {import('@converse/daemon/types').SearchResult} */
        const result = await request(ctx, 'messages.search', {
            query: args.join(' '),
            conversation: options.conversation,
            limit: parseLimit(options.limit),
        });
        if (options.json) {
            out(JSON.stringify(result) + '\n');
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

    async send(ctx) {
        const { args, options } = ctx;
        if (args.length === 0) throw new UsageError('Expected a JID to send to.');
        const [to, ...words] = args;
        const body = words.length ? words.join(' ') : await readStdin(ctx);
        /** @type {import('@converse/daemon/types').SendResult} */
        const params = { to, body, reply_to: options['reply-to'], correct: options.correct };
        const result = await (options.at === undefined
            ? request(ctx, 'messages.send', params)
            : request(ctx, 'schedules.create', { ...params, at: options.at }));
        return reportSend(result, ctx);
    },

    async upload(ctx) {
        const { args, options, out } = ctx;
        if (args.length !== 2) throw new UsageError('Expected a recipient and a local file path.');
        const [to, file_path] = args;
        const name = path.basename(file_path);
        const content = await readUpload(file_path);
        /** @type {import('@converse/daemon/types').SendResult} */
        const result = await request(ctx, 'files.upload', { to, name, content });
        if (result.outcome !== 'sent' || options.json) return reportSend(result, ctx);

        out(
            `Uploaded ${JSON.stringify(path.basename(file_path))} to ${result.message.conversation} ` +
                `as ${result.message.id}\n`,
        );
        return EXIT.OK;
    },

    async retract(ctx) {
        const { options, out } = ctx;
        const id = takeOne(ctx, 'message id');
        /** @type {import('@converse/daemon/types').SendResult} */
        const result = await request(ctx, 'messages.retract', { id, conversation: options.conversation });
        if (result.outcome !== 'sent') return reportSend(result, ctx);
        const { message } = result;
        if (options.json) {
            out(JSON.stringify(message) + '\n');
        } else {
            out(`Retracted ${message.id} in ${message.conversation}.\n`);
        }
        return EXIT.OK;
    },

    // Failed sends are the user's to deal with, so these always ask for full access.
    async resend(ctx) {
        const { options } = ctx;
        const id = takeOne(ctx, 'message id');
        /** @type {import('@converse/daemon/types').SendResult} */
        const result = await request(
            ctx,
            'messages.resend',
            { id, conversation: options.conversation, unencrypted: !!options.unencrypted },
            { access: 'full' },
        );
        return reportSend(result, ctx);
    },

    async discard(ctx) {
        const { options, out } = ctx;
        const id = takeOne(ctx, 'message id');
        /** @type {{ message: import('@converse/daemon/types').MessageDTO }} */
        const { message } = await request(
            ctx,
            'messages.discard',
            { id, conversation: options.conversation },
            { access: 'full' },
        );
        if (options.json) {
            out(JSON.stringify(message) + '\n');
        } else {
            out(`Discarded ${message.id} from ${message.conversation}. It was never sent.\n`);
        }
        return EXIT.OK;
    },

    async react(ctx) {
        const { args, options, out } = ctx;
        if (args.length !== 2) throw new UsageError('Expected a message id and an emoji.');
        const [id, emoji] = args;
        /** @type {import('@converse/daemon/types').SendResult} */
        const result = await request(ctx, 'messages.react', {
            id,
            emoji,
            conversation: options.conversation,
            remove: !!options.remove,
        });
        if (result.outcome !== 'sent' || options.json) return reportSend(result, ctx);

        const { message } = result;
        out(
            options.remove
                ? `Withdrew that reaction to ${message.id} in ${message.conversation}.\n`
                : `Reacted to ${message.id} in ${message.conversation}.\n`,
        );
        return EXIT.OK;
    },

    // Drafts are the user's to decide on, so these ask for full access, except
    // that in "as_user" mode an agent may see which drafts are still waiting.
    async 'drafts list'(ctx) {
        const { options, out, err } = ctx;
        /** @type {{ drafts: import('@converse/daemon/types').Draft[] }} */
        const { drafts } = await request(ctx, 'drafts.list', {}, { access: draftReadAccess(ctx.env) });
        if (options.json) {
            drafts.forEach((d) => out(JSON.stringify(d) + '\n'));
        } else if (drafts.length) {
            const now = new Date();
            drafts.forEach((d) => out(formatDraft(d, { full: options.full, now })));
        } else {
            err('No drafts.\n');
        }
        return EXIT.OK;
    },

    async 'drafts show'(ctx) {
        const { options, out } = ctx;
        const id = takeOne(ctx, 'draft id');
        /** @type {{ draft: import('@converse/daemon/types').Draft, target: import('@converse/daemon/types').MessageDTO|null }} */
        const { draft, target } = await request(ctx, 'drafts.get', { id }, { access: draftReadAccess(ctx.env) });
        out(options.json ? JSON.stringify(draft) + '\n' : formatDraftDetails(draft, target));
        return EXIT.OK;
    },

    async 'drafts send'(ctx) {
        const id = takeOne(ctx, 'draft id');
        /** @type {import('@converse/daemon/types').SendResult} */
        const result = await request(ctx, 'drafts.send', { id }, { access: 'full' });
        return reportSend(result, ctx);
    },

    async 'drafts reject'(ctx) {
        const { options, out } = ctx;
        const id = takeOne(ctx, 'draft id');
        /** @type {{ draft: import('@converse/daemon/types').Draft }} */
        const { draft } = await request(ctx, 'drafts.reject', { id }, { access: 'full' });
        if (options.json) {
            out(JSON.stringify(draft) + '\n');
        } else {
            out(`Withdrew draft ${draft.id}. Nothing was sent.\n`);
        }
        return EXIT.OK;
    },

    async 'schedules list'(ctx) {
        const { options, out, err } = ctx;
        /** @type {{ schedules: import('@converse/daemon/types').ScheduleDTO[] }} */
        const { schedules } = await request(ctx, 'schedules.list');
        if (options.json) {
            schedules.forEach((schedule) => out(JSON.stringify(schedule) + '\n'));
        } else if (schedules.length) {
            schedules.forEach((schedule) => out(formatSchedule(schedule, { full: options.full })));
        } else {
            err('No scheduled messages.\n');
        }
        return EXIT.OK;
    },

    async 'schedules cancel'(ctx) {
        const { options, out } = ctx;
        const id = takeOne(ctx, 'scheduled message id');
        /** @type {{ schedule: import('@converse/daemon/types').ScheduleDTO }} */
        const { schedule } = await request(ctx, 'schedules.cancel', { id });
        if (options.json) {
            out(JSON.stringify(schedule) + '\n');
        } else {
            out(`Cancelled scheduled message ${schedule.id}. Nothing was sent.\n`);
        }
        return EXIT.OK;
    },

    async conversations(ctx) {
        const { options, out, err } = ctx;
        /** @type {import('@converse/daemon/types').ConversationSummary[]} */
        const { conversations } = await request(ctx, 'conversations.list');
        if (options.json) {
            conversations.forEach((c) => out(JSON.stringify(c) + '\n'));
        } else if (conversations.length) {
            const now = new Date();
            conversations.forEach((c) => out(formatConversation(c, { now })));
        } else {
            err('No conversations.\n');
        }
        return EXIT.OK;
    },

    async inbox(ctx) {
        const { options, out, err } = ctx;
        /** @type {import('@converse/daemon/types').Inbox} */
        const { conversations } = await request(ctx, 'inbox.read');
        if (options.json) {
            conversations.forEach((group) => out(JSON.stringify(group) + '\n'));
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

    async wait(ctx) {
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
            out(JSON.stringify(message) + '\n');
        } else {
            out(formatMessage(message, { full: options.full }));
        }
        return EXIT.OK;
    },

    async contacts(ctx) {
        const { args, options, out, err } = ctx;
        const query = args.length ? args.join(' ') : undefined;
        /** @type {{ contacts: import('@converse/daemon/types').ContactSummary[] }} */
        const { contacts } = await request(ctx, 'contacts.list', { query });
        if (options.json) {
            contacts.forEach((c) => out(JSON.stringify(c) + '\n'));
        } else if (contacts.length) {
            contacts.forEach((c) => out(formatContact(c)));
        } else {
            err(query === undefined ? 'No contacts.\n' : `No contacts match ${JSON.stringify(query)}.\n`);
        }
        return EXIT.OK;
    },

    async whois(ctx) {
        const { options, out } = ctx;
        const jid = takeOne(ctx, 'contact');
        /** @type {import('@converse/daemon/types').ContactDetails} */
        const details = await request(ctx, 'contacts.whois', { jid });
        out(options.json ? JSON.stringify(details) + '\n' : formatContactDetails(details));
        return EXIT.OK;
    },

    async 'omemo devices'(ctx) {
        const { options, out } = ctx;
        const conversation = takeOne(ctx, 'contact');
        /** @type {import('@converse/daemon/types').DeviceList} */
        const list = await request(ctx, 'omemo.devices.list', { conversation });
        if (options.json) {
            out(JSON.stringify(list) + '\n');
        } else {
            out(formatDeviceList(list));
        }
        return EXIT.OK;
    },

    async 'omemo trust'(ctx) {
        const { args, options, out } = ctx;
        if (args.length !== 3) throw new UsageError('Expected a contact, a device id and a trust state.');
        const [conversation, device, trust] = args;
        /** @type {import('@converse/daemon/types').DeviceDTO} */
        const dto = await request(ctx, 'omemo.devices.trust', { conversation, device, trust });
        out(options.json ? JSON.stringify(dto) + '\n' : formatDevice(dto));
        return EXIT.OK;
    },

    async 'presence set'(ctx) {
        const { args, options, out } = ctx;
        if (args.length === 0) throw new UsageError('Expected a presence: online, chat, away, xa or dnd.');
        const [show, ...words] = args;
        /** @type {import('@converse/daemon/types').PresenceDTO} */
        const presence = await request(ctx, 'presence.set', {
            show,
            message: words.length ? words.join(' ') : undefined,
        });
        if (options.json) {
            out(JSON.stringify(presence) + '\n');
        } else {
            const status =
                presence.status_message === null ? '' : ` with status ${JSON.stringify(presence.status_message)}`;
            out(`Your presence is now ${presence.show}${status}.\n`);
        }
        return EXIT.OK;
    },

    async 'rooms join'(ctx) {
        const { options, out } = ctx;
        const room = takeOne(ctx, 'room JID');
        /** @type {{ conversation: import('@converse/daemon/types').ConversationDTO, nick: string }} */
        const joined = await request(ctx, 'rooms.join', { room, nick: options.nick });
        if (options.json) {
            out(JSON.stringify(joined) + '\n');
        } else {
            out(`Joined ${joined.conversation.jid} as ${JSON.stringify(joined.nick)}.\n`);
        }
        return EXIT.OK;
    },

    async 'rooms leave'(ctx) {
        const { options, out } = ctx;
        const room = takeOne(ctx, 'room');
        /** @type {{ conversation: import('@converse/daemon/types').ConversationDTO, was_in: boolean }} */
        const left = await request(ctx, 'rooms.leave', { room });
        if (options.json) {
            out(JSON.stringify(left) + '\n');
        } else if (left.was_in) {
            out(`Left ${left.conversation.jid}.\n`);
        } else {
            out(`Forgot ${left.conversation.jid}, which we weren't in, so a restart won't rejoin it.\n`);
        }
        return EXIT.OK;
    },

    async 'rooms occupants'(ctx) {
        const { options, out, err } = ctx;
        const room = takeOne(ctx, 'room');
        /** @type {{ occupants: import('@converse/daemon/types').OccupantDTO[] }} */
        const { occupants } = await request(ctx, 'rooms.occupants', { room });
        if (options.json) {
            occupants.forEach((o) => out(JSON.stringify(o) + '\n'));
        } else if (occupants.length) {
            occupants.forEach((o) => out(formatOccupant(o)));
        } else {
            err('Nobody is listed in that room.\n');
        }
        return EXIT.OK;
    },

    async 'rooms discover'(ctx) {
        const { options, out, err } = ctx;
        const service = takeOne(ctx, 'service');
        /** @type {{ rooms: import('@converse/daemon/types').RoomListing[] }} */
        const { rooms } = await request(ctx, 'rooms.discover', { service });
        if (options.json) {
            rooms.forEach((r) => out(JSON.stringify(r) + '\n'));
        } else if (rooms.length) {
            rooms.forEach((r) => out(formatRoomListing(r)));
        } else {
            err(`${service} lists no rooms.\n`);
        }
        return EXIT.OK;
    },

    'daemon start': (ctx) => printStatus(ctx, true),
    'daemon status': (ctx) => printStatus(ctx, false),
    'daemon stop': async ({ options, out, env }) => {
        const was_running = await stopDaemon({ env });
        if (options.json) {
            out(JSON.stringify({ stopped: was_running }) + '\n');
        } else {
            out(was_running ? 'Stopped.\n' : "The daemon wasn't running.\n");
        }
        return EXIT.OK;
    },
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
    client.onEvent(({ message }) => resolve(message));
    client.closed.catch(reject);
    try {
        await client.request('events.subscribe', { ...filter, once: true });
        return await promise;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * @param {import('./types').Context} ctx
 * @param {boolean} spawn - Whether to start the daemon if it isn't running.
 */
async function printStatus(ctx, spawn) {
    /** @type {import('@converse/daemon/types').Status} */
    const status = await request(ctx, 'daemon.status', {}, { spawn });
    if (ctx.options.json) {
        ctx.out(JSON.stringify(status) + '\n');
    } else {
        const state = status.connected ? `connected as ${status.jid}` : 'disconnected';
        ctx.out(`${state}, pid ${status.pid}, up ${formatDuration(status.uptime)}\n`);
    }
    return EXIT.OK;
}

/**
 * @param {import('./types').Context} ctx
 */
async function readStdin({ stdin }) {
    if (!stdin || stdin.isTTY) throw new UsageError('Expected the text to send, as arguments or on stdin.');
    let text = '';
    for await (const chunk of stdin) text += chunk;
    return text.replace(/\n$/, '');
}

/**
 * Reads a file to upload, base64-encoded for `files.upload`. The daemon never
 * opens a path, so a file the CLI can't read fails here, before the daemon is
 * asked for anything.
 * @param {string} file_path
 */
async function readUpload(file_path) {
    try {
        const metadata = await fs.stat(file_path);
        if (!metadata.isFile()) throw Object.assign(new Error('not a regular file'), { code: 'not a regular file' });
        if (metadata.size > MAX_UPLOAD_SIZE) {
            throw new Error(
                `${JSON.stringify(path.basename(file_path))} is ${metadata.size} bytes, which exceeds the daemon's ` +
                    `${MAX_UPLOAD_SIZE}-byte upload limit. Choose a smaller file.`,
            );
        }
        return (await fs.readFile(file_path)).toString('base64');
    } catch (e) {
        if (!e.code) throw e;
        throw new Error(
            `The file at ${JSON.stringify(file_path)} could not be read (${e.code}). ` +
                'Check that the path names a readable file, then try again.',
            { cause: e },
        );
    }
}
