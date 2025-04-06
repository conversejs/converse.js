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

const logger = Object.assign(
    {
        debug: console?.log ? console.log.bind(console) : function noop() {},
        error: console?.log ? console.log.bind(console) : function noop() {},
        info: console?.log ? console.log.bind(console) : function noop() {},
        warn: console?.log ? console.log.bind(console) : function noop() {},
    },
    console
);

/**
 * Logs messages to the console.
 * Available loglevels are:
 *      - 0: 'debug'
 *      - 1: 'info'
 *      - 2: 'warn',
 *      - 3: 'error'
 *      - 4: 'fatal'.
 * When using the 'error' or 'warn' loglevels, a full stacktrace will be logged as well.
 * @namespace log
 */
const log = {
    /** @type {keyof LEVELS} The current log level */
    loglevel: "info",

    /**
     * Sets the current log level which determines which messages are logged
     * @param {keyof LEVELS} level - The log level to set
     * @throws {Error} If an invalid log level is provided
     */
    setLogLevel(level) {
        if (!["debug", "info", "warn", "error", "fatal"].includes(/** @type {string} */ (level))) {
            throw new Error(`Invalid loglevel: ${level}`);
        }
        this.loglevel = level;
    },

    /**
     * Logs a message at the specified level with optional CSS styling
     * @param {any} message - The message to log
     * @param {keyof LEVELS} level - The log level to use
     * @param {string} [style=""] - Optional CSS styles to apply to the log message
     */
    log(message, level, style = "") {
        if (LEVELS[level] < LEVELS[this.loglevel]) {
            return;
        }
        if (level === "error" || level === "fatal") {
            style = style || "color: maroon";
        } else if (level === "debug") {
            style = style || "color: green";
        }

        if (message instanceof Error) {
            message = message.stack;
        } else if (isElement(message)) {
            message = /** @type {Element} */ (message).outerHTML;
        }
        const prefix = style ? "%c" : "";
        if (level === "error") {
            logger.error(`${prefix} ERROR: ${message}`, style);
        } else if (level === "warn") {
            logger.warn(`${prefix} ${new Date().toISOString()} WARNING: ${message}`, style);
        } else if (level === "fatal") {
            logger.error(`${prefix} FATAL: ${message}`, style);
        } else if (level === "debug") {
            logger.debug(`${prefix} ${new Date().toISOString()} DEBUG: ${message}`, style);
        } else {
            logger.info(`${prefix} ${new Date().toISOString()} INFO: ${message}`, style);
        }
    },

    /**
     * @param {any} message - The message to log
     * @param {string} [style=""] - Optional CSS styles to apply to the log message
     */
    debug(message, style) {
        this.log(message, "debug", style);
    },

    /**
     * @param {any} message - The message to log
     * @param {string} [style=""] - Optional CSS styles to apply to the log message
     */
    error(message, style) {
        this.log(message, "error", style);
    },

    /**
     * @param {any} message - The message to log
     * @param {string} [style=""] - Optional CSS styles to apply to the log message
     */
    info(message, style) {
        this.log(message, "info", style);
    },

    /**
     * @param {any} message - The message to log
     * @param {string} [style=""] - Optional CSS styles to apply to the log message
     */
    warn(message, style) {
        this.log(message, "warn", style);
    },

    /**
     * @param {any} message - The message to log
     * @param {string} [style=""] - Optional CSS styles to apply to the log message
     */
    fatal(message, style) {
        this.log(message, "fatal", style);
    },
};

/**
 * @param {unknown} el - The value to check
 * @returns {boolean} True if the value is an Element or Document
 */
export function isElement(el) {
    return el instanceof Element || el instanceof Document;
}

export default log;
