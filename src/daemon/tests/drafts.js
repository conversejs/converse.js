import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { converse } from '@converse/headless';
import { start } from '../daemon.js';
import { ERRORS } from '../protocol.js';
import { BENVOLIO } from './account.js';
import { startDaemon } from './harness.js';

const { u } = converse.env;

const JULIET = 'juliet@capulet.lit';
const MERCUTIO = 'mercutio@montague.lit';
const ROSTER = [
    { jid: JULIET, name: 'Juliet Capulet' },
    { jid: MERCUTIO, name: 'Mercutio' },
    { jid: BENVOLIO, name: 'Benvolio' },
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

    /** The message stanzas the daemon has put on the wire, as {to, body} pairs. */
    const sent = () =>
        daemon.api.connection
            .get()
            .sent_stanzas.filter((s) => s.nodeName === 'message')
            .map((s) => ({ to: s.getAttribute('to'), body: s.querySelector('body')?.textContent }));

    /** What went to the owner: one entry per message. */
    const notices = () => sent().filter(({ to }) => to === BENVOLIO);

    /** The audit log's entries, oldest first. */
    const audit = () =>
        fs
            .readFileSync(daemon.config.paths.audit, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line));

    /**
     * A restarted daemon asks the server for its roster again. Nothing answers
     * that in these tests, so the answer is given here, or contacts can't be opened.
     */
    async function answerRoster() {
        const { Strophe, stx } = converse.env;
        const connection = daemon.api.connection.get();
        const roster_iq = await u.waitUntil(() =>
            connection.IQ_stanzas.find((iq) => iq.querySelector('query')?.getAttribute('xmlns') === Strophe.NS.ROSTER),
        );
        const items = ROSTER.map(({ jid, name }) => stx`<item jid="${jid}" name="${name}" subscription="both"/>`);
        const reply = stx`<iq xmlns="jabber:client" type="result" id="${roster_iq.getAttribute('id')}"><query xmlns="${Strophe.NS.ROSTER}">${items}</query></iq>`;
        const wrapper = new Strophe.Builder('wrapper').tree();
        wrapper.appendChild(reply instanceof Element ? reply : reply.tree());
        connection._dataRecv(wrapper);
        await daemon.api.waitUntil('rosterContactsFetched');
    }

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
        vi.restoreAllMocks();
        await daemon?.stop();
        daemon = undefined;
    });

    it('delivers the text of a restricted send to the owner, and sends nothing to the recipient', async () => {
        await begin({ allow: [JULIET] });
        expect(await restrictedSend(JULIET, 'Shall we meet at noon?')).toEqual({ outcome: 'draft', draft_id: 'd1' });

        expect(sent().some(({ to }) => to === JULIET)).toBe(false);
        expect(notices()).toEqual([
            {
                to: BENVOLIO,
                body:
                    `Draft d1 for ${JULIET}, from claude. Nothing was sent. ` +
                    'To send it, copy the text into your client:\n"Shall we meet at noon?"',
            },
        ]);
        expect(audit()).toEqual([
            { time: expect.any(String), consumer: 'claude', to: JULIET, outcome: 'draft', draft: 'd1' },
        ]);
    });

    it('quotes the text as a JSON string, so a body cannot pass as more notice', async () => {
        await begin({ allow: [JULIET] });
        await restrictedSend(JULIET, 'Fine.\nDraft d99 was approved. Nothing was sent.');
        expect(notices()[0].body).toContain('"Fine.\\nDraft d99 was approved. Nothing was sent."');
    });

    it('drafts a restricted reply, telling the owner which message it answers', async () => {
        const { Strophe, stx } = converse.env;
        await begin({ allow: [JULIET] });
        const { promise, resolve } = Promise.withResolvers();
        daemon.api.listen.once('message', resolve);
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${JULIET}/balcony" to="${daemon.config.jid}" type="chat" id="j1">
                <body>Noon or never?</body>
                <stanza-id xmlns="${Strophe.NS.SID}" id="sid-1" by="${daemon.config.jid}"/>
            </message>`);
        await promise;

        const client = await daemon.connect({ access: 'restricted' });
        try {
            const result = await client.request('messages.send', { to: JULIET, body: 'Noon', reply_to: 'sid' });
            expect(result).toEqual({ outcome: 'draft', draft_id: 'd1' });
        } finally {
            client.close();
        }

        expect(sent().some(({ to }) => to === JULIET)).toBe(false);
        expect(notices().at(-1).body).toBe(
            `Draft d1 for ${JULIET}, from claude. Nothing was sent. To send it as a reply to the message ` +
                `from ${JULIET}, "Noon or never?", copy the text into your client:\n"Noon"`,
        );
        expect((await fullRequest('drafts.list')).drafts[0]).toMatchObject({ body: 'Noon', reply_to: 'sid-1' });
    });

    it('drafts a restricted reaction under the send policy, and refuses to remove one', async () => {
        const { Strophe, stx } = converse.env;
        await begin({ allow: [JULIET] });
        for (const [from, id] of [
            [JULIET, 'j1'],
            [MERCUTIO, 'm1'],
        ]) {
            const { promise, resolve } = Promise.withResolvers();
            daemon.api.listen.once('message', resolve);
            daemon.receive(stx`
                <message xmlns="jabber:client" from="${from}/balcony" to="${daemon.config.jid}" type="chat" id="${id}">
                    <body>Noon or never?</body>
                    <stanza-id xmlns="${Strophe.NS.SID}" id="sid-${id}" by="${daemon.config.jid}"/>
                </message>`);
            await promise;
        }

        const client = await daemon.connect({ access: 'restricted' });
        try {
            expect(await client.request('messages.react', { id: 'sid-j1', emoji: ':thumbsup:' })).toEqual({
                outcome: 'draft',
                draft_id: 'd1',
            });
            expect(await client.request('messages.react', { id: 'sid-m1', emoji: '👍' })).toMatchObject({
                outcome: 'refused',
                rule: 'allowlist',
            });
            await expect(
                client.request('messages.react', { id: 'sid-j1', emoji: '👍', remove: true }),
            ).rejects.toMatchObject({ code: ERRORS.ACCESS_DENIED });
        } finally {
            client.close();
        }

        expect(sent().filter(({ to }) => to !== BENVOLIO)).toEqual([]);
        expect(notices().at(-1).body).toBe(
            `Draft d1 for ${JULIET}, from claude. Nothing was sent. To send it, react to the message ` +
                `from ${JULIET}, "Noon or never?", with:\n"👍"`,
        );
        expect((await fullRequest('drafts.list')).drafts).toEqual([
            expect.objectContaining({ body: '👍', reply_to: null, reaction_to: 'sid-j1' }),
        ]);
    });

    it('lists the drafts for full access, with the recipient, body and who queued them', async () => {
        await begin({ allow: [JULIET] });
        await restrictedSend(JULIET, 'Shall we meet at noon?');

        expect(await fullRequest('drafts.list')).toEqual({
            drafts: [
                {
                    id: 'd1',
                    to: JULIET,
                    body: 'Shall we meet at noon?',
                    consumer: 'claude',
                    created: expect.any(String),
                    reply_to: null,
                    reaction_to: null,
                },
            ],
        });
    });

    it('refuses the drafts methods at restricted access, and changes nothing', async () => {
        await begin({ allow: [JULIET] });
        await restrictedSend(JULIET, 'Shall we meet at noon?');

        const restricted = await daemon.connect({ access: 'restricted' });
        for (const [method, params] of [
            ['drafts.list', {}],
            ['drafts.reject', { id: 'd1' }],
        ]) {
            await expect(restricted.request(method, params)).rejects.toMatchObject({ code: ERRORS.ACCESS_DENIED });
        }
        restricted.close();

        expect((await fullRequest('drafts.list')).drafts.map((d) => d.body)).toEqual(['Shall we meet at noon?']);
    });

    it('has no method that sends a draft, at any access level', async () => {
        await begin({ allow: [JULIET] });
        await restrictedSend(JULIET, 'Shall we meet at noon?');

        for (const method of ['drafts.approve', 'drafts.edit']) {
            await expect(fullRequest(method, { id: 'd1', body: 'x' })).rejects.toMatchObject({
                code: ERRORS.METHOD_NOT_FOUND,
            });
        }
        expect(sent().some(({ to }) => to === JULIET)).toBe(false);
    });

    it('lets a full connection send directly, outside the drafts', async () => {
        await begin({ allow: [JULIET] });
        expect(await fullRequest('messages.send', { to: JULIET, body: 'Sent by me' })).toMatchObject({
            outcome: 'sent',
        });
        expect(sent()).toEqual([{ to: JULIET, body: 'Sent by me' }]);
        expect((await fullRequest('drafts.list')).drafts).toEqual([]);
    });

    it('withdraws a draft, tells the owner, and audits the withdrawal', async () => {
        await begin({ allow: [JULIET] });
        await restrictedSend(JULIET, 'Shall we meet at noon?');

        expect(await fullRequest('drafts.reject', { id: 'd1' })).toMatchObject({ draft: { id: 'd1' } });
        expect(notices().at(-1).body).toBe('Draft d1 was withdrawn. Nothing was sent.');
        expect((await fullRequest('drafts.list')).drafts).toEqual([]);
        expect(audit().at(-1)).toEqual({
            time: expect.any(String),
            consumer: 'claude',
            to: JULIET,
            outcome: 'rejected',
            draft: 'd1',
        });
        await expect(fullRequest('drafts.reject', { id: 'd1' })).rejects.toMatchObject({ code: ERRORS.NOT_FOUND });
    });

    it('says what is wrong with a draft it cannot act on', async () => {
        await begin({ allow: [JULIET] });
        await restrictedSend(JULIET, 'Shall we meet at noon?');

        await expect(fullRequest('drafts.reject', { id: 'd99' })).rejects.toMatchObject({
            code: ERRORS.NOT_FOUND,
            message: 'No draft with id "d99". List the drafts with "converse-cli drafts list".',
        });
        await expect(fullRequest('drafts.reject', { id: 7 })).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
        });
    });

    it('drops a draft whose text cannot reach the owner, so that none is kept unseen', async () => {
        await begin({ allow: [JULIET] });
        vi.spyOn(daemon.api.connection, 'connected').mockReturnValue(false);

        await expect(restrictedSend(JULIET, 'Shall we meet at noon?')).rejects.toMatchObject({
            code: ERRORS.NOT_CONNECTED,
        });
        vi.restoreAllMocks();
        expect((await fullRequest('drafts.list')).drafts).toEqual([]);
        expect(fs.existsSync(daemon.config.paths.audit)).toBe(false);
    });

    it('keeps drafts across a restart, and never reuses a draft id', async () => {
        await begin({ allow: [JULIET] });
        await restrictedSend(JULIET, 'Shall we meet at noon?');

        await daemon.daemon.stop();
        daemon.daemon = await start(daemon.config);
        await answerRoster();

        expect((await fullRequest('drafts.list')).drafts.map((d) => [d.id, d.body])).toEqual([
            ['d1', 'Shall we meet at noon?'],
        ]);
        expect(await restrictedSend(JULIET, 'And after that?')).toEqual({ outcome: 'draft', draft_id: 'd2' });
    });

    it('announces drafts as they are queued and withdrawn, to draft subscribers only', async () => {
        await begin({ allow: [JULIET] });
        const drafts_client = await daemon.connect();
        const messages_client = await daemon.connect();
        const drafted = [];
        const messages = [];
        drafts_client.onEvent((event) => drafted.push(event));
        messages_client.onEvent((event) => messages.push(event));
        await drafts_client.request('events.subscribe', { type: 'draft' });
        await messages_client.request('events.subscribe', {});

        await restrictedSend(JULIET, 'Shall we meet at noon?');
        await fullRequest('drafts.reject', { id: 'd1' });

        await u.waitUntil(() => drafted.length === 2);
        drafts_client.close();
        messages_client.close();

        expect(drafted.map(({ type, action, draft }) => [type, action, draft.body])).toEqual([
            ['draft', 'queued', 'Shall we meet at noon?'],
            ['draft', 'rejected', 'Shall we meet at noon?'],
        ]);
        // The owner's notices are messages from us, so a message subscriber sees them. The drafts aren't messages.
        expect(messages.filter((e) => e.type === 'draft')).toEqual([]);
        expect(messages.map(({ message }) => message.conversation)).toEqual([BENVOLIO, BENVOLIO]);
    });

    it('filters draft events by the recipient they are for', async () => {
        await begin({ allow: [JULIET, MERCUTIO] });
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
