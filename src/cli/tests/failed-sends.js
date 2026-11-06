/**
 * Sending a failed send again, or discarding it, from the command line. What
 * the daemon does with each is covered at the protocol seam; this pins the
 * commands, their output and exit codes, and that they need full access.
 */
import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../daemon/config.js';
import { startDaemon } from '../../daemon/tests/harness.js';
import { EXIT } from '../exit-codes.js';
import { run } from './run.js';

const JULIET = 'juliet@capulet.lit';
const BENVOLIO = 'benvolio@montague.lit';

describe('converse-cli resend and discard', () => {
    let daemon, client;

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [
                { jid: JULIET, name: 'Juliet Capulet' },
                { jid: BENVOLIO, name: 'Benvolio' },
            ],
        });
        client = await daemon.connect({ access: 'full' });
    });

    afterAll(async () => {
        client?.close();
        await daemon?.stop();
    });

    /**
     * Sends a message whose encryption fails, so that it's kept as a failed send.
     * @param {string} body
     * @returns {Promise<string>} Its id
     */
    async function failSend(body) {
        const chat = await daemon.api.chats.get(JULIET, {}, true);
        const stanza = vi
            .spyOn(chat, 'createMessageStanza')
            .mockRejectedValue(Object.assign(new Error('Headless words'), { code: 'no-omemo-devices' }));
        try {
            await client.request('messages.send', { to: JULIET, body }).catch(() => {});
        } finally {
            stanza.mockRestore();
        }
        const { messages } = await client.request('messages.list', { conversation: JULIET, limit: 50 });
        return messages.findLast((m) => m.body === body).id;
    }

    /** The last message stanza the daemon sent. */
    const lastSent = () => daemon.connection.sent_stanzas.filter((s) => s.nodeName === 'message').at(-1);

    it('sends a failed send again, and reports it as send does', async () => {
        const id = await failSend('Try me again');
        const { code, stdout, stderr } = await run(daemon.env, 'resend', id);
        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        expect(stdout).toBe(`Sent to ${JULIET} as ${id}\n`);
        expect(lastSent().querySelector('body').textContent).toBe('Try me again');
    });

    it('prints the outcome as JSON with --json', async () => {
        const id = await failSend('In JSON');
        const { code, stdout } = await run(daemon.env, 'resend', id, '--json');
        expect(code).toBe(EXIT.OK);
        expect(JSON.parse(stdout)).toMatchObject({ outcome: 'sent', message: { id, status: 'sent' } });
    });

    it('shows the refusal of --unencrypted as the daemon gives it, naming the setting', async () => {
        const id = await failSend('Not in the clear');
        const { code, stdout, stderr } = await run(daemon.env, 'resend', id, '--unencrypted');
        expect({ code, stdout }).toEqual({ code: EXIT.ERROR, stdout: '' });
        expect(stderr).toContain('set "allow_unencrypted_resend" to true in the daemon config');
    });

    it('discards a failed send, which read then no longer shows', async () => {
        const id = await failSend('Not wanted');
        const { code, stdout } = await run(daemon.env, 'discard', id);
        expect(code).toBe(EXIT.OK);
        expect(stdout).toBe(`Discarded ${id} from ${JULIET}. It was never sent.\n`);
        expect((await run(daemon.env, 'read', JULIET, '--limit', '50')).stdout).not.toContain(id);
    });

    it('looks only in the conversation given with --conversation', async () => {
        const id = await failSend('Only for Juliet');
        const elsewhere = await run(daemon.env, 'discard', id, '--conversation', 'Benvolio');
        expect(elsewhere.code).toBe(EXIT.NOT_FOUND);
        const { code } = await run(daemon.env, 'discard', id, '--conversation', 'Juliet Capulet');
        expect(code).toBe(EXIT.OK);
    });

    it('exits as not found for a message that is not a failed send, and says so', async () => {
        const { code, stdout } = await run(daemon.env, 'resend', await failSend('Sent in the end'));
        expect(code).toBe(EXIT.OK);
        const id = stdout.match(/ as (\S+)\n$/)[1];
        for (const command of ['resend', 'discard']) {
            const { code, stderr } = await run(daemon.env, command, id);
            expect(code).toBe(EXIT.NOT_FOUND);
            expect(stderr).toContain(`Message "${id}" isn't a failed send`);
        }
    });

    it('fails clearly for a client that can only reach the restricted socket', async () => {
        const id = await failSend('Out of reach');
        const { socket } = loadConfig(daemon.env).paths;
        // As in a sandbox where only the restricted socket is mounted.
        fs.renameSync(socket, `${socket}.hidden`);
        try {
            for (const command of ['resend', 'discard']) {
                const { code, stdout, stderr } = await run(daemon.env, command, id);
                expect({ code, stdout }).toEqual({ code: EXIT.ERROR, stdout: '' });
                expect(stderr).toContain(
                    'This needs full access, and this client can only reach the restricted socket.',
                );
            }
        } finally {
            fs.renameSync(`${socket}.hidden`, socket);
        }
        const { messages } = await client.request('messages.list', { conversation: JULIET, limit: 50 });
        expect(messages.find((m) => m.id === id).status).toBe('failed');
    });

    it('lists both in the overview, and documents each', async () => {
        const { stdout } = await run(daemon.env, '--help');
        expect(stdout).toMatch(/\n {2}resend <id> +Send a failed send again \(full access\)\n/);
        expect(stdout).toMatch(/\n {2}discard <id> +Remove a failed send from the history \(full access\)\n/);

        const help = (await run(daemon.env, 'help', 'resend')).stdout;
        expect(help).toContain('Usage: converse-cli resend <id> [options]');
        expect(help).toContain('--unencrypted');
        expect(help).toContain('--conversation <contact|room>');
        expect(help).toMatch(/Exit codes:\n(.*\n)*\s+3\s+no such account, contact, conversation or message\n/);
    });
});
