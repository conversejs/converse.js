import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { converse } from '@converse/headless';
import { createPolicy } from '../policy.js';
import { ERRORS } from '../protocol.js';
import { createRoomStore } from '../rooms.js';
import { startDaemon } from './harness.js';

const { ROOMSTATUS } = converse;
const { u } = converse.env;

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
    });

    it('keeps the nickname it has in a room it is already in, and says so', async () => {
        const joining = full.request('rooms.join', { room: ORCHARD });
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
