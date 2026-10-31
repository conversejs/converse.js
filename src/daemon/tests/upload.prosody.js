import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eventually, registerAccount, startDaemon } from './real-server.js';

describe('File upload on a real Prosody', () => {
    const daemons = [];
    const contents = Buffer.from('But soft, what light through yonder window breaks?\n');
    let romeo, juliet;

    beforeAll(async () => {
        [romeo, juliet] = await Promise.all([
            registerAccount('upload-romeo').then(startDaemon),
            registerAccount('upload-juliet').then(startDaemon),
        ]);
        daemons.push(romeo, juliet);
    });

    afterAll(async () => {
        await Promise.all(daemons.map((daemon) => daemon.stop()));
    });

    it('delivers a URL whose download is byte-for-byte the uploaded file', async () => {
        const result = await romeo.requestFull('files.upload', {
            to: juliet.jid,
            name: 'balcony.txt',
            content: contents.toString('base64'),
        });
        expect(result).toMatchObject({ outcome: 'sent', message: { body: expect.stringMatching(/^http:\/\//) } });

        const received = await eventually(
            async () =>
                (await juliet.requestFull('messages.list', { conversation: romeo.jid })).messages.find(
                    (message) => message.body === result.message.body,
                ),
            { what: 'the uploaded file URL to reach the other daemon' },
        );
        expect(received).toMatchObject({ from: romeo.jid, direction: 'incoming' });

        const response = await fetch(received.body);
        expect(response.status).toBe(200);
        expect(Buffer.from(await response.arrayBuffer())).toEqual(contents);
    });
});
