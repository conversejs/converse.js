/**
 * The drafts flow from the command line: a restricted send is drafted, and the
 * user lists or withdraws drafts. What the daemon does with each is covered at
 * the protocol seam; this pins the commands, output and exit codes.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDaemon } from '../../daemon/tests/harness.js';
import { EXIT } from '../exit-codes.js';
import { run } from './run.js';

const JULIET = 'juliet@capulet.lit';

describe('converse-cli drafts', () => {
    let daemon;

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [{ jid: JULIET, name: 'Juliet Capulet' }],
            policy: { allow: [JULIET] },
        });
    });

    afterAll(() => daemon?.stop());

    it('drafts a restricted send, and exits with the draft code', async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'send', JULIET, 'Shall we meet at noon?');
        expect({ code, stderr }).toEqual({ code: EXIT.DRAFT, stderr: '' });
        expect(stdout).toBe('Drafted as d1. Its text went to the owner, and nothing was sent.\n');
    });

    it('prints the send as its JSON outcome with --json', async () => {
        const { code, stdout } = await run(daemon.env, 'send', '--json', JULIET, 'Or at one?');
        expect(code).toBe(EXIT.DRAFT);
        expect(JSON.parse(stdout)).toEqual({ outcome: 'draft', draft_id: 'd2' });
    });

    it('lists each draft on one line: its id, when it was queued, its recipient and its body', async () => {
        const { code, stdout } = await run(daemon.env, 'drafts', 'list');
        expect(code).toBe(EXIT.OK);
        const lines = stdout.split('\n');
        expect(lines.pop()).toBe('');
        expect(lines).toEqual([
            expect.stringMatching(
                new RegExp(`^d1 {2}\\S+ \\(just now\\) {2}to ${JULIET} {2}"Shall we meet at noon\\?"$`),
            ),
            expect.stringMatching(new RegExp(`^d2 .* {2}"Or at one\\?"$`)),
        ]);
    });

    it('withdraws a draft without sending it', async () => {
        const { code, stdout } = await run(daemon.env, 'drafts', 'reject', 'd2');
        expect(code).toBe(EXIT.OK);
        expect(stdout).toBe('Withdrew draft d2. Nothing was sent.\n');
    });

    it('exits as not found for a draft that is gone, and says how to see the ones there are', async () => {
        const { code, stderr } = await run(daemon.env, 'drafts', 'reject', 'd2');
        expect(code).toBe(EXIT.NOT_FOUND);
        expect(stderr).toContain('No draft with id "d2". List the drafts with "converse-cli drafts list"');
    });

    it('has no command that sends a draft or edits one', async () => {
        for (const command of ['approve', 'edit']) {
            const { code, stderr } = await run(daemon.env, 'drafts', command, 'd1');
            expect(code).toBe(EXIT.ERROR);
            expect(stderr).toContain('unknown command "drafts ' + command + ' d1"');
        }
    });
});
