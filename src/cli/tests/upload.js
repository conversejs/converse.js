import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDaemon } from '../../daemon/tests/harness.js';
import { EXIT } from '../exit-codes.js';
import { run } from './run.js';

const JULIET = 'juliet@capulet.lit';

describe('converse-cli upload', () => {
    let daemon, dir, file, server;

    beforeAll(async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'converse-cli-upload-test-'));
        file = path.join(dir, 'balcony.txt');
        await fs.writeFile(file, 'Arise, fair sun');
        server = http.createServer((request, response) => {
            request.resume();
            request.on('end', () => response.writeHead(201).end());
        });
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const { port } = server.address();
        daemon = await startDaemon({
            access: 'full',
            roster: [{ jid: JULIET, name: 'Juliet Capulet' }],
            upload_service: {
                jid: 'upload.montague.lit',
                put_url: `http://127.0.0.1:${port}/put/balcony.txt`,
                get_url: `http://127.0.0.1:${port}/get/balcony.txt`,
                max_file_size: 1024,
            },
        });
    });

    afterAll(async () => {
        await daemon?.stop();
        await new Promise((resolve) => server?.close(resolve));
        await fs.rm(dir, { recursive: true, force: true });
    });

    it('uploads a local file and says where its URL was sent', async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'upload', 'Juliet Capulet', file);
        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        expect(stdout).toMatch(/^Uploaded "balcony\.txt" to juliet@capulet\.lit as .+\n$/);
    });

    it('prints the stable send result with --json', async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'upload', JULIET, file, '--json');
        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        expect(JSON.parse(stdout)).toMatchObject({
            outcome: 'sent',
            message: {
                conversation: JULIET,
                body: `http://127.0.0.1:${server.address().port}/get/balcony.txt`,
            },
        });
    });

    it('sends the file under its name only, not its path', async () => {
        const before = daemon.connection.IQ_stanzas.length;
        const { code } = await run(daemon.env, 'upload', JULIET, file);
        expect(code).toBe(EXIT.OK);
        const request = daemon.connection.IQ_stanzas.slice(before).find((iq) => iq.querySelector('request'));
        expect(request.querySelector('request').getAttribute('filename')).toBe('balcony.txt');
    });

    it('fails on a file it cannot read, before asking the daemon for anything', async () => {
        const before = daemon.connection.IQ_stanzas.length;
        const missing = path.join(dir, 'missing.txt');
        const { code, stdout, stderr } = await run(daemon.env, 'upload', JULIET, missing);
        expect({ code, stdout }).toEqual({ code: EXIT.ERROR, stdout: '' });
        expect(stderr).toBe(
            `converse-cli: The file at ${JSON.stringify(missing)} could not be read (ENOENT). ` +
                'Check that the path names a readable file, then try again.\n',
        );
        expect(daemon.connection.IQ_stanzas).toHaveLength(before);
    });

    it('fails on a directory', async () => {
        const { code, stderr } = await run(daemon.env, 'upload', JULIET, dir);
        expect(code).toBe(EXIT.ERROR);
        expect(stderr).toContain('could not be read (not a regular file)');
    });

    it('requires one recipient and one path', async () => {
        const { code, stderr } = await run(daemon.env, 'upload', JULIET);
        expect(code).toBe(EXIT.ERROR);
        expect(stderr).toContain('Expected a recipient and a local file path.');
    });
});
