/**
 * @module:shared.converse
 * @typedef {import('@converse/skeletor/src/storage').Storage} Storage
 * @typedef {import('@converse/skeletor').Collection} Collection
 * @typedef {import('../plugins/disco/index').DiscoState} DiscoState
 * @typedef {import('../plugins/status/status').default} XMPPStatus
 * @typedef {import('../plugins/vcard/vcard').default} VCards
 */
import log from '../log.js';
import i18n from './i18n.js';
import pluggable from 'pluggable.js/src/pluggable.js';
import { EventEmitter, Model } from '@converse/skeletor';
import { getOpenPromise } from '@converse/openpromise';
import { isTestEnv } from '../utils/session.js';

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


const DEPRECATED_ATTRS = {
    chatboxes: null,
    bookmarks: null,

    ANONYMOUS,
    CLOSED,
    EXTERNAL,
    LOGIN,
    LOGOUT,
    OPENED,
    PREBIND,
    SUCCESS,
    FAILURE,
    INACTIVE,
    ACTIVE,
    COMPOSING,
    PAUSED,
    GONE,
}


/**
 * A private, closured namespace containing the private api (via {@link _converse.api})
 * as well as private methods and internal data-structures.
 * @global
 * @namespace _converse
 */
class ConversePrivateGlobal extends EventEmitter(Object) {

    constructor () {
        super();
        const proxy = new Proxy(this, {
            get: (target, key) => {
                if (!isTestEnv() && typeof key === 'string') {
                    if (Object.keys(DEPRECATED_ATTRS).includes(key)) {
                        log.warn(`Accessing ${key} on _converse is DEPRECATED`);
                    }
                }
                return Reflect.get(target, key)
            }
        });
        proxy.initialize();
        return proxy;
    }

    initialize () {
        this.VERSION_NAME = VERSION_NAME;

        this.strict_plugin_dependencies = false;

        this.pluggable = null;

        this.templates = {};

        this.storage = /** @type {Record<string, Storage.LocalForage>} */{};

        this.promises = {
            'initialized': getOpenPromise(),
        };

        this.DEFAULT_IMAGE_TYPE = DEFAULT_IMAGE_TYPE;
        this.DEFAULT_IMAGE = DEFAULT_IMAGE;

        this.NUM_PREKEYS = 100; // DEPRECATED. Set here so that tests can override

        // Set as module attr so that we can override in tests.
        // TODO: replace with config settings
        this.TIMEOUTS =  {
            PAUSED: 10000,
            INACTIVE: 90000
        };

        Object.assign(this, DEPRECATED_ATTRS);

        this.api = /** @type {module:shared-api.APIEndpoint} */ null;

        /**
         * Namespace for storing translated strings.
         *
         * @typedef {Record<string, string>} UserMessage
         * @typedef {Record<string, string|UserMessage>} UserMessages
         */
        this.labels = /** @type {UserMessages} */({});

        /**
         * Namespace for storing code that might be useful to 3rd party
         * plugins. We want to make it possible for 3rd party plugins to have
         * access to code (e.g. classes) from converse.js without having to add
         * converse.js as a dependency.
         */
        this.exports = /** @type {Record<string, Object>} */({});

        /**
         * Namespace for storing the state, as represented by instances of
         * Models and Collections.
         *
         * @typedef {Object & Record<string, Collection|Model|VCards|XMPPStatus|DiscoState>} ConverseState
         * @property {VCards} [vcards]
         * @property {XMPPStatus} xmppstatus
         * @property {DiscoState} disco
         */
        this.state = /** @type {ConverseState} */({});

        this.initSession();
    }

    initSession () {
        this.session?.destroy();
        this.session = new Model();

        // XXX DEPRECATED
        Object.assign(
            this, {
                jid: undefined,
                bare_jid: undefined,
                domain: undefined,
                resource: undefined
            }
        );
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
