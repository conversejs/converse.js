import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDaemon } from '../../daemon/tests/harness.js';
import { EXIT } from '../exit-codes.js';
import { run } from './run.js';

const JULIET = 'juliet@capulet.lit';

describe('converse-cli scheduled sends', () => {
    let daemon;
    let send_at;
    let schedule_id;

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [{ jid: JULIET, name: 'Juliet Capulet' }],
            mode: 'bot',
            policy: { direct: [JULIET] },
        });
        send_at = new Date(Date.now() + 60_000).toISOString();
    });

    afterAll(() => daemon?.stop());

    it('schedules send --at without sending immediately', async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'send', '--at', send_at, JULIET, 'See you later');

        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        expect(stdout).toMatch(new RegExp(`^Scheduled (\\S+) to ${JULIET} for ${send_at}\\.\\n$`));
        schedule_id = stdout.match(/^Scheduled (\S+)/)[1];
        const sent = daemon.connection.sent_stanzas.filter(
            (s) => s.nodeName === 'message' && s.getAttribute('to') === JULIET,
        );
        expect(sent).toEqual([]);
    });

    it('lists scheduled messages one per line', async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'schedules', 'list');

        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        expect(stdout).toBe(`${schedule_id}  ${send_at}  to ${JULIET}  "See you later"\n`);
    });

    it('prints stable JSON for a scheduled send', async () => {
        const later = new Date(Date.now() + 120_000).toISOString();
        const { code, stdout } = await run(daemon.env, 'send', '--json', '--at', later, JULIET, 'JSON later');
        const result = JSON.parse(stdout);

        expect(code).toBe(EXIT.OK);
        expect(result).toMatchObject({
            outcome: 'scheduled',
            schedule: { to: JULIET, body: 'JSON later', send_at: later, access: 'restricted' },
        });
        await run(daemon.env, 'schedules', 'cancel', result.schedule.id);
    });

    it('cancels a scheduled message', async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'schedules', 'cancel', schedule_id);

        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        expect(stdout).toBe(`Cancelled scheduled message ${schedule_id}. Nothing was sent.\n`);
        const empty = await run(daemon.env, 'schedules', 'list');
        expect(empty).toMatchObject({ code: EXIT.OK, stdout: '', stderr: 'No scheduled messages.\n' });
    });

    it('reports an invalid or past --at value as bad usage', async () => {
        for (const value of ['soon', new Date(Date.now() - 1000).toISOString()]) {
            const { code, stderr } = await run(daemon.env, 'send', '--at', value, JULIET, 'Too late');
            expect(code).toBe(EXIT.ERROR);
            expect(stderr).toContain('"at" must be an ISO 8601 time in the future');
        }
    });
});
