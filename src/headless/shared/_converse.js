import i18n from '@converse/headless/shared/i18n';
import log from '@converse/headless/log';
import { CONNECTION_STATUS } from '@converse/headless/shared/constants';
import { Router } from '@converse/skeletor/src/router.js';
import { TimeoutError } from '@converse/headless/shared/errors';
import { createStore, getDefaultStore } from '@converse/headless/utils/storage.js';
import { getInitSettings } from '@converse/headless/shared/settings/utils.js';
import { getOpenPromise } from '@converse/openpromise';


/**
 * A private, closured object containing the private api (via {@link _converse.api})
 * as well as private methods and internal data-structures.
 * @global
 * @namespace _converse
 */
const _converse = {
    log,
    CONNECTION_STATUS,
    templates: {},
    promises: {
        'initialized': getOpenPromise()
    },

    STATUS_WEIGHTS: {
        'offline':      6,
        'unavailable':  5,
        'xa':           4,
        'away':         3,
        'dnd':          2,
        'chat':         1, // We currently don't differentiate between "chat" and "online"
        'online':       1
    },
    ANONYMOUS: 'anonymous',
    CLOSED: 'closed',
    EXTERNAL: 'external',
    LOGIN: 'login',
    LOGOUT: 'logout',
    OPENED: 'opened',
    PREBIND: 'prebind',

    /**
     * @constant
     * @type { integer }
     */
    STANZA_TIMEOUT: 20000,

    SUCCESS: 'success',
    FAILURE: 'failure',

    // Generated from css/images/user.svg
    DEFAULT_IMAGE_TYPE: 'image/svg+xml',
    DEFAULT_IMAGE: "PD94bWwgdmVyc2lvbj0iMS4wIj8+CjxzdmcgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiA8cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iIzU1NSIvPgogPGNpcmNsZSBjeD0iNjQiIGN5PSI0MSIgcj0iMjQiIGZpbGw9IiNmZmYiLz4KIDxwYXRoIGQ9Im0yOC41IDExMiB2LTEyIGMwLTEyIDEwLTI0IDI0LTI0IGgyMyBjMTQgMCAyNCAxMiAyNCAyNCB2MTIiIGZpbGw9IiNmZmYiLz4KPC9zdmc+Cg==",

    TIMEOUTS: {
        // Set as module attr so that we can override in tests.
        PAUSED: 10000,
        INACTIVE: 90000
    },

    // XEP-0085 Chat states
    // https://xmpp.org/extensions/xep-0085.html
    INACTIVE: 'inactive',
    ACTIVE: 'active',
    COMPOSING: 'composing',
    PAUSED: 'paused',
    GONE: 'gone',

    // Chat types
    PRIVATE_CHAT_TYPE: 'chatbox',
    CHATROOMS_TYPE: 'chatroom',
    HEADLINES_TYPE: 'headline',
    CONTROLBOX_TYPE: 'controlbox',

    default_connection_options: {'explicitResourceBinding': true},
    router: new Router(),

    TimeoutError: TimeoutError,

    isTestEnv: () => {
        return getInitSettings()['bosh_service_url'] === 'montague.lit/http-bind';
    },

    getDefaultStore,
    createStore,

    /**
     * Translate the given string based on the current locale.
     * @method __
     * @private
     * @memberOf _converse
     * @param { String } str
     */
    '__': (...args) => i18n.__(...args),

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

export default _converse;
