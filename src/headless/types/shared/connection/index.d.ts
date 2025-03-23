declare const Connection_base: typeof import("strophe.js/src/types/connection").default;
/**
 * The Connection class manages the connection to the XMPP server. It's
 * agnostic concerning the underlying protocol (i.e. websocket, long-polling
 * via BOSH or websocket inside a shared worker).
 */
export class Connection extends Connection_base {
    constructor(service: any, options: any);
    send_initial_presence: boolean;
    debouncedReconnect: import("lodash").DebouncedFunc<() => Promise<any>>;
    /** @param {Element} body */
    xmlInput(body: Element): void;
    bind(): Promise<void>;
    onDomainDiscovered(response: any): Promise<any>;
    /**
     * Adds support for XEP-0156 by quering the XMPP server for alternate
     * connection methods. This allows users to use the websocket or BOSH
     * connection of their own XMPP server instead of a proxy provided by the
     * host of Converse.js.
     * @method Connnection.discoverConnectionMethods
     * @param {string} domain
     */
    discoverConnectionMethods(domain: string): Promise<void>;
    /**
     * Establish a new XMPP session by logging in with the supplied JID and
     * password.
     * @method Connnection.connect
     * @param {String} jid
     * @param {String} password
     * @param {Function} callback
     */
    connect(jid: string, password: string, callback: Function): Promise<void>;
    /**
     * @param {string} reason
     */
    disconnect(reason: string): void;
    /**
     * Switch to a different transport if a service URL is available for it.
     *
     * When reconnecting with a new transport, we call setUserJID
     * so that a new resource is generated, to avoid multiple
     * server-side sessions with the same resource.
     *
     * We also call `_proto._doDisconnect` so that connection event handlers
     * for the old transport are removed.
     */
    switchTransport(): Promise<void>;
    reconnect(): Promise<any>;
    reconnecting: boolean;
    /**
     * Called as soon as a new connection has been established, either
     * by logging in or by attaching to an existing BOSH session.
     * @method Connection.onConnected
     * @param {Boolean} [reconnecting] - Whether Converse.js reconnected from an earlier dropped session.
     */
    onConnected(reconnecting?: boolean): Promise<void>;
    /**
     * Used to keep track of why we got disconnected, so that we can
     * decide on what the next appropriate action is (in onDisconnected)
     * @param {Number|'logout'} [cause] - The status number as received from Strophe.
     * @param {String} [reason] - An optional user-facing message as to why
     *  there was a disconnection.
     * @param {Boolean} [override] - An optional flag to replace any previous
     *  disconnection cause and reason.
     */
    setDisconnectionCause(cause?: number | "logout", reason?: string, override?: boolean): void;
    disconnection_cause: number | "logout";
    disconnection_reason: string;
    /**
     * @param {Number} [status] - The status number as received from Strophe.
     * @param {String} [message] - An optional user-facing message
     */
    setConnectionStatus(status?: number, message?: string): void;
    status: number;
    finishDisconnection(): Promise<void>;
    /**
     * Gets called once strophe's status reaches Strophe.Status.DISCONNECTED.
     * Will either start a teardown process for converse.js or attempt
     * to reconnect.
     * @method onDisconnected
     */
    onDisconnected(): any;
    /**
     * Callback method called by Strophe as the Connection goes
     * through various states while establishing or tearing down a
     * connection.
     * @param {Number} status
     * @param {String} [condition]
     */
    onConnectStatusChanged(status: number, condition?: string): void;
    /**
     * @param {string} type
     */
    isType(type: string): boolean;
    hasResumed(): boolean;
    restoreWorkerSession(): any;
    worker_attach_promise: any;
}
/**
 * The MockConnection class is used during testing, to mock an XMPP connection.
 */
export class MockConnection extends Connection {
    /**
     * @param {string} service - The BOSH or WebSocket service URL.
     * @param {import('strophe.js/src/types/connection').ConnectionOptions} options - The configuration options
     */
    constructor(service: string, options: import("strophe.js/src/types/connection").ConnectionOptions);
    sent_stanzas: any[];
    IQ_stanzas: any[];
    IQ_ids: any[];
    mock: boolean;
    get _sasl_mechanism(): import("strophe.js/src/types/sasl-sha256.js").default;
    _processRequest(): void;
    sendIQ(iq: any, callback: any, errback: any): string;
    send(stanza: any): void;
}
export {};
//# sourceMappingURL=index.d.ts.map