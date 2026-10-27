import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { converse } from '@converse/headless';
import { JID, startDaemon } from '../../daemon/tests/harness.js';
import { EXIT } from '../exit-codes.js';
import { run } from './run.js';

const { stx, u } = converse.env;

const JULIET = 'juliet@capulet.lit';
const MERCUTIO = 'mercutio@montague.lit';

describe('converse-cli wait', () => {
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

    /**
     * Delivers messages until `waiting` has ended. A message that arrives
     * before the wait subscribes is missed, so one message isn't enough.
     * @template T
     * @param {Promise<T>} waiting
     * @param {(n: number) => Promise<void>} deliver - Delivers the nth round of messages
     * @returns {Promise<T>}
     */
    async function deliverUntil(waiting, deliver) {
        const exited = waiting.then(() => true);
        const pause = () => new Promise((resolve) => setTimeout(resolve, 100));
        for (let n = 0; !(await Promise.race([exited, pause()])); n++) {
            await deliver(n);
        }
        return waiting;
    }

    /**
     * Delivers a message from `from`, and waits until the daemon has stored it.
     * @param {string} from
     * @param {string} body
     */
    async function receive(from, body) {
        const { promise, resolve } = Promise.withResolvers();
        daemon.api.listen.once('message', resolve);
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${from}/balcony" to="${JID}" type="chat"
                     id="${u.getUniqueId()}">
                <body>${body}</body>
            </message>`);
        await promise;
    }

    it('times out with its own exit code, saying what to check', async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'wait', '--timeout', '1');
        expect(code).toBe(EXIT.TIMEOUT);
        expect(stdout).toBe('');
        expect(stderr).toBe(
            'No matching message within 1s. Check the --from, --conversation and --mention filters, ' +
                'or wait longer with --timeout.\n',
        );
    });

    it('refuses a timeout that is not a positive number of seconds', async () => {
        const { code, stderr } = await run(daemon.env, 'wait', '--timeout', '0');
        expect(code).toBe(EXIT.ERROR);
        expect(stderr).toMatch(/^converse-cli: --timeout "0" isn't a number of seconds\. /);
    });

    it('prints the first message from the sender it is waiting for, and exits ok', async () => {
        // Mercutio's messages must never match.
        const { code, stdout, stderr } = await deliverUntil(
            run(daemon.env, 'wait', '--from', JULIET, '--timeout', '20'),
            async (n) => {
                await receive(MERCUTIO, `Not from Juliet ${n}`);
                await receive(JULIET, `From Juliet ${n}`);
            },
        );
        expect(stderr).toBe('');
        expect(code).toBe(EXIT.OK);
        expect(stdout).toMatch(/^\S+\s+\S+ \(just now\)\s+juliet@capulet\.lit\s+"From Juliet \d+"\n$/);
        expect(stdout).not.toContain('Not from Juliet');
    });

    it('prints the matching message as JSON with --json', async () => {
        const { code, stdout } = await deliverUntil(
            run(daemon.env, 'wait', '--conversation', MERCUTIO, '--json', '--timeout', '20'),
            (n) => receive(MERCUTIO, `Good morrow ${n}`),
        );
        expect(code).toBe(EXIT.OK);
        expect(JSON.parse(stdout)).toEqual({
            id: expect.any(String),
            conversation: MERCUTIO,
            from: MERCUTIO,
            nick: null,
            direction: 'incoming',
            time: expect.any(String),
            body: expect.stringMatching(/^Good morrow \d+$/),
            encryption: null,
            reply_to: null,
            edited: null,
            retracted: null,
            reactions: {},
        });
    });
});
