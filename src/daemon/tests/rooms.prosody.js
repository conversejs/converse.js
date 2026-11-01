/**
 * Rooms on a real Prosody: what a mock can't show, since it's the server that
 * decides who is in a room, and tells everyone when someone joins or leaves.
 */
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { converse } from '@converse/headless';
import { MUC_DOMAIN, WEBSOCKET_URL } from '../../../tests/prosody/server.js';
import { ERRORS } from '../protocol.js';
import { eventually, registerAccount, startDaemon } from './real-server.js';

const { Strophe, $pres } = converse.env;

/**
 * Joins a room as a plain XMPP client, and records every presence the room
 * sends about its occupants. Joins and leaves show up here, whichever
 * daemon makes them.
 * @param {{ jid: string, password: string }} account
 * @param {string} room
 */
async function watch(account, room) {
    const conn = new Strophe.Connection(WEBSOCKET_URL);
    await new Promise((resolve, reject) => {
        conn.connect(`${account.jid}/watcher`, account.password, (status) => {
            if (status === Strophe.Status.CONNECTED) resolve(undefined);
            if (status === Strophe.Status.AUTHFAIL || status === Strophe.Status.CONNFAIL) {
                reject(new Error(`The watcher couldn't connect (status ${status})`));
            }
        });
    });
    /** @type {{ from: string, type: string }[]} */
    const presences = [];
    conn.addHandler(
        (stanza) => {
            const from = stanza.getAttribute('from') ?? '';
            if (from.startsWith(`${room}/`)) presences.push({ from, type: stanza.getAttribute('type') ?? 'available' });
            return true;
        },
        null,
        'presence',
    );
    conn.send($pres({ to: `${room}/watcher` }).c('x', { xmlns: Strophe.NS.MUC }));
    await eventually(() => presences.some(({ from }) => from === `${room}/watcher`), {
        what: 'the watcher to enter the room',
    });
    return { presences, disconnect: () => conn.disconnect() };
}

describe('Rooms on a real Prosody', () => {
    const daemons = [];
    let romeo, juliet, room, watcher;

    beforeAll(async () => {
        const [romeo_account, juliet_account] = await Promise.all([
            registerAccount('romeo'),
            registerAccount('juliet'),
        ]);
        [romeo, juliet] = await Promise.all([startDaemon(romeo_account), startDaemon(juliet_account)]);
        daemons.push(romeo, juliet);
        room = `garden-${crypto.randomUUID().slice(0, 8)}@${MUC_DOMAIN}`;
    });

    afterAll(async () => {
        watcher?.disconnect();
        await Promise.all(daemons.map((d) => d.stop()));
    });

    it('joins a room under the consumer name, and remembers it as a group chat', async () => {
        const joined = await romeo.requestFull('rooms.join', { room });
        expect(joined).toEqual({
            conversation: expect.objectContaining({ jid: room, type: 'groupchat' }),
            nick: 'agent',
        });
        expect(await juliet.requestFull('rooms.join', { room, nick: 'juliet' })).toMatchObject({ nick: 'juliet' });
    });

    it('lists the occupants by nickname', async () => {
        const { occupants } = await eventually(
            async () => {
                const result = await romeo.request('rooms.occupants', { room });
                return result.occupants.length === 2 ? result : undefined;
            },
            { what: 'both occupants to be listed' },
        );
        expect(occupants.map((o) => o.nick)).toEqual(['agent', 'juliet']);
    });

    it('exchanges messages in the room, with each sender identified as its occupant', async () => {
        // A restricted send to a room that isn't on the policy list is refused, so nothing goes out.
        const refused = await romeo.requestRestricted('messages.send', { to: room, body: 'Is this the room?' });
        expect(refused).toMatchObject({ outcome: 'refused', rule: 'room_allowlist' });

        const sent = await romeo.requestFull('messages.send', { to: room, body: 'Is this the room?' });
        expect(sent).toMatchObject({ outcome: 'sent', message: { conversation: room, from: `${room}/agent` } });

        const received = await eventually(
            async () =>
                (await juliet.request('messages.list', { conversation: room })).messages.find(
                    (m) => m.body === 'Is this the room?',
                ),
            { what: 'the message in the room' },
        );
        expect(received).toMatchObject({
            conversation: room,
            from: `${room}/agent`,
            nick: 'agent',
            direction: 'incoming',
        });
    });

    it('shows the room among conversations and in the inbox, as a group chat', async () => {
        // The first look at the inbox sets the consumer's baseline, so only what comes after it is unread.
        await juliet.request('inbox.read');
        await romeo.requestFull('messages.send', { to: room, body: 'Second message' });

        const { conversations } = await eventually(
            async () => {
                const result = await juliet.request('conversations.list');
                return result.conversations.some((c) => c.jid === room && c.unread === 1) ? result : undefined;
            },
            { what: 'the room to show one unread message' },
        );
        expect(conversations.find((c) => c.jid === room)).toMatchObject({ type: 'groupchat' });

        const { conversations: groups } = await juliet.request('inbox.read');
        expect(groups.find((g) => g.conversation.jid === room)).toMatchObject({
            conversation: { type: 'groupchat' },
            messages: [expect.objectContaining({ body: 'Second message', nick: 'agent' })],
        });
    });

    it('lists the rooms a service hosts', async () => {
        const { rooms } = await romeo.request('rooms.discover', { service: MUC_DOMAIN });
        expect(rooms.map((r) => r.jid)).toContain(room);
    });

    it('refuses a restricted join to a room that is not on the policy list', async () => {
        await expect(romeo.requestRestricted('rooms.join', { room: `other@${MUC_DOMAIN}` })).rejects.toMatchObject({
            code: ERRORS.ACCESS_DENIED,
        });
    });

    it('makes no join or leave presence across many consecutive CLI calls', async () => {
        watcher = await watch(await registerAccount('watcher'), room);
        const before = watcher.presences.length;

        for (let i = 0; i < 15; i++) {
            await romeo.request('conversations.list');
            await romeo.request('messages.list', { conversation: room, limit: 5 });
            await romeo.request('rooms.occupants', { room });
            await romeo.request('contacts.list');
        }

        // Guards against passing vacuously: the watcher must have seen romeo, when it entered.
        expect(watcher.presences.slice(0, before).some(({ from }) => from === `${room}/agent`)).toBe(true);
        const from_romeo = watcher.presences.slice(before).filter(({ from }) => from === `${room}/agent`);
        expect(from_romeo).toEqual([]);
    });

    it('rejoins the rooms it was in after a restart', async () => {
        await romeo.restart();
        await eventually(
            async () => {
                const { occupants } = await romeo.request('rooms.occupants', { room });
                return occupants.some((o) => o.nick === 'agent');
            },
            { what: 'the daemon to rejoin the room after its restart' },
        );
    });

    it('leaves a room, and forgets it, so that a restart does not rejoin it', async () => {
        await juliet.requestFull('rooms.leave', { room });
        await eventually(
            () => watcher.presences.some(({ from, type }) => from === `${room}/juliet` && type === 'unavailable'),
            {
                what: 'the room to see juliet leave',
            },
        );

        await juliet.restart();
        await expect(juliet.request('rooms.occupants', { room })).rejects.toMatchObject({
            code: ERRORS.NOT_FOUND,
        });
    });
});
