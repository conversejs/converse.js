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
 * Bumped whenever a change would break an existing client. That includes the
 * shape of the DTOs in `types.ts`: a field may be added within a version, but
 * never renamed, removed or given a new meaning.
 */
export const PROTOCOL_VERSION = 2;

/**
 * The largest file `files.upload` takes, before any server's own limit. It's
 * above what servers commonly allow, so it only stops a request that no server
 * would accept anyway.
 */
export const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;

/**
 * The longest line, in bytes, the daemon reads from a client: room for an
 * upload of {@link MAX_UPLOAD_SIZE} as base64, and the request around it. A
 * longer line is refused before it's buffered in full, and the connection
 * closed.
 */
export const MAX_LINE_LENGTH = Math.ceil(MAX_UPLOAD_SIZE / 3) * 4 + 64 * 1024;

/**
 * JSON-RPC error codes. Those below -32000 are the spec's own; the daemon's
 * start at -32000.
 */
export const ERRORS = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600, // Also a line longer than MAX_LINE_LENGTH, sent with a null id
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
    PROTOCOL_MISMATCH: -32000,
    HELLO_REQUIRED: -32001,
    NOT_CONNECTED: -32002, // The daemon has no XMPP session right now
    NOT_FOUND: -32003, // No such contact, conversation or message
    AMBIGUOUS: -32004, // More than one match; `data.candidates` lists them
    ACCESS_DENIED: -32005, // The method needs full access, and this connection is restricted
    CONFLICT: -32006, // The request clashes with what's happening now, such as approving a draft already being sent
    JOIN_REFUSED: -32007, // The room turned the join down: banned, nickname taken, or a password is needed
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
