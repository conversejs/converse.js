import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { log } from '@converse/headless';
import { createLineBudget, listen, serveClient } from '../transport.js';

describe('serveClient', () => {
    let dir;
    /** @type {net.Server} */
    let server;

    beforeEach(async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'converse-transport-'));
    });

    afterEach(async () => {
        server?.close();
        await fs.rm(dir, { recursive: true, force: true });
    });

    it("runs what a method asks to once its response is written, even when that's slow", async () => {
        const socket_path = path.join(dir, 'socket');
        const budget = createLineBudget();
        server = await listen(socket_path, (socket) =>
            serveClient(socket, budget, (notify) => async (line) => {
                const { id } = JSON.parse(line);
                // Real I/O between the method and the write, such as an audit log's, which a
                // setImmediate set by the method would run before.
                await new Promise((resolve) => setTimeout(resolve, 20));
                return {
                    response: { id, result: 'answer' },
                    close: false,
                    after: [() => notify({ what: 'event' })],
                };
            }),
        );
        const client = net.connect(socket_path);
        /** @type {Object[]} */
        const lines = [];
        readline.createInterface({ input: client }).on('line', (line) => lines.push(JSON.parse(line)));
        client.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'any' }) + '\n');

        await expect.poll(() => lines.length).toBe(2);
        expect(lines).toEqual([
            { jsonrpc: '2.0', id: 1, result: 'answer' },
            { jsonrpc: '2.0', method: 'event', params: { what: 'event' } },
        ]);
        client.destroy();
    });

    it('logs what fails once a response is written, and still runs the rest, and closes', async () => {
        const error = vi.spyOn(log, 'error').mockImplementation(() => {});
        const socket_path = path.join(dir, 'socket');
        const budget = createLineBudget();
        server = await listen(socket_path, (socket) =>
            serveClient(socket, budget, (notify) => (line) => {
                const { id } = JSON.parse(line);
                return Promise.resolve({
                    response: { id, result: 'answer' },
                    close: true,
                    after: [
                        () => {
                            throw new Error('Failed');
                        },
                        () => notify({ what: 'event' }),
                    ],
                });
            }),
        );
        const client = net.connect(socket_path);
        /** @type {Object[]} */
        const lines = [];
        readline.createInterface({ input: client }).on('line', (line) => lines.push(JSON.parse(line)));
        const ended = new Promise((resolve) => client.once('end', resolve));
        client.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'any' }) + '\n');

        await ended;
        expect(lines).toEqual([
            { jsonrpc: '2.0', id: 1, result: 'answer' },
            { jsonrpc: '2.0', method: 'event', params: { what: 'event' } },
        ]);
        expect(error).toHaveBeenCalledWith(expect.stringContaining('Failed'));
        error.mockRestore();
        client.destroy();
    });
});
