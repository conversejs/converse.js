import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDaemon } from './harness.js';

const JULIET = 'juliet@capulet.lit';

describe('File upload without an XEP-0363 service', () => {
    let daemon, client, dir, file;

    beforeAll(async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'converse-upload-error-test-'));
        file = path.join(dir, 'letter.txt');
        await fs.writeFile(file, 'A letter');
        daemon = await startDaemon({ roster: [{ jid: JULIET, name: 'Juliet Capulet' }] });
        client = await daemon.connect();
    });

    afterAll(async () => {
        client?.close();
        await daemon?.stop();
        await fs.rm(dir, { recursive: true, force: true });
    });

    it('says that the server has no upload service and what to do next', async () => {
        await expect(client.request('files.upload', { to: JULIET, path: file })).rejects.toMatchObject({
            message: expect.stringMatching(/no HTTP file upload service.*nothing was sent.*server administrator/is),
        });
    });
});
