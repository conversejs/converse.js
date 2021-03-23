import { sprintf } from 'sprintf-js';

/**
 * @namespace i18n
 */
export default {
    initialize () {},

    /**
     * Overridable string wrapper method which can be used to provide i18n
     * support.
     *
     * The default implementation in @converse/headless simply calls sprintf
     * with the passed in arguments.
     *
     * If you install the full version of Converse, then this method gets
     * overwritten in src/i18n/index.js to return a translated string.
     * @method __
     * @private
     * @memberOf i18n
     * @param { String } str
     */
    __ (...args) {
        return sprintf(...args);
    }
};
