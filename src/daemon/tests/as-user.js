/**
 * Mode A ("as_user"): the daemon runs on the user's own account. Every
 * restricted send to an allowed target is a draft, held in the daemon and
 * delivered nowhere, until the user sends it from full access.
 */
import fs from 'node:fs';
import http from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { converse, log } from '@converse/headless';
import { start } from '../daemon.js';
import { ERRORS } from '../protocol.js';
import { JID, startDaemon } from './harness.js';

const { Strophe, stx, u } = converse.env;

const ME = Strophe.getBareJidFromJid(JID);
const JULIET = 'juliet@capulet.lit';
const TYBALT = 'tybalt@capulet.lit';
const GARDEN = 'garden@conference.montague.lit';
const HALL = 'hall@conference.montague.lit';
const ROSTER = [
    { jid: JULIET, name: 'Juliet Capulet' },
    { jid: TYBALT, name: 'Tybalt' },
];

describe('Acting as the user (as_user mode)', () => {
    let daemon;

    /**
     * @param {Partial<import('../types').Policy>} [policy]
     */
    async function begin(policy = { allow: [JULIET] }) {
        daemon = await startDaemon({ roster: ROSTER, mode: 'as_user', owner: ME, policy });
    }

    /** The message stanzas the daemon has put on the wire. */
    const sentStanzas = () => daemon.connection.sent_stanzas.filter((s) => s.nodeName === 'message');

    /** The audit log's entries, oldest first. */
    const audit = () =>
        fs
            .readFileSync(daemon.config.paths.audit, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line));

    /**
     * Calls a method on a connection of the given access level, and hangs up.
     * @param {import('../types').Access} access
     * @param {string} method
     * @param {Object} [params]
     */
    async function call(access, method, params) {
        const client = await daemon.connect({ access });
        try {
            return await client.request(method, params);
        } finally {
            client.close();
        }
    }
    const restricted = (method, params) => call('restricted', method, params);
    const full = (method, params) => call('full', method, params);

    /**
     * Feeds in a message from Juliet, and waits until it's stored.
     * @param {string} id
     * @param {string} body
     */
    async function fromJuliet(id, body) {
        const { promise, resolve } = Promise.withResolvers();
        daemon.api.listen.once('message', resolve);
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${JULIET}/balcony" to="${JID}" type="chat" id="${id}">
                <body>${body}</body>
                <stanza-id xmlns="${Strophe.NS.SID}" id="sid-${id}" by="${ME}"/>
            </message>`);
        await promise;
        return `sid-${id}`;
    }

    /** Joins a room from the full connection. */
    async function joinRoom(room) {
        const client = await daemon.connect();
        const joined = client.request('rooms.join', { room, nick: 'romeo' });
        await daemon.enterRoom(room, 'romeo');
        await joined;
        client.close();
    }

    afterEach(async () => {
        vi.restoreAllMocks();
        await daemon?.stop();
        daemon = undefined;
    });

    it('starts, and warns that restricted access is only as strong as its isolation from the full socket', async () => {
        const warn = vi.spyOn(log, 'warn');
        await begin();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining(daemon.config.paths.socket));
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('can approve its own drafts'));
        expect((await full('daemon.status')).connected).toBe(true);
    });

    describe('routes every restricted send to a draft or a refusal', () => {
        it('drafts a send to a contact on the allowlist, and delivers it nowhere', async () => {
            await begin();
            expect(await restricted('messages.send', { to: JULIET, body: 'Noon?' })).toEqual({
                outcome: 'draft',
                draft_id: 'd1',
            });
            expect(sentStanzas()).toEqual([]);
            expect(audit()).toEqual([
                {
                    time: expect.any(String),
                    consumer: 'claude',
                    to: JULIET,
                    outcome: 'draft',
                    draft: 'd1',
                    route: 'draft',
                    mode: 'as_user',
                },
            ]);
        });

        it('refuses a contact not on the allowlist', async () => {
            await begin();
            expect(await restricted('messages.send', { to: TYBALT, body: 'Hi' })).toMatchObject({
                outcome: 'refused',
                rule: 'allowlist',
            });
            expect(audit().at(-1)).toMatchObject({
                to: TYBALT,
                outcome: 'refused',
                rule: 'allowlist',
                mode: 'as_user',
            });
        });

        it('sends nothing directly to the account itself, which is the owner: it is refused unless allowed', async () => {
            await begin();
            expect(await restricted('messages.send', { to: ME, body: 'Note to self' })).toMatchObject({
                outcome: 'refused',
                rule: 'allowlist',
            });
            await daemon.stop();
            await begin({ allow: [ME] });
            expect(await restricted('messages.send', { to: ME, body: 'Note to self' })).toMatchObject({
                outcome: 'draft',
            });
            expect(sentStanzas()).toEqual([]);
        });

        it('drafts a send to a room on the policy list, and refuses a room that is not', async () => {
            await begin({ rooms: [GARDEN] });
            await joinRoom(GARDEN);
            await joinRoom(HALL);
            expect(await restricted('messages.send', { to: GARDEN, body: 'Hello all' })).toEqual({
                outcome: 'draft',
                draft_id: 'd1',
            });
            expect(await restricted('messages.send', { to: HALL, body: 'Hello all' })).toMatchObject({
                outcome: 'refused',
                rule: 'room_allowlist',
            });
            expect(sentStanzas()).toEqual([]);
        });

        it('drafts a reply, naming the message it answers', async () => {
            await begin();
            const id = await fromJuliet('j1', 'Noon or never?');
            expect(await restricted('messages.send', { to: JULIET, body: 'Noon', reply_to: id })).toEqual({
                outcome: 'draft',
                draft_id: 'd1',
            });
            expect(await full('drafts.get', { id: 'd1' })).toMatchObject({
                draft: { body: 'Noon', reply_to: id },
                target: { id, from: JULIET, body: 'Noon or never?' },
            });
            expect(audit().at(-1)).toMatchObject({ outcome: 'draft', action: 'reply', target: id, mode: 'as_user' });
        });

        it('drafts a correction, a retraction and a reaction, which other modes refuse or send', async () => {
            await begin();
            const { message: mine } = await full('messages.send', { to: JULIET, body: 'Frist' });
            const theirs = await fromJuliet('j1', 'Noon?');
            const before = sentStanzas().length;

            expect(await restricted('messages.send', { to: JULIET, body: 'First', correct: mine.id })).toEqual({
                outcome: 'draft',
                draft_id: 'd1',
            });
            expect(await restricted('messages.retract', { id: mine.id })).toEqual({ outcome: 'draft', draft_id: 'd2' });
            expect(await restricted('messages.react', { id: theirs, emoji: '👍' })).toEqual({
                outcome: 'draft',
                draft_id: 'd3',
            });
            expect(await restricted('messages.react', { id: theirs, emoji: '👍', remove: true })).toEqual({
                outcome: 'draft',
                draft_id: 'd4',
            });
            expect(sentStanzas().length).toBe(before);

            expect((await full('drafts.list')).drafts).toEqual([
                expect.objectContaining({ id: 'd1', body: 'First', correct: mine.id }),
                expect.objectContaining({ id: 'd2', body: null, retract: mine.id }),
                expect.objectContaining({ id: 'd3', body: '👍', reaction_to: theirs, remove: false }),
                expect.objectContaining({ id: 'd4', body: '👍', reaction_to: theirs, remove: true }),
            ]);
            expect(
                audit()
                    .slice(-4)
                    .map(({ action, route, mode }) => [action, route, mode]),
            ).toEqual([
                ['correct', 'draft', 'as_user'],
                ['retract', 'draft', 'as_user'],
                ['react', 'draft', 'as_user'],
                ['react', 'draft', 'as_user'],
            ]);
        });

        it("refuses to draft a correction or retraction of someone else's message", async () => {
            await begin();
            const theirs = await fromJuliet('j1', 'Noon?');
            await expect(restricted('messages.send', { to: JULIET, body: 'x', correct: theirs })).rejects.toMatchObject(
                { code: ERRORS.INVALID_PARAMS },
            );
            await expect(restricted('messages.retract', { id: theirs })).rejects.toMatchObject({
                code: ERRORS.INVALID_PARAMS,
            });
            expect((await full('drafts.list')).drafts).toEqual([]);
        });

        it('refuses a correction, retraction or reaction for a contact not on the allowlist', async () => {
            await begin();
            const { message: mine } = await full('messages.send', { to: TYBALT, body: 'Frist' });
            for (const [method, params] of [
                ['messages.send', { to: TYBALT, body: 'First', correct: mine.id }],
                ['messages.retract', { id: mine.id }],
                ['messages.react', { id: mine.id, emoji: '👍' }],
            ]) {
                expect(await restricted(method, params)).toMatchObject({ outcome: 'refused', rule: 'allowlist' });
            }
        });

        it('counts drafts against the rate limits', async () => {
            await begin({ allow: [JULIET], rate_limit: { per_conversation: 1, overall: 20, window: 60 } });
            expect((await restricted('messages.send', { to: JULIET, body: 'one' })).outcome).toBe('draft');
            expect(await restricted('messages.send', { to: JULIET, body: 'two' })).toMatchObject({
                outcome: 'refused',
                rule: 'rate_conversation',
            });
        });
    });

    describe('drafts', () => {
        it('lets restricted access list and show drafts, but not send or withdraw them', async () => {
            await begin();
            await restricted('messages.send', { to: JULIET, body: 'Noon?' });

            expect((await restricted('drafts.list')).drafts.map((d) => d.id)).toEqual(['d1']);
            expect(await restricted('drafts.get', { id: 'd1' })).toEqual({
                draft: expect.objectContaining({ id: 'd1', to: JULIET, body: 'Noon?', consumer: 'claude' }),
                target: null,
            });
            for (const method of ['drafts.send', 'drafts.reject']) {
                await expect(restricted(method, { id: 'd1' })).rejects.toMatchObject({ code: ERRORS.ACCESS_DENIED });
            }
            expect(sentStanzas()).toEqual([]);
            expect((await full('drafts.list')).drafts.map((d) => d.id)).toEqual(['d1']);
        });

        it('says what is wrong with a draft it cannot show', async () => {
            await begin();
            await expect(full('drafts.get', { id: 'd9' })).rejects.toMatchObject({
                code: ERRORS.NOT_FOUND,
                message: 'No draft with id "d9". List the drafts with "converse-cli drafts list".',
            });
        });

        it('sends a draft as the user when full access approves it, and audits the approval', async () => {
            await begin();
            await restricted('messages.send', { to: JULIET, body: 'Noon?' });

            const result = await full('drafts.send', { id: 'd1' });
            expect(result).toMatchObject({
                outcome: 'sent',
                message: { conversation: JULIET, from: ME, direction: 'outgoing', body: 'Noon?', status: 'sent' },
            });
            expect(sentStanzas().map((s) => [s.getAttribute('to'), s.querySelector('body')?.textContent])).toEqual([
                [JULIET, 'Noon?'],
            ]);
            expect((await full('drafts.list')).drafts).toEqual([]);
            expect(audit().at(-1)).toEqual({
                time: expect.any(String),
                consumer: 'claude',
                to: JULIET,
                outcome: 'sent',
                id: result.message.id,
                draft: 'd1',
                approved_by: 'full',
                route: 'draft',
                mode: 'as_user',
            });
            await expect(full('drafts.send', { id: 'd1' })).rejects.toMatchObject({ code: ERRORS.NOT_FOUND });
        });

        it('sends an approved reply, correction, retraction and reaction as each was asked for', async () => {
            await begin();
            const { message: mine } = await full('messages.send', { to: JULIET, body: 'Frist' });
            const theirs = await fromJuliet('j1', 'Noon?');
            await restricted('messages.send', { to: JULIET, body: 'Yes', reply_to: theirs });
            await restricted('messages.send', { to: JULIET, body: 'First', correct: mine.id });
            await restricted('messages.react', { id: theirs, emoji: ':thumbsup:' });

            const reply = await full('drafts.send', { id: 'd1' });
            expect(reply.message).toMatchObject({ body: 'Yes', reply_to: theirs });
            // In a 1:1 chat a reply names the message by the id its sender gave it (XEP-0461).
            expect(sentStanzas().at(-1).querySelector('reply').getAttribute('id')).toBe('j1');

            const corrected = await full('drafts.send', { id: 'd2' });
            expect(corrected.message).toMatchObject({ body: 'First', edited: expect.any(String) });
            expect(sentStanzas().at(-1).querySelector('replace').getAttribute('id')).toBe(mine.id);

            const reacted = await full('drafts.send', { id: 'd3' });
            expect(reacted.message).toMatchObject({ id: theirs, reactions: { '👍': [ME] } });
            expect(sentStanzas().at(-1).querySelector('reaction').textContent).toBe('👍');

            await restricted('messages.retract', { id: corrected.message.id });
            const retracted = await full('drafts.send', { id: 'd4' });
            expect(retracted.message).toMatchObject({ body: null, retracted: expect.any(String) });
            expect(sentStanzas().at(-1).querySelector('retract')).not.toBeNull();

            expect(
                audit()
                    .filter((e) => e.approved_by)
                    .map(({ action, target }) => [action, target]),
            ).toEqual([
                ['reply', theirs],
                ['correct', mine.id],
                ['react', theirs],
                ['retract', corrected.message.id],
            ]);
        });

        it('shares an approved upload as a file, with its URL out of band (XEP-0066)', async () => {
            const server = http.createServer((request, response) => {
                request.resume().on('end', () => response.writeHead(201).end());
            });
            await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
            const url = `http://127.0.0.1:${server.address().port}/get/balcony.txt`;
            try {
                daemon = await startDaemon({
                    roster: ROSTER,
                    mode: 'as_user',
                    owner: ME,
                    policy: { allow: [JULIET] },
                    upload_service: {
                        jid: 'upload.montague.lit',
                        put_url: `http://127.0.0.1:${server.address().port}/put/balcony.txt`,
                        get_url: url,
                        max_file_size: 1024,
                    },
                });
                const content = Buffer.from('What light?').toString('base64');
                expect(await restricted('files.upload', { to: JULIET, name: 'balcony.txt', content })).toEqual({
                    outcome: 'draft',
                    draft_id: 'd1',
                });
                expect(sentStanzas()).toEqual([]);
                expect((await full('drafts.get', { id: 'd1' })).draft).toMatchObject({ body: url, upload: true });

                await full('drafts.send', { id: 'd1' });
                const stanza = sentStanzas().at(-1);
                expect(stanza.getAttribute('to')).toBe(JULIET);
                expect(stanza.querySelector(`x[xmlns="${Strophe.NS.OUTOFBAND}"] url`).textContent).toBe(url);
                expect(audit().at(-1)).toMatchObject({ outcome: 'sent', action: 'upload', approved_by: 'full' });
            } finally {
                await new Promise((resolve) => server.close(resolve));
            }
        });

        it('keeps a draft that could not be sent, so that it can be sent later', async () => {
            await begin();
            await restricted('messages.send', { to: JULIET, body: 'Noon?' });
            vi.spyOn(daemon.api.connection, 'connected').mockReturnValue(false);

            await expect(full('drafts.send', { id: 'd1' })).rejects.toMatchObject({ code: ERRORS.NOT_CONNECTED });
            vi.restoreAllMocks();
            expect((await full('drafts.list')).drafts.map((d) => d.id)).toEqual(['d1']);
            expect(audit().some((e) => e.outcome === 'sent')).toBe(false);
        });

        it('withdraws a draft without telling anyone, since there is no other account to tell', async () => {
            await begin();
            await restricted('messages.send', { to: JULIET, body: 'Noon?' });

            expect(await full('drafts.reject', { id: 'd1' })).toMatchObject({ draft: { id: 'd1' } });
            expect(sentStanzas()).toEqual([]);
            expect(audit().at(-1)).toEqual({
                time: expect.any(String),
                consumer: 'claude',
                to: JULIET,
                outcome: 'rejected',
                draft: 'd1',
                route: 'draft',
                mode: 'as_user',
            });
        });

        it('keeps drafts across a restart, delivering none of them', async () => {
            await begin();
            await restricted('messages.send', { to: JULIET, body: 'Noon?' });

            await daemon.daemon.stop();
            daemon.daemon = await start(daemon.config);
            daemon.connection = daemon.api.connection.get();

            expect((await full('drafts.list')).drafts.map((d) => [d.id, d.body])).toEqual([['d1', 'Noon?']]);
            expect(sentStanzas()).toEqual([]);
        });

        it('announces a draft as queued and as sent, to draft subscribers', async () => {
            await begin();
            const client = await daemon.connect();
            const drafted = [];
            client.onEvent((event) => drafted.push(event));
            await client.request('events.subscribe', { type: 'draft' });

            await restricted('messages.send', { to: JULIET, body: 'Noon?' });
            await full('drafts.send', { id: 'd1' });
            await u.waitUntil(() => drafted.length === 2);
            client.close();

            expect(drafted.map(({ action, draft }) => [action, draft.id])).toEqual([
                ['queued', 'd1'],
                ['sent', 'd1'],
            ]);
        });
    });

    it('keeps the inbox cursor of restricted access as in other modes', async () => {
        await begin();
        expect((await restricted('inbox.read')).conversations).toEqual([]);
        await fromJuliet('j1', 'Noon?');
        expect((await restricted('inbox.read')).conversations).toEqual([
            expect.objectContaining({ messages: [expect.objectContaining({ body: 'Noon?' })] }),
        ]);
        expect((await restricted('inbox.read')).conversations).toEqual([]);
    });
});

