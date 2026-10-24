import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { converse } from '@converse/headless';
import { JID, startDaemon } from '../../daemon/tests/harness.js';
import { EXIT } from '../exit-codes.js';
import { run } from './run.js';

const { stx, u } = converse.env;

const JULIET = 'juliet@capulet.lit';

describe('converse-cli conversations and inbox', () => {
    let daemon;

    beforeAll(async () => {
        daemon = await startDaemon({ roster: [{ jid: JULIET, name: 'Juliet Capulet' }] });
    });

    afterAll(() => daemon?.stop());

    /**
     * Delivers a message from Juliet, and waits until the daemon has stored it.
     * @param {string} body
     */
    async function receive(body) {
        const { promise, resolve } = Promise.withResolvers();
        daemon.api.listen.once('message', resolve);
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${JULIET}/balcony" to="${JID}" type="chat" id="${u.getUniqueId()}">
                <body>${body}</body>
            </message>`);
        await promise;
    }

    it('says there is nothing new, and sets the consumer up on its first look', async () => {
        expect(await run(daemon.env, 'inbox')).toEqual({
            code: EXIT.OK,
            stdout: '',
            stderr: 'No new messages.\n',
        });
        expect(await run(daemon.env, 'conversations')).toEqual({
            code: EXIT.OK,
            stdout: '',
            stderr: 'No conversations.\n',
        });
    });

    it('lists conversations with what is unread, then shows and marks the messages read', async () => {
        await receive('Who goes there?');

        const listed = await run(daemon.env, 'conversations');
        expect(listed.code).toBe(EXIT.OK);
        expect(listed.stdout).toMatch(/^juliet@capulet\.lit {2}"Juliet Capulet" {2}unread 1 {2}last active /);

        const inbox = await run(daemon.env, 'inbox');
        expect(inbox.code).toBe(EXIT.OK);
        const [header, message] = inbox.stdout.split('\n');
        expect(header).toBe('== juliet@capulet.lit (1 new)');
        expect(message).toMatch(/^\S+ {2}\S+ \(just now\) {2}juliet@capulet\.lit {2}"Who goes there\?"$/);

        expect((await run(daemon.env, 'inbox')).stderr).toBe('No new messages.\n');
        expect((await run(daemon.env, 'conversations')).stdout).toMatch(/unread 0 /);
    });

    it('prints the inbox as JSON, one object per conversation, with --json', async () => {
        await receive('Speak, friend');

        const { code, stdout } = await run(daemon.env, 'inbox', '--json');
        expect(code).toBe(EXIT.OK);
        const lines = stdout
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line));
        expect(lines).toEqual([
            {
                conversation: { jid: JULIET, type: 'chat', name: 'Juliet Capulet' },
                messages: [expect.objectContaining({ conversation: JULIET, body: 'Speak, friend' })],
            },
        ]);
    });
});
