/**
 * @module:shared.api.user
 */
import _converse from '../_converse.js';
import presence_api from './presence.js';
import connection_api from '../connection/api.js';
import { replacePromise } from '../../utils/session.js';
import { attemptNonPreboundSession, setUserJID } from '../../utils/init.js';
import { getOpenPromise } from '@converse/openpromise';
import { user_settings_api } from '../settings/user/api.js';
import { LOGOUT } from '../constants.js';

const api = {
    /**
     * This grouping collects API functions related to the current logged in user.
     *
     * @namespace _converse.api.user
     * @memberOf _converse.api
     */
    user: {
        settings: user_settings_api,
        ...presence_api,

        /**
         * @method _converse.api.user.jid
         * @returns {string} The current user's full JID (Jabber ID)
         * @example _converse.api.user.jid())
         */
        jid() {
            return connection_api.get()?.jid;
        },

        /**
         * Logs the user in.
         *
         * If called without any parameters, Converse will try
         * to log the user in by calling the `prebind_url` or `credentials_url` depending
         * on whether prebinding is used or not.
         *
         * @method _converse.api.user.login
         * @param { string } [jid]
         * @param { string } [password]
         * @param { boolean } [automatic=false] - An internally used flag that indicates whether
         *  this method was called automatically once the connection has been
         *  initialized. It's used together with the `auto_login` configuration flag
         *  to determine whether Converse should try to log the user in if it
         *  fails to restore a previous auth'd session.
         *  @returns  { Promise<void> }
         */
        async login(jid, password, automatic = false) {
            const { api } = _converse;
            jid = jid || api.settings.get('jid');

            const connection = connection_api.init(jid);

            if (api.settings.get('connection_options')?.worker && (await connection.restoreWorkerSession())) {
                return;
            }
            if (jid) {
                jid = await setUserJID(jid);
            }

            /**
             * *Hook* which allows 3rd party code to attempt logging in before
             * the core code attempts it.
             *
             * Note: If the hook handler has logged the user in, it should set the
             * `success` flag on the payload to `true`.
             *
             * @typedef {Object} LoginHookPayload
             * @property {string} jid
             * @property {string} password
             * @property {boolean} [automatic] - An internally used flag that indicates whether
             *  this method was called automatically once the connection has been initialized.
             * @property {boolean} [success] - A flag which indicates whether
             * login has succeeded. If a hook handler receives a payload with
             * this flag, it should NOT attempt to log in.
             * If a handler has successfully logged in, it should return the
             * payload with this flag set to true.
             *
             * @event _converse#login
             * @param {typeof api.user} context
             * @param {LoginHookPayload} payload
             */
            const { success } = await _converse.api.hook('login', this, { jid, password, automatic });
            if (success) return;

            password = password || api.settings.get('password');
            const credentials = jid && password ? { jid, password } : null;
            await attemptNonPreboundSession(credentials, automatic);
        },

        /**
         * Logs the user out of the current XMPP session.
         * @method _converse.api.user.logout
         * @example _converse.api.user.logout();
         */
        async logout() {
            const { api } = _converse;
            /**
             * Triggered before the user is logged out
             * @event _converse#beforeLogout
             */
            await api.trigger('beforeLogout', { 'synchronous': true });

            const promise = getOpenPromise();
            const complete = () => {
                // Recreate all the promises
                Object.keys(_converse.promises).forEach((p) => replacePromise(_converse, p));

                // Remove the session JID, otherwise the user would just be logged
                // in again upon reload. See #2759
                localStorage.removeItem('conversejs-session-jid');

                /**
                 * Triggered once the user has logged out.
                 * @event _converse#logout
                 */
                api.trigger('logout');
                promise.resolve();
            };

            const connection = connection_api.get();
            if (connection) {
                connection.setDisconnectionCause(LOGOUT, undefined, true);
                api.listen.once('disconnected', () => complete());
                connection.disconnect();
            } else {
                complete();
            }
            return promise;
        },
    },
};

export default api;
