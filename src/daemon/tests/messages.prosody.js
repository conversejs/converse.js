/**
 * Daemons on a real Prosody: what a mock connection can't show, since it
 * encodes our own assumptions about the server.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eventually, registerAccount, startDaemon } from './real-server.js';

/**
 * @param {{ request: Function }} daemon
 * @param {string} conversation
 * @param {string} body
 * @param {number} [timeout]
 */
function waitForMessage(daemon, conversation, body, timeout) {
    return eventually(
        async () => (await daemon.request('messages.list', { conversation })).messages.find((m) => m.body === body),
        { timeout, what: `"${body}" in the conversation with ${conversation}` },
    );
}

describe('Daemons on a real Prosody', () => {
    const daemons = [];
    let romeo_account, romeo, juliet;

    beforeAll(async () => {
        romeo_account = await registerAccount('romeo');
        [romeo, juliet] = await Promise.all([startDaemon(romeo_account), registerAccount('juliet').then(startDaemon)]);
        daemons.push(romeo, juliet);
    });

    afterAll(() => Promise.all(daemons.map((d) => d.stop())));

    it('exchange 1:1 messages in both directions', async () => {
        const sent = await romeo.request('messages.send', { to: juliet.jid, body: 'But soft!' });
        expect(sent.outcome).toBe('sent');

        const received = await waitForMessage(juliet, romeo.jid, 'But soft!');
        expect(received).toMatchObject({ conversation: romeo.jid, from: romeo.jid, direction: 'incoming' });
        // Juliet's server archived it, and the id it assigned is the one she sees.
        expect(received.id).not.toBe(sent.message.id);

        await juliet.request('messages.send', { to: romeo.jid, body: 'Ay me!' });
        await expect(waitForMessage(romeo, juliet.jid, 'Ay me!')).resolves.toMatchObject({
            from: juliet.jid,
            direction: 'incoming',
        });
    });

    it("shows a message sent from another of the account's devices, via carbons", async () => {
        // A second daemon on Romeo's account stands in for his phone.
        const phone = await startDaemon(romeo_account, { resource: 'phone' });
        daemons.push(phone);

        // The daemon enables carbons shortly after connecting, and nothing
        // says when it's done. So keep sending until a copy arrives: a missed
        // first message means carbons weren't on yet, not that they're broken.
        const copy = await eventually(
            async () => {
                const body = `From my phone ${Date.now()}`;
                await phone.request('messages.send', { to: juliet.jid, body });
                return await waitForMessage(romeo, juliet.jid, body, 3000).catch(() => null);
            },
            { timeout: 20000, what: 'a carbon copy' },
        );
        expect(copy).toMatchObject({ conversation: juliet.jid, from: romeo.jid, direction: 'outgoing' });
    });
});
