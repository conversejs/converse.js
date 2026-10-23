import fs from 'node:fs/promises';
import net from 'node:net';
import readline from 'node:readline';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { converse } from '@converse/headless';
import { ERRORS, PROTOCOL_VERSION } from '../protocol.js';
import { start } from '../daemon.js';
import { JID, startDaemon } from './harness.js';

const { Strophe, stx, u } = converse.env;

/**
 * Writes raw lines to the socket and collects the parsed responses, for the
 * cases the client library is there to prevent.
 * @param {string} socket_path
 * @param {Object[]} messages
 * @param {number} count - How many responses to wait for.
 */
async function exchange(socket_path, messages, count) {
    const socket = net.createConnection(socket_path);
    const responses = [];
    const { promise, resolve } = Promise.withResolvers();
    readline.createInterface({ input: socket }).on('line', (line) => {
        responses.push(JSON.parse(line));
        if (responses.length === count) resolve(undefined);
    });
    const closed = new Promise((r) => socket.once('close', r));
    messages.forEach((m) => socket.write(JSON.stringify(m) + '\n'));
    await promise;
    return { responses, socket, closed };
}

describe('The daemon', () => {
    let daemon;

    afterEach(async () => {
        await daemon?.stop();
        daemon = undefined;
    });

    it('serves an owner-only socket in the runtime directory', async () => {
        daemon = await startDaemon();
        const { paths } = daemon.config;
        expect(paths.socket.startsWith(`${daemon.env.XDG_RUNTIME_DIR}/`)).toBe(true);
        expect((await fs.stat(paths.socket)).isSocket()).toBe(true);
        expect((await fs.stat(paths.socket)).mode & 0o777).toBe(0o600);
        expect((await fs.stat(paths.runtime_dir)).mode & 0o777).toBe(0o700);
        expect((await fs.readFile(paths.pidfile, 'utf8')).trim()).toBe(String(process.pid));
    });

    it('refuses to start a second time for the same account', async () => {
        daemon = await startDaemon();
        await expect(start(daemon.config)).rejects.toThrow(
            `A daemon for romeo@montague.lit is already running (pid ${process.pid}). ` +
                'Stop it with "converse-cli daemon stop".',
        );
        // The refused start left the running daemon's files alone.
        await expect(fs.stat(daemon.config.paths.socket)).resolves.toBeTruthy();
        await expect(fs.stat(daemon.config.paths.pidfile)).resolves.toBeTruthy();
    });

    it('replaces a stale pidfile', async () => {
        daemon = await startDaemon();
        const { config } = daemon;
        await daemon.daemon.stop();
        // A pid that can't be running.
        await fs.writeFile(config.paths.pidfile, '2147483646\n');
        daemon.daemon = await start(config);
        expect((await fs.readFile(config.paths.pidfile, 'utf8')).trim()).toBe(String(process.pid));
    });

    it('completes the handshake, naming the protocol, consumer, access level and JID', async () => {
        daemon = await startDaemon();
        const client = await daemon.connect({ consumer: 'tester' });
        expect(client.hello).toEqual({ protocol: PROTOCOL_VERSION, consumer: 'tester', access: 'full', jid: JID });
        client.close();

        const default_client = await daemon.connect();
        expect(default_client.hello.consumer).toBe('claude');
        default_client.close();
    });

    it('refuses a client speaking another protocol version, and hangs up', async () => {
        daemon = await startDaemon();
        const { responses, closed } = await exchange(
            daemon.config.paths.socket,
            [{ jsonrpc: '2.0', id: 1, method: 'hello', params: { protocol: 99 } }],
            1,
        );
        expect(responses).toEqual([
            {
                jsonrpc: '2.0',
                id: 1,
                error: {
                    code: ERRORS.PROTOCOL_MISMATCH,
                    message:
                        `This daemon speaks protocol version ${PROTOCOL_VERSION} but the client asked for 99. ` +
                        'Upgrade whichever is older; to restart the daemon, run "converse-cli daemon stop".',
                    data: { protocol: PROTOCOL_VERSION },
                },
            },
        ]);
        await closed;
    });

    it('answers nothing but hello before the handshake', async () => {
        daemon = await startDaemon();
        const { responses, socket } = await exchange(
            daemon.config.paths.socket,
            [
                { jsonrpc: '2.0', id: 1, method: 'daemon.status' },
                { jsonrpc: '2.0', id: 2, method: 'hello', params: { protocol: PROTOCOL_VERSION } },
                { jsonrpc: '2.0', id: 3, method: 'no.such.method' },
            ],
            3,
        );
        socket.end();
        // Responses needn't come back in request order; the ids pair them up.
        responses.sort((a, b) => a.id - b.id);
        expect(responses.map((r) => r.error?.code ?? 'ok')).toEqual([
            ERRORS.HELLO_REQUIRED,
            'ok',
            ERRORS.METHOD_NOT_FOUND,
        ]);
        expect(responses[0].error.message).toBe('Send "hello" with the protocol version first.');
    });

    it('rejects lines that are not JSON-RPC requests', async () => {
        daemon = await startDaemon();
        const socket = net.createConnection(daemon.config.paths.socket);
        const lines = [];
        const { promise, resolve } = Promise.withResolvers();
        readline.createInterface({ input: socket }).on('line', (line) => {
            lines.push(JSON.parse(line));
            if (lines.length === 2) resolve(undefined);
        });
        socket.write('not json\n{"id": 7, "method": "hello"}\n');
        await promise;
        socket.end();
        expect(lines.map((l) => [l.id, l.error.code])).toEqual([
            [null, ERRORS.PARSE_ERROR],
            [7, ERRORS.INVALID_REQUEST],
        ]);
    });

    it('reports its status', async () => {
        daemon = await startDaemon();
        const client = await daemon.connect();
        const status = await client.request('daemon.status');
        client.close();
        expect(status).toEqual({
            connected: true,
            jid: JID,
            pid: process.pid,
            started: expect.any(String),
            uptime: expect.any(Number),
        });
        expect(Date.now() - Date.parse(status.started)).toBeLessThan(10000);
    });

    it('enables message carbons once the server says it supports them', async () => {
        daemon = await startDaemon();
        const { connection, receive } = daemon;
        const disco_iq = await u.waitUntil(() =>
            connection.IQ_stanzas.find(
                (iq) =>
                    iq.getAttribute('to') === 'montague.lit' &&
                    iq.querySelector(`query[xmlns="${Strophe.NS.DISCO_INFO}"]`),
            ),
        );
        receive(stx`
            <iq xmlns="jabber:client" type="result" from="montague.lit" to="${JID}" id="${disco_iq.getAttribute('id')}">
                <query xmlns="${Strophe.NS.DISCO_INFO}">
                    <identity category="server" type="im"/>
                    <feature var="${Strophe.NS.CARBONS}"/>
                </query>
            </iq>`);
        await u.waitUntil(() =>
            connection.IQ_stanzas.find((iq) => iq.querySelector(`enable[xmlns="${Strophe.NS.CARBONS}"]`)),
        );
    });

    it('logs out and cleans up when a client asks it to stop', async () => {
        daemon = await startDaemon();
        const { config, connection } = daemon;
        const client = await daemon.connect();
        await expect(client.request('daemon.stop')).resolves.toEqual({});
        await daemon.daemon.stopped;

        expect(daemon.api.connection.connected()).toBeFalsy();
        const unavailable = stx`<presence xmlns="jabber:client" type="unavailable"/>`.tree();
        expect(u.isEqualNode(connection.sent_stanzas.at(-1), unavailable)).toBe(true);
        await expect(fs.stat(config.paths.socket)).rejects.toThrow('ENOENT');
        await expect(fs.stat(config.paths.pidfile)).rejects.toThrow('ENOENT');
    });

    it('still cleans up when logging out fails, so the next daemon can start', async () => {
        daemon = await startDaemon();
        const { config } = daemon;
        const client = await daemon.connect();
        const logout = vi.spyOn(daemon.api.user, 'logout').mockRejectedValue(new Error('server gone'));
        try {
            await expect(client.request('daemon.stop')).resolves.toEqual({});
            await daemon.daemon.stopped;
        } finally {
            logout.mockRestore();
        }
        await expect(fs.stat(config.paths.socket)).rejects.toThrow('ENOENT');
        await expect(fs.stat(config.paths.pidfile)).rejects.toThrow('ENOENT');
    });
});
