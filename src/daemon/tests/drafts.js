import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { converse } from '@converse/headless';
import { start } from '../daemon.js';
import { ERRORS } from '../protocol.js';
import { startDaemon } from './harness.js';

const { u } = converse.env;

const JULIET = 'juliet@capulet.lit';
const MERCUTIO = 'mercutio@montague.lit';
const ROSTER = [
    { jid: JULIET, name: 'Juliet Capulet' },
    { jid: MERCUTIO, name: 'Mercutio' },
];

describe('Drafts', () => {
    let daemon;

    /**
     * @param {Object} policy - The send policy, from the config file
     */
    async function begin(policy) {
        daemon = await startDaemon({ roster: ROSTER, policy });
        return daemon;
    }

    /** The message stanzas the daemon has put on the wire, as they are now. */
    const sentMessages = () => daemon.api.connection.get().sent_stanzas.filter((s) => s.nodeName === 'message');

    /** The bodies of those stanzas. */
    const sentBodies = () => sentMessages().map((s) => s.querySelector('body')?.textContent);

    /** The audit log's entries, oldest first. */
    const audit = () =>
        fs
            .readFileSync(daemon.config.paths.audit, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line));

    /**
     * Sends from a restricted connection, and hangs up.
     * @param {string} to
     * @param {string} body
     */
    async function restrictedSend(to, body) {
        const client = await daemon.connect({ access: 'restricted' });
        try {
            return await client.request('messages.send', { to, body });
        } finally {
            client.close();
        }
    }

    /**
     * Calls a method on a full connection, and hangs up.
     * @param {string} method
     * @param {Object} [params]
     */
    async function fullRequest(method, params) {
        const client = await daemon.connect();
        try {
            return await client.request(method, params);
        } finally {
            client.close();
        }
    }

    afterEach(async () => {
        await daemon?.stop();
        daemon = undefined;
    });

    it('queues a restricted send to a draft-mode JID, sends nothing, and says which draft it is', async () => {
        await begin({ allow: [JULIET], draft: true });
        expect(await restrictedSend(JULIET, 'Shall we meet at noon?')).toEqual({ outcome: 'draft', draft_id: 'd1' });

        expect(sentMessages()).toHaveLength(0);
        expect(audit()).toEqual([
            { time: expect.any(String), consumer: 'claude', to: JULIET, outcome: 'draft', draft: 'd1' },
        ]);
    });

    it('lists the queued drafts with their body, recipient and who queued them', async () => {
        await begin({ allow: [JULIET], draft: true });
        await restrictedSend(JULIET, 'Shall we meet at noon?');

        expect(await fullRequest('drafts.list')).toEqual({
            drafts: [
                {
                    id: 'd1',
                    to: JULIET,
                    body: 'Shall we meet at noon?',
                    consumer: 'claude',
                    created: expect.any(String),
                },
            ],
        });
    });

    it('refuses every drafts method at restricted access, and changes nothing', async () => {
        await begin({ allow: [JULIET], draft: true });
        await restrictedSend(JULIET, 'Shall we meet at noon?');

        const restricted = await daemon.connect({ access: 'restricted' });
        for (const [method, params] of [
            ['drafts.list', {}],
            ['drafts.approve', { id: 'd1' }],
            ['drafts.edit', { id: 'd1', body: 'Changed' }],
            ['drafts.reject', { id: 'd1' }],
        ]) {
            await expect(restricted.request(method, params)).rejects.toMatchObject({ code: ERRORS.ACCESS_DENIED });
        }
        restricted.close();

        expect(sentMessages()).toHaveLength(0);
        expect((await fullRequest('drafts.list')).drafts.map((d) => d.body)).toEqual(['Shall we meet at noon?']);
    });

    it('drafts only the sends to the JIDs listed, when draft is a list', async () => {
        await begin({ allow: [JULIET, MERCUTIO], draft: [JULIET] });
        expect(await restrictedSend(MERCUTIO, 'Come to the park')).toMatchObject({ outcome: 'sent' });
        expect(await restrictedSend(JULIET, 'Wherefore art thou?')).toEqual({ outcome: 'draft', draft_id: 'd1' });
        expect(sentBodies()).toEqual(['Come to the park']);
    });

    it('lets a full connection send directly, even when the policy would draft', async () => {
        await begin({ allow: [JULIET], draft: true });
        expect(await fullRequest('messages.send', { to: JULIET, body: 'Sent by me' })).toMatchObject({
            outcome: 'sent',
        });
        expect(sentBodies()).toEqual(['Sent by me']);
        expect((await fullRequest('drafts.list')).drafts).toEqual([]);
    });

    it('counts a queued send toward the rate limit, so the queue fills no faster than sends would', async () => {
        await begin({ allow: [JULIET], draft: true, rate_limit: { per_conversation: 1, overall: 20, window: 60 } });
        expect(await restrictedSend(JULIET, 'One')).toEqual({ outcome: 'draft', draft_id: 'd1' });
        expect(await restrictedSend(JULIET, 'Two')).toMatchObject({ outcome: 'refused', rule: 'rate_conversation' });
    });

    it('refuses to draft a send the allowlist refuses, rather than queue it', async () => {
        await begin({ allow: [JULIET], draft: true });
        expect(await restrictedSend(MERCUTIO, 'Hello')).toMatchObject({ outcome: 'refused', rule: 'allowlist' });
        expect((await fullRequest('drafts.list')).drafts).toEqual([]);
    });

    it('sends an approved draft as it stands, removes it, and audits the send against the draft', async () => {
        await begin({ allow: [JULIET], draft: true });
        await restrictedSend(JULIET, 'Shall we meet at noon?');

        const result = await fullRequest('drafts.approve', { id: 'd1' });
        expect(result).toMatchObject({ outcome: 'sent', message: { conversation: JULIET, direction: 'outgoing' } });
        expect(sentBodies()).toEqual(['Shall we meet at noon?']);
        expect((await fullRequest('drafts.list')).drafts).toEqual([]);
        expect(audit().at(-1)).toEqual({
            time: expect.any(String),
            consumer: 'claude',
            to: JULIET,
            outcome: 'sent',
            id: result.message.id,
            draft: 'd1',
        });
    });

    it('sends the text as edited when a draft is approved, and an edit alone sends nothing', async () => {
        await begin({ allow: [JULIET], draft: true });
        await restrictedSend(JULIET, 'Shall we meet at noon?');

        expect(await fullRequest('drafts.edit', { id: 'd1', body: 'Shall we meet at one?' })).toMatchObject({
            draft: { id: 'd1', body: 'Shall we meet at one?' },
        });
        expect(sentMessages()).toHaveLength(0);

        await fullRequest('drafts.approve', { id: 'd1' });
        expect(sentBodies()).toEqual(['Shall we meet at one?']);
    });

    it('drops a rejected draft for good, sends nothing, and audits the rejection', async () => {
        await begin({ allow: [JULIET], draft: true });
        await restrictedSend(JULIET, 'Shall we meet at noon?');

        expect(await fullRequest('drafts.reject', { id: 'd1' })).toMatchObject({ draft: { id: 'd1' } });
        expect(sentMessages()).toHaveLength(0);
        expect(audit().at(-1)).toEqual({
            time: expect.any(String),
            consumer: 'claude',
            to: JULIET,
            outcome: 'rejected',
            draft: 'd1',
        });
        await expect(fullRequest('drafts.approve', { id: 'd1' })).rejects.toMatchObject({ code: ERRORS.NOT_FOUND });
    });

    it('says what is wrong with a draft it cannot act on', async () => {
        await begin({ allow: [JULIET], draft: true });
        await restrictedSend(JULIET, 'Shall we meet at noon?');

        await expect(fullRequest('drafts.approve', { id: 'd99' })).rejects.toMatchObject({
            code: ERRORS.NOT_FOUND,
            message: 'No draft with id "d99". List the drafts waiting for approval with "converse-cli drafts list".',
        });
        await expect(fullRequest('drafts.edit', { id: 'd1', body: '   ' })).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
            message: 'There is nothing to send: "body" is empty.',
        });
        await expect(fullRequest('drafts.reject', { id: 7 })).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
        });
    });

    it('keeps drafts across a restart, and never reuses a draft id', async () => {
        await begin({ allow: [JULIET], draft: true });
        await restrictedSend(JULIET, 'Shall we meet at noon?');

        await daemon.daemon.stop();
        daemon.daemon = await start(daemon.config);

        expect((await fullRequest('drafts.list')).drafts.map((d) => [d.id, d.body])).toEqual([
            ['d1', 'Shall we meet at noon?'],
        ]);
        expect(await restrictedSend(JULIET, 'And after that?')).toEqual({ outcome: 'draft', draft_id: 'd2' });
    });

    it('announces drafts to draft subscribers as they are queued, edited and approved', async () => {
        await begin({ allow: [JULIET], draft: true });
        const drafts_client = await daemon.connect();
        const messages_client = await daemon.connect();
        const drafted = [];
        const messages = [];
        drafts_client.onEvent((event) => drafted.push(event));
        messages_client.onEvent((event) => messages.push(event));
        await drafts_client.request('events.subscribe', { type: 'draft' });
        await messages_client.request('events.subscribe', {});

        await restrictedSend(JULIET, 'Shall we meet at noon?');
        await fullRequest('drafts.edit', { id: 'd1', body: 'Shall we meet at one?' });
        await fullRequest('drafts.approve', { id: 'd1' });

        await u.waitUntil(() => drafted.length === 3 && messages.length === 1);
        drafts_client.close();
        messages_client.close();

        expect(drafted.map(({ type, action, draft }) => [type, action, draft.body])).toEqual([
            ['draft', 'queued', 'Shall we meet at noon?'],
            ['draft', 'edited', 'Shall we meet at one?'],
            ['draft', 'approved', 'Shall we meet at one?'],
        ]);
        // A message subscriber sees the send that the approval made, and not the drafts.
        expect(messages.map(({ type, message }) => [type, message.direction, message.body])).toEqual([
            ['message', 'outgoing', 'Shall we meet at one?'],
        ]);
    });

    it('filters draft events by the conversation they are addressed to', async () => {
        await begin({ allow: [JULIET, MERCUTIO], draft: true });
        const client = await daemon.connect();
        const drafted = [];
        client.onEvent((event) => drafted.push(event));
        await client.request('events.subscribe', { type: 'draft', conversation: MERCUTIO });

        await restrictedSend(JULIET, 'For Juliet');
        await restrictedSend(MERCUTIO, 'For Mercutio');
        await u.waitUntil(() => drafted.length === 1);
        client.close();

        expect(drafted.map(({ draft }) => draft.to)).toEqual([MERCUTIO]);
    });
});
