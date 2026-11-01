import { describe, expect, it, vi } from 'vitest';
import { createDispatcher } from '../dispatch.js';
import { ERRORS, PROTOCOL_VERSION, RPCError } from '../protocol.js';

/**
 * @param {Object} [options]
 * @param {import('../types').Access} [options.access]
 * @param {Record<string, Function>} [options.methods]
 */
function dispatcher({ access = 'full', methods = {} } = {}) {
    return createDispatcher({
        access,
        config: { consumer: 'agent', mode: 'owner_only' },
        methods: { 'daemon.status': () => ({ ok: true }), 'daemon.stop': () => ({}), ...methods },
        getJID: () => 'daemon@example.org/converse',
        notify: vi.fn(),
    });
}

const request = (method, params, id = 1) => JSON.stringify({ jsonrpc: '2.0', id, method, params });
const hello = (params = {}) => request('hello', { protocol: PROTOCOL_VERSION, ...params });

describe('The JSON-RPC dispatcher', () => {
    it('answers hello with the protocol, access, mode and JID', async () => {
        const { handle, client } = dispatcher({ access: 'restricted' });
        const { response, close } = await handle(hello({ consumer: 'bot' }));
        expect(response).toEqual({
            id: 1,
            result: {
                protocol: PROTOCOL_VERSION,
                consumer: 'bot',
                access: 'restricted',
                mode: 'owner_only',
                jid: 'daemon@example.org/converse',
            },
        });
        expect(close).toBe(false);
        expect(client.consumer).toBe('bot');
    });

    it("falls back to the config's consumer", async () => {
        const { handle, client } = dispatcher();
        await handle(hello());
        expect(client.consumer).toBe('agent');
    });

    it('refuses another protocol version, and closes the connection', async () => {
        const { handle } = dispatcher();
        const { response, close } = await handle(request('hello', { protocol: PROTOCOL_VERSION + 1 }));
        expect(response.error.code).toBe(ERRORS.PROTOCOL_MISMATCH);
        expect(response.error.data).toEqual({ protocol: PROTOCOL_VERSION });
        expect(close).toBe(true);
    });

    it('refuses a method before hello', async () => {
        const { handle } = dispatcher();
        const { response } = await handle(request('daemon.status'));
        expect(response.error.code).toBe(ERRORS.HELLO_REQUIRED);
    });

    it('refuses a line that is not JSON', async () => {
        const { handle } = dispatcher();
        const { response } = await handle('{');
        expect(response).toEqual({ id: null, error: { code: ERRORS.PARSE_ERROR, message: 'Not valid JSON.' } });
    });

    it('refuses JSON that is not a JSON-RPC 2.0 request, keeping its id', async () => {
        const { handle } = dispatcher();
        expect((await handle(JSON.stringify({ id: 7, method: 'hello' }))).response).toMatchObject({
            id: 7,
            error: { code: ERRORS.INVALID_REQUEST },
        });
        expect((await handle(JSON.stringify({ jsonrpc: '2.0', id: 8 }))).response.error.code).toBe(
            ERRORS.INVALID_REQUEST,
        );
        expect((await handle('null')).response.error.code).toBe(ERRORS.INVALID_REQUEST);
    });

    it('refuses an unknown method', async () => {
        const { handle } = dispatcher();
        await handle(hello());
        const { response } = await handle(request('nope.nothing'));
        expect(response.error.code).toBe(ERRORS.METHOD_NOT_FOUND);
    });

    it("doesn't take an inherited property for a method", async () => {
        const { handle } = dispatcher();
        await handle(hello());
        expect((await handle(request('toString'))).response.error.code).toBe(ERRORS.METHOD_NOT_FOUND);
    });

    it('refuses a full access method on a restricted connection', async () => {
        const { handle } = dispatcher({ access: 'restricted' });
        await handle(hello());
        expect((await handle(request('daemon.stop'))).response.error.code).toBe(ERRORS.ACCESS_DENIED);
        expect((await handle(request('daemon.status'))).response).toEqual({ id: 1, result: { ok: true } });
    });

    it('calls a method with its params and the client, or {} without params', async () => {
        const status = vi.fn(() => 'done');
        const { handle, client } = dispatcher({ methods: { 'daemon.status': status } });
        await handle(hello());
        await handle(request('daemon.status', { a: 1 }));
        await handle(request('daemon.status'));
        expect(status).toHaveBeenNthCalledWith(1, { a: 1 }, client);
        expect(status).toHaveBeenNthCalledWith(2, {}, client);
    });

    it("passes on an RPCError, and hides other errors' kind behind INTERNAL_ERROR", async () => {
        const { handle } = dispatcher({
            methods: {
                'daemon.status': () => {
                    throw new RPCError(ERRORS.NOT_FOUND, 'Not here.', { x: 1 });
                },
                'daemon.stop': () => {
                    throw new TypeError('Broken.');
                },
            },
        });
        await handle(hello());
        expect((await handle(request('daemon.status'))).response).toEqual({
            id: 1,
            error: { code: ERRORS.NOT_FOUND, message: 'Not here.', data: { x: 1 } },
        });
        expect((await handle(request('daemon.stop'))).response).toEqual({
            id: 1,
            error: { code: ERRORS.INTERNAL_ERROR, message: 'Broken.', data: undefined },
        });
    });

    it('sends no response to a notification, even an error', async () => {
        const status = vi.fn();
        const { handle } = dispatcher({ methods: { 'daemon.status': status } });
        await handle(hello());
        expect((await handle(request('daemon.status', {}, null))).response).toBeNull();
        expect(status).toHaveBeenCalledOnce();
        expect((await handle(request('nope.nothing', {}, null))).response).toBeNull();
    });
});
