/**
 * Creating and configuring rooms on a real Prosody: the owner form, its field
 * types and the values it takes are the server's, so a mock would only show
 * what we expect it to say.
 */
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MUC_DOMAIN } from '../../../tests/prosody/server.js';
import { ERRORS } from '../protocol.js';
import { registerAccount, startDaemon } from './real-server.js';

const newRoom = (name) => `${name}-${crypto.randomUUID().slice(0, 8)}@${MUC_DOMAIN}`;

const AGENTS_ROOM = {
    roomname: 'Agents',
    membersonly: true,
    whois: 'anyone',
    persistentroom: true,
    publicroom: false,
};

describe('Creating and configuring rooms on a real Prosody', () => {
    const daemons = [];
    let romeo, juliet, mercutio, accounts;
    const room = newRoom('agents');

    /** @param {string} jid */
    const listed = async (jid) =>
        (await romeo.request('rooms.discover', { service: MUC_DOMAIN })).rooms.some((r) => r.jid === jid);

    beforeAll(async () => {
        accounts = await Promise.all([registerAccount('romeo'), registerAccount('juliet'), registerAccount('mercutio')]);
        [romeo, juliet, mercutio] = await Promise.all(accounts.map((account) => startDaemon(account)));
        daemons.push(romeo, juliet, mercutio);
    });

    afterAll(async () => {
        await Promise.all(daemons.map((d) => d.stop()));
    });

    it('creates a members-only, non-anonymous, persistent room, with its members, and joins it', async () => {
        const created = await romeo.requestFull('rooms.create', {
            room,
            settings: AGENTS_ROOM,
            affiliations: { member: [accounts[1].jid] },
        });
        expect(created).toMatchObject({
            created: true,
            nick: 'agent',
            settings: AGENTS_ROOM,
            affiliations: [{ jid: accounts[1].jid, affiliation: 'member' }],
        });

        const config = await romeo.requestFull('rooms.config', { room });
        expect(config.settings).toMatchObject(AGENTS_ROOM);
        expect(config.affiliations).toMatchObject({ owner: [accounts[0].jid], member: [accounts[1].jid] });
        expect(config.fields.find((f) => f.name === 'whois')).toMatchObject({
            type: 'list-single',
            value: 'anyone',
            options: expect.arrayContaining(['moderators', 'anyone']),
        });
    });

    it('lets a member in, and turns anyone else away, saying why', async () => {
        await expect(juliet.requestFull('rooms.join', { room, nick: 'juliet' })).resolves.toMatchObject({
            nick: 'juliet',
        });
        await expect(mercutio.requestFull('rooms.join', { room, nick: 'mercutio' })).rejects.toMatchObject({
            code: ERRORS.JOIN_REFUSED,
            message: expect.stringContaining('member list'),
        });
    });

    it('leaves a room that exists as it is', async () => {
        const again = await romeo.requestFull('rooms.create', { room, settings: { membersonly: false } });
        expect(again).toMatchObject({ created: false, settings: null });
        expect((await romeo.requestFull('rooms.config', { room })).settings.membersonly).toBe(true);
    });

    it("refuses settings the room doesn't have or values it doesn't take, and destroys the new room", async () => {
        const doomed = newRoom('doomed');
        const refused = romeo.requestFull('rooms.create', {
            room: doomed,
            settings: { membersonlyy: true, whois: 'everyone' },
        });
        await expect(refused).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
            message: expect.stringMatching(/"membersonlyy" isn't one of this room's settings.*"whois" takes/),
        });
        expect(await listed(doomed)).toBe(false);
        // Nor is it remembered, to be joined again.
        await expect(romeo.request('rooms.occupants', { room: doomed })).rejects.toMatchObject({
            code: ERRORS.NOT_FOUND,
        });
    });

    it("doesn't create a room on a join", async () => {
        const missing = newRoom('missing');
        await expect(juliet.requestFull('rooms.join', { room: missing })).rejects.toMatchObject({
            code: ERRORS.NOT_FOUND,
            message: expect.stringContaining('"rooms.create"'),
        });
        expect(await listed(missing)).toBe(false);
    });

    it('says what a change would do, and does nothing, on a dry run', async () => {
        const result = await romeo.requestFull('rooms.configure', {
            room,
            settings: { roomname: 'Agents 2', publicroom: 'true' },
            affiliations: { member: [accounts[2].jid] },
            dry_run: true,
        });
        expect(result).toEqual({
            room,
            dry_run: true,
            changes: [
                { name: 'roomname', from: 'Agents', to: 'Agents 2' },
                { name: 'publicroom', from: false, to: true },
            ],
            affiliations: [{ jid: accounts[2].jid, affiliation: 'member' }],
        });
        const config = await romeo.requestFull('rooms.config', { room });
        expect(config.settings).toMatchObject({ roomname: 'Agents', publicroom: false });
        expect(config.affiliations.member).toEqual([accounts[1].jid]);
    });

    it('changes only the settings asked for, and gives affiliations without taking any away', async () => {
        const result = await romeo.requestFull('rooms.configure', {
            room,
            settings: { roomname: 'Agents 2', membersonly: true },
            affiliations: { member: [accounts[2].jid] },
        });
        expect(result).toMatchObject({
            changes: [{ name: 'roomname', from: 'Agents', to: 'Agents 2' }],
            affiliations: [{ jid: accounts[2].jid, affiliation: 'member' }],
        });
        const config = await romeo.requestFull('rooms.config', { room });
        expect(config.settings).toMatchObject({ ...AGENTS_ROOM, roomname: 'Agents 2' });
        expect(config.affiliations.member).toEqual([accounts[1].jid, accounts[2].jid].sort());

        // Asked again, nothing is left to change.
        expect(
            await romeo.requestFull('rooms.configure', {
                room,
                settings: { roomname: 'Agents 2' },
                affiliations: { member: [accounts[2].jid] },
            }),
        ).toMatchObject({ changes: [], affiliations: [] });
    });

    it("refuses to show or change a room's settings to someone who doesn't own it", async () => {
        await expect(juliet.requestFull('rooms.config', { room })).rejects.toMatchObject({
            code: ERRORS.FORBIDDEN,
        });
        await expect(
            juliet.requestFull('rooms.configure', { room, settings: { membersonly: false } }),
        ).rejects.toMatchObject({ code: ERRORS.FORBIDDEN });
    });

    it('takes neither from restricted access', async () => {
        await expect(romeo.requestRestricted('rooms.create', { room: newRoom('restricted') })).rejects.toMatchObject({
            code: ERRORS.ACCESS_DENIED,
        });
        await expect(romeo.requestRestricted('rooms.config', { room })).rejects.toMatchObject({
            code: ERRORS.ACCESS_DENIED,
        });
    });
});
