import { isElement } from './utils/html.js';

export const LEVELS = {
    'debug': 0,
    'info': 1,
    'warn': 2,
    'error': 3,
    'fatal': 4
}

/* eslint-disable @typescript-eslint/no-empty-function */
const logger = Object.assign({
    'debug': console?.log ? console.log.bind(console) : function noop () {},
    'error': console?.log ? console.log.bind(console) : function noop () {},
    'info': console?.log ? console.log.bind(console) : function noop () {},
    'warn': console?.log ? console.log.bind(console) : function noop () {}
}, console);
/* eslint-enable @typescript-eslint/no-empty-function */


/**
 * The log namespace
 * @namespace log
 */
export default {

    /**
     * The the log-level, which determines how verbose the logging is.
     * @method log#setLogLevel
     * @param {keyof LEVELS} level - The loglevel which allows for filtering of log messages
     */
    setLogLevel (level) {
        if (!['debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
            throw new Error(`Invalid loglevel: ${level}`);
        }
        this.loglevel = level;
    },

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
    log (message, level, style='') {
        if (LEVELS[level] < LEVELS[this.loglevel]) {
            return;
        }
        if (level === 'error' || level === 'fatal') {
            style = style || 'color: maroon';
        } else if (level === 'debug') {
            style = style || 'color: green';
        }

        if (message instanceof Error) {
            message = message.stack;
        } else if (isElement(message)) {
            message = /** @type {Element} */(message).outerHTML;
        }
        const prefix = style ? '%c' : '';
        if (level === 'error') {
            logger.error(`${prefix} ERROR: ${message}`, style);
        } else if (level === 'warn') {
            logger.warn(`${prefix} ${(new Date()).toISOString()} WARNING: ${message}`, style);
        } else if (level === 'fatal') {
            logger.error(`${prefix} FATAL: ${message}`, style);
        } else if (level === 'debug') {
            logger.debug(`${prefix} ${(new Date()).toISOString()} DEBUG: ${message}`, style);
        } else {
            logger.info(`${prefix} ${(new Date()).toISOString()} INFO: ${message}`, style);
        }
    },

    debug (message, style) {
        this.log(message, 'debug', style);
    },

    error (message, style) {
        this.log(message, 'error', style);
    },

    info (message, style) {
        this.log(message, 'info', style);
    },

    warn (message, style) {
        this.log(message, 'warn', style);
    },

    fatal (message, style) {
        this.log(message, 'fatal', style);
    }
}
