/**
 * Runs the CLI against a daemon in this process, so that the specs can put
 * messages in it. What the commands do is covered at the protocol seam; this
 * pins argument parsing, the text output and the exit codes.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { converse } from '@converse/headless';
import { JID, startDaemon } from '../../daemon/tests/harness.js';
import { EXIT } from '../exit-codes.js';
import { run, runWithInput } from './run.js';

const { Strophe, stx } = converse.env;

const JULIET = 'juliet@capulet.lit';

describe('converse-cli read and send', () => {
    let daemon;

    /**
     * @param {string} id - Also used as the stanza-id our server assigned
     * @param {string} body
     * @param {string} stamp
     */
    async function receive(id, body, stamp) {
        const { promise, resolve } = Promise.withResolvers();
        daemon.api.listen.once('message', resolve);
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${JULIET}/balcony" to="${JID}" type="chat" id="${id}">
                <body>${body}</body>
                <stanza-id xmlns="${Strophe.NS.SID}" id="${id}" by="romeo@montague.lit"/>
                <delay xmlns="urn:xmpp:delay" stamp="${stamp}"/>
            </message>`);
        await promise;
    }

    beforeAll(async () => {
        daemon = await startDaemon({ roster: [{ jid: JULIET, name: 'Juliet Capulet' }] });
        await receive('a1b2c3d4e5f6', 'Wherefore art thou?', '2026-10-20T10:00:00.123Z');
        await receive('a1b2ffff0000', 'Line one\nLine two "quoted"', '2026-10-21T10:00:00Z');
        await receive('b0b0b0b0b0b0', 'x'.repeat(300), '2026-10-22T10:00:00Z');
    });

    afterAll(() => daemon?.stop());

    it('prints one line per message: short id, time and age, sender and the body as a JSON string', async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'read', JULIET, '--limit', '2');
        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        const lines = stdout.split('\n');
        expect(lines.pop()).toBe('');
        expect(lines).toHaveLength(2);
        expect(lines[0]).toMatch(/^a1b2ffff {2}2026-10-21T10:00:00Z \(\d+d ago\) {2}juliet@capulet\.lit {2}/);
        expect(lines[0]).toMatch(/ {2}"Line one\\nLine two \\"quoted\\""$/);
        expect(lines[1]).toMatch(
            new RegExp(`^b0b0b0b0 .* {2}"${'x'.repeat(280)}" \\[\\+20 chars, --full to show\\]$`),
        );
    });

    it('shows long bodies whole with --full', async () => {
        const { stdout } = await run(daemon.env, 'read', JULIET, '--limit', '1', '--full');
        expect(stdout).toMatch(new RegExp(`  "${'x'.repeat(300)}"\\n$`));
    });

    it('prints DTOs as JSON lines with --json', async () => {
        const { stdout } = await run(daemon.env, 'read', JULIET, '--json', '--before', 'a1b2f');
        expect(stdout.trim().split('\n').map((l) => JSON.parse(l))).toEqual([
            {
                id: 'a1b2c3d4e5f6',
                conversation: JULIET,
                from: JULIET,
                direction: 'incoming',
                time: '2026-10-20T10:00:00.123Z',
                body: 'Wherefore art thou?',
            },
        ]);
    });

    it('accepts --since as a duration or an ISO time', async () => {
        let { stdout } = await run(daemon.env, 'read', JULIET, '--since', '2026-10-21T00:00:00Z');
        expect(stdout.split('\n').filter(Boolean).map((l) => l.slice(0, 8))).toEqual(['a1b2ffff', 'b0b0b0b0']);

        ({ stdout } = await run(daemon.env, 'read', JULIET, '--since', '100000d'));
        expect(stdout.split('\n').filter(Boolean)).toHaveLength(3);

        const result = await run(daemon.env, 'read', JULIET, '--since', 'last tuesday');
        expect(result.code).toBe(EXIT.ERROR);
        expect(result.stderr).toContain('nor a duration (30m, 2h, 7d)');
    });

    it('says when there are no messages, on stderr', async () => {
        const result = await run(daemon.env, 'read', JULIET, '--since', '1s');
        expect(result).toEqual({ code: EXIT.OK, stdout: '', stderr: 'No messages.\n' });
    });

    it('exits with "not found" for an unknown conversation or message', async () => {
        let result = await run(daemon.env, 'read', 'tybalt@capulet.lit');
        expect(result.code).toBe(EXIT.NOT_FOUND);
        expect(result.stderr).toContain('send them a message to start a conversation');

        result = await run(daemon.env, 'read', JULIET, '--before', 'zzz');
        expect(result.code).toBe(EXIT.NOT_FOUND);
    });

    it('exits with "ambiguous" and lists the candidates for an id prefix matching several', async () => {
        const result = await run(daemon.env, 'read', JULIET, '--before', 'a1b2');
        expect(result).toEqual({
            code: EXIT.AMBIGUOUS,
            stdout: '',
            stderr:
                'converse-cli: More than one message has an id starting with "a1b2".\n' +
                '  a1b2c3d4e5f6\n' +
                '  a1b2ffff0000\n',
        });
    });

    it('rejects bad usage, pointing at the help', async () => {
        let result = await run(daemon.env, 'read');
        expect(result).toMatchObject({ code: EXIT.ERROR, stderr: expect.stringContaining('Expected exactly one JID') });
        result = await run(daemon.env, 'read', JULIET, '--limit', 'lots');
        expect(result.code).toBe(EXIT.ERROR);
        expect(result.stderr).toContain('Run "converse-cli --help" for usage.');
    });

    it('sends a message and prints the id it was sent as', async () => {
        const { code, stdout } = await run(daemon.env, 'send', JULIET, 'But', 'soft!');
        expect(code).toBe(EXIT.OK);
        const [, id] = stdout.match(/^Sent to juliet@capulet\.lit as (\S+)\n$/);
        const stanza = daemon.connection.sent_stanzas.filter((s) => s.nodeName === 'message').at(-1);
        expect(stanza.querySelector('body').textContent).toBe('But soft!');
        expect(stanza.querySelector('origin-id').getAttribute('id')).toBe(id);
    });

    it('sends the text on stdin when given none', async () => {
        const { code } = await runWithInput(daemon.env, 'Two\nlines\n', 'send', JULIET);
        expect(code).toBe(EXIT.OK);
        const stanza = daemon.connection.sent_stanzas.filter((s) => s.nodeName === 'message').at(-1);
        expect(stanza.querySelector('body').textContent).toBe('Two\nlines');
    });

    it('sends text that starts with a dash when it follows "--"', async () => {
        const { code } = await run(daemon.env, 'send', JULIET, '--', '-1 for yes');
        expect(code).toBe(EXIT.OK);
        const stanza = daemon.connection.sent_stanzas.filter((s) => s.nodeName === 'message').at(-1);
        expect(stanza.querySelector('body').textContent).toBe('-1 for yes');
    });

    it('refuses to send nothing', async () => {
        const result = await run(daemon.env, 'send', JULIET);
        expect(result.code).toBe(EXIT.ERROR);
        expect(result.stderr).toBe('converse-cli: There is nothing to send: "body" is empty.\n');
    });
});
