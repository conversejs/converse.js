/**
 * Whether a room took a message we sent it: the room echoes back each message
 * it passes on, and a send waits a little for that echo.
 */
import fs from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { converse, MAMPlaceholderMessage } from '@converse/headless';
import { ERRORS } from '../protocol.js';
import { ROOM_ECHO } from '../send.js';
import { JID, startDaemon } from './harness.js';

const { stx, u } = converse.env;

const GARDEN = 'garden@conference.montague.lit';
const JULIET = 'juliet@capulet.lit';
const HALL = 'hall@conference.montague.lit';
// A gateway, such as biboumi, hosts its users on the same domain as its rooms.
const GATEWAY_USER = 'mercutio%irc.example.org@conference.montague.lit';

describe('A send to a room', () => {
    let daemon, client;
    const timeout = ROOM_ECHO.timeout;

    /** The last message stanza the daemon sent to the room. */
    const lastSent = () =>
        daemon.connection.sent_stanzas
            .filter((s) => s.nodeName === 'message' && s.getAttribute('to') === GARDEN)
            .at(-1);

    /** Waits for the daemon to send its `n`th message to the room. */
    const sentToRoom = (n) =>
        u.waitUntil(
            () =>
                daemon.connection.sent_stanzas.filter(
                    (s) => s.nodeName === 'message' && s.getAttribute('to') === GARDEN && s.querySelector('body'),
                ).length >= n,
        );
    const countSent = () =>
        daemon.connection.sent_stanzas.filter(
            (s) => s.nodeName === 'message' && s.getAttribute('to') === GARDEN && s.querySelector('body'),
        ).length;

    /** The audit log's last entry. */
    const lastAudited = () => JSON.parse(fs.readFileSync(daemon.config.paths.audit, 'utf8').trim().split('\n').at(-1));

    /** Removes us from the room "due to a technical problem". */
    const removeFromRoom = () =>
        daemon.receive(stx`
            <presence xmlns="jabber:client" from="${GARDEN}/romeo" to="${JID}" type="unavailable">
                <x xmlns="http://jabber.org/protocol/muc#user">
                    <item affiliation="member" role="none"/>
                    <status code="110"/>
                    <status code="333"/>
                </x>
            </presence>`);

    async function enter() {
        const joined = client.request('rooms.join', { room: GARDEN, nick: 'romeo' });
        await daemon.enterRoom(GARDEN, 'romeo');
        await joined;
    }

    beforeAll(async () => {
        ROOM_ECHO.timeout = 300;
        daemon = await startDaemon({ roster: [{ jid: JULIET, name: 'Juliet' }] });
        client = await daemon.connect();
        await enter();
    });

    afterEach(() => daemon.setRoomEcho(true));

    afterAll(async () => {
        ROOM_ECHO.timeout = timeout;
        client?.close();
        await daemon?.stop();
    });

    it('waits for the room to echo it back, and says when it did', async () => {
        const { outcome, message } = await client.request('messages.send', { to: GARDEN, body: 'Hello all' });
        expect(outcome).toBe('sent');
        expect(message).toMatchObject({ status: 'sent', delivered: expect.any(String) });
        // The id is then the one the room gave it.
        expect(message.id).not.toBe(lastSent().getAttribute('id'));
        expect(lastAudited()).toMatchObject({ outcome: 'sent', id: message.id });

        const { messages } = await client.request('messages.list', { conversation: GARDEN });
        expect(messages.at(-1)).toMatchObject({ id: message.id, delivered: message.delivered });
    });

    it('is confirmed in a room whose history has a gap', async () => {
        const room = await daemon.api.rooms.get(GARDEN);
        const gap = room.messages.add(new MAMPlaceholderMessage({ time: new Date().toISOString() }));
        try {
            const { outcome } = await client.request('messages.send', { to: GARDEN, body: 'Mind the gap' });
            expect(outcome).toBe('sent');
        } finally {
            room.messages.remove(gap);
        }
    });

    it('confirms a correction afresh, when the room echoes it', async () => {
        const { message } = await client.request('messages.send', { to: GARDEN, body: 'Helo' });
        const corrected = await client.request('messages.send', { to: GARDEN, body: 'Hello', correct: message.id });
        expect(corrected.message).toMatchObject({ body: 'Hello', edited: expect.any(String) });
        expect(corrected.message.delivered > message.delivered).toBe(true);
    });

    it('brings back the delivered version when a correction that missed the room is discarded', async () => {
        const { message } = await client.request('messages.send', { to: GARDEN, body: 'Meet at noon' });

        daemon.setRoomEcho(false);
        const n = countSent();
        const correcting = client.request('messages.send', { to: GARDEN, body: 'Meet at one', correct: message.id });
        await sentToRoom(n + 1);
        removeFromRoom();
        await expect(correcting).rejects.toMatchObject({ code: ERRORS.NOT_JOINED });

        await client.request('messages.discard', { id: message.id, conversation: GARDEN });
        const { messages } = await client.request('messages.list', { conversation: GARDEN });
        expect(messages.at(-1)).toMatchObject({ id: message.id, body: 'Meet at noon', status: 'sent' });

        daemon.setRoomEcho(true);
        await enter();
    });

    it('reports a send the room did not echo in time as sent, but not delivered', async () => {
        daemon.setRoomEcho(false);
        const started = Date.now();
        const { outcome, message } = await client.request('messages.send', { to: GARDEN, body: 'Anyone?' });
        expect(Date.now() - started).toBeGreaterThanOrEqual(ROOM_ECHO.timeout - 50);
        expect(outcome).toBe('sent');
        expect(message).toMatchObject({ status: 'sent', delivered: null });
    });

    it("reports a send as sent when the room's messages are cleared before it echoes", async () => {
        daemon.setRoomEcho(false);
        const n = countSent();
        const sending = client.request('messages.send', { to: GARDEN, body: 'Gone soon' });
        await sentToRoom(n + 1);
        const room = await daemon.api.rooms.get(GARDEN);
        await room.clearMessages();
        await expect(sending).resolves.toMatchObject({ outcome: 'sent', message: { status: 'sent' } });
    });

    it('fails a send the room turns down, and keeps it for a resend', async () => {
        daemon.setRoomEcho(false);
        const n = countSent();
        const sending = client.request('messages.send', { to: GARDEN, body: 'Let me in' });
        await sentToRoom(n + 1);
        const id = lastSent().getAttribute('id');
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${GARDEN}" to="${JID}" type="error" id="${id}">
                <error type="auth"><forbidden xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error>
            </message>`);
        await expect(sending).rejects.toMatchObject({
            code: ERRORS.UNDELIVERED,
            data: { id, condition: 'forbidden' },
        });

        expect(lastAudited()).toMatchObject({ to: GARDEN, outcome: 'failed', id, error_code: 'forbidden' });

        const { messages } = await client.request('messages.list', { conversation: GARDEN });
        expect(messages.at(-1)).toMatchObject({ id, status: 'failed', error_code: 'forbidden', delivered: null });

        daemon.setRoomEcho(true);
        const resent = await client.request('messages.resend', { id, conversation: GARDEN });
        expect(resent.message).toMatchObject({ status: 'sent', error_code: null, delivered: expect.any(String) });
    });

    it('fails a send the room says it does not have us for, and refuses to send there after', async () => {
        daemon.setRoomEcho(false);
        const n = countSent();
        const sending = client.request('messages.send', { to: GARDEN, body: 'Still here?' });
        await sentToRoom(n + 1);
        const id = lastSent().getAttribute('id');
        removeFromRoom();
        await expect(sending).rejects.toMatchObject({
            code: ERRORS.NOT_JOINED,
            data: { id, see: ['rooms.join', 'messages.resend'] },
        });

        const { messages } = await client.request('messages.list', { conversation: GARDEN });
        expect(messages.at(-1)).toMatchObject({ id, status: 'failed', error_code: 'not-in-room' });

        // Out of the room, nothing more is sent to it.
        const sent = countSent();
        await expect(client.request('messages.send', { to: GARDEN, body: 'Hello?' })).rejects.toMatchObject({
            code: ERRORS.NOT_JOINED,
        });
        await expect(client.request('messages.resend', { id, conversation: GARDEN })).rejects.toMatchObject({
            code: ERRORS.NOT_JOINED,
        });
        expect(countSent()).toBe(sent);

        // Back in the room, the failed send goes out again.
        daemon.setRoomEcho(true);
        await enter();
        const resent = await client.request('messages.resend', { id, conversation: GARDEN });
        expect(resent.message).toMatchObject({ status: 'sent', delivered: expect.any(String) });
    });

    it('fails a send that the room answers with not-acceptable as one to a room we are not in', async () => {
        daemon.setRoomEcho(false);
        const n = countSent();
        const sending = client.request('messages.send', { to: GARDEN, body: 'Hello?' });
        await sentToRoom(n + 1);
        const id = lastSent().getAttribute('id');
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${GARDEN}" to="${JID}" type="error" id="${id}">
                <error type="modify"><not-acceptable xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error>
            </message>`);
        // Headless pings the room, which still answers for us.
        const ping = await u.waitUntil(() =>
            daemon.connection.sent_stanzas.find(
                (s) => s.nodeName === 'iq' && s.getAttribute('to') === `${GARDEN}/romeo` && s.querySelector('ping'),
            ),
        );
        daemon.receive(stx`
            <iq xmlns="jabber:client" type="result" from="${GARDEN}/romeo" to="${JID}" id="${ping.getAttribute('id')}"/>`);
        await expect(sending).rejects.toMatchObject({ code: ERRORS.NOT_JOINED, data: { id } });

        const { messages } = await client.request('messages.list', { conversation: GARDEN });
        expect(messages.at(-1)).toMatchObject({ id, status: 'failed', error_code: 'not-in-room' });
    });

    it('sends to a MUC only when asked to, and refuses one it is not in', async () => {
        const sentTo = (jid) =>
            daemon.connection.sent_stanzas.filter((s) => s.nodeName === 'message' && s.getAttribute('to') === jid);

        await expect(
            client.request('messages.send', { to: HALL, body: 'Hi', type: 'groupchat' }),
        ).rejects.toMatchObject({ code: ERRORS.NOT_JOINED });
        expect(sentTo(HALL)).toHaveLength(0);

        await expect(client.request('messages.send', { to: GARDEN, body: 'Hi', type: 'chat' })).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
        });

        // Meant for one occupant, it must not reach them all.
        await expect(client.request('messages.send', { to: `${GARDEN}/juliet`, body: 'Psst' })).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
        });
        expect(sentTo(GARDEN).filter((s) => s.querySelector('body')?.textContent === 'Psst')).toHaveLength(0);

        // Not known as a MUC, so not guessed to be one.
        const { outcome } = await client.request('messages.send', { to: GATEWAY_USER, body: 'Hi' });
        expect(outcome).toBe('sent');
        expect(sentTo(GATEWAY_USER).at(-1).getAttribute('type')).toBe('chat');
    });

    it("says when a chat message's recipient confirmed it with a receipt", async () => {
        const { message } = await client.request('messages.send', { to: JULIET, body: 'Hi' });
        expect(message.delivered).toBe(null);

        const id = daemon.connection.sent_stanzas
            .filter((s) => s.nodeName === 'message' && s.getAttribute('to') === JULIET)
            .at(-1)
            .getAttribute('id');
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${JULIET}/balcony" to="${JID}" id="${u.getUniqueId()}">
                <received xmlns="urn:xmpp:receipts" id="${id}"/>
            </message>`);
        await u.waitUntil(async () => {
            const { messages } = await client.request('messages.list', { conversation: JULIET });
            return messages.at(-1).delivered;
        });
    });
});
