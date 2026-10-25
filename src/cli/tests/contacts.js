/**
 * Contacts and presence from the command line: the commands, their output and
 * their exit codes. What the daemon answers is covered at the protocol seam.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDaemon } from '../../daemon/tests/harness.js';
import { EXIT } from '../exit-codes.js';
import { run } from './run.js';

const JULIET = 'juliet@capulet.lit';
const MERCUTIO = 'mercutio@montague.lit';

describe('converse-cli contacts', () => {
    let daemon;

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [
                { jid: JULIET, name: 'Juliet Capulet' },
                { jid: MERCUTIO, name: 'Mercutio' },
            ],
        });
    });

    afterAll(() => daemon?.stop());

    it('lists each contact on one line: JID, presence, then the name, quoted', async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'contacts');
        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        expect(stdout).toBe(`${JULIET}  offline  "Juliet Capulet"\n${MERCUTIO}  offline  "Mercutio"\n`);
    });

    it('filters by the words after the command', async () => {
        const { stdout } = await run(daemon.env, 'contacts', 'mercutio');
        expect(stdout).toBe(`${MERCUTIO}  offline  "Mercutio"\n`);
    });

    it('says so, on stderr, when nothing matches', async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'contacts', 'Paris');
        expect({ code, stdout, stderr }).toEqual({ code: EXIT.OK, stdout: '', stderr: 'No contacts match "Paris".\n' });
    });

    it('exits not found from whois for a name nobody has', async () => {
        const { code, stderr } = await run(daemon.env, 'whois', 'Paris');
        expect(code).toBe(EXIT.NOT_FOUND);
        expect(stderr).toContain('converse-cli contacts');
    });

    it('refuses presence from restricted access, which is what the CLI uses, and says how to allow it', async () => {
        const { code, stderr } = await run(daemon.env, 'presence', 'set', 'dnd', 'In a meeting');
        expect(code).toBe(EXIT.ERROR);
        expect(stderr).toContain("Restricted access can't change your presence");
        expect(stderr).toContain('"policy.presence"');
    });
});
