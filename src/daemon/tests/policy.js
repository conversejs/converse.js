import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { startDaemon } from './harness.js';

const JULIET = 'juliet@capulet.lit';
const MERCUTIO = 'mercutio@montague.lit';
const BENVOLIO = 'benvolio@montague.lit';
const ROSTER = [
    { jid: JULIET, name: 'Juliet Capulet' },
    { jid: MERCUTIO, name: 'Mercutio' },
    { jid: BENVOLIO, name: 'Benvolio' },
];

describe('The send policy', () => {
    let daemon;

    /**
     * @param {Object} policy - Overrides the allowlist and rate limits
     */
    async function start(policy) {
        daemon = await startDaemon({ roster: ROSTER, policy });
        return daemon;
    }

    /** The message stanzas the daemon has put on the wire. */
    const sentMessages = () => daemon.connection.sent_stanzas.filter((s) => s.nodeName === 'message');

    /** The audit log's entries, oldest first. */
    const audit = () =>
        fs
            .readFileSync(daemon.config.paths.audit, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line));

    afterEach(async () => {
        await daemon?.stop();
        daemon = undefined;
    });

    it('sends a restricted message to an allowlisted JID, and audits it', async () => {
        await start({ allow: [JULIET] });
        const client = await daemon.connect({ access: 'restricted' });
        const result = await client.request('messages.send', { to: JULIET, body: 'Hi' });
        client.close();

        expect(result).toMatchObject({ outcome: 'sent', message: { conversation: JULIET, body: 'Hi' } });
        expect(sentMessages()).toHaveLength(1);
        expect(audit()).toEqual([
            { time: expect.any(String), consumer: 'claude', to: JULIET, outcome: 'sent', id: result.message.id },
        ]);
    });

    it('refuses a restricted send to anyone off the allowlist, without sending, and says which rule did', async () => {
        await start({ allow: [JULIET] });
        const client = await daemon.connect({ access: 'restricted' });
        const result = await client.request('messages.send', { to: MERCUTIO, body: 'Secret plan' });
        client.close();

        expect(result).toEqual({
            outcome: 'refused',
            rule: 'allowlist',
            message:
                `Restricted sends only go to the JIDs listed in "policy.allow" in ${daemon.config.paths.config}, ` +
                `and ${MERCUTIO} isn't one of them.`,
        });
        expect(sentMessages()).toHaveLength(0);
        expect(audit()).toEqual([
            { time: expect.any(String), consumer: 'claude', to: MERCUTIO, outcome: 'refused', rule: 'allowlist' },
        ]);
    });

    it('leaves the audit log without message bodies', async () => {
        await start({ allow: [] });
        const client = await daemon.connect({ access: 'restricted' });
        await client.request('messages.send', { to: JULIET, body: 'a body that must not be logged' });
        client.close();
        expect(fs.readFileSync(daemon.config.paths.audit, 'utf8')).not.toContain('must not be logged');
    });

    it('lets a full connection send to anyone, outside the policy, and audits it', async () => {
        await start({ allow: [] });
        const client = await daemon.connect();
        const result = await client.request('messages.send', { to: BENVOLIO, body: 'Come to the park' });
        client.close();

        expect(result.outcome).toBe('sent');
        expect(sentMessages()).toHaveLength(1);
        expect(audit()).toEqual([
            { time: expect.any(String), consumer: 'claude', to: BENVOLIO, outcome: 'sent', id: result.message.id },
        ]);
    });

    it('limits restricted sends to one conversation, and leaves the others open', async () => {
        await start({ allow: [JULIET, MERCUTIO], rate_limit: { per_conversation: 2, overall: 20, window: 60 } });
        const client = await daemon.connect({ access: 'restricted' });
        const send = (to) => client.request('messages.send', { to, body: 'x' });

        expect((await send(JULIET)).outcome).toBe('sent');
        expect((await send(JULIET)).outcome).toBe('sent');
        expect(await send(JULIET)).toMatchObject({
            outcome: 'refused',
            rule: 'rate_conversation',
            message: expect.stringContaining('"policy.rate_limit.per_conversation"'),
        });
        expect((await send(MERCUTIO)).outcome).toBe('sent');
        client.close();
        expect(sentMessages()).toHaveLength(3);
    });

    it('limits restricted sends across all conversations', async () => {
        await start({ allow: [JULIET, MERCUTIO], rate_limit: { per_conversation: 5, overall: 3, window: 60 } });
        const client = await daemon.connect({ access: 'restricted' });
        const send = (to) => client.request('messages.send', { to, body: 'x' });

        expect((await send(JULIET)).outcome).toBe('sent');
        expect((await send(MERCUTIO)).outcome).toBe('sent');
        expect((await send(JULIET)).outcome).toBe('sent');
        expect(await send(MERCUTIO)).toMatchObject({ outcome: 'refused', rule: 'rate_overall' });
        client.close();
    });

    it('does not count a refusal by the allowlist against the rate limits', async () => {
        await start({ allow: [JULIET], rate_limit: { per_conversation: 5, overall: 1, window: 60 } });
        const client = await daemon.connect({ access: 'restricted' });
        const send = (to) => client.request('messages.send', { to, body: 'x' });

        expect((await send(BENVOLIO)).rule).toBe('allowlist');
        expect((await send(BENVOLIO)).rule).toBe('allowlist');
        expect((await send(JULIET)).outcome).toBe('sent');
        client.close();
    });

    it('lets sends through again once the window has passed', async () => {
        await start({ allow: [JULIET], rate_limit: { per_conversation: 1, overall: 20, window: 1 } });
        const client = await daemon.connect({ access: 'restricted' });
        const send = () => client.request('messages.send', { to: JULIET, body: 'x' });

        expect((await send()).outcome).toBe('sent');
        expect((await send()).rule).toBe('rate_conversation');
        await new Promise((resolve) => setTimeout(resolve, 1100));
        expect((await send()).outcome).toBe('sent');
        client.close();
    });

    it('audits every send and refusal in order, whichever connection made it', async () => {
        await start({ allow: [JULIET] });
        const restricted = await daemon.connect({ access: 'restricted' });
        const full = await daemon.connect();
        await restricted.request('messages.send', { to: JULIET, body: 'one' });
        await restricted.request('messages.send', { to: BENVOLIO, body: 'two' });
        await full.request('messages.send', { to: BENVOLIO, body: 'three' });
        restricted.close();
        full.close();

        expect(audit().map(({ to, outcome }) => [to, outcome])).toEqual([
            [JULIET, 'sent'],
            [BENVOLIO, 'refused'],
            [BENVOLIO, 'sent'],
        ]);
    });
});
