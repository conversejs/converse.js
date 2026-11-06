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
 * @param {Record<string, (params: any, client: import('./types').Client, call: import('./types').Call) => unknown>} context.methods
 * @param {() => string|null} context.getJID
 * @param {(params: unknown) => void} context.notify - Sends the client an event
 * @param {() => boolean} [context.writable] - Whether an event sent now can still be written
 */
export function createDispatcher({ access, config, methods, getJID, notify, writable = () => true }) {
    /** @type {import('./types').Hello|null} */
    let hello = null;

    /** @type {import('./types').Client} */
    const client = { access, consumer: null, notify, writable, closed: false };

    /**
     * The consumer a client is, from the name it asks for. A restricted
     * client is the configured consumer: the daemon can't tell restricted
     * clients apart, so the name a client asks for would only be a label,
     * and it decides whose cursors, schedules and drafts the client reaches.
     * The name is the first hello's, and stays.
     * @param {unknown} asked
     * @returns {string}
     */
    const consumerFor = (asked) => {
        const name = typeof asked === 'string' && asked ? asked : (client.consumer ?? config.consumer);
        if (access === 'restricted' && name !== config.consumer) {
            throw new RPCError(
                ERRORS.ACCESS_DENIED,
                `A restricted connection is the consumer "${config.consumer}", as the config names it, ` +
                    `not "${name}". Leave "consumer" out of "hello".`,
            );
        }
        if (client.consumer !== null && name !== client.consumer) {
            throw new RPCError(
                ERRORS.INVALID_PARAMS,
                `This connection is already the consumer "${client.consumer}", and that can't change. ` +
                    'Connect again to be another.',
            );
        }
        return name;
    };

    const call = (method, params, after) => {
        if (method === 'hello') {
            if (params?.protocol !== PROTOCOL_VERSION) {
                throw new RPCError(
                    ERRORS.PROTOCOL_MISMATCH,
                    `This daemon speaks protocol version ${PROTOCOL_VERSION} but the client asked for ` +
                        `${params?.protocol}. Upgrade whichever is older; to restart the daemon, ` +
                        `stop it with "daemon.stop".`,
                    { protocol: PROTOCOL_VERSION, see: ['daemon.stop'] },
                );
            }
            hello = {
                protocol: PROTOCOL_VERSION,
                consumer: consumerFor(params.consumer),
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
        return methods[method](params ?? {}, client, { afterReply: (fn) => after.push(fn) });
    };

    /**
     * Handles one line the client sent.
     * @param {string} line
     * @returns {ReturnType<import('./types').RequestHandler>} The response to send, without its
     *  `jsonrpc` member, or null for a notification; whether to close the connection after it; and
     *  what the method asked to run once it's written
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
        /** @type {(() => void)[]} */
        const after = [];
        try {
            const result = await call(method, params, after);
            // A request without an id is a notification, which gets no response.
            return { response: id === null ? null : { id, result }, close: false, after };
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