describe('Drafts in the modes that deliver them', () => {
    let daemon;

    afterEach(async () => {
        await daemon?.stop();
        daemon = undefined;
    });

    it('refuses drafts.send at full access, pointing to how drafts work there', async () => {
        daemon = await startDaemon({ roster: ROSTER, policy: { allow: [JULIET] } });
        const restricted = await daemon.connect({ access: 'restricted' });
        const full = await daemon.connect();
        try {
            await restricted.request('messages.send', { to: JULIET, body: 'Noon?' });
            await expect(full.request('drafts.send', { id: 'd1' })).rejects.toMatchObject({
                code: ERRORS.ACCESS_DENIED,
                message: expect.stringContaining('send it from your own client'),
            });
            for (const method of ['drafts.get', 'drafts.list', 'drafts.send']) {
                await expect(restricted.request(method, { id: 'd1' })).rejects.toMatchObject({
                    code: ERRORS.ACCESS_DENIED,
                });
            }
            expect((await full.request('drafts.get', { id: 'd1' })).draft).toMatchObject({ body: 'Noon?' });
        } finally {
            restricted.close();
            full.close();
        }
        expect(
            daemon.connection.sent_stanzas.some((s) => s.nodeName === 'message' && s.getAttribute('to') === JULIET),
        ).toBe(false);
    });
});
