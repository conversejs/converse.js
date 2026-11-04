import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { _converse, converse } from '@converse/headless';
import { createPolicy } from '../policy.js';
import { ERRORS } from '../protocol.js';
import { createRoomStore } from '../rooms.js';
import { JID, startDaemon } from './harness.js';

const { ROOMSTATUS } = converse;
const { stx, u } = converse.env;

const GARDEN = 'garden@conference.montague.lit';
const HALL = 'hall@conference.montague.lit';
const ORCHARD = 'orchard@conference.montague.lit';
const TOMB = 'tomb@conference.montague.lit';

describe('Rooms, under the mock connection', () => {
    let daemon, restricted, full;

    beforeAll(async () => {
        daemon = await startDaemon({ policy: { rooms: [GARDEN] } });
        restricted = await daemon.connect({ access: 'restricted' });
        full = await daemon.connect({ access: 'full' });
    });

    afterAll(async () => {
        vi.restoreAllMocks();
        restricted?.close();
        full?.close();
        await daemon?.stop();
    });

    it('refuses a restricted join to a room that is not on the policy list, and says where the list is', async () => {
        await expect(restricted.request('rooms.join', { room: HALL })).rejects.toMatchObject({
            code: ERRORS.ACCESS_DENIED,
            message: expect.stringContaining('"policy.rooms"'),
        });
    });

    it('refuses a blank nickname before anything else', async () => {
        await expect(full.request('rooms.join', { room: GARDEN, nick: '  ' })).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
        });
    });

    it('refuses to list the occupants of a room we are not in', async () => {
        await expect(full.request('rooms.occupants', { room: GARDEN })).rejects.toMatchObject({
            code: ERRORS.NOT_FOUND,
        });
    });

    it('refuses to leave a room we are not in', async () => {
        await expect(full.request('rooms.leave', { room: GARDEN })).rejects.toMatchObject({
            code: ERRORS.NOT_FOUND,
        });
    });

    it('refuses a restricted leave of a room that is not on the policy list', async () => {
        await expect(restricted.request('rooms.leave', { room: HALL })).rejects.toMatchObject({
            code: ERRORS.ACCESS_DENIED,
        });
    });

    it('refuses a service that is not a domain', async () => {
        await expect(restricted.request('rooms.discover', { service: 'conference example.org' })).rejects.toMatchObject(
            { code: ERRORS.INVALID_PARAMS },
        );
    });

    it('passes on the rooms a service lists, without joining any', async () => {
        const listing = [{ jid: HALL, name: 'Hall' }];
        const discover = vi.spyOn(daemon.api.rooms, 'discover').mockResolvedValue(listing);
        expect(await restricted.request('rooms.discover', { service: 'conference.montague.lit' })).toEqual({
            rooms: listing,
        });
        expect(discover).toHaveBeenCalledWith('conference.montague.lit', { timeout: expect.any(Number) });
    });
});

