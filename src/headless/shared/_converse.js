/**
 * @module:shared_converse
 */
import i18n from './i18n.js';
import pluggable from 'pluggable.js/src/pluggable.js';
import { EventEmitter, Model } from '@converse/skeletor';
import { getOpenPromise } from '@converse/openpromise';

import {
    ACTIVE,
    ANONYMOUS,
    CLOSED,
    COMPOSING,
    DEFAULT_IMAGE,
    DEFAULT_IMAGE_TYPE,
    EXTERNAL,
    FAILURE,
    GONE,
    INACTIVE,
    LOGIN,
    LOGOUT,
    OPENED,
    PAUSED,
    PREBIND,
    SUCCESS,
    VERSION_NAME
} from './constants';


/**
 * A private, closured namespace containing the private api (via {@link _converse.api})
 * as well as private methods and internal data-structures.
 * @global
 * @namespace _converse
 */
class ConversePrivateGlobal extends EventEmitter(Object) {

    constructor () {
        super();

        this.VERSION_NAME = VERSION_NAME;

        this.templates = {};
        this.promises = {
            'initialized': getOpenPromise()
        };

        this.ANONYMOUS = ANONYMOUS;
        this.CLOSED = CLOSED;
        this.EXTERNAL = EXTERNAL;
        this.LOGIN = LOGIN;
        this.LOGOUT = LOGOUT;
        this.OPENED = OPENED;
        this.PREBIND = PREBIND;

        this.SUCCESS = SUCCESS;
        this.FAILURE = FAILURE;

        this.DEFAULT_IMAGE_TYPE = DEFAULT_IMAGE_TYPE;
        this.DEFAULT_IMAGE = DEFAULT_IMAGE;

        this.INACTIVE = INACTIVE;
        this.ACTIVE = ACTIVE;
        this.COMPOSING = COMPOSING;
        this.PAUSED = PAUSED;
        this.GONE = GONE;

        // Set as module attr so that we can override in tests.
        // TODO: replace with config settings
        this.TIMEOUTS =  {
            PAUSED: 10000,
            INACTIVE: 90000
        };

        // TODO: DEPRECATED
        this.bookmarks = null;
        this.chatboxes = null;

        this.api = /** @type {module:shared-api.APIEndpoint} */ null;

        /**
         * Namespace for storing code that might be useful to 3rd party
         * plugins. We want to make it possible for 3rd party plugins to have
         * access to code (e.g. classes) from converse.js without having to add
         * converse.js as a dependency.
         */
        this.exports = /** @type {Record<string, Object>} */{};

        /**
         * Namespace for storing the state, as represented by instances of
         * Models and Collections.
         */
        this.state = /** @type {Record<string, Model|Collection>} */{};

        this.initSession();
    }

    initSession () {
        this.session?.destroy();
        this.session = new Model();
    }

    /**
     * Translate the given string based on the current locale.
     * @method __
     * @memberOf _converse
     * @param {...String} args
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
     * @param {String} str
     */
    ___ (str) {
        return str;
    }
}

const _converse = new ConversePrivateGlobal();

// Make _converse pluggable
pluggable.enable(_converse, '_converse', 'pluggable');

export default _converse;
