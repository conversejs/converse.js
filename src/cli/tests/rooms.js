/**
 * Rooms from the command line: the commands, their output and their exit
 * codes. What the daemon does with each is covered at the protocol seam, and
 * the joins themselves against a real server.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readSetup } from '../commands/rooms.js';
import { ROOM_ECHO } from '../../daemon/send.js';
import { startDaemon } from '../../daemon/tests/harness.js';
import { EXIT } from '../exit-codes.js';
import { run } from './run.js';

const ROOM = 'garden@conference.montague.lit';

describe('converse rooms', () => {
    let daemon;

    beforeAll(async () => {
        daemon = await startDaemon();
    });

    afterAll(async () => {
        vi.restoreAllMocks();
        await daemon?.stop();
    });

    it('refuses a join from restricted access, which is what the CLI uses, and says where to allow it', async () => {
        const { code, stderr } = await run(daemon.env, 'rooms', 'join', ROOM);
        expect(code).toBe(EXIT.ERROR);
        expect(stderr).toContain('"policy.rooms"');
    });

    it('refuses to leave a room it is not on the list for, and says so before looking', async () => {
        const { code, stderr } = await run(daemon.env, 'rooms', 'leave', ROOM);
        expect(code).toBe(EXIT.ERROR);
        expect(stderr).toContain('"policy.rooms"');
    });

    it('reports, as not found, the occupants of a room it is not in', async () => {
        const { code } = await run(daemon.env, 'rooms', 'occupants', ROOM);
        expect(code).toBe(EXIT.NOT_FOUND);
    });

    it('lists the rooms a service hosts, one per line, and nothing is joined', async () => {
        vi.spyOn(daemon.api.rooms, 'discover').mockResolvedValue([
            { jid: ROOM, name: 'Garden' },
            { jid: 'hall@conference.montague.lit', name: null },
        ]);
        const { code, stdout, stderr } = await run(daemon.env, 'rooms', 'discover', 'conference.montague.lit');
        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        expect(stdout).toBe(`${ROOM}  "Garden"\nhall@conference.montague.lit  -\n`);
    });

    it('says so when a service lists no rooms', async () => {
        vi.spyOn(daemon.api.rooms, 'discover').mockResolvedValue([]);
        const { code, stderr } = await run(daemon.env, 'rooms', 'discover', 'conference.montague.lit');
        expect(code).toBe(EXIT.OK);
        expect(stderr).toBe('conference.montague.lit lists no rooms.\n');
    });

    it('needs a subcommand, and names them', async () => {
        const { code, stderr } = await run(daemon.env, 'rooms');
        expect(code).toBe(EXIT.ERROR);
        expect(stderr).toBe(
            'converse: "rooms" needs one of: join, create, config show, config set, leave, occupants, discover. ' +
                'Run "converse help rooms" for each one\'s usage.\n',
        );
    });
});

describe('converse rooms create and config', () => {
    let daemon, dir;

    beforeAll(async () => {
        daemon = await startDaemon({ access: 'full' });
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'converse-rooms-test-'));
    });

    afterAll(async () => {
        await daemon?.stop();
        await fs.rm(dir, { recursive: true, force: true });
    });

    /**
     * @param {Record<string, any>} options
     * @param {string} [stdin]
     */
    const setup = (options, stdin) =>
        readSetup(
            /** @type {any} */ ({
                options,
                env: { XDG_CONFIG_HOME: dir },
                stdin: stdin === undefined ? undefined : Readable.from([stdin]),
            }),
            ROOM,
        );
    const spec_path = () => path.join(dir, 'converse', 'rooms', `${ROOM}.json`);

    it('reads the settings and affiliations from a file, then --set and --member over them', async () => {
        const file = path.join(dir, 'room.json');
        await fs.writeFile(
            file,
            JSON.stringify({
                settings: { membersonly: true, whois: 'moderators' },
                affiliations: { member: ['a@example.org'], admin: ['b@example.org'] },
            }),
        );
        expect(await setup({ file, set: ['whois=anyone', 'roomname=A = B'], member: ['c@example.org'] })).toEqual({
            settings: { membersonly: true, whois: 'anyone', roomname: 'A = B' },
            affiliations: { member: ['a@example.org', 'c@example.org'], admin: ['b@example.org'] },
            source: file,
            spec_path: spec_path(),
        });
    });

    it("reads the room's spec when given no file, and a file instead of it when given one", async () => {
        expect(await setup({})).toEqual({ settings: {}, affiliations: {}, source: null, spec_path: spec_path() });
        await fs.mkdir(path.dirname(spec_path()), { recursive: true });
        await fs.writeFile(spec_path(), JSON.stringify({ settings: { persistentroom: true } }));
        try {
            expect(await setup({ set: ['membersonly=true'] })).toMatchObject({
                settings: { persistentroom: true, membersonly: 'true' },
                source: spec_path(),
            });
            const other = path.join(dir, 'other.json');
            await fs.writeFile(other, JSON.stringify({ settings: { publicroom: false } }));
            expect(await setup({ file: other })).toMatchObject({ settings: { publicroom: false }, source: other });
        } finally {
            await fs.rm(spec_path());
        }
    });

    it("refuses a room JID that would take the spec's path out of its directory", async () => {
        await expect(
            readSetup(/** @type {any} */ ({ options: {}, env: { XDG_CONFIG_HOME: dir } }), '../../x@y'),
        ).rejects.toThrow('Expected a room JID');
    });

    it('reads the file from stdin given "-", and takes back what rooms config --json printed', async () => {
        const printed = { room: 'x@conference.example.org', settings: { publicroom: false }, affiliations: {}, fields: [] };
        expect(await setup({ file: '-' }, JSON.stringify(printed))).toMatchObject({
            settings: { publicroom: false },
            affiliations: {},
            source: 'stdin',
        });
    });

    it('refuses a file it cannot read, that is not JSON, or has keys it does not know', async () => {
        await expect(setup({ file: path.join(dir, 'missing.json') })).rejects.toThrow("Couldn't read");
        const bad = path.join(dir, 'bad.json');
        await fs.writeFile(bad, '{ settings: ');
        await expect(setup({ file: bad })).rejects.toThrow("isn't JSON");
        await fs.writeFile(bad, JSON.stringify({ config: { membersonly: true } }));
        await expect(setup({ file: bad })).rejects.toThrow('not "config"');
        await fs.writeFile(bad, JSON.stringify({ settings: ['membersonly'] }));
        await expect(setup({ file: bad })).rejects.toThrow('"settings" in');
    });

    it('refuses a --set that has no name=value, before asking the daemon', async () => {
        const { code, stderr } = await run(daemon.env, 'rooms', 'create', ROOM, '--set', 'membersonly');
        expect(code).toBe(EXIT.ERROR);
        expect(stderr).toContain('--set takes <name=value>');
    });

    it('leaves a room that exists as it is, and says so, with exit code 0', async () => {
        // The mock server says every room exists.
        const { code, stdout, stderr } = await run(daemon.env, 'rooms', 'create', ROOM, '--set', 'membersonly=true');
        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        expect(stdout).toBe(
            `${ROOM} exists already, so it was left as it is. Change it with "converse rooms config set".\n`,
        );
    });

    it('names the subcommands of rooms config', async () => {
        const { code, stderr } = await run(daemon.env, 'rooms', 'config');
        expect(code).toBe(EXIT.ERROR);
        expect(stderr).toContain('"rooms config" needs one of: show, set.');
    });
});

