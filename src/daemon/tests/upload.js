import { once } from 'node:events';
import fsSync from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { converse } from '@converse/headless';
import { ERRORS, MAX_LINE_LENGTH, PROTOCOL_VERSION } from '../protocol.js';
import { BENVOLIO } from './account.js';
import { startDaemon } from './harness.js';

const { Strophe } = converse.env;
const JULIET = 'juliet@capulet.lit';
const TYBALT = 'tybalt@capulet.lit';
const BALCONY = {
    name: 'balcony.txt',
    content: Buffer.from('What light through yonder window breaks?').toString('base64'),
};

describe('File upload through the daemon', () => {
    let daemon, client, server, received;

    beforeAll(async () => {
        server = http.createServer((request, response) => {
            const chunks = [];
            request.on('data', (chunk) => chunks.push(chunk));
            request.on('end', () => {
                received = { method: request.method, body: Buffer.concat(chunks) };
                response.writeHead(201).end();
            });
        });
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const { port } = server.address();
        daemon = await startDaemon({
            roster: [{ jid: JULIET, name: 'Juliet Capulet' }],
            policy: { allow: [JULIET] },
            upload_service: {
                jid: 'upload.montague.lit',
                put_url: `http://127.0.0.1:${port}/put/balcony.txt`,
                get_url: `http://127.0.0.1:${port}/get/balcony.txt`,
                max_file_size: 1024,
            },
        });
        client = await daemon.connect();
    });

    afterAll(async () => {
        client?.close();
        await daemon?.stop();
        await new Promise((resolve) => server?.close(resolve));
    });

    const audit = () => fsSync.readFileSync(daemon.config.paths.audit, 'utf8').trim().split('\n').map(JSON.parse);
    const slotRequests = () =>
        daemon.connection.IQ_stanzas.filter((iq) => iq.querySelector(`request[xmlns="${Strophe.NS.HTTPUPLOAD}"]`));
    const sentMessages = () => daemon.connection.sent_stanzas.filter((s) => s.nodeName === 'message');

    it('uploads with XEP-0363, sends the public URL with XEP-0066, and audits it', async () => {
        const result = await client.request('files.upload', { to: JULIET, ...BALCONY });

        expect(received).toEqual({
            method: 'PUT',
            body: Buffer.from('What light through yonder window breaks?'),
        });
        const request = slotRequests().at(-1);
        expect(request.getAttribute('to')).toBe('upload.montague.lit');
        expect(request.querySelector('request').getAttribute('filename')).toBe('balcony.txt');
        expect(request.querySelector('request').getAttribute('size')).toBe('40');

        const stanza = sentMessages().at(-1);
        const url = `http://127.0.0.1:${server.address().port}/get/balcony.txt`;
        expect(stanza.getAttribute('to')).toBe(JULIET);
        expect(stanza.querySelector('body').textContent).toBe(url);
        expect(stanza.querySelector(`x[xmlns="${Strophe.NS.OUTOFBAND}"] url`).textContent).toBe(url);
        expect(result).toMatchObject({ outcome: 'sent', message: { conversation: JULIET, body: url } });
        expect(audit().at(-1)).toMatchObject({ to: JULIET, outcome: 'sent', action: 'upload' });
    });

    it('keeps only the last part of the name, whichever separator it uses', async () => {
        await client.request('files.upload', { to: JULIET, ...BALCONY, name: '../../etc\\balcony.txt' });
        expect(slotRequests().at(-1).querySelector('request').getAttribute('filename')).toBe('balcony.txt');
    });

    it('refuses a restricted upload that names a path, without reading it or asking for a slot', async () => {
        const restricted = await daemon.connect({ access: 'restricted' });
        const slots = slotRequests().length;
        const messages = sentMessages().length;
        try {
            await expect(
                restricted.request('files.upload', { to: BENVOLIO, path: daemon.config.paths.config }),
            ).rejects.toMatchObject({
                code: ERRORS.INVALID_PARAMS,
                message: expect.stringContaining('not a "path"'),
            });
        } finally {
            restricted.close();
        }
        expect(slotRequests()).toHaveLength(slots);
        expect(sentMessages()).toHaveLength(messages);
    });

    it('refuses contents that are not base64', async () => {
        await expect(
            client.request('files.upload', { to: JULIET, name: 'balcony.txt', content: 'not base64!' }),
        ).rejects.toMatchObject({ code: ERRORS.INVALID_PARAMS, message: expect.stringContaining('base64') });
    });

    it('checks restricted policy before uploading the file', async () => {
        const restricted = await daemon.connect({ access: 'restricted' });
        const slots = slotRequests().length;
        try {
            await expect(restricted.request('files.upload', { to: TYBALT, ...BALCONY })).resolves.toMatchObject({
                outcome: 'refused',
                rule: 'allowlist',
            });
        } finally {
            restricted.close();
        }
        expect(slotRequests()).toHaveLength(slots);
        expect(audit().at(-1)).toMatchObject({
            to: TYBALT,
            outcome: 'refused',
            action: 'upload',
            mode: 'owner_only',
        });
    });

    it('uploads directly to the owner from restricted access', async () => {
        const restricted = await daemon.connect({ access: 'restricted' });
        try {
            await expect(restricted.request('files.upload', { to: BENVOLIO, ...BALCONY })).resolves.toMatchObject({
                outcome: 'sent',
                message: { conversation: BENVOLIO },
            });
        } finally {
            restricted.close();
        }
        expect(audit().at(-1)).toMatchObject({
            to: BENVOLIO,
            outcome: 'sent',
            action: 'upload',
            route: 'direct',
            mode: 'owner_only',
        });
    });

    it('uploads an allowed restricted file as a draft URL for the owner', async () => {
        const restricted = await daemon.connect({ access: 'restricted' });
        try {
            await expect(restricted.request('files.upload', { to: JULIET, ...BALCONY })).resolves.toMatchObject({
                outcome: 'draft',
                draft_id: expect.any(String),
            });
        } finally {
            restricted.close();
        }
        expect(audit().at(-1)).toMatchObject({
            to: JULIET,
            outcome: 'draft',
            action: 'upload',
            route: 'draft',
        });
    });

    it('reports the server size limit and sends neither the file nor a message', async () => {
        const slots = slotRequests().length;
        const messages = sentMessages().length;
        const large = { name: 'too-large.bin', content: Buffer.alloc(1025).toString('base64') };
        await expect(client.request('files.upload', { to: JULIET, ...large })).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
            message: expect.stringContaining("exceeds the server's 1024-byte upload limit"),
        });
        expect(slotRequests()).toHaveLength(slots);
        expect(sentMessages()).toHaveLength(messages);
    });

    it('refuses a request longer than any upload, before reading it in full, and closes the connection', async () => {
        const socket = net.createConnection(daemon.config.paths.restricted_socket);
        let response = '';
        socket.setEncoding('utf8').on('data', (data) => (response += data));
        const closed = new Promise((resolve) => socket.on('close', resolve));
        socket.on('error', () => {}); // Writing on after the daemon closed

        socket.write(
            JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'hello', params: { protocol: PROTOCOL_VERSION } }) + '\n',
        );
        socket.write('{"jsonrpc":"2.0","id":2,"method":"files.upload","params":{"content":"');
        // Twice the limit, never finished with a newline: the daemon has to
        // refuse it from the length alone.
        const chunk = 'A'.repeat(1024 * 1024);
        for (let sent = 0; sent < MAX_LINE_LENGTH * 2 && !socket.destroyed; sent += chunk.length) {
            if (!socket.write(chunk)) await Promise.race([once(socket, 'drain'), closed]);
        }
        await closed;

        const [hello, refusal] = response.trim().split('\n').map(JSON.parse);
        expect(hello).toMatchObject({ id: 1, result: { protocol: PROTOCOL_VERSION } });
        expect(refusal).toMatchObject({
            id: null,
            error: { code: ERRORS.INVALID_REQUEST, message: expect.stringContaining('connection closed') },
        });
        await expect(client.request('daemon.status')).resolves.toMatchObject({ connected: true });
    });
});
