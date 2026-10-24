/**
 * The drafts flow from the command line: a restricted send is queued, and the
 * user lists, edits, approves and rejects it. What the daemon does with each
 * is covered at the protocol seam; this pins the commands, output and exit codes.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDaemon } from '../../daemon/tests/harness.js';
import { EXIT } from '../exit-codes.js';
import { run, runWithInput } from './run.js';

const JULIET = 'juliet@capulet.lit';

describe('converse-cli drafts', () => {
    let daemon;

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [{ jid: JULIET, name: 'Juliet Capulet' }],
            policy: { allow: [JULIET], draft: true },
        });
    });

    afterAll(() => daemon?.stop());

    it('queues a restricted send for approval, and exits with the draft code', async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'send', JULIET, 'Shall we meet at noon?');
        expect({ code, stderr }).toEqual({ code: EXIT.DRAFT, stderr: '' });
        expect(stdout).toBe("Queued as draft d1. It isn't sent until the user approves it.\n");
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

    it('edits a draft with text read from stdin, and leaves it queued', async () => {
        const { code, stdout } = await runWithInput(daemon.env, 'Shall we meet at one?\n', 'drafts', 'edit', 'd1');
        expect(code).toBe(EXIT.OK);
        expect(stdout).toBe("Edited draft d1. It's still waiting for approval.\n");
        const { stdout: listed } = await run(daemon.env, 'drafts', 'list');
        expect(listed).toContain('"Shall we meet at one?"');
    });

    it('approves a draft, sending it as it stands', async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'drafts', 'approve', 'd1');
        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        expect(stdout).toMatch(new RegExp(`^Sent to ${JULIET} as \\S+\\n$`));
    });

    it('rejects a draft without sending it', async () => {
        const { code, stdout } = await run(daemon.env, 'drafts', 'reject', 'd2');
        expect(code).toBe(EXIT.OK);
        expect(stdout).toBe('Rejected draft d2. Nothing was sent.\n');
    });

    it('exits as not found for a draft that is gone, and says how to see the ones there are', async () => {
        const { code, stderr } = await run(daemon.env, 'drafts', 'approve', 'd2');
        expect(code).toBe(EXIT.NOT_FOUND);
        expect(stderr).toContain('No draft with id "d2". List the drafts waiting for approval');
    });
});
