/**
 * @typedef {module:shared-api-public.ConversePrivateGlobal} ConversePrivateGlobal
 */
import { sprintf } from 'sprintf-js';
import dayjs from 'dayjs';
import sizzle from 'sizzle';
import URI from 'urijs';
import { Stanza, Strophe, $build, $iq, $msg, $pres, stx } from 'strophe.js';
import { Collection, Model } from "@converse/skeletor";
import { filesize } from 'filesize';
import { html } from 'lit';

import api from './index.js';
import _converse from '../_converse.js';
import i18n from '../i18n';
import log from "@converse/log";
import ConnectionFeedback from './../connection/feedback.js';
import u, { setLogLevelFromRoute } from '../../utils/index.js';
import { ANONYMOUS, CHAT_STATES, KEYCODES, VERSION_NAME } from '../constants.js';
import { isTestEnv } from '../../utils/session.js';
import { TimeoutError } from '../errors.js';
import { initAppSettings } from '../settings/utils.js';
import * as errors from '../errors.js';

_converse.api = api;

import {
    cleanup,
    initClientConfig,
    initPlugins,
    initSessionStorage,
    registerGlobalEventHandlers,
} from '../../utils/init.js';

/**
 * @typedef {Window & {converse: ConversePrivateGlobal} } window
 *
 * ### The Public API
 *
 * This namespace contains public API methods which are are
 * accessible on the global `converse` object.
 * They are public, because any JavaScript in the
 * page can call them. Public methods therefore don’t expose any sensitive
 * or closured data. To do that, you’ll need to create a plugin, which has
 * access to the private API method.
 *
 * @global
 * @namespace converse
 */
const converse = Object.assign(/** @type {ConversePrivateGlobal} */(window).converse || {}, {

    CHAT_STATES,

    keycodes: KEYCODES,

    /**
     * Public API method which initializes Converse.
     * This method must always be called when using Converse.
     * @async
     * @memberOf converse
     * @method initialize
     * @param { object } settings A map of [configuration-settings](https://conversejs.org/docs/html/configuration.html#configuration-settings).
     * @example
     * converse.initialize({
     *     auto_list_rooms: false,
     *     auto_subscribe: false,
     *     bosh_service_url: 'https://bind.example.com',
     *     hide_muc_server: false,
     *     i18n: 'en',
     *     play_sounds: true,
     *     show_controlbox_by_default: true,
     *     debug: false,
     *     roster_groups: true
     * });
     */
    async initialize (settings) {
        const { api } = _converse;
        await cleanup(_converse);

        initAppSettings(settings);
        _converse.strict_plugin_dependencies = settings.strict_plugin_dependencies; // Needed by pluggable.js
        log.setLogLevel(api.settings.get("loglevel"));

        if (api.settings.get("authentication") === ANONYMOUS) {
            if (api.settings.get("auto_login") && !api.settings.get('jid')) {
                throw new Error("Config Error: you need to provide the server's " +
                      "domain via the 'jid' option when using anonymous " +
                      "authentication with auto_login.");
            }
        }

        setLogLevelFromRoute();
        addEventListener('hashchange', setLogLevelFromRoute);

        const connfeedback = new ConnectionFeedback();
        Object.assign(_converse, { connfeedback }); // XXX: DEPRECATED
        Object.assign(_converse.state, { connfeedback });

        await initSessionStorage(_converse);
        await initClientConfig(_converse);
        await i18n.initialize();
        initPlugins(_converse);

        // Register all custom elements
        // XXX: api.elements is defined in the UI part of Converse, outside of @converse/headless.
        // This line should probably be moved to the UI code as part of a larger refactoring.
        api.elements?.register();

        registerGlobalEventHandlers(_converse);

        const plugins = _converse.pluggable.plugins
        if (api.settings.get("auto_login") || api.settings.get("keepalive") && plugins['converse-bosh']?.enabled()) {
            await api.user.login(null, null, true);
        }

        /**
         * Triggered once converse.initialize has finished.
         * @event _converse#initialized
         */
        api.trigger('initialized');

        if (isTestEnv()) {
            return _converse;
        }
    },

    /**
     * Exposes methods for adding and removing plugins. You'll need to write a plugin
     * if you want to have access to the private API methods defined further down below.
     *
     * For more information on plugins, read the documentation on [writing a plugin](/docs/html/plugin_development.html).
     * @namespace plugins
     * @memberOf converse
     */
    plugins: {
        /**
         * Registers a new plugin.
         * @method converse.plugins.add
         * @param { string } name The name of the plugin
         * @param { object } plugin The plugin object
         * @example
         *  const plugin = {
         *      initialize: function () {
         *          // Gets called as soon as the plugin has been loaded.
         *
         *          // Inside this method, you have access to the private
         *          // API via `_covnerse.api`.
         *
         *          // The private _converse object contains the core logic
         *          // and data-structures of Converse.
         *      }
         *  }
         *  converse.plugins.add('myplugin', plugin);
         */
        add (name, plugin) {
            plugin.__name__ = name;
            if (_converse.pluggable.plugins[name] !== undefined) {
                throw new TypeError(
                    `Error: plugin with name "${name}" has already been ` + 'registered!'
                );
            } else {
                _converse.pluggable.plugins[name] = plugin;
            }
        }

    },
    /**
     * Utility methods and globals from bundled 3rd party libraries.
     * @typedef ConverseEnv
     * @property {Error} converse.env.TimeoutError
     * @property {function} converse.env.$build    - Creates a Strophe.Builder, for creating stanza objects.
     * @property {function} converse.env.$iq       - Creates a Strophe.Builder with an <iq/> element as the root.
     * @property {function} converse.env.$msg      - Creates a Strophe.Builder with an <message/> element as the root.
     * @property {function} converse.env.$pres     - Creates a Strophe.Builder with an <presence/> element as the root.
     * @property {function} converse.env.Promise   - The Promise implementation used by Converse.
     * @property {function} converse.env.Strophe   - The [Strophe](http://strophe.im/strophejs) XMPP library used by Converse.
     * @property {function} converse.env.f         - And instance of Lodash with its methods wrapped to produce immutable auto-curried iteratee-first data-last methods.
     * @property {function} converse.env.sizzle    - [Sizzle](https://sizzlejs.com) CSS selector engine.
     * @property {function} converse.env.sprintf
     * @property {object} converse.env._           - The instance of [lodash-es](http://lodash.com) used by Converse.
     * @property {object} converse.env.dayjs       - [DayJS](https://github.com/iamkun/dayjs) date manipulation library.
     * @property {Array<Error>} converse.env.errors
     * @memberOf converse
     */
    'env': {
        $build,
        $iq,
        $msg,
        $pres,
        'utils': u,
        Collection,
        Model,
        Promise,
        Stanza,
        Strophe,
        TimeoutError,
        URI,
        VERSION_NAME,
        dayjs,
        errors,
        filesize,
        html,
        log,
        sizzle,
        sprintf,
        stx,
        u,
    }
});

export default converse;
