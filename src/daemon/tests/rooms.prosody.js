/**
 * Rooms on a real Prosody: what a mock can't show, since it's the server that
 * decides who is in a room, and tells everyone when someone joins or leaves.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { converse } from '@converse/headless';
import { MUC_DOMAIN, WEBSOCKET_URL } from '../../../tests/prosody/server.js';
import { ERRORS } from '../protocol.js';
import { eventually, registerAccount, startDaemon } from './real-server.js';

const { Strophe, $pres, stx } = converse.env;
const NS_BOOKMARKS = 'urn:xmpp:bookmarks:1';

/**
 * Logs in to an account as a plain XMPP client.
 * @param {{ jid: string, password: string }} account
 * @param {string} resource
 * @returns {Promise<import('strophe.js').Connection>}
 */
async function login(account, resource) {
    const conn = new Strophe.Connection(WEBSOCKET_URL);
    await new Promise((resolve, reject) => {
        conn.connect(`${account.jid}/${resource}`, account.password, (status) => {
            if (status === Strophe.Status.CONNECTED) resolve(undefined);
            if (status === Strophe.Status.AUTHFAIL || status === Strophe.Status.CONNFAIL) {
                reject(new Error(`${resource} couldn't connect (status ${status})`));
            }
        });
    });
    return conn;
}

/**
 * The account's bookmarks (XEP-0402), as another of its clients sees them.
 * @param {{ jid: string, password: string }} account
 */
async function bookmarksOf(account) {
    const conn = await login(account, 'bookmarks');

    /** @param {import('strophe.js').Builder} iq */
    const sendIQ = (iq) => new Promise((resolve, reject) => conn.sendIQ(iq.tree(), resolve, reject));

    return {
        /** The JIDs of the bookmarked rooms. None if the node doesn't exist yet. */
        async rooms() {
            const result = await sendIQ(
                stx`<iq type="get" xmlns="jabber:client">
                    <pubsub xmlns="${Strophe.NS.PUBSUB}"><items node="${NS_BOOKMARKS}"/></pubsub>
                </iq>`,
            ).catch((e) => e);
            return [...result.querySelectorAll('item')].map((item) => item.getAttribute('id'));
        },
        /**
         * Bookmarks a room, to be joined by the account's clients.
         * @param {string} room
         * @param {string} nick
         */
        add(room, nick) {
            return sendIQ(
                stx`<iq type="set" xmlns="jabber:client">
                    <pubsub xmlns="${Strophe.NS.PUBSUB}">
                        <publish node="${NS_BOOKMARKS}">
                            <item id="${room}">
                                <conference xmlns="${NS_BOOKMARKS}" autojoin="true"><nick>${nick}</nick></conference>
                            </item>
                        </publish>
                        <publish-options>
                            <x xmlns="jabber:x:data" type="submit">
                                <field var="FORM_TYPE" type="hidden">
                                    <value>${Strophe.NS.PUBSUB}#publish-options</value>
                                </field>
                                <field var="pubsub#persist_items"><value>true</value></field>
                                <field var="pubsub#max_items"><value>max</value></field>
                                <field var="pubsub#send_last_published_item"><value>never</value></field>
                                <field var="pubsub#access_model"><value>whitelist</value></field>
                            </x>
                        </publish-options>
                    </pubsub>
                </iq>`,
            );
        },
        disconnect: () => conn.disconnect(),
    };
}

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

        const before_restart = watcher.presences.length;
        await juliet.restart();
        // Headless joins every room it restores as the daemon starts. Once its rooms are loaded, one
        // it doesn't hold can't be joined: the room has messages, so it would be listed if it held it.
        const { conversations } = await juliet.request('conversations.list');
        expect(conversations.map((c) => c.jid)).not.toContain(room);
        expect(watcher.presences.slice(before_restart).filter(({ from }) => from === `${room}/juliet`)).toEqual([]);
        await expect(juliet.request('rooms.occupants', { room })).rejects.toMatchObject({
            code: ERRORS.NOT_FOUND,
        });
    });
});

