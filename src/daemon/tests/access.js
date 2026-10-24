import fs from 'node:fs/promises';
import net from 'node:net';
import readline from 'node:readline';
import { afterEach, describe, expect, it } from 'vitest';
import { ERRORS, PROTOCOL_VERSION } from '../protocol.js';
import { JID, startDaemon } from './harness.js';

/**
 * Sends one raw request to a socket, and returns the response.
 * @param {string} socket_path
 * @param {Object} request
 */
async function rawRequest(socket_path, request) {
    const socket = net.createConnection(socket_path);
    const { promise, resolve } = Promise.withResolvers();
    readline.createInterface({ input: socket }).on('line', (line) => resolve(JSON.parse(line)));
    socket.write(JSON.stringify(request) + '\n');
    try {
        return await promise;
    } finally {
        socket.end();
    }
}

describe('Access levels', () => {
    let daemon;

    afterEach(async () => {
        await daemon?.stop();
        daemon = undefined;
    });

    it('serves a restricted socket beside the full one, both owner-only', async () => {
        daemon = await startDaemon();
        const { paths } = daemon.config;
        expect(paths.restricted_socket).not.toBe(paths.socket);
        for (const socket_path of [paths.socket, paths.restricted_socket]) {
            expect((await fs.stat(socket_path)).isSocket()).toBe(true);
            expect((await fs.stat(socket_path)).mode & 0o777).toBe(0o600);
        }
    });

    it('removes both sockets when it stops', async () => {
        daemon = await startDaemon();
        const { paths } = daemon.config;
        await daemon.stop();
        daemon = undefined;
        await expect(fs.stat(paths.socket)).rejects.toThrow('ENOENT');
        await expect(fs.stat(paths.restricted_socket)).rejects.toThrow('ENOENT');
    });

    it('gives each connection the level of the socket it arrived on', async () => {
        daemon = await startDaemon();
        const full = await daemon.connect();
        const restricted = await daemon.connect({ access: 'restricted' });
        expect(full.hello).toEqual({ protocol: PROTOCOL_VERSION, consumer: 'claude', access: 'full', jid: JID });
        expect(restricted.hello).toEqual({
            protocol: PROTOCOL_VERSION,
            consumer: 'claude',
            access: 'restricted',
            jid: JID,
        });
        full.close();
        restricted.close();
    });

    it('ignores an access level asked for in hello', async () => {
        daemon = await startDaemon();
        const response = await rawRequest(daemon.config.paths.restricted_socket, {
            jsonrpc: '2.0',
            id: 1,
            method: 'hello',
            params: { protocol: PROTOCOL_VERSION, consumer: 'claude', access: 'full' },
        });
        expect(response.result.access).toBe('restricted');
    });

    it('refuses full-only methods on a restricted connection, and carries on serving it', async () => {
        daemon = await startDaemon();
        const client = await daemon.connect({ access: 'restricted' });
        await expect(client.request('daemon.stop')).rejects.toMatchObject({
            code: ERRORS.ACCESS_DENIED,
            message: '"daemon.stop" is only available at full access, and this connection is restricted.',
        });
        // The refused call changed nothing: the daemon is still up for this client.
        expect(await client.request('daemon.status')).toMatchObject({ connected: true });
        client.close();
    });

    it('refuses a raw request for a full-only method on the restricted socket, and keeps running', async () => {
        daemon = await startDaemon();
        const socket = net.createConnection(daemon.config.paths.restricted_socket);
        const responses = [];
        const { promise, resolve } = Promise.withResolvers();
        readline.createInterface({ input: socket }).on('line', (line) => {
            responses.push(JSON.parse(line));
            if (responses.length === 3) resolve(undefined);
        });
        socket.write(
            JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'hello', params: { protocol: PROTOCOL_VERSION } }) + '\n',
        );
        socket.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'daemon.stop' }) + '\n');
        socket.write(JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'daemon.status' }) + '\n');
        await promise;
        socket.end();
        // Responses are matched by id, not by arrival order.
        const byId = Object.fromEntries(responses.map((r) => [r.id, r]));
        expect(byId[2]).toMatchObject({ error: { code: ERRORS.ACCESS_DENIED } });
        expect(byId[3]).toMatchObject({ result: { connected: true } });
    });
});
