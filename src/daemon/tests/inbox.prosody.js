/**
 * Read cursors on a real Prosody: they have to outlive the daemon, so that an
 * agent's inbox after a restart shows only what came since its last read.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eventually, registerAccount, startDaemon } from './real-server.js';

describe('Read cursors on a real Prosody', () => {
    const daemons = [];
    let romeo, juliet;

    beforeAll(async () => {
        [romeo, juliet] = await Promise.all([
            registerAccount('romeo').then(startDaemon),
            registerAccount('juliet').then(startDaemon),
        ]);
        daemons.push(romeo, juliet);
    });

    afterAll(() => Promise.all(daemons.map((d) => d.stop())));

    /**
     * Waits until Juliet's daemon has stored a message from Romeo with this body.
     * @param {string} body
     * @param {number} [timeout]
     */
    const storedFromRomeo = (body, timeout) =>
        eventually(
            async () =>
                (await juliet.request('messages.list', { conversation: romeo.jid })).messages.find(
                    (m) => m.body === body,
                ),
            { timeout, what: `"${body}" from Romeo` },
        );

    /** The bodies of Juliet's inbox, from Romeo. */
    async function inboxBodies() {
        const { conversations } = await juliet.request('inbox.read');
        return conversations.flatMap((g) => g.messages.map((m) => m.body));
    }

    it('shows what arrived since the last read, and keeps that across a restart', async () => {
        // Juliet's first look sets her baseline, so the first message is unread.
        await juliet.request('conversations.list');
        await romeo.request('messages.send', { to: juliet.jid, body: 'Before the restart' });
        await storedFromRomeo('Before the restart');

        expect(await inboxBodies()).toEqual(['Before the restart']);
        expect(await inboxBodies()).toEqual([]);

        await juliet.restart();
        expect(await inboxBodies()).toEqual([]);

        // Right after a restart the server may not yet count Juliet's daemon as
        // online, and then a message is held back rather than delivered. So
        // keep sending until one gets through, and check for that one.
        const body = await eventually(
            async () => {
                const sent = `After the restart ${Date.now()}`;
                await romeo.request('messages.send', { to: juliet.jid, body: sent });
                return await storedFromRomeo(sent, 1000).then(
                    () => sent,
                    () => null,
                );
            },
            { what: 'a message after the restart' },
        );
        const bodies = await inboxBodies();
        expect(bodies).toContain(body);
        expect(bodies).not.toContain('Before the restart');
    });
});
