/**
 * Rooms from the command line: the commands, their output and their exit
 * codes. What the daemon does with each is covered at the protocol seam, and
 * the joins themselves against a real server.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startDaemon } from '../../daemon/tests/harness.js';
import { EXIT } from '../exit-codes.js';
import { run } from './run.js';

const ROOM = 'garden@conference.montague.lit';

describe('converse-cli rooms', () => {
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
            'converse-cli: "rooms" needs one of: join, leave, occupants, discover. ' +
                'Run "converse-cli help rooms" for each one\'s usage.\n',
        );
    });
});
