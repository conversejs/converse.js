/**
 * Rooms from the command line: the commands, their output and their exit
 * codes. What the daemon does with each is covered at the protocol seam, and
 * the joins themselves against a real server.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
            'converse: "rooms" needs one of: join, leave, occupants, discover. ' +
                'Run "converse help rooms" for each one\'s usage.\n',
        );
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
