/**
 * The drafts flow from the command line in "as_user" mode: a restricted send
 * is held as a draft, which the agent may list and show, and which the user
 * sends from full access. What the daemon does with each is covered at the
 * protocol seam; this pins the commands, output and exit codes.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { converse } from '@converse/headless';
import { JID, startDaemon } from '../../daemon/tests/harness.js';
import { EXIT } from '../exit-codes.js';
import { run } from './run.js';

const { Strophe, stx } = converse.env;

const ME = Strophe.getBareJidFromJid(JID);
const JULIET = 'juliet@capulet.lit';

describe('converse-cli drafts, in as_user mode', () => {
    let daemon;

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [{ jid: JULIET, name: 'Juliet Capulet' }],
            mode: 'as_user',
            owner: ME,
            policy: { allow: [JULIET] },
        });
        const { promise, resolve } = Promise.withResolvers();
        daemon.api.listen.once('message', resolve);
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${JULIET}/balcony" to="${JID}" type="chat" id="j1">
                <body>Noon or never?</body>
                <stanza-id xmlns="${Strophe.NS.SID}" id="sid-j1" by="${ME}"/>
            </message>`);
        await promise;
    });

    afterAll(() => daemon?.stop());

    it('drafts a restricted send, says it waits for approval, and exits with the draft code', async () => {
        const { code, stdout, stderr } = await run(
            daemon.env,
            'send',
            JULIET,
            '--reply-to',
            'sid-j1',
            'Noon.\nAt the orchard wall.',
        );
        expect({ code, stderr }).toEqual({ code: EXIT.DRAFT, stderr: '' });
        expect(stdout).toBe('Drafted as d1. Nothing was sent: it waits for the user to approve it.\n');
    });

    it('drafts a retraction too, with the draft code', async () => {
        const { message } = await (async () => {
            const client = await daemon.connect();
            try {
                return await client.request('messages.send', { to: JULIET, body: 'Oops' });
            } finally {
                client.close();
            }
        })();
        const { code, stdout } = await run(daemon.env, 'retract', message.id);
        expect(code).toBe(EXIT.DRAFT);
        expect(stdout).toBe('Drafted as d2. Nothing was sent: it waits for the user to approve it.\n');
    });

    it('lists the drafts at restricted access, noting what each acts on', async () => {
        const { code, stdout } = await run(daemon.env, 'drafts', 'list');
        expect(code).toBe(EXIT.OK);
        const lines = stdout.split('\n');
        expect(lines.pop()).toBe('');
        expect(lines).toEqual([
            expect.stringMatching(
                new RegExp(
                    `^d1 {2}\\S+ \\(just now\\) {2}to ${JULIET} {2}\\[replies to sid-j1\\] {2}` +
                        '"Noon\\.\\\\nAt the orchard wall\\."$',
                ),
            ),
            expect.stringMatching(/^d2 .* {2}\[retracts \S+\] {2}""$/),
        ]);
    });

    it('shows one draft in full, with the message it answers and its text over several lines', async () => {
        const { code, stdout } = await run(daemon.env, 'drafts', 'show', 'd1');
        expect(code).toBe(EXIT.OK);
        expect(stdout).toMatch(
            new RegExp(
                '^Draft d1, made by claude \\S+ \\(just now\\)\\n' +
                    `To: ${JULIET}\\n` +
                    `Replies to: sid-j1  \\S+ \\(just now\\)  ${JULIET}  "Noon or never\\?"\\n` +
                    'Text:\\n' +
                    'Noon\\.\\nAt the orchard wall\\.\\n$',
            ),
        );
    });

    it('prints the draft as JSON with --json', async () => {
        const { code, stdout } = await run(daemon.env, 'drafts', 'show', '--json', 'd1');
        expect(code).toBe(EXIT.OK);
        expect(JSON.parse(stdout)).toMatchObject({ id: 'd1', to: JULIET, reply_to: 'sid-j1' });
    });

    it('sends a draft from full access, and reports it as send does', async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'drafts', 'send', 'd1');
        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        expect(stdout).toMatch(new RegExp(`^Sent to ${JULIET} as \\S+\\n$`));
    });

    it('exits as not found for a draft that was sent', async () => {
        for (const command of ['show', 'send']) {
            const { code, stderr } = await run(daemon.env, 'drafts', command, 'd1');
            expect(code).toBe(EXIT.NOT_FOUND);
            expect(stderr).toContain('No draft with id "d1"');
        }
    });
});
