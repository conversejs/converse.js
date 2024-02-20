declare namespace _default {
    /**
     * @method api.connection.init
     * @memberOf api.connection
     * @param {string} [jid]
     * @return {Connection|MockConnection}
     */
    function init(jid?: string): Connection | MockConnection;
    function get(): any;
    function destroy(): void;
    /**
     * @method api.connection.authenticated
     * @memberOf api.connection
     * @returns {boolean} Whether we're authenticated to the XMPP server or not
     */
    function authenticated(): boolean;
    /**
     * @method api.connection.connected
     * @memberOf api.connection
     * @returns {boolean} Whether there is an established connection or not.
     */
    function connected(): boolean;
    /**
     * Terminates the connection.
     *
     * @method api.connection.disconnect
     * @memberOf api.connection
     */
    function disconnect(): void;
    /**
     * Can be called once the XMPP connection has dropped and we want
     * to attempt reconnection.
     * Only needs to be called once, if reconnect fails Converse will
     * attempt to reconnect every two seconds, alternating between BOSH and
     * Websocket if URLs for both were provided.
     * @method reconnect
     * @memberOf api.connection
     */
    function reconnect(): any;
    /**
     * Utility method to determine the type of connection we have
     * @method isType
     * @memberOf api.connection
     * @returns {boolean}
     */
    function isType(type: any): boolean;
}
export default _default;
import { Connection } from "./index.js";
import { MockConnection } from "./index.js";
//# sourceMappingURL=api.d.ts.map