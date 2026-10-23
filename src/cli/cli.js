/**
 * converse-cli: a short-lived command line client of the Converse daemon.
 * Each invocation connects to the daemon's socket (starting the daemon if
 * it isn't running), makes its request, prints the result and exits.
 *
 * There are deliberately no options for credentials: they'd end up in shell
 * history and agent transcripts. The account comes from the config file.
 */
import { parseArgs } from 'node:util';
import { connect, DaemonUnavailableError, getConfigPath, stopDaemon } from '@converse/daemon/client';
import pkg from './package.json' with { type: 'json' };
import { EXIT } from './exit-codes.js';

/**
 * @param {NodeJS.ProcessEnv} env
 */
const usage = (env) => `Usage: converse-cli <command> [options]

Read and send XMPP messages through the Converse daemon, which holds one
long-lived session for your account. Any command starts the daemon if it
isn't running.

Commands:
  daemon start    Start the daemon (if needed) and show its status
  daemon status   Show whether the daemon is connected, as which JID, and for how long
  daemon stop     Log out and stop the daemon

Options:
  --json          Print results as JSON
  -h, --help      Show this help and exit
  -v, --version   Show the version and exit

The account is configured in ${getConfigPath(env)}.

Exit codes:
  ${EXIT.OK}  ok
  ${EXIT.ERROR}  error
  ${EXIT.DAEMON_UNAVAILABLE}  daemon not running, or it couldn't be started
`;

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
            options: {
                json: { type: 'boolean' },
                help: { type: 'boolean', short: 'h' },
                version: { type: 'boolean', short: 'v' },
            },
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
    if (values.help || positionals.length === 0) {
        io.out(usage(io.env));
        return EXIT.OK;
    }

    const [command, ...args] = positionals;
    const handler = COMMANDS[[command, args[0]].join(' ')];
    if (!handler) {
        io.err(
            `converse-cli: unknown command "${positionals.join(' ')}". Run "converse-cli --help" to list commands.\n`,
        );
        return EXIT.ERROR;
    }
    try {
        return await handler({ ...io, json: !!values.json });
    } catch (e) {
        io.err(`converse-cli: ${e.message}\n`);
        return e instanceof DaemonUnavailableError ? EXIT.DAEMON_UNAVAILABLE : EXIT.ERROR;
    }
}

/** @type {Record<string, (ctx: import('./types').Context) => Promise<number>>} */
const COMMANDS = {
    'daemon start': (ctx) => printStatus(ctx, true),
    'daemon status': (ctx) => printStatus(ctx, false),
    'daemon stop': async ({ out, json, env }) => {
        const was_running = await stopDaemon({ env });
        if (json) {
            out(JSON.stringify({ stopped: was_running }) + '\n');
        } else {
            out(was_running ? 'Stopped.\n' : "The daemon wasn't running.\n");
        }
        return EXIT.OK;
    },
};

/**
 * @param {import('./types').Context} ctx
 * @param {boolean} spawn - Whether to start the daemon if it isn't running.
 */
async function printStatus({ out, json, env }, spawn) {
    const client = await connect({ spawn, env });
    try {
        const status = await client.request('daemon.status');
        if (json) {
            out(JSON.stringify(status) + '\n');
        } else {
            const state = status.connected ? `connected as ${status.jid}` : 'disconnected';
            out(`${state}, pid ${status.pid}, up ${formatDuration(status.uptime)}\n`);
        }
    } finally {
        client.close();
    }
    return EXIT.OK;
}

/**
 * @param {number} seconds
 */
function formatDuration(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [d && `${d}d`, h && `${h}h`, m && `${m}m`, (s || seconds === 0) && `${s}s`].filter(Boolean);
    return parts.slice(0, 2).join(' ');
}
