import _converse from '../_converse.js';
import events_api from '../api/events.js';
import { Connection, MockConnection } from './index.js';
import { PREBIND } from '../constants.js';
import { getConnectionServiceURL, setStropheLogLevel } from './utils.js';
import { isSameDomain } from '../../utils/jid.js';
import { isTestEnv } from '../../utils/session.js';
import { settings_api } from '../settings/api.js';

let connection;

const default_connection_options = { 'explicitResourceBinding': true };

/**
 * This grouping collects API functions related to the XMPP connection.
 *
 * @namespace api.connection
 * @memberOf api
 */
export default {
    /**
     * @method api.connection.init
     * @memberOf api.connection
     * @param {string} [jid]
     * @return {Connection|MockConnection}
     */
    init(jid) {
        if (jid && connection?.jid && isSameDomain(connection.jid, jid)) return connection;

        if (settings_api.get('authentication') === PREBIND) {
            // Checked here, before logging in changes any state.
            if (!_converse.pluggable.initialized_plugins.includes('converse-bosh')) {
                throw new Error("authentication is set to 'prebind' but the converse-bosh plugin isn't loaded");
            }
            if (!settings_api.get('bosh_service_url')) {
                throw new Error("authentication is set to 'prebind' but we don't have a BOSH connection");
            }
        }
        if (
            settings_api.get('connection_options')?.worker &&
            !_converse.pluggable.initialized_plugins.includes('converse-shared-worker')
        ) {
            throw new Error("connection_options.worker is set but the converse-shared-worker plugin isn't loaded");
        }

        const XMPPConnection = isTestEnv() ? MockConnection : Connection;
        const user_options = settings_api.get('connection_options') ?? {};
        connection = new XMPPConnection(
            getConnectionServiceURL(),
            Object.assign(default_connection_options, user_options, {
                'keepalive': settings_api.get('keepalive'),
                // XEP-0198 Stream Management is handled natively by Strophe
                'enableStreamManagement': !!settings_api.get('enable_smacks'),
                'streamManagement': {
                    'maxUnacked': settings_api.get('smacks_max_unacked_stanzas') ?? 5,
                    // Let embedders (and tests) override e.g. the storage backend.
                    ...(user_options.streamManagement ?? {}),
                },
            }),
        );

        setStropheLogLevel();
        /**
         * Triggered once the `Connection` constructor has been initialized, which
         * will be responsible for managing the connection to the XMPP server.
         *
         * @event connectionInitialized
         */
        events_api.trigger('connectionInitialized');

        return connection;
    },

    /**
     * @method api.connection.get
     * @memberOf api.connection
     * @return {Connection|MockConnection}
     */
    get() {
        return connection;
    },

    destroy() {
        this.disconnect();
        connection?.disconnect();
        connection = undefined;
    },

    /**
     * Whether the login has completed (SASL and resource binding, stream
     * resumption, or attaching to an existing session), which is when
     * stanzas may be sent. Code that decides whether it can send checks this,
     * not {@link api.connection.connected}.
     *
     * @method api.connection.authenticated
     * @memberOf api.connection
     * @returns {boolean}
     */
    authenticated() {
        return connection?.authenticated && true;
    },

    /**
     * Whether the stream to the XMPP server is open. That's already the case
     * while still logging in, when nothing may be sent yet, see
     * {@link api.connection.authenticated}.
     *
     * @method api.connection.connected
     * @memberOf api.connection
     * @returns {boolean}
     */
    connected() {
        return connection?.connected && true;
    },

    /**
     * @method api.connection.remembered
     * @memberOf api.connection
     * @returns {boolean} Whether this device remembers the session, so that
     *  it's kept through dropped connections and retried for as long as it's
     *  remembered, rather than given up on.
     */
    remembered() {
        return !!connection?.remembered;
    },

    /**
     * Whether a session is open: one that has logged in, or that was resumed
     * from the cache, and that hasn't ended. It stays open through dropped
     * connections, so a front end keeps showing it while offline.
     *
     * @method api.connection.hasSession
     * @memberOf api.connection
     * @returns {boolean}
     */
    hasSession() {
        return !!(connection?.authenticated || connection?.has_connected || connection?.resumed_jid);
    },

    /**
     * Terminates the connection.
     *
     * @method api.connection.disconnect
     * @memberOf api.connection
     */
    disconnect() {
        connection?.disconnect();
    },

    /**
     * Can be called once the XMPP connection has dropped and we want
     * to attempt reconnection.
     * Only needs to be called once, if reconnect fails Converse will keep
     * attempting to reconnect, waiting 3 seconds at first and twice as long
     * each time up to a minute, alternating between BOSH and Websocket if URLs
     * for both were provided.
     * @method reconnect
     * @memberOf api.connection
     */
    reconnect() {
        return connection.requestReconnect({ explicit: true });
    },

    /**
     * Retries the connection now, because whatever kept it from connecting
     * has gone away, and starts the waits between retries from 3 seconds
     * again. A front end calls it when the network comes back, for example on
     * the browser's `online` event, or when an app is brought back to the
     * foreground.
     *
     * Unlike {@link api.connection.reconnect}, this restarts the backoff.
     * A working connection is checked rather than replaced, with a ping if the
     * `converse-ping` plugin is loaded. An attempt that's underway is started
     * anew, since it most likely started while the network was down, unless
     * an earlier call started it. One that has just failed is retried within
     * 3 seconds.
     * @method retry
     * @memberOf api.connection
     */
    retry() {
        return connection?.retry();
    },

    /**
     * Utility method to determine the type of connection we have
     * @method isType
     * @memberOf api.connection
     * @returns {boolean}
     */
    isType(type) {
        return connection.isType(type);
    },
};
