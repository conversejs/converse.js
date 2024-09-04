export namespace LEVELS {
    let debug: number;
    let info: number;
    let warn: number;
    let error: number;
    let fatal: number;
}
declare namespace _default {
    /**
     * The the log-level, which determines how verbose the logging is.
     * @method log#setLogLevel
     * @param {keyof LEVELS} level - The loglevel which allows for filtering of log messages
     */
    function setLogLevel(level: "debug" | "error" | "info" | "warn" | "fatal"): void;
    /**
     * Logs messages to the browser's developer console.
     * Available loglevels are 0 for 'debug', 1 for 'info', 2 for 'warn',
     * 3 for 'error' and 4 for 'fatal'.
     * When using the 'error' or 'warn' loglevels, a full stacktrace will be
     * logged as well.
     * @method log#log
     * @param {string|Element|Error} message - The message to be logged
     * @param {string} level - The loglevel which allows for filtering of log messages
     */
    function log(message: string | Element | Error, level: string, style?: string): void;
    function debug(message: any, style: any): void;
    function error(message: any, style: any): void;
    function info(message: any, style: any): void;
    function warn(message: any, style: any): void;
    function fatal(message: any, style: any): void;
}
export default _default;
//# sourceMappingURL=log.d.ts.map