/**
 * Command line options: how a command declares one, and how the parser and
 * the help are derived from those declarations. Whether an option takes a
 * value is said once, by the function that declares it.
 * @module @converse/cli/options
 */

/**
 * An option that takes no value, such as `--full`.
 * @param {string} name - Its long name, without the dashes
 * @param {string} help - What it does
 * @param {string} [short] - Its one-letter name, if it has one
 * @returns {import('./types').Option}
 */
export function flag(name, help, short) {
    return { name, type: 'boolean', help, ...(short ? { short } : {}) };
}

/**
 * An option that takes a value, such as `--limit <n>`.
 * @param {string} name - Its long name, without the dashes
 * @param {string} value - How help shows its value, such as "<n>"
 * @param {string} help - What it does
 * @returns {import('./types').Option}
 */
export function option(name, value, help) {
    return { name, type: 'string', value, help };
}

/** Options every command takes. */
export const GLOBAL_OPTIONS = [
    option('account', '<name>', 'Use this account, not the default one. CONVERSE_ACCOUNT=<name> does the same'),
    flag('json', 'Print the JSON the daemon returned instead of text: one object per line for lists'),
    flag('help', 'Show this help and exit', 'h'),
];

/** Taken without a command. */
export const VERSION = flag('version', 'Show the version and exit', 'v');

/**
 * How help shows an option, such as `--limit <n>` or `-h, --help`.
 * @param {import('./types').Option} option
 */
export function label({ name, value, short }) {
    return `${short ? `-${short}, ` : ''}--${name}${value ? ` ${value}` : ''}`;
}

/**
 * Every option any of the commands takes, as `parseArgs` wants them. The
 * parser reads all of them, whatever the command, so an option that two
 * commands both take must be of the same type in each.
 * @param {Record<string, import('./types').Command>} commands
 * @returns {import('node:util').ParseArgsOptionsConfig}
 */
export function parseOptions(commands) {
    /** @type {import('node:util').ParseArgsOptionsConfig} */
    const config = {};
    const all = [...Object.values(commands).flatMap(({ options = [] }) => options), ...GLOBAL_OPTIONS, VERSION];
    for (const { name, type, short } of all) {
        if (config[name] && config[name].type !== type) {
            throw new Error(`--${name} is declared both with and without a value.`);
        }
        config[name] = { type, ...(short ? { short } : {}) };
    }
    return config;
}

/**
 * The options given that a command doesn't take, so that none is silently ignored.
 * @param {import('./types').Command} command
 * @param {Object} values - The options given, as `parseArgs` returns them
 * @returns {string[]}
 */
export function unexpectedOptions(command, values) {
    const taken = new Set([...(command.options ?? []), ...GLOBAL_OPTIONS].map(({ name }) => name));
    return Object.keys(values).filter((name) => !taken.has(name));
}
