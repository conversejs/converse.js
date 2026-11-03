/**
 * The accounts, and their daemons.
 * @module @converse/cli/commands/daemon
 */
import fsSync from 'node:fs';
import { getConfigDir, listAccounts, listDaemons, stopDaemon } from '@converse/daemon/client';
import { request } from '../context.js';
import { EXIT } from '../exit-codes.js';
import { formatDuration, formatJSON } from '../format.js';
import { flag } from '../options.js';

/** @type {Record<string, import('../types').Command>} */
export const DAEMON_COMMANDS = {
    accounts: {
        summary: 'List the configured accounts, and which is the default',
        description:
            'List the configured accounts, one line per account: its name and JID, and "(default)" ' +
            'for the one used when no account is named. Each file accounts/<name>.json is the ' +
            'account <name>. The account "default" is the default, or without it the only account, ' +
            'and with several there is none.',
        examples: ['converse-cli accounts'],
        run({ options, out, err, env }) {
            const accounts = listAccounts(env).map((account) => ({ ...account, jid: readJID(account.config) }));
            if (options.json) {
                accounts.forEach((a) => out(formatJSON(a)));
            } else if (accounts.length) {
                accounts.forEach((a) =>
                    out(`${a.name}  ${a.jid ?? '(no valid "jid")'}${a.default ? '  (default)' : ''}\n`),
                );
            } else {
                err(`No account is configured in ${getConfigDir(env)}.\n`);
            }
            return EXIT.OK;
        },
    },
    'daemon start': {
        summary: "Start the daemon if it isn't running, and show its status",
        description:
            "Start the daemon if it isn't running, and show its status. Any other command starts it " +
            'too, so this is rarely needed.',
        examples: ['converse-cli daemon start'],
        run: (ctx) => printStatus(ctx, true),
    },
    'daemon status': {
        summary: 'Show whether the daemon is connected, as which JID',
        description:
            'Show whether the daemon is connected, as which JID, its pid, for how long it has ' +
            'been running, and the socket it was reached on, which tells a daemon on another host, ' +
            "through a tunnel, from a local one. The JID is who you are to others. This doesn't " +
            'start the daemon.\n\n' +
            'With --all, list every running daemon instead, one line per account: its name, the JID ' +
            'it was started as, its pid and for how long it has been running.',
        options: [flag('all', "List every account's running daemon")],
        examples: ['converse-cli daemon status', 'converse-cli daemon status --all'],
        run: (ctx) => (ctx.options.all ? printAllStatuses(ctx) : printStatus(ctx, false)),
    },
    'daemon stop': {
        summary: 'Log out and stop the daemon',
        description:
            'Log out and stop the daemon. Your contacts see you go offline, and rooms see you leave. ' +
            'A daemon reached through a socket the config names may be on another host, so for that ' +
            'one this returns once the daemon has closed the connection, and says it was asked to stop.',
        examples: ['converse-cli daemon stop'],
        async run({ options, out, env }) {
            const stopped = await stopDaemon({ env });
            if (options.json) {
                out(formatJSON({ stopped: stopped !== false }));
            } else if (stopped === 'asked') {
                // Its pidfile may be on another host, so the closed connection is all there is to go by.
                out('Asked the daemon to stop. It has closed the connection.\n');
            } else {
                out(stopped ? 'Stopped.\n' : "The daemon wasn't running.\n");
            }
            return EXIT.OK;
        },
    },
};

/**
 * @param {import('../types').Context} ctx
 * @param {boolean} spawn - Whether to start the daemon if it isn't running.
 */
async function printStatus(ctx, spawn) {
    /** @type {import('@converse/daemon/types').Status} */
    const status = await request(ctx, 'daemon.status', {}, { spawn });
    // Which socket was reached tells a daemon through a tunnel from a local one.
    if (ctx.options.json) {
        ctx.out(formatJSON({ ...status, socket: ctx.socket_path }));
    } else {
        const state = status.connected ? `connected as ${status.jid}` : 'disconnected';
        ctx.out(`${state}, pid ${status.pid}, up ${formatDuration(status.uptime)}, on ${ctx.socket_path}\n`);
    }
    return EXIT.OK;
}

/**
 * Lists the running daemons, of every account, from the records they leave.
 * @param {import('../types').Context} ctx
 */
function printAllStatuses({ options, out, err, env }) {
    const daemons = listDaemons(env).map(({ account, jid, pid, started }) => ({
        account,
        jid,
        pid,
        started,
        uptime: Math.floor((Date.now() - Date.parse(started)) / 1000),
    }));
    if (options.json) {
        daemons.forEach((d) => out(formatJSON(d)));
    } else if (daemons.length) {
        daemons.forEach((d) => out(`${d.account}  ${d.jid}  pid ${d.pid}  up ${formatDuration(d.uptime)}\n`));
    } else {
        err('No daemon is running.\n');
    }
    return EXIT.OK;
}

/**
 * The JID an account's config file names, for listing it. Null if the file
 * can't be read or names none.
 * @param {string} config_path
 * @returns {string|null}
 */
function readJID(config_path) {
    try {
        const { jid } = JSON.parse(fsSync.readFileSync(config_path, 'utf8'));
        return typeof jid === 'string' ? jid.trim().toLowerCase() : null;
    } catch {
        return null;
    }
}
