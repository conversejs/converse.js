/**
 * One client's side of the JSON-RPC: parsing its requests, settling the
 * protocol with `hello`, checking access and calling the methods. It knows
 * nothing of sockets, so that it can be tested on its own.
 * @module @converse/daemon/dispatch
 */
import { mayCall } from './access.js';
import { ERRORS, PROTOCOL_VERSION, RPCError } from './protocol.js';

/**
 * @param {Object} context
 * @param {import('./types').Access} context.access - The level of the socket the client connected to
 * @param {Pick<import('./types').Config, 'consumer'|'mode'>} context.config
 * @param {Record<string, (params: any, client: import('./types').Client) => unknown>} context.methods
 * @param {() => string|null} context.getJID
 * @param {(params: unknown) => void} context.notify - Sends the client an event
 */
export function createDispatcher({ access, config, methods, getJID, notify }) {
    /** @type {import('./types').Hello|null} */
    let hello = null;

    /** @type {import('./types').Client} */
    const client = { access, consumer: null, notify };

    const call = (method, params) => {
        if (method === 'hello') {
            if (params?.protocol !== PROTOCOL_VERSION) {
                throw new RPCError(
                    ERRORS.PROTOCOL_MISMATCH,
                    `This daemon speaks protocol version ${PROTOCOL_VERSION} but the client asked for ` +
                        `${params?.protocol}. Upgrade whichever is older; to restart the daemon, ` +
                        `stop it with "daemon.stop".`,
                    { protocol: PROTOCOL_VERSION },
                );
            }
            hello = {
                protocol: PROTOCOL_VERSION,
                consumer: typeof params.consumer === 'string' && params.consumer ? params.consumer : config.consumer,
                access,
                mode: config.mode,
                jid: getJID(),
            };
            client.consumer = hello.consumer;
            return hello;
        }
        if (!hello) {
            throw new RPCError(ERRORS.HELLO_REQUIRED, 'Send "hello" with the protocol version first.');
        }
        if (!Object.hasOwn(methods, method)) {
            throw new RPCError(ERRORS.METHOD_NOT_FOUND, `Unknown method "${method}".`);
        }
        if (!mayCall(method, access, config.mode)) {
            throw new RPCError(
                ERRORS.ACCESS_DENIED,
                `"${method}" is only available at full access, and this connection is restricted.`,
            );
        }
        return methods[method](params ?? {}, client);
    };

    /**
     * Handles one line the client sent.
     * @param {string} line
     * @returns {Promise<{ response: Object|null, close: boolean }>} The response to send, without
     *  its `jsonrpc` member, or null for a notification; and whether to close the connection after it
     */
    const handle = async (line) => {
        let request;
        try {
            request = JSON.parse(line);
        } catch {
            return {
                response: { id: null, error: { code: ERRORS.PARSE_ERROR, message: 'Not valid JSON.' } },
                close: false,
            };
        }
        const { id = null, method, params } = request ?? {};
        if (request?.jsonrpc !== '2.0' || typeof method !== 'string') {
            return {
                response: { id, error: { code: ERRORS.INVALID_REQUEST, message: 'Not a JSON-RPC 2.0 request.' } },
                close: false,
            };
        }
        try {
            const result = await call(method, params);
            // A request without an id is a notification, which gets no response.
            return { response: id === null ? null : { id, result }, close: false };
        } catch (e) {
            const { code, message, data } =
                e instanceof RPCError ? e : { code: ERRORS.INTERNAL_ERROR, message: e.message, data: undefined };
            return {
                response: id === null ? null : { id, error: { code, message, data } },
                close: code === ERRORS.PROTOCOL_MISMATCH,
            };
        }
    };

    return { client, handle };
}
