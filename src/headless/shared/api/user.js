/**
 * @module:shared.api.user
 */
import _converse from '../_converse.js';
import log from '@converse/log';
import presence_api from './presence.js';
import connection_api from '../connection/api.js';
import { endSession } from '../../utils/session.js';
import { attemptNonPreboundSession, resumeSession, setUserJID } from '../../utils/init.js';
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
         * If called without any parameters, Converse will try to log the
         * user in with credentials from a plugin (see the
         * `beforeAttemptNonPreboundSession` hook), or by calling the
         * `prebind_url` if prebinding is used.
         *
         * @method _converse.api.user.login
         * @param { string } [jid]
         * @param { string } [password]
         * @param { import('./types').LoginOptions|boolean } [options] - With
         *  `automatic`, Converse logs in by itself once the connection has
         *  been initialized. It's used together with the `auto_login`
         *  configuration flag to determine whether Converse should try to log
         *  the user in if it fails to restore a previous auth'd session.
         *  Passing `automatic` as a boolean is deprecated.
         * @returns { Promise<void> }
         * @example _converse.api.user.login(jid, password, { automatic: true });
         */
        async login(jid, password, options = {}) {
            const automatic = typeof options === 'boolean' ? options : !!options?.automatic;
            const { api } = _converse;
            jid = jid || api.settings.get('jid');

            const connection = connection_api.init(jid);

            // `api.connection.retry()` leaves a login alone that's still getting ready.
            return connection.whilePreparing(async () => {
                /**
                 * *Hook* through which a plugin attaches to a session that
                 * already exists elsewhere, such as one held by a shared
                 * worker, before anything else is done to log in. A plugin
                 * that attached sets `attached` on the payload.
                 * @event _converse#attachSession
                 * @param {null} context
                 * @param {import('./types').AttachSessionPayload} payload
                 */
                const { attached } = await api.hook('attachSession', null, { attached: false });
                if (attached) return;

                if (jid) {
                    jid = await setUserJID(jid);
                }
                // Only a start-up resumes a session. A login from the form is
                // checked by the server before anything is loaded.
                let credentials = null;
                if (automatic) {
                    const resumed = await resumeSession(jid, password);
                    if (resumed?.credentials) {
                        // Kept whole, so that they stay renewable if their source said so.
                        credentials = resumed.credentials;
                        ({ jid, password } = credentials);
                    }
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
                if (!credentials && jid && password) credentials = { jid, password };
                await attemptNonPreboundSession(credentials, automatic);
            });
        },

        /**
         * Logs the user out of the current XMPP session.
         *
         * This device then forgets the session, so that the next start doesn't
         * resume it. A client that is merely closing, rather than being logged
         * out of, passes `remember`, so that its next start resumes the session
         * (see the `auto_reconnect` setting).
         * @method _converse.api.user.logout
         * @param {object} [options]
         * @param {boolean} [options.remember=false] - Whether to keep remembering the session.
         * @example _converse.api.user.logout();
         */
        async logout({ remember = false } = {}) {
            const { api } = _converse;
            /**
             * Triggered before the user is logged out
             * @event _converse#beforeLogout
             */
            await api.trigger('beforeLogout', { 'synchronous': true });

            const promise = getOpenPromise();
            const complete = () =>
                endSession(_converse, { remember })
                    .catch((e) => log.error(e))
                    .finally(() => promise.resolve());

            const connection = connection_api.get();
            if (connection) {
                connection.setDisconnectionCause(LOGOUT, undefined, true);
                api.listen.once('disconnected', () => complete());
                if (connection.connect_callback) {
                    connection.disconnect();
                } else {
                    // A session resumed from the cache can be logged out of
                    // before Strophe was asked to connect. It then has nothing
                    // to tear down, and no callback to report through.
                    connection.finishDisconnection();
                }
            } else {
                complete();
            }
            return promise;
        },
    },
};

export default api;
