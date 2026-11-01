import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { BENVOLIO } from './account.js';
import { startDaemon } from './harness.js';

const JULIET = 'juliet@capulet.lit';
const MERCUTIO = 'mercutio@montague.lit';
const TYBALT = 'tybalt@capulet.lit';
const ROSTER = [
    { jid: JULIET, name: 'Juliet Capulet' },
    { jid: MERCUTIO, name: 'Mercutio' },
    { jid: TYBALT, name: 'Tybalt' },
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

    /** The message stanzas the daemon has put on the wire, as {to, body} pairs. */
    const sent = () =>
        daemon.connection.sent_stanzas
            .filter((s) => s.nodeName === 'message')
            .map((s) => ({ to: s.getAttribute('to'), body: s.querySelector('body')?.textContent }));

    /** What went to the owner, each draft's notice as one entry. */
    const notices = () => sent().filter(({ to }) => to === BENVOLIO);

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

    it('drafts a restricted send to an allowlisted JID, delivering the text to the owner, and audits it', async () => {
        await start({ allow: [JULIET] });
        const client = await daemon.connect({ access: 'restricted' });
        const result = await client.request('messages.send', { to: JULIET, body: 'Hi' });
        client.close();

        expect(result).toEqual({ outcome: 'draft', draft_id: 'd1' });
        expect(sent().some(({ to }) => to === JULIET)).toBe(false);
        expect(notices()).toHaveLength(1);
        expect(notices()[0].body).toContain(`Draft d1 for ${JULIET}`);
        expect(notices()[0].body).toContain('"Hi"');
        expect(audit()).toEqual([
            {
                time: expect.any(String),
                consumer: 'agent',
                to: JULIET,
                outcome: 'draft',
                draft: 'd1',
                route: 'draft',
                mode: 'owner_only',
            },
        ]);
    });

    it('refuses a restricted send to anyone off the allowlist, without drafting it, and says which rule did', async () => {
        await start({ allow: [JULIET] });
        const client = await daemon.connect({ access: 'restricted' });
        const result = await client.request('messages.send', { to: TYBALT, body: 'Secret plan' });
        client.close();

        expect(result).toEqual({
            outcome: 'refused',
            rule: 'allowlist',
            message:
                'Restricted sends are only drafted for the JIDs listed in ' +
                `"policy.allow" in ${daemon.config.paths.config}, ` +
                `and ${TYBALT} isn't one of them.`,
        });
        expect(sent()).toHaveLength(0);
        expect(audit()).toEqual([
            {
                time: expect.any(String),
                consumer: 'agent',
                to: TYBALT,
                outcome: 'refused',
                rule: 'allowlist',
                mode: 'owner_only',
            },
        ]);
    });

    it('leaves the audit log without message bodies', async () => {
        await start({ allow: [JULIET] });
        const client = await daemon.connect({ access: 'restricted' });
        await client.request('messages.send', { to: JULIET, body: 'a body that must not be logged' });
        client.close();
        expect(notices()[0].body).toContain('must not be logged');
        expect(fs.readFileSync(daemon.config.paths.audit, 'utf8')).not.toContain('must not be logged');
    });

    it('lets a full connection send to anyone, outside the policy, and audits it', async () => {
        await start({ allow: [] });
        const client = await daemon.connect();
        const result = await client.request('messages.send', { to: MERCUTIO, body: 'Come to the park' });
        client.close();

        expect(result.outcome).toBe('sent');
        expect(sent()).toEqual([{ to: MERCUTIO, body: 'Come to the park' }]);
        expect(audit()).toEqual([
            { time: expect.any(String), consumer: 'agent', to: MERCUTIO, outcome: 'sent', id: result.message.id },
        ]);
    });

    it('limits drafts to one conversation, and leaves the others open', async () => {
        await start({ allow: [JULIET, MERCUTIO], rate_limit: { per_conversation: 2, overall: 20, window: 60 } });
        const client = await daemon.connect({ access: 'restricted' });
        const send = (to) => client.request('messages.send', { to, body: 'x' });

        expect((await send(JULIET)).outcome).toBe('draft');
        expect((await send(JULIET)).outcome).toBe('draft');
        expect(await send(JULIET)).toMatchObject({
            outcome: 'refused',
            rule: 'rate_conversation',
            message: expect.stringContaining('"policy.rate_limit.per_conversation"'),
        });
        expect((await send(MERCUTIO)).outcome).toBe('draft');
        client.close();
        expect(notices()).toHaveLength(3);
    });

    it('limits drafts across all conversations', async () => {
        await start({ allow: [JULIET, MERCUTIO], rate_limit: { per_conversation: 5, overall: 3, window: 60 } });
        const client = await daemon.connect({ access: 'restricted' });
        const send = (to) => client.request('messages.send', { to, body: 'x' });

        expect((await send(JULIET)).outcome).toBe('draft');
        expect((await send(MERCUTIO)).outcome).toBe('draft');
        expect((await send(JULIET)).outcome).toBe('draft');
        expect(await send(MERCUTIO)).toMatchObject({ outcome: 'refused', rule: 'rate_overall' });
        client.close();
    });

    it('does not count a refusal by the allowlist against the rate limits', async () => {
        await start({ allow: [JULIET], rate_limit: { per_conversation: 5, overall: 1, window: 60 } });
        const client = await daemon.connect({ access: 'restricted' });
        const send = (to) => client.request('messages.send', { to, body: 'x' });

        expect((await send(TYBALT)).rule).toBe('allowlist');
        expect((await send(TYBALT)).rule).toBe('allowlist');
        expect((await send(JULIET)).outcome).toBe('draft');
        client.close();
    });

    it('lets drafts through again once the window has passed', async () => {
        await start({ allow: [JULIET], rate_limit: { per_conversation: 1, overall: 20, window: 1 } });
        const client = await daemon.connect({ access: 'restricted' });
        const send = () => client.request('messages.send', { to: JULIET, body: 'x' });

        expect((await send()).outcome).toBe('draft');
        expect((await send()).rule).toBe('rate_conversation');
        await new Promise((resolve) => setTimeout(resolve, 1100));
        expect((await send()).outcome).toBe('draft');
        client.close();
    });

    it('audits every draft and refusal in order, whichever connection made it', async () => {
        await start({ allow: [JULIET] });
        const restricted = await daemon.connect({ access: 'restricted' });
        const full = await daemon.connect();
        await restricted.request('messages.send', { to: JULIET, body: 'one' });
        await restricted.request('messages.send', { to: TYBALT, body: 'two' });
        await full.request('messages.send', { to: MERCUTIO, body: 'three' });
        restricted.close();
        full.close();

        expect(audit().map(({ to, outcome }) => [to, outcome])).toEqual([
            [JULIET, 'draft'],
            [TYBALT, 'refused'],
            [MERCUTIO, 'sent'],
        ]);
    });
});
