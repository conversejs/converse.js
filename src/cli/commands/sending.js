/**
 * Sending, and acting on messages already sent: send, upload, retract, resend, discard and react.
 * @module @converse/cli/commands/sending
 */
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MAX_UPLOAD_SIZE } from '@converse/daemon/protocol';
import { reportSend, request, takeOne, UsageError } from '../context.js';
import { EXIT } from '../exit-codes.js';
import { formatJSON, quote } from '../format.js';
import { flag, option } from '../options.js';
import { IN_CONVERSATION, LOOKUP_EXITS, MESSAGE_ID, SEND_EXITS, TARGET } from './shared.js';

/** @type {Record<string, import('../types').Command>} */
export const SENDING_COMMANDS = {
    send: {
        summary: 'Send a message, subject to the send policy',
        description:
            'Send a message. Without <text>, it is read from stdin, which suits long or multi-line ' +
            'text. Text that starts with a dash needs "--" before it, so it isn\'t read as an ' +
            'option.\n\n' +
            'At restricted access, the default, sends follow the config\'s "mode". In owner_only ' +
            'and bot, a send to the owner goes out directly. In owner_only, a contact listed in ' +
            '"policy.allow" gets a draft: the text goes to the owner, who sends it from their own ' +
            'client. In bot, a room in "policy.rooms" or a contact in "policy.direct" is sent to ' +
            "directly. In as_user, the account is the user's own, and nothing is sent directly: a " +
            'contact in "policy.allow" or a room in "policy.rooms" gets a draft, which waits in the ' +
            'daemon until the user sends it with drafts send. Anything else is refused. The exit ' +
            'code says which happened: 0 sent, 6 drafted, 5 refused. A draft or a refusal means ' +
            "nothing reached the recipient: don't send it again another way.",
        args: [TARGET, ['[text]', 'The message. Without it, the text is read from stdin']],
        options: [
            option(
                'reply-to',
                '<id>',
                'Reply to this message of the conversation (XEP-0461). A reply is routed as any send is. A drafted one tells the owner which message it answers',
            ),
            option(
                'correct',
                '<id>',
                'Replace one of your messages with <text> (XEP-0308). The message keeps its place, and answers to its old id. A restricted correction is only sent directly, and refused where a send would be drafted, except in as_user, where it is drafted too',
            ),
            option(
                'at',
                '<time>',
                'Schedule it for this future ISO 8601 time. Policy is checked now and again when it becomes due, even after a restart',
            ),
        ],
        exits: SEND_EXITS,
        examples: [
            'converse-cli send juliet@capulet.lit "On my way"',
            'converse-cli send "Juliet Capulet" --reply-to 01a183d1-2cc2-74f2-8de3-fd8a38834143 "Yes, at nine"',
            'converse-cli send juliet@capulet.lit -- -1 for yes',
            "printf 'Line one\\nLine two\\n' | converse-cli send juliet@capulet.lit",
        ],
        async run(ctx) {
            const { args, options } = ctx;
            if (args.length === 0) throw new UsageError('Expected a JID to send to.');
            const [to, ...words] = args;
            const body = words.length ? words.join(' ') : await readStdin(ctx);
            /** @type {{ to: string, body: string, reply_to?: string, correct?: string }} */
            const params = { to, body, reply_to: options['reply-to'], correct: options.correct };
            const result = await (options.at === undefined
                ? request(ctx, 'messages.send', params)
                : request(ctx, 'schedules.create', { ...params, at: options.at }));
            return reportSend(result, ctx);
        },
    },
    upload: {
        summary: 'Upload a local file and share its URL',
        description:
            'Upload a local file with XEP-0363 and share its URL. The CLI reads the file and sends ' +
            'its contents to the daemon, so the file must be readable by the CLI, not the daemon. ' +
            'It follows the same send policy as send: a direct route shares the URL with the ' +
            'contact or room; a draft route sends the URL to the owner, who may share it, or in ' +
            'as_user holds it until the user sends it with drafts send.',
        args: [TARGET, ['<path>', 'The local file']],
        exits: SEND_EXITS,
        examples: ['converse-cli upload juliet@capulet.lit ./report.pdf'],
        async run(ctx) {
            const { args, options, out } = ctx;
            if (args.length !== 2) throw new UsageError('Expected a recipient and a local file path.');
            const [to, file_path] = args;
            const name = path.basename(file_path);
            const content = await readUpload(file_path);
            /** @type {import('@converse/daemon/types').SendResult} */
            const result = await request(ctx, 'files.upload', { to, name, content });
            if (result.outcome !== 'sent' || options.json) return reportSend(result, ctx);

            out(
                `Uploaded ${quote(path.basename(file_path))} to ${result.message.conversation} ` +
                    `as ${result.message.id}\n`,
            );
            return EXIT.OK;
        },
    },
    retract: {
        summary: 'Withdraw one of your messages',
        description:
            'Withdraw one of your messages (XEP-0424). Its recipients see that it was retracted. A ' +
            'restricted retraction is only sent directly, so where policy would draft a send, a ' +
            'retraction is refused. In as_user it is drafted instead, for the user to send.',
        args: [MESSAGE_ID],
        options: [IN_CONVERSATION],
        exits: SEND_EXITS,
        examples: ['converse-cli retract 01a183d1-2cc2-74f2-8de3-fd8a38834143'],
        async run(ctx) {
            const { options, out } = ctx;
            const id = takeOne(ctx, 'message id');
            /** @type {import('@converse/daemon/types').SendResult} */
            const result = await request(ctx, 'messages.retract', { id, conversation: options.conversation });
            if (result.outcome !== 'sent') return reportSend(result, ctx);
            const { message } = result;
            if (options.json) {
                out(formatJSON(message));
            } else {
                out(`Retracted ${message.id} in ${message.conversation}.\n`);
            }
            return EXIT.OK;
        },
    },
    resend: {
        summary: 'Send a failed send again (full access)',
        description:
            'Send again one of your messages that read marks [send failed: <reason>]. It is sent ' +
            'encrypted, as it was meant to be, and keeps its id. Nothing resends a failed send on its ' +
            "own. Failed sends are the owner's to deal with, so this always connects at full access, " +
            'and fails for a client that only has restricted access. The outcome is reported as send ' +
            'reports it. If it fails again, it stays failed, with the new reason.',
        args: [['<id>', 'The id of the failed send, as read printed it']],
        options: [
            IN_CONVERSATION,
            flag(
                'unencrypted',
                'Send it in the clear, if it failed because it could not be encrypted. The daemon refuses this unless the config\'s "allow_unencrypted_resend" is true',
            ),
        ],
        exits: LOOKUP_EXITS,
        examples: [
            'converse-cli resend 01a183d1-2cc2-74f2-8de3-fd8a38834143',
            'converse-cli resend 01a183d1-2cc2-74f2-8de3-fd8a38834143 --unencrypted',
        ],
        // Failed sends are the user's to deal with, so these always ask for full access.
        async run(ctx) {
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
    },
    discard: {
        summary: 'Remove a failed send from the history (full access)',
        description:
            'Remove one of your messages that read marks [send failed: <reason>] from the history. ' +
            'It was never sent, so nobody else sees a change. Full access only, as for resend.',
        args: [['<id>', 'The id of the failed send, as read printed it']],
        options: [IN_CONVERSATION],
        exits: LOOKUP_EXITS,
        examples: ['converse-cli discard 01a183d1-2cc2-74f2-8de3-fd8a38834143'],
        async run(ctx) {
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
                out(formatJSON(message));
            } else {
                out(`Discarded ${message.id} from ${message.conversation}. It was never sent.\n`);
            }
            return EXIT.OK;
        },
    },
    react: {
        summary: 'React to a message with an emoji',
        description:
            'React to a message with an emoji, or its shortname such as :thumbsup: (XEP-0444). Your ' +
            'earlier reactions to it stay. A restricted reaction follows the same policy as a send, ' +
            'and a drafted one asks the owner to give it.',
        args: [MESSAGE_ID, ['<emoji>', 'An emoji, or its shortname']],
        options: [
            IN_CONVERSATION,
            flag(
                'remove',
                'Withdraw this reaction instead. Restricted access can only do it where policy sends directly, or in as_user, where it is drafted',
            ),
        ],
        exits: SEND_EXITS,
        examples: ['converse-cli react 01a183d1-2cc2-74f2-8de3-fd8a38834143 :thumbsup:'],
        async run(ctx) {
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
    },
};

/**
 * @param {import('../types').Context} ctx
 */
async function readStdin({ stdin }) {
    if (!stdin || stdin.isTTY) throw new UsageError('Expected the text to send, as arguments or on stdin.');
    let text = '';
    for await (const chunk of stdin) text += chunk;
    return text.replace(/\n$/, '');
}

/** How much of a file to upload is read at a time. */
const UPLOAD_CHUNK_SIZE = 1024 * 1024;

/**
 * Reads a file to upload, base64-encoded for `files.upload`. The daemon never
 * opens a path, so a file the CLI can't read fails here, before the daemon is
 * asked for anything.
 *
 * The checks and the read go through one open handle, so that what's read is
 * the file that was checked, even if the path is changed in between.
 * @param {string} file_path
 */
async function readUpload(file_path) {
    /** @param {string} what - What the file did, e.g. "is 40000000 bytes, which exceeds" */
    const tooLarge = (what) =>
        new Error(
            `${quote(path.basename(file_path))} ${what} the daemon's ` +
                `${MAX_UPLOAD_SIZE}-byte upload limit. Choose a smaller file.`,
        );

    let handle;
    try {
        // Non-blocking, so that opening a FIFO doesn't wait for a writer
        // before it can be turned away as not a regular file.
        const { O_RDONLY, O_NONBLOCK = 0 } = fsSync.constants;
        handle = await fs.open(file_path, O_RDONLY | O_NONBLOCK);
        const metadata = await handle.stat();
        if (!metadata.isFile()) throw Object.assign(new Error('not a regular file'), { code: 'not a regular file' });
        if (metadata.size > MAX_UPLOAD_SIZE) throw tooLarge(`is ${metadata.size} bytes, which exceeds`);

        // The file can still grow after the stat, so never read more than
        // one byte past the limit.
        const chunks = [];
        let length = 0;
        while (length <= MAX_UPLOAD_SIZE) {
            const room = Math.min(UPLOAD_CHUNK_SIZE, MAX_UPLOAD_SIZE + 1 - length);
            const { bytesRead, buffer } = await handle.read({ buffer: Buffer.alloc(room) });
            if (bytesRead === 0) break;

            chunks.push(buffer.subarray(0, bytesRead));
            length += bytesRead;
        }
        if (length > MAX_UPLOAD_SIZE) throw tooLarge('grew, while it was being read, past');

        return Buffer.concat(chunks, length).toString('base64');
    } catch (e) {
        if (!e.code) throw e;
        throw new Error(
            `The file at ${quote(file_path)} could not be read (${e.code}). ` +
                'Check that the path names a readable file, then try again.',
            { cause: e },
        );
    } finally {
        await handle?.close();
    }
}
