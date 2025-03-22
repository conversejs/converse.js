/**
 * @param {unknown} el - The value to check
 * @returns {boolean} True if the value is an Element or Document
 */
export function isElement(el: unknown): boolean;
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
     * Logs a message at the specified level with optional CSS styling
     * @param {any} message - The message to log
     * @param {keyof LEVELS} level - The log level to use
     * @param {string} [style=""] - Optional CSS styles to apply to the log message
     */
    function log(message: any, level: string | number, style?: string): void;
    /**
     * @param {any} message - The message to log
     * @param {string} [style=""] - Optional CSS styles to apply to the log message
     */
    function debug(message: any, style?: string): void;
    /**
     * @param {any} message - The message to log
     * @param {string} [style=""] - Optional CSS styles to apply to the log message
     */
    function error(message: any, style?: string): void;
    /**
     * @param {any} message - The message to log
     * @param {string} [style=""] - Optional CSS styles to apply to the log message
     */
    function info(message: any, style?: string): void;
    /**
     * @param {any} message - The message to log
     * @param {string} [style=""] - Optional CSS styles to apply to the log message
     */
    function warn(message: any, style?: string): void;
    /**
     * @param {any} message - The message to log
     * @param {string} [style=""] - Optional CSS styles to apply to the log message
     */
    function fatal(message: any, style?: string): void;
}
//# sourceMappingURL=index.d.ts.map