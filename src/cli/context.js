/**
 * What every command does with the daemon: connecting at the right access
 * level, making a request, and reporting a send's outcome. Also the checks
 * on a command's arguments.
 * @module @converse/cli/context
 */
import { connect, getSocketFromEnv, loadConfig } from '@converse/daemon/client';
import { ERRORS } from '@converse/daemon/protocol';
import { EXIT } from './exit-codes.js';
import { formatJSON } from './format.js';

/**
 * Bad usage, reported with a pointer to the help.
 */
export class UsageError extends Error {}

/** How the outcome of a send maps onto exit codes. */
const EXIT_FOR_OUTCOME = {
    sent: EXIT.OK,
    pending: EXIT.PENDING,
    refused: EXIT.REFUSED,
    draft: EXIT.DRAFT,
    scheduled: EXIT.OK,
};

/**
 * The access level the CLI connects at: restricted, unless the config says
 * otherwise. Given only a socket, with `CONVERSE_SOCKET`, the CLI has no
 * config, and the level is the socket's.
 * @param {NodeJS.ProcessEnv} env
 * @returns {import('@converse/daemon/types').Access}
 */
export const accessFor = (env) => (getSocketFromEnv(env) ? 'restricted' : loadConfig(env).access);

/**
 * Makes a request for drafts at the configured access level, or else at full
 * access. Drafts are the user's to decide on, but the daemon lets restricted
 * access see them in "as_user" mode: its mode decides, not this config's,
 * which can differ for a daemon on another host.
 * @param {import('./types').Context} ctx
 * @param {string} method
 * @param {Record<string, any>} params
 */
export async function requestDrafts(ctx, method, params) {
    try {
        return await request(ctx, method, params);
    } catch (e) {
        // Given only a socket, there's no other level to try.
        if (
            /** @type {import('@converse/daemon/protocol').RPCError} */ (e).code !== ERRORS.ACCESS_DENIED ||
            getSocketFromEnv(ctx.env)
        )
            throw e;

        return request(ctx, method, params, { access: 'full' });
    }
}

/**
 * Connects (starting the daemon if need be), makes one request and hangs up.
 * Keeps the daemon's `hello`, and the socket it was reached on, in `ctx`, for
 * what the output depends on.
 * @param {import('./types').Context} ctx
 * @param {string} method
 * @param {Record<string, any>} [params]
 * @param {Pick<import('@converse/daemon/types').ConnectOptions, 'spawn'|'access'>} [options] - `access`
 *  defaults to the configured level
 */
export async function request(ctx, method, params, { spawn = true, access = accessFor(ctx.env) } = {}) {
    const client = await connect({ spawn, env: ctx.env, access });
    ctx.hello = client.hello;
    ctx.socket_path = client.socket_path;
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
export function reportSend(result, { options, out, err, hello }) {
    if (options.json) {
        out(formatJSON(result));
    } else if (result.outcome === 'sent') {
        out(`Sent to ${result.message.conversation} as ${result.message.id}\n`);
        warnIfUnconfirmed(result.message, { err });
    } else if (result.outcome === 'pending') {
        out(
            `Not sent yet to ${result.message.conversation}: the connection dropped. ${result.message.id} ` +
                'goes out once the daemon is connected again.\n',
        );
    } else if (result.outcome === 'draft') {
        out(
            hello.mode === 'as_user'
                ? `Drafted as ${result.draft_id}. Nothing was sent: it waits for the user to approve it.\n`
                : `Drafted as ${result.draft_id}. Its text went to the owner, and nothing was sent.\n`,
        );
    } else if (result.outcome === 'scheduled') {
        const { schedule } = result;
        out(`Scheduled ${schedule.id} to ${schedule.to} for ${schedule.send_at}.\n`);
    } else {
        err(`converse: ${result.message}\n`);
    }
    return EXIT_FOR_OUTCOME[result.outcome];
}

/**
 * Says on stderr that a room didn't echo a message we just sent it, so that
 * "sent" isn't read as "the room has it". A chat's message is confirmed only
 * by a receipt, which many clients never send, so it isn't warned about.
 * @param {import('@converse/daemon/types').MessageDTO} message
 * @param {Pick<import('./types').Context, 'err'>} ctx
 */
export function warnIfUnconfirmed(message, { err }) {
    // Only a room's messages have a nickname. A reaction returns the message it
    // was sent to, which can be someone else's.
    if (message.status !== 'sent' || message.nick === null || message.delivered) return;

    err(
        `converse: warning: ${message.conversation} hasn't confirmed ${message.id} yet, so it may not ` +
            'have reached the room. Check with read before sending it again.\n',
    );
}

/**
 * @param {import('./types').Context} ctx
 * @param {string} what - What the argument is, for the error message.
 */
export function takeOne({ args }, what) {
    if (args.length !== 1) throw new UsageError(`Expected exactly one ${what}.`);
    return args[0];
}

/**
 * @param {string} [limit] - The value of --limit
 * @returns {number|undefined}
 */
export function parseLimit(limit) {
    if (limit === undefined) return undefined;
    const number = Number(limit);
    if (!Number.isInteger(number)) throw new UsageError(`--limit "${limit}" isn't a whole number.`);
    return number;
}