describe('Rooms from the config, on a real Prosody', () => {
    let romeo, watcher;
    const kept = `kept-${crypto.randomUUID().slice(0, 8)}@${MUC_DOMAIN}`;
    const dropped = `dropped-${crypto.randomUUID().slice(0, 8)}@${MUC_DOMAIN}`;

    /** @param {string} room */
    const occupantsOf = async (room) => (await romeo.request('rooms.occupants', { room })).occupants.length;

    beforeAll(async () => {
        romeo = await startDaemon(await registerAccount('romeo'), { rooms: { [kept]: {}, [dropped]: {} } });
    });

    afterAll(async () => {
        watcher?.disconnect();
        await romeo?.stop();
    });

    it('joins the rooms in the config on start', async () => {
        await eventually(() => occupantsOf(kept), { what: 'the daemon to join the first room' });
        await eventually(() => occupantsOf(dropped), { what: 'the daemon to join the second room' });
    });

    it('stops joining a room once it is taken out of the config', async () => {
        watcher = await watch(await registerAccount('watcher'), dropped);
        const before = watcher.presences.length;

        await romeo.restart(async () => {
            const raw = JSON.parse(await fs.readFile(romeo.config_path, 'utf8'));
            await fs.writeFile(romeo.config_path, JSON.stringify({ ...raw, rooms: { [kept]: {} } }));
        });
        // Back in the room still in the config, so the start got as far as joining rooms.
        await eventually(() => occupantsOf(kept), { what: 'the daemon to rejoin the room still in the config' });
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const joins = watcher.presences
            .slice(before)
            .filter(({ from, type }) => from === `${dropped}/agent` && type === 'available');
        expect(joins).toEqual([]);
        await expect(romeo.request('rooms.occupants', { room: dropped })).rejects.toMatchObject({
            code: ERRORS.NOT_FOUND,
        });
    });
});

describe('Bookmarks on a real Prosody', () => {
    // Romeo's daemon has the default settings. Juliet's has bookmarks turned
    // on, and shows what Romeo's would do with them, so that a check of
    // Romeo's can't pass just because it looked too soon.
    let romeo, juliet, romeo_bookmarks, juliet_bookmarks;
    const newRoom = () => `bookmarked-${crypto.randomUUID().slice(0, 8)}@${MUC_DOMAIN}`;

    beforeAll(async () => {
        const [romeo_account, juliet_account] = await Promise.all([
            registerAccount('romeo'),
            registerAccount('juliet'),
        ]);
        [romeo, juliet] = await Promise.all([
            startDaemon(romeo_account),
            startDaemon(juliet_account, { settings: { allow_bookmarks: true } }),
        ]);
        [romeo_bookmarks, juliet_bookmarks] = await Promise.all([
            bookmarksOf(romeo_account),
            bookmarksOf(juliet_account),
        ]);
    });

    afterAll(async () => {
        romeo_bookmarks?.disconnect();
        juliet_bookmarks?.disconnect();
        await Promise.all([romeo?.stop(), juliet?.stop()]);
    });

    it('bookmarks none of the rooms it joins', async () => {
        const room = newRoom();
        await romeo.requestFull('rooms.join', { room });
        await juliet.requestFull('rooms.join', { room, nick: 'juliet' });

        await eventually(async () => (await juliet_bookmarks.rooms()).includes(room), {
            what: "the room in Juliet's bookmarks",
        });
        expect(await romeo_bookmarks.rooms()).not.toContain(room);
    });

    it("doesn't join the rooms the account's bookmarks say to join", async () => {
        // A room each, so that neither waits on a room the other has just created.
        const [romeo_room, juliet_room] = [newRoom(), newRoom()];
        await Promise.all([romeo_bookmarks.add(romeo_room, 'romeo'), juliet_bookmarks.add(juliet_room, 'juliet')]);
        await Promise.all([romeo.restart(), juliet.restart()]);

        await eventually(
            async () => (await juliet.request('rooms.occupants', { room: juliet_room })).occupants.length,
            { what: 'Juliet to join the room she bookmarked' },
        );
        await expect(romeo.request('rooms.occupants', { room: romeo_room })).rejects.toMatchObject({
            code: ERRORS.NOT_FOUND,
        });
    });
});
