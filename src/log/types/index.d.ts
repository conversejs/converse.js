export declare const LEVELS: {
    debug: number;
    info: number;
    warn: number;
    error: number;
    fatal: number;
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
declare const log: {
    /** @type {keyof typeof LEVELS} The current log level */
    loglevel: keyof typeof LEVELS;
    /**
     * Sets the current log level which determines which messages are logged
     * @param {keyof typeof LEVELS} level - The log level to set
     * @throws {Error} If an invalid log level is provided
     */
    setLogLevel(level: keyof typeof LEVELS): void;
    /**
     * Logs a message at the specified level.
     * Accepts the same arguments as the corresponding console method.
     * @param {keyof typeof LEVELS} level - The log level to use
     * @param  {...any} args - Arguments passed through to the console method
     */
    log(level: keyof typeof LEVELS, ...args: any[]): void;
    /**
     * @param  {...any} args - Arguments passed through to console.debug
     */
    debug(...args: any[]): void;
    /**
     * @param  {...any} args - Arguments passed through to console.error
     */
    error(...args: any[]): void;
    /**
     * @param  {...any} args - Arguments passed through to console.info
     */
    info(...args: any[]): void;
    /**
     * @param  {...any} args - Arguments passed through to console.warn
     */
    warn(...args: any[]): void;
    /**
     * @param  {...any} args - Arguments passed through to console.error
     */
    fatal(...args: any[]): void;
};
export default log;
//# sourceMappingURL=index.d.ts.map