describe('converse rooms create from restricted access', () => {
    let daemon;

    beforeAll(async () => {
        daemon = await startDaemon();
    });

    afterAll(async () => {
        await daemon?.stop();
    });

    it('is refused, as it needs full access', async () => {
        const { code, stderr } = await run(daemon.env, 'rooms', 'create', ROOM);
        expect(code).toBe(EXIT.ERROR);
        expect(stderr).toMatch(/full access|restricted/i);
    });
});

describe('converse sending to a room', () => {
    let daemon, client;
    const timeout = ROOM_ECHO.timeout;

    beforeAll(async () => {
        ROOM_ECHO.timeout = 300;
        daemon = await startDaemon({ access: 'full' });
        client = await daemon.connect({ access: 'full' });
    });

    afterEach(() => daemon.setRoomEcho(true));

    afterAll(async () => {
        ROOM_ECHO.timeout = timeout;
        client?.close();
        await daemon?.stop();
    });

    it("exits with its own code for a MUC the daemon isn't in, and nothing is sent", async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'send', '--muc', ROOM, 'Hello all');
        expect({ code, stdout }).toEqual({ code: EXIT.NOT_JOINED, stdout: '' });
        expect(stderr).toBe(
            `converse: We aren't in ${ROOM}, so the message wasn't sent. ` +
                'Join it first with "converse rooms join".\n',
        );
        const sent = daemon.connection.sent_stanzas.filter((s) => s.nodeName === 'message' && s.querySelector('body'));
        expect(sent).toEqual([]);
    });

    it('reports a send the room echoed as sent, without a warning', async () => {
        const joined = client.request('rooms.join', { room: ROOM, nick: 'romeo' });
        await daemon.enterRoom(ROOM, 'romeo');
        await joined;

        const { code, stdout, stderr } = await run(daemon.env, 'send', '--muc', ROOM, 'Hello all');
        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        expect(stdout).toMatch(new RegExp(`^Sent to ${ROOM} as `));
    });

    it("warns that a room didn't echo a send in time, and read marks it", async () => {
        daemon.setRoomEcho(false);
        const { code, stdout, stderr } = await run(daemon.env, 'send', ROOM, 'Anyone?');
        expect(code).toBe(EXIT.OK);
        const id = stdout.match(/ as (\S+)\n$/)[1];
        expect(stderr).toBe(
            `converse: warning: ${ROOM} hasn't confirmed ${id} yet, so it may not have reached the room. ` +
                'Check with read before sending it again.\n',
        );

        const read = await run(daemon.env, 'read', ROOM);
        const lines = read.stdout.trim().split('\n');
        expect(lines.at(-1)).toContain('[not confirmed by the room]  "Anyone?"');
        expect(lines.at(-2)).not.toContain('not confirmed');
    });
});
