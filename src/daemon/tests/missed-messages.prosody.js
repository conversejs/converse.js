/**
 * Messages sent while a daemon is down or cut off, on a real Prosody.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eventually, registerAccount, startDaemon, startProxy } from './real-server.js';

/**
 * @param {{ request: Function }} daemon
 * @param {string} conversation
 * @param {string[]} bodies
 */
function waitForMessages(daemon, conversation, bodies) {
    return eventually(
        async () => {
            const { messages } = await daemon.request('messages.list', { conversation, limit: 50 });
            const found = bodies.map((body) => messages.filter((m) => m.body === body));
            return found.every((f) => f.length) && found;
        },
        { timeout: 20000, what: `${bodies.length} messages in the conversation with ${conversation}` },
    );
}

describe('Messages a daemon missed', () => {
    const cleanup = [];
    let juliet;

    beforeAll(async () => {
        juliet = await startDaemon(await registerAccount('juliet'));
        cleanup.push(() => juliet.stop());
    });

    afterAll(() => Promise.all(cleanup.map((f) => f())));

    it('are readable after the daemon restarts, each once', async () => {
        const romeo = await startDaemon(await registerAccount('romeo'));
        cleanup.push(() => romeo.stop());
        await juliet.request('messages.send', { to: romeo.jid, body: 'Before' });
        await waitForMessages(romeo, juliet.jid, ['Before']);

        const missed = ['While you were out', 'And again'];
        await romeo.restart(async () => {
            for (const body of missed) await juliet.request('messages.send', { to: romeo.jid, body });
        });

        const found = await waitForMessages(romeo, juliet.jid, ['Before', ...missed]);
        expect(found.map((f) => f.length)).toEqual([1, 1, 1]);
    });

    it('arrive when the connection drops and the stream is resumed', async () => {
        const proxy = await startProxy();
        cleanup.push(() => proxy.close());
        const romeo = await startDaemon(await registerAccount('romeo'), { websocket_url: proxy.websocket_url });
        cleanup.push(() => romeo.stop());
        await juliet.request('messages.send', { to: romeo.jid, body: 'Hello' });
        await waitForMessages(romeo, juliet.jid, ['Hello']);
        expect((await romeo.request('daemon.status')).resumed).toBe(false);

        // Sent into the gap: the server holds them for the hibernating session.
        proxy.drop();
        const missed = ['Are you there?', 'Hello?'];
        for (const body of missed) await juliet.request('messages.send', { to: romeo.jid, body });

        await eventually(async () => (await romeo.request('daemon.status')).resumed, {
            timeout: 30000,
            what: 'the stream to be resumed',
        });
        const found = await waitForMessages(romeo, juliet.jid, missed);
        expect(found.map((f) => f.length)).toEqual([1, 1]);
    });
});
