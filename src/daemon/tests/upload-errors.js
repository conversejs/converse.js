import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDaemon } from './harness.js';

const JULIET = 'juliet@capulet.lit';

describe('File upload without an XEP-0363 service', () => {
    let daemon, client;

    beforeAll(async () => {
        daemon = await startDaemon({ roster: [{ jid: JULIET, name: 'Juliet Capulet' }] });
        client = await daemon.connect();
    });

    afterAll(async () => {
        client?.close();
        await daemon?.stop();
    });

    it('says that the server has no upload service and what to do next', async () => {
        const letter = { name: 'letter.txt', content: Buffer.from('A letter').toString('base64') };
        await expect(client.request('files.upload', { to: JULIET, ...letter })).rejects.toMatchObject({
            message: expect.stringMatching(/no HTTP file upload service.*nothing was sent.*server administrator/is),
        });
    });
});
