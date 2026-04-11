/**
 * @type {Object.<string, number>}
 */
export const LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
};

/**
 * Logs messages to the console.
 * Available loglevels are:
 *      - 0: 'debug'
 *      - 1: 'info'
 *      - 2: 'warn',
 *      - 3: 'error'
 *      - 4: 'fatal'.
 * @namespace log
 */
const log = {
    /** @type {keyof LEVELS} The current log level */
    loglevel: 'info',

    /**
     * Sets the current log level which determines which messages are logged
     * @param {keyof LEVELS} level - The log level to set
     * @throws {Error} If an invalid log level is provided
     */
    setLogLevel(level) {
        if (!['debug', 'info', 'warn', 'error', 'fatal'].includes(/** @type {string} */ (level))) {
            throw new Error(`Invalid loglevel: ${level}`);
        }
        this.loglevel = level;
    },

    /**
     * Logs a message at the specified level.
     * Accepts the same arguments as the corresponding console method.
     * @param {keyof LEVELS} level - The log level to use
     * @param  {...any} args - Arguments passed through to the console method
     */
    log(level, ...args) {
        if (LEVELS[level] < LEVELS[this.loglevel]) {
            return;
        }

        const [msg, ...rest] = args;
        let formattedMsg = msg;
        if (msg instanceof Error) {
            formattedMsg = msg.stack;
        } else if (typeof Element !== 'undefined' && msg instanceof Element) {
            formattedMsg = msg.outerHTML;
        }

        const method = level === 'fatal' ? 'error' : level;
        console[method](formattedMsg, ...rest);
    },

    /**
     * @param  {...any} args - Arguments passed through to console.debug
     */
    debug(...args) {
        this.log('debug', ...args);
    },

    /**
     * @param  {...any} args - Arguments passed through to console.error
     */
    error(...args) {
        this.log('error', ...args);
    },

    /**
     * @param  {...any} args - Arguments passed through to console.info
     */
    info(...args) {
        this.log('info', ...args);
    },

    /**
     * @param  {...any} args - Arguments passed through to console.warn
     */
    warn(...args) {
        this.log('warn', ...args);
    },

    /**
     * @param  {...any} args - Arguments passed through to console.error
     */
    fatal(...args) {
        this.log('fatal', ...args);
    },
};

export default log;
