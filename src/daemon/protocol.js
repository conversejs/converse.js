/**
 * What the daemon and its clients agree on, kept free of any `@converse/headless`
 * import so that a client loading it doesn't load an XMPP stack.
 *
 * The wire format is JSON-RPC 2.0 over a unix socket, one JSON message per
 * line. A client's first request must be `hello`, which settles the protocol
 * version.
 * @module @converse/daemon/protocol
 */

/**
 * Bumped whenever a change would break an existing client.
 */
export const PROTOCOL_VERSION = 1;

/**
 * JSON-RPC error codes. Those below -32000 are the spec's own; the daemon's
 * start at -32000.
 */
export const ERRORS = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
    PROTOCOL_MISMATCH: -32000,
    HELLO_REQUIRED: -32001,
};

/**
 * A JSON-RPC error, as raised by a method handler or received by a client.
 */
export class RPCError extends Error {
    /**
     * @param {number} code - One of {@link ERRORS}
     * @param {string} message
     * @param {unknown} [data]
     */
    constructor(code, message, data) {
        super(message);
        this.name = 'RPCError';
        this.code = code;
        this.data = data;
    }
}
