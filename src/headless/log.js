import * as strophe from 'strophe.js/src/core';
import { get, isElement } from 'lodash';

const Strophe = strophe.default.Strophe;

const logger = Object.assign({
    'debug': get(console, 'log') ? console.log.bind(console) : function noop () {},
    'error': get(console, 'log') ? console.log.bind(console) : function noop () {},
    'info': get(console, 'log') ? console.log.bind(console) : function noop () {},
    'warn': get(console, 'log') ? console.log.bind(console) : function noop () {}
}, console);


/**
 * The log namespace
 * @namespace log
 */
const log = {

    /**
     * Initialize the logger by setting the loglevel
     * @method log#initialize
     * @param { string } message - The message to be logged
     * @param { integer } level - The loglevel which allows for filtering of log messages
     */
    initialize (loglevel) {
        this.loglevel = loglevel;
    },

    /**
     * Logs messages to the browser's developer console.
     * Available loglevels are 0 for 'debug', 1 for 'info', 2 for 'warn',
     * 3 for 'error' and 4 for 'fatal'.
     * When using the 'error' or 'warn' loglevels, a full stacktrace will be
     * logged as well.
     * @method log#log
     * @param { string } message - The message to be logged
     * @param { integer } level - The loglevel which allows for filtering of log messages
     */
    log (message, level, style='') {
        if (level === Strophe.LogLevel.ERROR || level === Strophe.LogLevel.FATAL) {
            style = style || 'color: maroon';
        } else if (level === Strophe.LogLevel.DEBUG) {
            style = style || 'color: green';
        }

        if (message instanceof Error) {
            message = message.stack;
        } else if (isElement(message)) {
            message = message.outerHTML;
        }
        const prefix = style ? '%c' : '';
        if (level === Strophe.LogLevel.ERROR) {
            logger.error(`${prefix} ERROR: ${message}`, style);
        } else if (level === Strophe.LogLevel.WARN) {
            logger.warn(`${prefix} ${(new Date()).toISOString()} WARNING: ${message}`, style);
        } else if (level === Strophe.LogLevel.FATAL) {
            logger.error(`${prefix} FATAL: ${message}`, style);
        } else if (this.loglevel === Strophe.LogLevel.DEBUG && level === Strophe.LogLevel.DEBUG) {
            logger.debug(`${prefix} ${(new Date()).toISOString()} DEBUG: ${message}`, style);
        } else if (this.loglevel === Strophe.LogLevel.INFO) {
            logger.info(`${prefix} ${(new Date()).toISOString()} INFO: ${message}`, style);
        }
    },

    debug (message) {
        this.log(message, Strophe.LogLevel.DEBUG);
    },

    error (message) {
        this.log(message, Strophe.LogLevel.ERROR);
    },

    info (message) {
        this.log(message, Strophe.LogLevel.INFO);
    },

    warn (message) {
        this.log(message, Strophe.LogLevel.WARN);
    },

    fatal (message) {
        this.log(message, Strophe.LogLevel.FATAL);
    }
}

export default log;
