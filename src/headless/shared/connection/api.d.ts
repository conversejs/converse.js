declare namespace _default {
    /**
     * @method _converse.api.connection.authenticated
     * @memberOf _converse.api.connection
     * @returns {boolean} Whether we're authenticated to the XMPP server or not
     */
    function authenticated(): boolean;
    /**
     * @method _converse.api.connection.connected
     * @memberOf _converse.api.connection
     * @returns {boolean} Whether there is an established connection or not.
     */
    function connected(): boolean;
    /**
     * Terminates the connection.
     *
     * @method _converse.api.connection.disconnect
     * @memberOf _converse.api.connection
     */
    function disconnect(): void;
    /**
     * Can be called once the XMPP connection has dropped and we want
     * to attempt reconnection.
     * Only needs to be called once, if reconnect fails Converse will
     * attempt to reconnect every two seconds, alternating between BOSH and
     * Websocket if URLs for both were provided.
     * @method reconnect
     * @memberOf _converse.api.connection
     */
    function reconnect(): any;
    /**
     * Utility method to determine the type of connection we have
     * @method isType
     * @memberOf _converse.api.connection
     * @returns {boolean}
     */
    function isType(type: any): boolean;
}
export default _default;
