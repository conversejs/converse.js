import i18n from './i18n.js';
import pluggable from 'pluggable.js/src/pluggable.js';
import { EventEmitter } from '@converse/skeletor';
import { getOpenPromise } from '@converse/openpromise';

import {
    ACTIVE,
    ANONYMOUS,
    CHATROOMS_TYPE,
    CLOSED,
    COMPOSING,
    CONTROLBOX_TYPE,
    DEFAULT_IMAGE,
    DEFAULT_IMAGE_TYPE,
    EXTERNAL,
    FAILURE,
    GONE,
    HEADLINES_TYPE,
    INACTIVE,
    LOGIN,
    LOGOUT,
    OPENED,
    PAUSED,
    PREBIND,
    PRIVATE_CHAT_TYPE,
    SUCCESS,
    VERSION_NAME
} from './constants';


/**
 * A private, closured namespace containing the private api (via {@link _converse.api})
 * as well as private methods and internal data-structures.
 * @global
 * @namespace _converse
 */
class ConverseNamespace extends EventEmitter(Object) {

    constructor () {
        super();

        this.VERSION_NAME = VERSION_NAME;

        this.templates = {};
        this.promises = {
            'initialized': getOpenPromise()
        };


        Object.assign(this, {
            ANONYMOUS,
            CLOSED,
            EXTERNAL,
            LOGIN,
            LOGOUT,
            OPENED,
            PREBIND,

            SUCCESS,
            FAILURE,

            DEFAULT_IMAGE_TYPE,
            DEFAULT_IMAGE,

            INACTIVE,
            ACTIVE,
            COMPOSING,
            PAUSED,
            GONE,

            PRIVATE_CHAT_TYPE,
            CHATROOMS_TYPE,
            HEADLINES_TYPE,
            CONTROLBOX_TYPE,

            // Set as module attr so that we can override in tests.
            // TODO: replace with config settings
            TIMEOUTS: {
                PAUSED: 10000,
                INACTIVE: 90000
            },
        });
    }

    /**
     * Translate the given string based on the current locale.
     * @method __
     * @memberOf _converse
     * @param { ...String } args
     */
    __ (...args) {
        return i18n.__(...args);
    }

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
     * @memberOf _converse
     * @param { String } str
     */
    ___ (str) {
        return str;
    }
}

const _converse = new ConverseNamespace();

// Make _converse pluggable
pluggable.enable(_converse, '_converse', 'pluggable');

export default _converse;
