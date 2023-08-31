import i18n from './i18n.js';
import pluggable from 'pluggable.js/src/pluggable.js';
import { Events } from '@converse/skeletor/src/events.js';
import { getOpenPromise } from '@converse/openpromise';


/**
 * A private, closured object which contains the app context and exposes
 * a private api (via {@link _converse.api}).
 * @global
 * @namespace _converse
 */
const _converse = {
    promises: {
        'initialized': getOpenPromise()
    },

    // Set as module attr so that we can override in tests.
    // TODO: replace with config settings
    TIMEOUTS: {
        PAUSED: 10000,
        INACTIVE: 90000
    },

    default_connection_options: {'explicitResourceBinding': true},

    /**
     * Translate the given string based on the current locale.
     * @method __
     * @private
     * @memberOf _converse
     * @param { String } str
     */
    '__': (str, ...args) => i18n.__(str, ...args),

    /**
     * A no-op method which is used to signal to gettext that the passed in string
     * should be included in the pot translation file.
     *
     * In contrast to the double-underscore method, the triple underscore method
     * doesn't actually translate the strings.
     *
     * One reason for this method might be because we're using strings we cannot
     * send to the translation function because they require variable interpolation
     * and we don't yet have the variables at scan time.
     *
     * @method ___
     * @private
     * @memberOf _converse
     * @param { String } str
     */
    '___': str => str
}

// Make _converse an event emitter
Object.assign(_converse, Events);

// Make _converse pluggable
pluggable.enable(_converse, '_converse', 'pluggable');

export default _converse;
