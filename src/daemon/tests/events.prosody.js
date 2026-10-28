/**
 * Event subscriptions between daemons on a real Prosody: a message that
 * another account's daemon sends has to reach a subscriber here, through the
 * server, as it would for a `wait`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { run } from '../../cli/tests/run.js';
import { EXIT } from '../../cli/exit-codes.js';
import { registerAccount, startDaemon } from './real-server.js';

describe('Event subscriptions on a real Prosody', () => {
    const daemons = [];
    let romeo, juliet;

    beforeAll(async () => {
        [romeo, juliet] = await Promise.all([
            registerAccount('romeo').then(startDaemon),
            registerAccount('juliet').then(startDaemon),
        ]);
        daemons.push(romeo, juliet);
    });

    afterAll(() => Promise.all(daemons.map((d) => d.stop())));

    it('delivers a message from another daemon to a subscriber waiting for it', async () => {
        const body = `Wherefore art thou ${Date.now()}?`;
        const delivered = Promise.withResolvers();
        juliet.onEvent((event) => {
            if (event.message.body === body) delivered.resolve(event);
        });
        // The subscription is in place before the send, so the server's reply
        // can't beat it.
        const { subscription } = await juliet.request('events.subscribe', { from: romeo.jid, once: true });

        await romeo.request('messages.send', { to: juliet.jid, body });
        const event = await delivered.promise;

        expect(event).toEqual({
            subscription,
            type: 'message',
            message: {
                id: expect.any(String),
                conversation: romeo.jid,
                from: romeo.jid,
                nick: null,
                direction: 'incoming',
                time: expect.any(String),
                body,
                encryption: null,
                reply_to: null,
                edited: null,
                retracted: null,
                reactions: {},
                status: 'received',
                error_code: null,
            },
        });
    });

    it('makes `wait` on one daemon return the message another daemon sends', async () => {
        const waiting = run(juliet.env, 'wait', '--from', romeo.jid, '--timeout', '30', '--json');
        const exited = waiting.then(() => true);
        const pause = () => new Promise((resolve) => setTimeout(resolve, 300));

        // `wait` only sees messages that arrive after it subscribes, and it
        // takes a moment to connect, so keep sending until it has exited.
        for (let n = 0; !(await Promise.race([exited, pause()])); n++) {
            await romeo.request('messages.send', { to: juliet.jid, body: `Ping ${n}` });
        }

        const { code, stdout, stderr } = await waiting;
        expect(stderr).toBe('');
        expect(code).toBe(EXIT.OK);
        expect(JSON.parse(stdout)).toMatchObject({
            conversation: romeo.jid,
            from: romeo.jid,
            direction: 'incoming',
            body: expect.stringMatching(/^Ping \d+$/),
        });
    });
});
