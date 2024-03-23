import events_api from '../api/events.js';
import { Connection, MockConnection } from './index.js';
import { PREBIND } from '../constants.js';
import { Strophe } from 'strophe.js';
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
    init (jid) {
        if (jid && connection?.jid && isSameDomain(connection.jid, jid)) return connection;

        if (!settings_api.get('bosh_service_url') && settings_api.get('authentication') === PREBIND) {
            throw new Error("authentication is set to 'prebind' but we don't have a BOSH connection");
        }

        const XMPPConnection = isTestEnv() ? MockConnection : Connection;
        connection = new XMPPConnection(
            getConnectionServiceURL(),
            Object.assign(default_connection_options, settings_api.get('connection_options'), {
                'keepalive': settings_api.get('keepalive'),
            })
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

    get () {
        return connection;
    },

    destroy () {
        this.disconnect();
        connection?.disconnect();
        connection = undefined;
    },

    /**
     * @method api.connection.authenticated
     * @memberOf api.connection
     * @returns {boolean} Whether we're authenticated to the XMPP server or not
     */
    authenticated () {
        return connection?.authenticated && true;
    },

    /**
     * @method api.connection.connected
     * @memberOf api.connection
     * @returns {boolean} Whether there is an established connection or not.
     */
    connected () {
        return connection?.connected && true;
    },

    /**
     * Terminates the connection.
     *
     * @method api.connection.disconnect
     * @memberOf api.connection
     */
    disconnect () {
        connection?.disconnect();
    },

    /**
     * Can be called once the XMPP connection has dropped and we want
     * to attempt reconnection.
     * Only needs to be called once, if reconnect fails Converse will
     * attempt to reconnect every two seconds, alternating between BOSH and
     * Websocket if URLs for both were provided.
     * @method reconnect
     * @memberOf api.connection
     */
    reconnect () {
        connection.setConnectionStatus(
            Strophe.Status.RECONNECTING,
            'The connection has dropped, attempting to reconnect.'
        );
        if (connection?.reconnecting) {
            return connection.debouncedReconnect();
        } else {
            return connection.reconnect();
        }
    },

    /**
     * Utility method to determine the type of connection we have
     * @method isType
     * @memberOf api.connection
     * @returns {boolean}
     */
    isType (type) {
        return connection.isType(type);
    },
};
