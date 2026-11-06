/**
 * "as_user" mode on a real Prosody: the daemon is a second client on the
 * user's own account. A draft goes nowhere until full access sends it, and
 * then it reaches the recipient as the user's message, with a carbon for the
 * user's other client.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eventually, registerAccount, startDaemon } from './real-server.js';

/**
 * @param {{ requestFull: Function }} daemon
 * @param {string} conversation
 * @param {string} body
 * @param {number} [timeout]
 */
function waitForMessage(daemon, conversation, body, timeout) {
    return eventually(
        async () => (await daemon.requestFull('messages.list', { conversation })).messages.find((m) => m.body === body),
        { timeout, what: `"${body}" in the conversation with ${conversation}` },
    );
}

describe('Acting as the user on a real Prosody', () => {
    const daemons = [];
    let agent, phone, juliet;

    beforeAll(async () => {
        const [romeo_account, juliet_account] = await Promise.all([
            registerAccount('romeo'),
            registerAccount('juliet'),
        ]);
        [agent, phone, juliet] = await Promise.all([
            startDaemon(romeo_account, {
                mode: 'as_user',
                owner: romeo_account.jid,
                policy: { allow: [juliet_account.jid] },
            }),
            // A second client on Romeo's account, standing in for his phone.
            startDaemon(romeo_account, { resource: 'phone' }),
            startDaemon(juliet_account),
        ]);
        daemons.push(agent, phone, juliet);

        // Carbons are enabled shortly after connecting, and nothing says when
        // that's done, so wait until a send from the agent's client is copied
        // to the phone before relying on it.
        await eventually(
            async () => {
                const body = `Warming up ${Date.now()}`;
                await agent.requestFull('messages.send', { to: juliet.jid, body });
                return await waitForMessage(phone, juliet.jid, body, 3000).catch(() => null);
            },
            { timeout: 20000, what: 'carbons to be enabled' },
        );
    });

    afterAll(() => Promise.all(daemons.map((d) => d.stop())));

    it('holds a restricted send as a draft, and sends it as the user once full access approves it', async () => {
        const body = `Shall we meet at noon? ${Date.now()}`;
        const drafted = await agent.requestRestricted('messages.send', { to: juliet.jid, body });
        expect(drafted).toMatchObject({ outcome: 'draft' });

        // Nothing went out: the recipient and the user's other client have nothing yet.
        await expect(waitForMessage(juliet, agent.jid, body, 2000)).rejects.toThrow('Timed out');
        expect((await phone.requestFull('messages.list', { conversation: juliet.jid })).messages).not.toContainEqual(
            expect.objectContaining({ body }),
        );

        const sent = await agent.requestFull('drafts.send', { id: drafted.draft_id });
        expect(sent).toMatchObject({ outcome: 'sent', message: { from: agent.jid, body } });

        await expect(waitForMessage(juliet, agent.jid, body)).resolves.toMatchObject({
            from: agent.jid,
            direction: 'incoming',
        });
        await expect(waitForMessage(phone, juliet.jid, body)).resolves.toMatchObject({
            from: agent.jid,
            direction: 'outgoing',
        });
        expect((await agent.requestRestricted('drafts.list')).drafts).toEqual([]);
    });
});
