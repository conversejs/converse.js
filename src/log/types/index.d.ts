/**
 * @type {Object.<string, number>}
 */
export const LEVELS: {
    [x: string]: number;
};
export default log;
declare namespace log {
    let loglevel: string | number;
    /**
     * Sets the current log level which determines which messages are logged
     * @param {keyof LEVELS} level - The log level to set
     * @throws {Error} If an invalid log level is provided
     */
    function setLogLevel(level: string | number): void;
    /**
     * Logs a message at the specified level.
     * Accepts the same arguments as the corresponding console method.
     * @param {keyof LEVELS} level - The log level to use
     * @param  {...any} args - Arguments passed through to the console method
     */
    function log(level: string | number, ...args: any[]): void;
    /**
     * @param  {...any} args - Arguments passed through to console.debug
     */
    function debug(...args: any[]): void;
    /**
     * @param  {...any} args - Arguments passed through to console.error
     */
    function error(...args: any[]): void;
    /**
     * @param  {...any} args - Arguments passed through to console.info
     */
    function info(...args: any[]): void;
    /**
     * @param  {...any} args - Arguments passed through to console.warn
     */
    function warn(...args: any[]): void;
    /**
     * @param  {...any} args - Arguments passed through to console.error
     */
    function fatal(...args: any[]): void;
}
//# sourceMappingURL=index.d.ts.map