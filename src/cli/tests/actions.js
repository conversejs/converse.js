/**
 * The commands that act on a message already in a conversation, run at full
 * access, which sends them rather than drafting them. What they do is covered
 * at the protocol seam; this pins their arguments, text output and exit codes.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { converse } from '@converse/headless';
import { JID, startDaemon } from '../../daemon/tests/harness.js';
import { EXIT } from '../exit-codes.js';
import { run } from './run.js';

const { Strophe, stx } = converse.env;

const JULIET = 'juliet@capulet.lit';

describe('converse-cli acting on messages', () => {
    let daemon;

    /** The last message stanza the daemon sent. */
    const lastSent = () => daemon.connection.sent_stanzas.filter((s) => s.nodeName === 'message').at(-1);

    /**
     * Sends at full access, and returns the id it printed.
     * @param {...string} args - After "send"
     */
    async function send(...args) {
        const { code, stdout } = await run(daemon.env, 'send', ...args);
        expect(code).toBe(EXIT.OK);
        return stdout.match(/^Sent to \S+ as (\S+)\n$/)[1];
    }

    /** The last line read prints for Juliet. */
    async function lastLine() {
        const { stdout } = await run(daemon.env, 'read', JULIET, '--limit', '1');
        return stdout;
    }

    beforeAll(async () => {
        daemon = await startDaemon({ roster: [{ jid: JULIET, name: 'Juliet Capulet' }], access: 'full' });
        const { promise, resolve } = Promise.withResolvers();
        daemon.api.listen.once('message', resolve);
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${JULIET}/balcony" to="${JID}" type="chat" id="j1">
                <body>Wherefore art thou?</body>
                <stanza-id xmlns="${Strophe.NS.SID}" id="e5e5e5e5e5e5" by="romeo@montague.lit"/>
            </message>`);
        await promise;
    });

    afterAll(() => daemon?.stop());

    it('corrects a message with --correct, and read notes that it was edited', async () => {
        const id = await send(JULIET, 'Hree');
        await send(JULIET, 'Here', '--correct', id.slice(0, 8));

        expect(lastSent().querySelector('replace').getAttribute('id')).toBe(id);
        expect(await lastLine()).toMatch(/ {2}romeo@montague\.lit {2}\[edited\] {2}"Here"\n$/);
    });

    it('replies with --reply-to, which goes out at full access', async () => {
        await send(JULIET, 'Here', '--reply-to', 'e5e5');
        expect(lastSent().querySelector('reply').getAttribute('id')).toBe('j1');
        expect(await lastLine()).toMatch(/ {2}\[reply to e5e5e5e5\] {2}"Here"\n$/);
    });

    it('retracts a message by its short id, and read notes that it was retracted', async () => {
        const id = await send(JULIET, 'Never mind');
        const { code, stdout } = await run(daemon.env, 'retract', id.slice(0, 8), '--conversation', JULIET);

        expect({ code, stdout }).toEqual({ code: EXIT.OK, stdout: `Retracted ${id} in ${JULIET}.\n` });
        expect(lastSent().querySelector('retract').getAttribute('id')).toBe(id);
        expect(await lastLine()).toMatch(/ {2}romeo@montague\.lit {2}\[retracted\] {2}""\n$/);

        const result = await run(daemon.env, 'retract', 'zzz');
        expect(result.code).toBe(EXIT.NOT_FOUND);
        expect(result.stderr).toBe('converse-cli: No message with id "zzz" in any conversation.\n');
    });

    it('reacts to a message, and read shows how many reacted with each emoji', async () => {
        let result = await run(daemon.env, 'react', 'e5e5', ':thumbsup:');
        expect(result).toEqual({
            code: EXIT.OK,
            stdout: `Reacted to e5e5e5e5e5e5 in ${JULIET}.\n`,
            stderr: '',
        });
        expect(lastSent().querySelector('reactions').getAttribute('id')).toBe('j1');

        const { stdout } = await run(daemon.env, 'read', JULIET);
        expect(stdout.split('\n')[0]).toMatch(/^e5e5e5e5 .* {2}\[reactions: 👍 1\] {2}"Wherefore art thou\?"$/);

        result = await run(daemon.env, 'react', 'e5e5', '👍', '--remove');
        expect(result.stdout).toBe(`Withdrew that reaction to e5e5e5e5e5e5 in ${JULIET}.\n`);
        expect(lastSent().querySelectorAll('reaction').length).toBe(0);

        result = await run(daemon.env, 'react', 'e5e5');
        expect(result.code).toBe(EXIT.ERROR);
        expect(result.stderr).toContain('Expected a message id and an emoji.');
    });

    it("exits with an error for a correction of someone else's message", async () => {
        const result = await run(daemon.env, 'send', JULIET, 'x', '--correct', 'e5e5');
        expect(result).toEqual({
            code: EXIT.ERROR,
            stdout: '',
            stderr: 'converse-cli: Message "e5e5" was sent by someone else, and only our own messages can be corrected.\n',
        });
    });
});