describe('Joining and leaving, with rooms stored from an earlier run', () => {
    let daemon, full;
    const stored = () => JSON.parse(fs.readFileSync(daemon.config.paths.rooms, 'utf8')).rooms;

    beforeAll(async () => {
        daemon = await startDaemon({
            rooms: [
                { jid: GARDEN, nick: 'agent' },
                { jid: HALL, nick: 'romeo' },
            ],
        });
        full = await daemon.connect({ access: 'full' });
    });

    afterAll(async () => {
        full?.close();
        await daemon?.stop();
    });

    it('forgets a stored room that would not let it back in, so a restart does not try it again', async () => {
        await daemon.refuseRoom(GARDEN);
        const garden = await daemon.api.rooms.get(GARDEN);
        await u.waitUntil(() => garden.session.get('connection_status') === ROOMSTATUS.BANNED);

        expect(await full.request('rooms.leave', { room: GARDEN })).toEqual({
            conversation: expect.objectContaining({ jid: GARDEN }),
            was_in: false,
        });
        expect(stored()).toEqual([{ jid: HALL, nick: 'romeo' }]);
    });

    it('leaves a stored room that it was told to leave while it was still rejoining it', async () => {
        const left = await full.request('rooms.leave', { room: HALL });
        expect(left).toMatchObject({ was_in: false });
        expect(stored()).toEqual([]);

        // The room lets us in after all, so the daemon leaves it straight away.
        await daemon.enterRoom(HALL, 'romeo');
        await u.waitUntil(() =>
            daemon.connection.sent_stanzas.some(
                (s) =>
                    s.nodeName === 'presence' &&
                    s.getAttribute('to') === `${HALL}/romeo` &&
                    s.getAttribute('type') === 'unavailable',
            ),
        );
        // Nor does headless keep it, as it would join it again as the daemon starts.
        await expect.poll(() => daemon.api.rooms.get(HALL)).toBeFalsy();
    });

    it('keeps the nickname it has in a room it is already in, and says so', async () => {
        const sent = daemon.connection.sent_stanzas.length;
        const joining = full.request('rooms.join', { room: ORCHARD });
        // This join's presence, not the one from the first time in.
        await u.waitUntil(() =>
            daemon.connection.sent_stanzas
                .slice(sent)
                .some(
                    (s) =>
                        s.nodeName === 'presence' &&
                        s.getAttribute('to') === `${ORCHARD}/agent` &&
                        !s.getAttribute('type'),
                ),
        );
        await daemon.enterRoom(ORCHARD, 'agent');
        expect(await joining).toMatchObject({ nick: 'agent' });

        expect(await full.request('rooms.join', { room: ORCHARD, nick: 'bob' })).toMatchObject({ nick: 'agent' });
        expect(stored()).toEqual([{ jid: ORCHARD, nick: 'agent' }]);
    });

    it('remembers a room before the room confirms the join, and forgets it if the room turns it down', async () => {
        const joining = full.request('rooms.join', { room: TOMB });
        // Remembered while the join is unconfirmed, so a late confirmation is still rejoined after a restart.
        await u.waitUntil(() => stored().some(({ jid }) => jid === TOMB));

        await daemon.refuseRoom(TOMB);
        await expect(joining).rejects.toMatchObject({ code: ERRORS.JOIN_REFUSED });
        expect(stored()).toEqual([{ jid: ORCHARD, nick: 'agent' }]);
        expect(await daemon.api.rooms.get(TOMB)).toBeFalsy();
    });

    it('drops a room it leaves from headless, so a restart does not join it, but keeps its messages', async () => {
        const orchard = await daemon.api.rooms.get(ORCHARD);
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${ORCHARD}/juliet" to="${JID}" type="groupchat"
                    id="${u.getUniqueId()}">
                <body>Before the leave</body>
            </message>`);
        await u.waitUntil(() => orchard.messages.findWhere({ body: 'Before the leave' }));

        expect(await full.request('rooms.leave', { room: ORCHARD })).toMatchObject({ was_in: true });
        expect(await daemon.api.rooms.get(ORCHARD)).toBeFalsy();
        expect(stored()).toEqual([]);

        // An OMEMO room's messages couldn't be fetched from the archive again, so they're kept.
        const sent = daemon.connection.sent_stanzas.length;
        const joining = full.request('rooms.join', { room: ORCHARD });
        // This join's presence, not the one from the first time in.
        await u.waitUntil(() =>
            daemon.connection.sent_stanzas
                .slice(sent)
                .some(
                    (s) =>
                        s.nodeName === 'presence' &&
                        s.getAttribute('to') === `${ORCHARD}/agent` &&
                        !s.getAttribute('type'),
                ),
        );
        await daemon.enterRoom(ORCHARD, 'agent');
        await joining;
        const again = await daemon.api.rooms.get(ORCHARD);
        await again.messages.fetched;
        expect(again.messages.findWhere({ body: 'Before the leave' })).toBeTruthy();
    });

    it('joins a room afresh when asked to while a leave is still closing it', async () => {
        const orchard = await daemon.api.rooms.get(ORCHARD);
        const { promise: gate, resolve: open } = Promise.withResolvers();
        const close = orchard.close.bind(orchard);
        const closing = vi.spyOn(orchard, 'close').mockImplementation(async (...args) => {
            await gate;
            return close(...args);
        });

        const leaving = full.request('rooms.leave', { room: ORCHARD });
        await u.waitUntil(() => closing.mock.calls.length > 0);
        const sent = daemon.connection.sent_stanzas.length;
        const joining = full.request('rooms.join', { room: ORCHARD });
        // Answered after the join has been taken up, since the requests are handled in order.
        await full.request('daemon.status');
        open();
        expect(await leaving).toMatchObject({ was_in: true });

        // A new join, of a new room: not the one the leave closed.
        await u.waitUntil(() =>
            daemon.connection.sent_stanzas
                .slice(sent)
                .some(
                    (s) =>
                        s.nodeName === 'presence' &&
                        s.getAttribute('to') === `${ORCHARD}/agent` &&
                        !s.getAttribute('type'),
                ),
        );
        await daemon.enterRoom(ORCHARD, 'agent');
        expect(await joining).toMatchObject({ nick: 'agent' });
        const again = await daemon.api.rooms.get(ORCHARD);
        expect(again).not.toBe(orchard);
        expect(again.isEntered()).toBe(true);
        expect(stored()).toContainEqual({ jid: ORCHARD, nick: 'agent' });
    });

    it("says why a room turned a join down, even if the room then can't be closed", async () => {
        const sent = daemon.connection.sent_stanzas.length;
        const joining = full.request('rooms.join', { room: TOMB });
        await u.waitUntil(() =>
            daemon.connection.sent_stanzas
                .slice(sent)
                .some((s) => s.nodeName === 'presence' && s.getAttribute('to') === `${TOMB}/agent`),
        );
        const tomb = await daemon.api.rooms.get(TOMB);
        vi.spyOn(tomb, 'close').mockRejectedValueOnce(new Error('The connection was lost'));

        await daemon.refuseRoom(TOMB);
        await expect(joining).rejects.toMatchObject({ code: ERRORS.JOIN_REFUSED });
        expect(stored()).not.toContainEqual(expect.objectContaining({ jid: TOMB }));
    });
});

describe('Rooms from the config, with their passwords', () => {
    let daemon, restricted, full;
    const stored = () => JSON.parse(fs.readFileSync(daemon.config.paths.rooms, 'utf8')).rooms;

    /**
     * The join presences sent to a room, oldest first.
     * @param {string} room
     */
    const joins = (room) =>
        daemon.connection.sent_stanzas.filter(
            (s) => s.nodeName === 'presence' && s.getAttribute('to') === `${room}/agent` && !s.getAttribute('type'),
        );

    /**
     * The password the latest join presence to a room carried, if any.
     * @param {string} room
     */
    const sentPassword = (room) => joins(room).at(-1)?.querySelector('x password')?.textContent;

    beforeAll(async () => {
        daemon = await startDaemon({
            policy: { rooms: [GARDEN, HALL, TOMB] },
            rooms: [{ jid: ORCHARD, nick: 'agent' }],
            room_config: {
                [GARDEN]: { password: 'rosemary' },
                [HALL]: {},
                [ORCHARD]: { password: 'sage' },
            },
        });
        restricted = await daemon.connect({ access: 'restricted' });
        full = await daemon.connect({ access: 'full' });
    });

    afterAll(async () => {
        restricted?.close();
        full?.close();
        await daemon?.stop();
    });

    it('rejoins a room stored from an earlier run with its password', async () => {
        await daemon.enterRoom(ORCHARD);
        expect(sentPassword(ORCHARD)).toBe('sage');
    });

    it('joins the rooms in the config on start, with their passwords, without storing them', async () => {
        await daemon.enterRoom(GARDEN);
        await daemon.enterRoom(HALL);
        expect(sentPassword(GARDEN)).toBe('rosemary');
        expect(sentPassword(HALL)).toBeUndefined();
        // Kept on the room, so that headless sends it again when it rejoins by itself.
        expect((await daemon.api.rooms.get(GARDEN)).get('password')).toBe('rosemary');
        expect(stored()).toEqual([{ jid: ORCHARD, nick: 'agent' }]);
    });

    it('sends the configured password when a client joins, without being given it', async () => {
        await restricted.request('rooms.leave', { room: GARDEN });
        const joining = restricted.request('rooms.join', { room: GARDEN });
        await u.waitUntil(() => joins(GARDEN).length === 2);
        await daemon.enterRoom(GARDEN);
        await joining;
        expect(sentPassword(GARDEN)).toBe('rosemary');
        // Under the default nickname, a room in the config needn't be stored.
        expect(stored()).toEqual([{ jid: ORCHARD, nick: 'agent' }]);
    });

    it("doesn't store a room in the config that gives us another nickname", async () => {
        await restricted.request('rooms.leave', { room: HALL });
        const joining = restricted.request('rooms.join', { room: HALL });
        await u.waitUntil(() => joins(HALL).length === 2);
        await daemon.enterRoom(HALL, 'agent', 'agent (bot)');
        expect(await joining).toMatchObject({ nick: 'agent (bot)' });
        // The config says to be in it, under the default nickname, whatever the room calls us.
        expect(stored()).toEqual([{ jid: ORCHARD, nick: 'agent' }]);
    });

    it('says to check the config when a room asks for a password', async () => {
        const joining = restricted.request('rooms.join', { room: TOMB });
        await daemon.refuseRoom(TOMB, 'agent', 'not-authorized');
        await expect(joining).rejects.toMatchObject({
            code: ERRORS.JOIN_REFUSED,
            message: expect.stringContaining('the one under "rooms" in the config is missing or wrong'),
        });
    });

    it('clears a password the room kept from before, when the config has none for it', async () => {
        const vault = 'vault@conference.montague.lit';
        // A room got with a password, which the config doesn't have, and that doesn't let us in.
        const model = await daemon.api.rooms.get(vault, { nick: 'agent', password: 'stale' }, true);
        await daemon.refuseRoom(vault);
        await u.waitUntil(() => model.session.get('connection_status') === ROOMSTATUS.BANNED);

        const joining = full.request('rooms.join', { room: vault });
        await u.waitUntil(() => joins(vault).length === 2);
        expect(sentPassword(vault)).toBeUndefined();
        expect(model.get('password')).toBeUndefined();
        await daemon.enterRoom(vault);
        await joining;
    });

    it('joins a room in the config again after a restart, even if it was left', async () => {
        await full.request('rooms.leave', { room: GARDEN });

        await daemon.restart();
        await daemon.enterRoom(GARDEN);
        expect(sentPassword(GARDEN)).toBe('rosemary');
        expect(stored().map(({ jid }) => jid)).not.toContain(GARDEN);
    });

    it('stops joining a room once it is taken out of the config', async () => {
        await daemon.restart({ room_config: { [ORCHARD]: { password: 'sage' } } });
        // The stored room is rejoined, which shows that the start got that far.
        await daemon.enterRoom(ORCHARD);
        expect(joins(GARDEN)).toEqual([]);
        expect(joins(HALL)).toEqual([]);
    });

    it("has headless restore none of the rooms it isn't meant to be in", () => {
        // Under the MockConnection, headless clears its cache when it logs out,
        // so the restart above had no rooms to restore. These are stored rooms
        // handed to headless the way it restores them.
        const stored = (jid) => ({ type: 'chatroom', jid, id: jid, nick: 'agent' });
        const { chatboxes } = _converse.state;
        expect(chatboxes.parse([stored(GARDEN), stored(ORCHARD)]).map(({ jid }) => jid)).toEqual([ORCHARD]);

        chatboxes.set([stored(GARDEN)], { add: true, parse: true });
        expect(chatboxes.get(GARDEN)).toBeUndefined();
        expect(joins(GARDEN)).toEqual([]);
    });
});

describe('The room store', () => {
    let dir;

    beforeAll(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'converse-rooms-test-'));
    });

    afterAll(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('keeps the rooms and their nicknames across a restart, and forgets one that is removed', () => {
        const file = path.join(dir, 'romeo.rooms.json');
        const store = createRoomStore(file);
        store.add(GARDEN, 'agent');
        store.add(HALL, 'romeo');
        store.add(GARDEN, 'agent-2');

        const reloaded = createRoomStore(file);
        expect(reloaded.list()).toEqual([
            { jid: HALL, nick: 'romeo' },
            { jid: GARDEN, nick: 'agent-2' },
        ]);

        reloaded.remove(HALL);
        expect(createRoomStore(file).list()).toEqual([{ jid: GARDEN, nick: 'agent-2' }]);
    });

    it('starts empty when there is no file yet', () => {
        expect(createRoomStore(path.join(dir, 'nobody.rooms.json')).list()).toEqual([]);
    });
});

describe('The room send policy', () => {
    /** @param {Partial<import('../types').Policy>} policy */
    const policyWith = (policy) =>
        createPolicy(
            {
                paths: { config: 'default.json' },
                policy: {
                    allow: [],
                    rooms: [GARDEN],
                    rate_limit: { per_conversation: 5, per_room: 1, overall: 20, window: 60 },
                    presence: false,
                    ...policy,
                },
            },
            { now: () => clock },
        );
    let clock = 0;

    it('refuses a room that is not on the policy list', () => {
        const policy = policyWith({});
        expect(policy.admit(HALL, { room: true })).toMatchObject({ allowed: false, rule: 'room_allowlist' });
    });

    it('allows a listed room once per window, and then refuses it until the window has passed', () => {
        clock = 0;
        const policy = policyWith({});
        expect(policy.admit(GARDEN, { room: true })).toEqual({ allowed: true, route: 'draft' });
        expect(policy.admit(GARDEN, { room: true })).toMatchObject({ allowed: false, rule: 'rate_room' });

        clock = 61_000;
        expect(policy.admit(GARDEN, { room: true })).toEqual({ allowed: true, route: 'draft' });
    });

    it('does not let a contact send count against a room, or the other way round', () => {
        clock = 0;
        const policy = policyWith({ allow: ['juliet@capulet.lit'] });
        expect(policy.admit('juliet@capulet.lit')).toEqual({ allowed: true, route: 'draft' });
        expect(policy.admit(GARDEN, { room: true })).toEqual({ allowed: true, route: 'draft' });
    });
});
