import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { converse } from '@converse/headless';
import { BENVOLIO } from './account.js';
import { ERRORS } from '../protocol.js';
import { JID, startDaemon } from './harness.js';

const { Strophe, stx } = converse.env;

const JULIET = 'juliet@capulet.lit';
const MERCUTIO = 'mercutio@montague.lit';
const TYBALT = 'tybalt@capulet.lit';
const GARDEN = 'garden@conference.montague.lit';
const HALL = 'hall@conference.montague.lit';
const ROSTER = [
    { jid: JULIET, name: 'Juliet Capulet' },
    { jid: MERCUTIO, name: 'Mercutio' },
    { jid: TYBALT, name: 'Tybalt' },
];

describe('Routing restricted sends by mode and target', () => {
    let daemon;

    /**
     * @param {Object} options
     * @param {import('../types').Mode} [options.mode]
     * @param {Partial<import('../types').Policy>} [options.policy]
     */
    async function begin({ mode, policy } = {}) {
        daemon = await startDaemon({ roster: ROSTER, mode, policy });
    }

    /** The message stanzas the daemon has put on the wire, as {to, body} pairs. */
    const sent = () =>
        daemon.connection.sent_stanzas
            .filter((s) => s.nodeName === 'message')
            .map((s) => ({ to: s.getAttribute('to'), body: s.querySelector('body')?.textContent }));

    /** The audit log's entries, oldest first. */
    const audit = () =>
        fs
            .readFileSync(daemon.config.paths.audit, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line));

    /**
     * Sends from a restricted connection, and hangs up.
     * @param {string} method
     * @param {Object} params
     */
    async function restricted(method, params) {
        const client = await daemon.connect({ access: 'restricted' });
        try {
            return await client.request(method, params);
        } finally {
            client.close();
        }
    }

    /**
     * Sends from the full connection, so that the account has a message of its own.
     * @param {string} to
     * @param {string} body
     */
    async function ownMessage(to, body) {
        const client = await daemon.connect();
        try {
            const { message } = await client.request('messages.send', { to, body });
            return message;
        } finally {
            client.close();
        }
    }

    /** Joins a room from the full connection, as the account's own nickname there. */
    async function joinRoom(room) {
        const client = await daemon.connect();
        const joined = client.request('rooms.join', { room, nick: 'romeo' });
        await daemon.enterRoom(room, 'romeo');
        await joined;
        client.close();
    }

    afterEach(async () => {
        await daemon?.stop();
        daemon = undefined;
    });

    describe('in owner_only mode', () => {
        it('sends to the owner directly, with no draft notice around the message', async () => {
            await begin({ mode: 'owner_only' });
            expect(await restricted('messages.send', { to: BENVOLIO, body: 'Hi' })).toMatchObject({
                outcome: 'sent',
                message: { conversation: BENVOLIO, body: 'Hi' },
            });
            expect(sent()).toEqual([{ to: BENVOLIO, body: 'Hi' }]);
            expect(audit()).toEqual([
                {
                    time: expect.any(String),
                    consumer: 'agent',
                    to: BENVOLIO,
                    outcome: 'sent',
                    id: expect.any(String),
                    route: 'direct',
                    mode: 'owner_only',
                },
            ]);
        });

        it('drafts a send to a room on the policy list', async () => {
            await begin({ mode: 'owner_only', policy: { rooms: [GARDEN] } });
            await joinRoom(GARDEN);
            expect(await restricted('messages.send', { to: GARDEN, body: 'Hello all' })).toEqual({
                outcome: 'draft',
                draft_id: 'd1',
            });
            expect(sent().some(({ to }) => to === GARDEN)).toBe(false);
            expect(audit().at(-1)).toMatchObject({ to: GARDEN, outcome: 'draft', route: 'draft', mode: 'owner_only' });
        });

        it('refuses a send to a room that is not on the policy list, by the room allowlist', async () => {
            await begin({ mode: 'owner_only', policy: { rooms: [GARDEN] } });
            await joinRoom(HALL);
            expect(await restricted('messages.send', { to: HALL, body: 'Hi' })).toMatchObject({
                outcome: 'refused',
                rule: 'room_allowlist',
            });
            expect(audit()).toEqual([
                {
                    time: expect.any(String),
                    consumer: 'agent',
                    to: HALL,
                    outcome: 'refused',
                    rule: 'room_allowlist',
                    mode: 'owner_only',
                },
            ]);
        });

        it('refuses a contact that is only on the direct list, since direct sends need bot mode', async () => {
            await begin({ mode: 'owner_only', policy: { direct: [JULIET] } });
            expect(await restricted('messages.send', { to: JULIET, body: 'Hi' })).toMatchObject({
                outcome: 'refused',
                rule: 'allowlist',
            });
            expect(sent()).toEqual([]);
        });

        it('drafts a send to a contact on the allowlist', async () => {
            await begin({ mode: 'owner_only', policy: { allow: [JULIET] } });
            expect(await restricted('messages.send', { to: JULIET, body: 'Hi' })).toEqual({
                outcome: 'draft',
                draft_id: 'd1',
            });
            expect(audit().at(-1)).toMatchObject({ to: JULIET, outcome: 'draft', route: 'draft', mode: 'owner_only' });
        });

        it('refuses a contact on neither list', async () => {
            await begin({ mode: 'owner_only', policy: { allow: [JULIET], direct: [MERCUTIO] } });
            expect(await restricted('messages.send', { to: TYBALT, body: 'Hi' })).toMatchObject({
                outcome: 'refused',
                rule: 'allowlist',
            });
        });
    });

    describe('in bot mode', () => {
        it('sends to the owner directly', async () => {
            await begin({ mode: 'bot' });
            expect(await restricted('messages.send', { to: BENVOLIO, body: 'Hi' })).toMatchObject({ outcome: 'sent' });
            expect(sent()).toEqual([{ to: BENVOLIO, body: 'Hi' }]);
        });

        it('sends to a room on the policy list directly', async () => {
            await begin({ mode: 'bot', policy: { rooms: [GARDEN] } });
            await joinRoom(GARDEN);
            expect(await restricted('messages.send', { to: GARDEN, body: 'Hello all' })).toMatchObject({
                outcome: 'sent',
                message: { conversation: GARDEN, body: 'Hello all' },
            });
            expect(sent()).toEqual([{ to: GARDEN, body: 'Hello all' }]);
            expect(audit().at(-1)).toMatchObject({ to: GARDEN, outcome: 'sent', route: 'direct', mode: 'bot' });
        });

        it('refuses a room that is not on the policy list, by the room allowlist', async () => {
            await begin({ mode: 'bot', policy: { rooms: [GARDEN] } });
            await joinRoom(HALL);
            expect(await restricted('messages.send', { to: HALL, body: 'Hi' })).toMatchObject({
                outcome: 'refused',
                rule: 'room_allowlist',
            });
            expect(sent()).toEqual([]);
        });

        it('sends to a contact on the direct list directly', async () => {
            await begin({ mode: 'bot', policy: { direct: [JULIET] } });
            expect(await restricted('messages.send', { to: JULIET, body: 'Hi' })).toMatchObject({ outcome: 'sent' });
            expect(sent()).toEqual([{ to: JULIET, body: 'Hi' }]);
            expect(audit().at(-1)).toMatchObject({ to: JULIET, outcome: 'sent', route: 'direct', mode: 'bot' });
        });

        it('drafts a send to a contact on the allowlist, which is not on the direct list', async () => {
            await begin({ mode: 'bot', policy: { allow: [JULIET] } });
            expect(await restricted('messages.send', { to: JULIET, body: 'Hi' })).toEqual({
                outcome: 'draft',
                draft_id: 'd1',
            });
            expect(audit().at(-1)).toMatchObject({ to: JULIET, outcome: 'draft', route: 'draft', mode: 'bot' });
        });

        it('sends directly to a contact on both lists, since the direct route wins', async () => {
            await begin({ mode: 'bot', policy: { allow: [JULIET], direct: [JULIET] } });
            expect(await restricted('messages.send', { to: JULIET, body: 'Hi' })).toMatchObject({ outcome: 'sent' });
        });

        it('refuses a contact on neither list', async () => {
            await begin({ mode: 'bot', policy: { allow: [JULIET], direct: [JULIET] } });
            expect(await restricted('messages.send', { to: TYBALT, body: 'Hi' })).toMatchObject({
                outcome: 'refused',
                rule: 'allowlist',
            });
        });
    });

    it('counts a direct send and a draft against the same overall budget', async () => {
        await begin({
            mode: 'bot',
            policy: {
                direct: [MERCUTIO],
                allow: [JULIET],
                rate_limit: { per_conversation: 5, overall: 2, window: 60 },
            },
        });
        expect((await restricted('messages.send', { to: MERCUTIO, body: 'one' })).outcome).toBe('sent');
        expect((await restricted('messages.send', { to: JULIET, body: 'two' })).outcome).toBe('draft');
        expect(await restricted('messages.send', { to: MERCUTIO, body: 'three' })).toMatchObject({
            outcome: 'refused',
            rule: 'rate_overall',
        });
    });

    describe('for corrections, retractions and reactions', () => {
        it('corrects its own message directly where the policy sends directly', async () => {
            await begin({ mode: 'bot', policy: { direct: [JULIET] } });
            const { id } = await ownMessage(JULIET, 'first');
            expect(await restricted('messages.send', { to: JULIET, body: 'second', correct: id })).toMatchObject({
                outcome: 'sent',
                message: { body: 'second' },
            });
            expect(audit().at(-1)).toMatchObject({ action: 'correct', route: 'direct', mode: 'bot' });
        });

        it('refuses a correction the policy would draft, since a draft cannot correct', async () => {
            await begin({ mode: 'owner_only', policy: { allow: [JULIET] } });
            const { id } = await ownMessage(JULIET, 'first');
            await expect(
                restricted('messages.send', { to: JULIET, body: 'second', correct: id }),
            ).rejects.toMatchObject({
                code: ERRORS.ACCESS_DENIED,
            });
            expect(sent().filter(({ body }) => body === 'second')).toEqual([]);
        });

        it('refuses a correction the policy refuses, by its rule', async () => {
            await begin({ mode: 'bot' });
            const { id } = await ownMessage(JULIET, 'first');
            expect(await restricted('messages.send', { to: JULIET, body: 'second', correct: id })).toMatchObject({
                outcome: 'refused',
                rule: 'allowlist',
            });
        });

        it('retracts its own message directly where the policy sends directly', async () => {
            await begin({ mode: 'bot', policy: { direct: [JULIET] } });
            const { id } = await ownMessage(JULIET, 'Oops');
            expect(await restricted('messages.retract', { id, conversation: JULIET })).toMatchObject({
                outcome: 'sent',
                message: { id, body: null, retracted: expect.any(String) },
            });
            expect(audit().at(-1)).toMatchObject({ action: 'retract', route: 'direct', mode: 'bot' });
        });

        it('refuses a retraction the policy would draft, since a draft cannot retract', async () => {
            await begin({ mode: 'owner_only', policy: { allow: [JULIET] } });
            const { id } = await ownMessage(JULIET, 'Oops');
            await expect(restricted('messages.retract', { id, conversation: JULIET })).rejects.toMatchObject({
                code: ERRORS.ACCESS_DENIED,
            });
        });

        it("refuses to retract someone else's message, even where the policy sends directly", async () => {
            await begin({ mode: 'bot', policy: { direct: [JULIET] } });
            const { promise, resolve } = Promise.withResolvers();
            daemon.api.listen.once('message', resolve);
            daemon.receive(stx`
                <message xmlns="jabber:client" from="${JULIET}/balcony" to="${JID}" type="chat" id="j1">
                    <body>Noon?</body>
                    <stanza-id xmlns="${Strophe.NS.SID}" id="sid-j1" by="${daemon.config.jid}"/>
                </message>`);
            await promise;
            await expect(restricted('messages.retract', { id: 'sid-j1', conversation: JULIET })).rejects.toMatchObject({
                code: ERRORS.INVALID_PARAMS,
            });
        });

        it('reacts directly where the policy sends directly, and withdraws a reaction there too', async () => {
            await begin({ mode: 'bot', policy: { direct: [JULIET] } });
            const { id } = await ownMessage(JULIET, 'Noon?');
            expect(await restricted('messages.react', { id, emoji: '👍', conversation: JULIET })).toMatchObject({
                outcome: 'sent',
                message: { id, reactions: { '👍': [expect.any(String)] } },
            });
            expect(
                await restricted('messages.react', { id, emoji: '👍', conversation: JULIET, remove: true }),
            ).toMatchObject({ outcome: 'sent', message: { id, reactions: {} } });
            expect(audit().at(-1)).toMatchObject({ action: 'react', route: 'direct', mode: 'bot' });
        });

        it('refuses to withdraw a reaction the policy would draft, since a draft cannot withdraw', async () => {
            await begin({ mode: 'owner_only', policy: { allow: [JULIET] } });
            const { id } = await ownMessage(JULIET, 'Noon?');
            await expect(
                restricted('messages.react', { id, emoji: '👍', conversation: JULIET, remove: true }),
            ).rejects.toMatchObject({ code: ERRORS.ACCESS_DENIED });
        });
    });
});
