/**
 * Replies, corrections, retractions and reactions on a real Prosody, sent by
 * one daemon and read by another. Each side addresses a message by the id its
 * own `read` showed, which for a received message is the stanza-id its own
 * server assigned, not an id the other side knows.
 */
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MUC_DOMAIN } from '../../../tests/prosody/server.js';
import { eventually, registerAccount, startDaemon } from './real-server.js';

/**
 * Waits until a conversation, as `daemon` reads it, has a message that passes `test`.
 * @param {{ requestFull: Function }} daemon
 * @param {string} conversation
 * @param {(m: import('../types').MessageDTO) => boolean} test
 * @param {string} what
 */
function waitForMessage(daemon, conversation, test, what) {
    return eventually(
        async () => (await daemon.requestFull('messages.list', { conversation })).messages.find(test),
        { what },
    );
}

describe('Acting on messages on a real Prosody', () => {
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

    describe('in a 1:1 chat', () => {
        let original, as_romeo_sees_it;

        beforeAll(async () => {
            ({ message: original } = await juliet.requestFull('messages.send', {
                to: romeo.jid,
                body: 'Wherefore art thou?',
            }));
            as_romeo_sees_it = await waitForMessage(
                romeo,
                juliet.jid,
                (m) => m.body === 'Wherefore art thou?',
                "Juliet's question",
            );
        });

        it('replies by stanza-id, and the other side sees which of its messages was answered', async () => {
            // Romeo's server gave the message its own stanza-id, which is what he addresses it by.
            expect(as_romeo_sees_it.id).not.toBe(original.id);
            await romeo.requestFull('messages.send', { to: juliet.jid, body: 'Here', reply_to: as_romeo_sees_it.id });

            const reply = await waitForMessage(juliet, romeo.jid, (m) => m.body === 'Here', 'the reply');
            expect(reply.reply_to).toBe(original.id);
        });

        it("reacts by stanza-id, and the other side sees who reacted", async () => {
            await romeo.requestFull('messages.react', { id: as_romeo_sees_it.id, emoji: '👍' });

            const reacted = await waitForMessage(
                juliet,
                romeo.jid,
                (m) => m.id === original.id && m.reactions['👍']?.length > 0,
                'the reaction',
            );
            expect(reacted.reactions).toEqual({ '👍': [romeo.jid] });
        });

        it('corrects a message, which the other side sees corrected in place', async () => {
            const { message: sent } = await romeo.requestFull('messages.send', { to: juliet.jid, body: 'Frist' });
            const received = await waitForMessage(juliet, romeo.jid, (m) => m.body === 'Frist', 'the typo');

            await romeo.requestFull('messages.send', { to: juliet.jid, body: 'First', correct: sent.id });

            const corrected = await waitForMessage(juliet, romeo.jid, (m) => m.body === 'First', 'the correction');
            expect(corrected).toMatchObject({ edited: expect.any(String) });
            expect(corrected.time).toBe(received.time);
            const { messages } = await juliet.requestFull('messages.list', { conversation: romeo.jid });
            expect(messages.some((m) => m.body === 'Frist')).toBe(false);
        });

        it('retracts a message, which the other side sees withdrawn, without its body', async () => {
            const { message: sent } = await romeo.requestFull('messages.send', { to: juliet.jid, body: 'Oops' });
            const received = await waitForMessage(juliet, romeo.jid, (m) => m.body === 'Oops', 'the slip');

            await romeo.requestFull('messages.retract', { id: sent.id });

            const retracted = await waitForMessage(
                juliet,
                romeo.jid,
                (m) => m.id === received.id && m.retracted !== null,
                'the retraction',
            );
            expect(retracted.body).toBe(null);
        });
    });

    describe('in a room', () => {
        let room, original, as_romeo_sees_it;

        beforeAll(async () => {
            room = `orchard-${crypto.randomUUID().slice(0, 8)}@${MUC_DOMAIN}`;
            await romeo.requestFull('rooms.join', { room, nick: 'romeo' });
            await juliet.requestFull('rooms.join', { room, nick: 'juliet' });
            ({ message: original } = await juliet.requestFull('messages.send', { to: room, body: 'Who is there?' }));
            as_romeo_sees_it = await waitForMessage(romeo, room, (m) => m.body === 'Who is there?', "Juliet's question");
            // Both see it by the stanza-id the room gave it.
            await waitForMessage(juliet, room, (m) => m.id === as_romeo_sees_it.id, 'the room echoing it back');
        });

        it('replies and reacts by the stanza-id the room gave the message', async () => {
            await romeo.requestFull('messages.send', { to: room, body: 'Romeo', reply_to: as_romeo_sees_it.id });
            await romeo.requestFull('messages.react', { id: as_romeo_sees_it.id, emoji: '❤️' });

            const reply = await waitForMessage(juliet, room, (m) => m.body === 'Romeo', 'the reply');
            expect(reply).toMatchObject({ reply_to: as_romeo_sees_it.id, nick: 'romeo' });
            const reacted = await waitForMessage(
                juliet,
                room,
                (m) => m.id === as_romeo_sees_it.id && m.reactions['❤️']?.length > 0,
                'the reaction',
            );
            expect(reacted.reactions).toEqual({ '❤️': [`${room}/romeo`] });
            expect(original.body).toBe('Who is there?');
        });

        it('corrects and retracts in the room, as the other occupant sees it', async () => {
            const { message: typo } = await romeo.requestFull('messages.send', { to: room, body: 'Hree' });
            await waitForMessage(juliet, room, (m) => m.body === 'Hree', 'the typo');
            await romeo.requestFull('messages.send', { to: room, body: 'Here', correct: typo.id });
            const corrected = await waitForMessage(juliet, room, (m) => m.body === 'Here', 'the correction');
            expect(corrected.edited).not.toBe(null);

            const { message: slip } = await romeo.requestFull('messages.send', { to: room, body: 'Oops' });
            const received = await waitForMessage(juliet, room, (m) => m.body === 'Oops', 'the slip');
            await romeo.requestFull('messages.retract', { id: slip.id, conversation: room });
            await expect(
                waitForMessage(juliet, room, (m) => m.id === received.id && m.retracted !== null, 'the retraction'),
            ).resolves.toMatchObject({ body: null });
        });
    });
});
