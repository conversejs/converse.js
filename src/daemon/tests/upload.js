import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { converse } from '@converse/headless';
import { ERRORS } from '../protocol.js';
import { BENVOLIO } from './account.js';
import { startDaemon } from './harness.js';

const { Strophe } = converse.env;
const JULIET = 'juliet@capulet.lit';
const TYBALT = 'tybalt@capulet.lit';

describe('File upload through the daemon', () => {
    let daemon, client, dir, file, server, received;

    beforeAll(async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'converse-upload-test-'));
        file = path.join(dir, 'balcony.txt');
        await fs.writeFile(file, 'What light through yonder window breaks?');
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
        await fs.rm(dir, { recursive: true, force: true });
    });

    const audit = () => fsSync.readFileSync(daemon.config.paths.audit, 'utf8').trim().split('\n').map(JSON.parse);

    it('uploads with XEP-0363, sends the public URL with XEP-0066, and audits it', async () => {
        const result = await client.request('files.upload', { to: JULIET, path: file });

        expect(received).toEqual({
            method: 'PUT',
            body: Buffer.from('What light through yonder window breaks?'),
        });
        const request = daemon.connection.IQ_stanzas.find((iq) =>
            iq.querySelector(`request[xmlns="${Strophe.NS.HTTPUPLOAD}"]`),
        );
        expect(request.getAttribute('to')).toBe('upload.montague.lit');
        expect(request.querySelector('request').getAttribute('filename')).toBe('balcony.txt');
        expect(request.querySelector('request').getAttribute('size')).toBe('40');

        const stanza = daemon.connection.sent_stanzas.filter((s) => s.nodeName === 'message').at(-1);
        const url = `http://127.0.0.1:${server.address().port}/get/balcony.txt`;
        expect(stanza.getAttribute('to')).toBe(JULIET);
        expect(stanza.querySelector('body').textContent).toBe(url);
        expect(stanza.querySelector(`x[xmlns="${Strophe.NS.OUTOFBAND}"] url`).textContent).toBe(url);
        expect(result).toMatchObject({ outcome: 'sent', message: { conversation: JULIET, body: url } });
        expect(audit().at(-1)).toMatchObject({ to: JULIET, outcome: 'sent', action: 'upload' });
        expect(JSON.stringify(audit().at(-1))).not.toContain(file);
    });

    it('checks restricted policy before reading or uploading the file', async () => {
        const restricted = await daemon.connect({ access: 'restricted' });
        const missing = path.join(dir, 'does-not-exist');
        try {
            await expect(restricted.request('files.upload', { to: TYBALT, path: missing })).resolves.toMatchObject({
                outcome: 'refused',
                rule: 'allowlist',
            });
        } finally {
            restricted.close();
        }
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
            await expect(restricted.request('files.upload', { to: BENVOLIO, path: file })).resolves.toMatchObject({
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
            await expect(restricted.request('files.upload', { to: JULIET, path: file })).resolves.toMatchObject({
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

    it('reports an unreadable path without asking the upload service for a slot', async () => {
        const before = daemon.connection.IQ_stanzas.length;
        await expect(
            client.request('files.upload', { to: JULIET, path: path.join(dir, 'missing.txt') }),
        ).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
            message: expect.stringContaining('could not be read'),
        });
        expect(daemon.connection.IQ_stanzas).toHaveLength(before);
    });

    it('reports the server size limit and sends neither the file nor a message', async () => {
        const large = path.join(dir, 'too-large.bin');
        await fs.writeFile(large, Buffer.alloc(1025));
        const messages = daemon.connection.sent_stanzas.filter((s) => s.nodeName === 'message').length;
        await expect(client.request('files.upload', { to: JULIET, path: large })).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
            message: expect.stringContaining("exceeds the server's 1024-byte upload limit"),
        });
        expect(daemon.connection.sent_stanzas.filter((s) => s.nodeName === 'message')).toHaveLength(messages);
    });
});
