import _converse from '../_converse.js';
import presence_api from './presence.js';
import u, { replacePromise } from '../../utils/core.js';
import { attemptNonPreboundSession, initConnection, setUserJID } from '../../utils/init.js';
import { getOpenPromise } from '@converse/openpromise';
import { user_settings_api } from '../settings/api.js';
import { LOGOUT, PREBIND } from '../constants.js';

export default {
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
        jid () {
            return _converse.connection.jid;
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
        async login (jid, password, automatic=false) {
            const { api } = _converse;
            jid = jid || api.settings.get('jid');
            if (!_converse.connection?.jid || (jid && !u.isSameDomain(_converse.connection.jid, jid))) {
                initConnection();
            }
            if (api.settings.get("connection_options")?.worker && (await _converse.connection.restoreWorkerSession())) {
                return;
            }
            if (jid) {
                jid = await setUserJID(jid);
            }

            // See whether there is a BOSH session to re-attach to
            const bosh_plugin = _converse.pluggable.plugins['converse-bosh'];
            if (bosh_plugin?.enabled()) {
                if (await _converse.restoreBOSHSession()) {
                    return;
                } else if (api.settings.get("authentication") === PREBIND && (!automatic || api.settings.get("auto_login"))) {
                    return _converse.startNewPreboundBOSHSession();
                }
            }
            password = password || api.settings.get("password");
            const credentials = (jid && password) ? { jid, password } : null;
            attemptNonPreboundSession(credentials, automatic);
        },

        /**
         * Logs the user out of the current XMPP session.
         * @method _converse.api.user.logout
         * @example _converse.api.user.logout();
         */
        async logout () {
            const { api } = _converse;
            /**
             * Triggered before the user is logged out
             * @event _converse#beforeLogout
             */
            await api.trigger('beforeLogout', {'synchronous': true});

            const promise = getOpenPromise();
            const complete = () => {
                // Recreate all the promises
                Object.keys(_converse.promises).forEach(replacePromise);
                delete _converse.jid

                // Remove the session JID, otherwise the user would just be logged
                // in again upon reload. See #2759
                localStorage.removeItem('conversejs-session-jid');

                /**
                 * Triggered once the user has logged out.
                 * @event _converse#logout
                 */
                api.trigger('logout');
                promise.resolve();
            }

            _converse.connection.setDisconnectionCause(LOGOUT, undefined, true);
            if (_converse.connection !== undefined) {
                api.listen.once('disconnected', () => complete());
                _converse.connection.disconnect();
            } else {
                complete();
            }
            return promise;
        }
    }
}
