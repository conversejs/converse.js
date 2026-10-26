/**
 * `converse-cli search`: argument parsing, the output and the exit codes. What
 * is found is covered at the protocol seam, in the daemon's search spec.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDaemon } from '../../daemon/tests/harness.js';
import { EXIT } from '../exit-codes.js';
import { run } from './run.js';

const JULIET = 'juliet@capulet.lit';
const OWN = 'romeo@montague.lit';

const SERVER = "Searched the server's archive, with its full-text search (XEP-0431).";

describe('converse-cli search', () => {
    let daemon;

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [{ jid: JULIET, name: 'Juliet Capulet' }],
            archive: [
                { id: 'a1', from: JULIET, to: OWN, body: 'Wherefore art thou?', time: '2026-10-20T10:00:00Z' },
                {
                    id: 'a2',
                    from: OWN,
                    to: JULIET,
                    body: 'Shall I come to the balcony?',
                    time: '2026-10-21T10:00:00Z',
                },
            ],
        });
    });

    afterAll(() => daemon?.stop());

    it('says which search was made, then prints each match with the conversation it is in', async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'search', 'balcony');
        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        const [first, line, rest] = stdout.split('\n');
        expect(first).toBe(SERVER);
        expect(line).toMatch(/^a2\s{2}2026-10-21T10:00:00Z \(\d+d ago\)\s{2}in juliet@capulet\.lit\s{2}/);
        expect(line).toMatch(/romeo@montague\.lit\s{2}"Shall I come to the balcony\?"$/);
        expect(rest).toBe('');
    });

    it('takes the words of the query as they are given', async () => {
        const { stdout } = await run(daemon.env, 'search', 'Wherefore', 'ART', 'thou');
        expect(stdout.split('\n')[1]).toMatch(/^a1 /);
    });

    it('says what it searched even when nothing matches, and that nothing did, on stderr', async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'search', 'hamlet');
        expect({ code, stdout, stderr }).toEqual({ code: EXIT.OK, stdout: `${SERVER}\n`, stderr: 'No messages match.\n' });
    });

    it('prints one JSON object with the method and the messages, with --json', async () => {
        const { code, stdout } = await run(daemon.env, 'search', 'balcony', '--json');
        expect(code).toBe(EXIT.OK);
        const result = JSON.parse(stdout);
        expect(result).toMatchObject({ method: 'server', messages: [{ id: 'a2', conversation: JULIET, from: OWN }] });
    });

    it('searches one conversation with --conversation, and fails if there is no such contact', async () => {
        const found = await run(daemon.env, 'search', 'the', '--conversation', 'Juliet Capulet');
        expect(found.code).toBe(EXIT.OK);
        const missing = await run(daemon.env, 'search', 'the', '--conversation', 'Nobody');
        expect(missing.code).toBe(EXIT.NOT_FOUND);
    });

    it('refuses no query, and a --limit that is not a whole number, as bad usage', async () => {
        const none = await run(daemon.env, 'search');
        expect(none.code).toBe(EXIT.ERROR);
        expect(none.stderr).toContain('Expected what to search for.');

        const limit = await run(daemon.env, 'search', 'balcony', '--limit', 'many');
        expect(limit.code).toBe(EXIT.ERROR);
        expect(limit.stderr).toContain('--limit "many" isn\'t a whole number.');
    });
});
