/**
 * converse-cli: a command line client of the Converse daemon.
 * Each invocation connects to the daemon's socket (starting the daemon if
 * it isn't running), makes its request, prints the result and exits. `watch`
 * alone stays connected, printing what arrives until it's stopped.
 *
 * There are deliberately no options for credentials: they'd end up in shell
 * history and agent transcripts. The account comes from its config file,
 * picked by name with `--account` or `CONVERSE_ACCOUNT`.
 */
import { parseArgs } from 'node:util';
import { AccountError, DaemonUnavailableError, getConfigDir, getSocketFromEnv } from '@converse/daemon/client';
import { ERRORS, RPCError } from '@converse/daemon/protocol';
import pkg from './package.json' with { type: 'json' };
import { COMMANDS } from './commands/index.js';
import { UsageError } from './context.js';
import { EXIT } from './exit-codes.js';
import { commandHelp, overview } from './help.js';
import { parseOptions, unexpectedOptions } from './options.js';

/** Every option any command takes, for the parser. */
const PARSE_OPTIONS = parseOptions(COMMANDS);

/** How the daemon's errors map onto exit codes. Anything else is EXIT.ERROR. */
const EXIT_FOR_ERROR = {
    [ERRORS.NOT_FOUND]: EXIT.NOT_FOUND,
    [ERRORS.AMBIGUOUS]: EXIT.AMBIGUOUS,
};

/**
 * The daemon's errors name the methods, or the program, that help, since its
 * clients aren't all this one, and list them in `data.see`. Those this CLI has
 * a command for are shown as that command.
 */
const COMMAND_FOR = {
    'converse-daemon': 'converse-cli daemon start',
    'daemon.status': 'converse-cli daemon status',
    'daemon.stop': 'converse-cli daemon stop',
    'contacts.list': 'converse-cli contacts',
    'drafts.list': 'converse-cli drafts list',
    'drafts.reject': 'converse-cli drafts reject',
    'messages.list': 'converse-cli read',
    'omemo.devices.list': 'converse-cli omemo devices',
    'rooms.join': 'converse-cli rooms join',
    'schedules.list': 'converse-cli schedules list',
};

/**
 * An error's message, with the methods it names, as its `data.see` lists
 * them, shown as this CLI's commands. Nothing else in it is touched, such as
 * a quoted value that happens to look like a method's name.
 * @param {Error & { data?: unknown }} error
 * @returns {string}
 */
function inCommands({ message, data }) {
    const see = /** @type {{ see?: unknown }} */ (data ?? {}).see;
    const names = Array.isArray(see) ? see.filter((name) => Object.hasOwn(COMMAND_FOR, name)) : [];
    return names.reduce((text, name) => text.replaceAll(`"${name}"`, `"${COMMAND_FOR[name]}"`), message);
}

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
    // The account goes to the daemon this starts, too.
    if (typeof values.account === 'string') io = { ...io, env: { ...io.env, CONVERSE_ACCOUNT: values.account } };

    if (values.version) {
        io.out(`${pkg.version}\n`);
        return EXIT.OK;
    }
    if (positionals.length === 0 || (positionals[0] === 'help' && positionals.length === 1)) {
        try {
            io.out(overview(COMMANDS, getConfigDir(io.env), getSocketFromEnv(io.env)));
        } catch (e) {
            return reportError(e, io);
        }
        return EXIT.OK;
    }

    const asking = positionals[0] === 'help';
    const [name, ...rest] = asking ? positionals.slice(1) : positionals;
    // Only the table's own entries count: "constructor" and "toString" aren't commands.
    const lookup = (key) => (Object.hasOwn(COMMANDS, key) ? key : undefined);
    const [command, args] = lookup(name) ? [lookup(name), rest] : [lookup(`${name} ${rest[0]}`), rest.slice(1)];
    // A group such as "drafts", given without its subcommand.
    const group = command ? [] : Object.keys(COMMANDS).filter((key) => key.startsWith(`${name} `));
    if (group.length && rest.length === 0) {
        if (asking || values.help) {
            io.out(group.map((key) => commandHelp(key, COMMANDS[key])).join('\n'));
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
        io.out(commandHelp(command, COMMANDS[command]));
        return EXIT.OK;
    }
    const unexpected = unexpectedOptions(COMMANDS[command], values);
    if (unexpected.length) {
        io.err(
            `converse-cli: ${command} doesn't take ${unexpected.map((o) => `--${o}`).join(' or ')}. ` +
                `Run "converse-cli help ${command}" for its options.\n`,
        );
        return EXIT.ERROR;
    }
    try {
        return await COMMANDS[command].run({ ...io, args, options: values });
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
    io.err(`converse-cli: ${inCommands(e)}\n`);
    if (e instanceof AccountError) {
        e.candidates.forEach((c) => io.err(`  ${c}\n`));
        return e.reason === 'ambiguous' ? EXIT.AMBIGUOUS : EXIT.NOT_FOUND;
    }
    if (e instanceof RPCError) {
        /** @type {string[]} */
        const candidates = /** @type {{ candidates?: string[] }} */ (e.data)?.candidates ?? [];
        candidates.forEach((c) => io.err(`  ${c}\n`));
        return EXIT_FOR_ERROR[e.code] ?? EXIT.ERROR;
    }
    return e instanceof DaemonUnavailableError ? EXIT.DAEMON_UNAVAILABLE : EXIT.ERROR;
}
