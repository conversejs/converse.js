import _converse from '@converse/headless/shared/_converse.js';
import { Strophe } from 'strophe.js/src/strophe.js';

/**
 * This grouping collects API functions related to the XMPP connection.
 *
 * @namespace _converse.api.connection
 * @memberOf _converse.api
 */
export default {

    /**
     * @method _converse.api.connection.authenticated
     * @memberOf _converse.api.connection
     * @returns {boolean} Whether we're authenticated to the XMPP server or not
     */
    authenticated () {
        return _converse?.connection?.authenticated && true;
    },

    /**
     * @method _converse.api.connection.connected
     * @memberOf _converse.api.connection
     * @returns {boolean} Whether there is an established connection or not.
     */
    connected () {
        return _converse?.connection?.connected && true;
    },

    /**
     * Terminates the connection.
     *
     * @method _converse.api.connection.disconnect
     * @memberOf _converse.api.connection
     */
    disconnect () {
        if (_converse.connection) {
            _converse.connection.disconnect();
        }
    },

    /**
     * Can be called once the XMPP connection has dropped and we want
     * to attempt reconnection.
     * Only needs to be called once, if reconnect fails Converse will
     * attempt to reconnect every two seconds, alternating between BOSH and
     * Websocket if URLs for both were provided.
     * @method reconnect
     * @memberOf _converse.api.connection
     */
    reconnect () {
        const { __, connection } = _converse;
        connection.setConnectionStatus(
            Strophe.Status.RECONNECTING,
            __('The connection has dropped, attempting to reconnect.')
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
     * @memberOf _converse.api.connection
     * @returns {boolean}
     */
    isType (type) {
        return _converse.connection.isType(type);
    }
};
