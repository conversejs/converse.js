export default log;
declare namespace log {
    /**
     * The the log-level, which determines how verbose the logging is.
     * @method log#setLogLevel
     * @param { number } level - The loglevel which allows for filtering of log messages
     */
    function setLogLevel(level: number): void;
    /**
     * Logs messages to the browser's developer console.
     * Available loglevels are 0 for 'debug', 1 for 'info', 2 for 'warn',
     * 3 for 'error' and 4 for 'fatal'.
     * When using the 'error' or 'warn' loglevels, a full stacktrace will be
     * logged as well.
     * @method log#log
     * @param { string | Error } message - The message to be logged
     * @param { number } level - The loglevel which allows for filtering of log messages
     */
    function log(message: string | Error, level: number, style?: string): void;
    function debug(message: any, style: any): void;
    function error(message: any, style: any): void;
    function info(message: any, style: any): void;
    function warn(message: any, style: any): void;
    function fatal(message: any, style: any): void;
}
