import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { converse } from '@converse/headless';
import { ERRORS } from '../protocol.js';
import { JID, startDaemon } from './harness.js';

const { stx, u } = converse.env;

const JULIET = 'juliet@capulet.lit';
const BENVOLIO = 'benvolio@montague.lit';

describe('A failed send', () => {
    let daemon, client, watcher;
    const events = [];

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [
                { jid: JULIET, name: 'Juliet Capulet' },
                { jid: BENVOLIO, name: 'Benvolio' },
            ],
        });
        client = await daemon.connect();
        watcher = await daemon.connect();
        watcher.onEvent((event) => events.push(event));
    });

    afterAll(async () => {
        watcher?.close();
        client?.close();
        await daemon?.stop();
    });

    /**
     * Delivers a message from `from`, and waits until the daemon has stored it.
     * @param {string} from
     * @param {string} body
     * @param {string} [stamp] - XEP-0203 delay, for a message that arrived earlier
     */
    async function receive(from, body, stamp) {
        const { promise, resolve } = Promise.withResolvers();
        daemon.api.listen.once('message', resolve);
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${from}/balcony" to="${JID}" type="chat" id="${u.getUniqueId()}">
                <body>${body}</body>
                ${stamp ? stx`<delay xmlns="urn:xmpp:delay" stamp="${stamp}"/>` : ''}
            </message>`);
        await promise;
    }

    /**
     * Sends a message whose encryption fails the way headless reports it, so the
     * message is stored as a failed send, and the send is refused.
     * @param {string} to
     * @param {string} body
     * @param {Object} [options]
     * @param {string} [options.code]
     * @param {boolean} [options.can_send_unencrypted] - Whether the failure was of encryption
     */
    async function failSend(to, body, { code = 'no-omemo-devices', can_send_unencrypted = false } = {}) {
        const chat = await daemon.api.chats.get(to, {}, true);
        const stanza = vi
            .spyOn(chat, 'createMessageStanza')
            .mockRejectedValue(Object.assign(new Error('Headless words'), { code, can_send_unencrypted }));
        try {
            const error = await client.request('messages.send', { to, body }).catch((e) => e);
            expect(error).toMatchObject({ code: ERRORS.INTERNAL_ERROR, data: { code } });
        } finally {
            stanza.mockRestore();
        }
    }

    it('is kept in the history, marked as failed with its code', async () => {
        await failSend(JULIET, 'Lost words');
        const { messages } = await client.request('messages.list', { conversation: JULIET, limit: 50 });
        expect(messages.at(-1)).toMatchObject({
            body: 'Lost words',
            direction: 'outgoing',
            status: 'failed',
            error_code: 'no-omemo-devices',
        });
    });

    it('is marked as sent when it went out, and as received when it came in', async () => {
        await receive(BENVOLIO, 'Shall we walk?', '2020-10-28T09:00:00Z');
        await client.request('messages.send', { to: BENVOLIO, body: 'Yes, let us.' });
        const { messages } = await client.request('messages.list', { conversation: BENVOLIO, limit: 50 });
        expect(messages.find((m) => m.body === 'Shall we walk?')).toMatchObject({
            status: 'received',
            error_code: null,
        });
        expect(messages.find((m) => m.body === 'Yes, let us.')).toMatchObject({ status: 'sent', error_code: null });
    });

    it('is left out of the inbox, the unread counts and the conversation activity', async () => {
        await client.request('inbox.read');
        await receive(BENVOLIO, 'Come to the orchard?');
        // The failed send comes after the message, so it would be the last activity if it counted.
        await new Promise((resolve) => setTimeout(resolve, 5));
        await failSend(BENVOLIO, 'A failed reply');

        const { messages } = await client.request('messages.list', { conversation: BENVOLIO, limit: 50 });
        const orchard = messages.find((m) => m.body === 'Come to the orchard?');
        const { conversations } = await client.request('conversations.list');
        const benvolio = conversations.find((c) => c.jid === BENVOLIO);
        expect(benvolio.unread).toBe(1);
        expect(benvolio.last_activity).toBe(orchard.time);

        const { conversations: unread } = await client.request('inbox.read');
        const bodies = unread.flatMap((c) => c.messages.map((m) => m.body));
        expect(bodies).toContain('Come to the orchard?');
        expect(bodies).not.toContain('A failed reply');
    });

    it('is not announced to a subscriber to outgoing messages', async () => {
        await watcher.request('events.subscribe', { direction: 'outgoing' });
        await failSend(JULIET, 'Never went out');
        await client.request('messages.send', { to: JULIET, body: 'It went out' });
        await u.waitUntil(() => events.some((e) => e.message?.body === 'It went out'));
        expect(events.map((e) => e.message?.body)).not.toContain('Never went out');
    });

    describe('sent again or discarded', () => {
        let full, restricted;

        beforeAll(async () => {
            full = await daemon.connect({ access: 'full' });
            restricted = await daemon.connect({ access: 'restricted' });
        });

        afterAll(() => {
            full?.close();
            restricted?.close();
        });

        /** @returns {Promise<import('../types').MessageDTO>} The failed send with this body */
        async function failedWith(body) {
            await failSend(JULIET, body);
            const { messages } = await client.request('messages.list', { conversation: JULIET, limit: 50 });
            return messages.findLast((m) => m.body === body);
        }

        it('is sent again by the owner, encrypted, once the send succeeds', async () => {
            const failed = await failedWith('Try me again');
            const { outcome, message } = await full.request('messages.resend', { id: failed.id });
            expect(outcome).toBe('sent');
            expect(message).toMatchObject({ id: failed.id, body: 'Try me again', status: 'sent', error_code: null });
            const { messages } = await client.request('messages.list', { conversation: JULIET, limit: 50 });
            expect(messages.findLast((m) => m.body === 'Try me again').status).toBe('sent');
        });

        it('stays failed, with the new reason, when sending it again fails too', async () => {
            const failed = await failedWith('Still no keys');
            const chat = await daemon.api.chats.get(JULIET, {}, true);
            const stanza = vi
                .spyOn(chat, 'createMessageStanza')
                .mockRejectedValue(Object.assign(new Error('Headless words'), { code: 'omemo-key-fetch-failed' }));
            try {
                await expect(full.request('messages.resend', { id: failed.id })).rejects.toMatchObject({
                    code: ERRORS.INTERNAL_ERROR,
                    message: "Nothing was sent: the recipient's encryption keys couldn't be fetched. Try again.",
                    data: { code: 'omemo-key-fetch-failed' },
                });
            } finally {
                stanza.mockRestore();
            }
            const { messages } = await client.request('messages.list', { conversation: JULIET, limit: 50 });
            expect(messages.find((m) => m.id === failed.id)).toMatchObject({
                status: 'failed',
                error_code: 'omemo-key-fetch-failed',
            });
        });

        it('is removed from the history by the owner, when discarded', async () => {
            const failed = await failedWith('Not wanted');
            const { message } = await full.request('messages.discard', { id: failed.id });
            expect(message).toMatchObject({ id: failed.id, body: 'Not wanted', status: 'failed' });
            const { messages } = await client.request('messages.list', { conversation: JULIET, limit: 50 });
            expect(messages.map((m) => m.id)).not.toContain(failed.id);
        });

        it('finds no failed send to resend or discard in a message that is not one', async () => {
            const { messages } = await client.request('messages.list', { conversation: BENVOLIO, limit: 50 });
            const sent = messages.find((m) => m.status === 'sent');
            await expect(full.request('messages.resend', { id: sent.id })).rejects.toMatchObject({
                code: ERRORS.NOT_FOUND,
                message:
                    `Message "${sent.id}" isn't a failed send, so it can't be sent again. "converse-cli read" ` +
                    'marks a failed send with [send failed: <reason>].',
            });
            await expect(full.request('messages.discard', { id: sent.id })).rejects.toMatchObject({
                code: ERRORS.NOT_FOUND,
            });
        });

        it('refuses an unencrypted resend while the config does not allow it, and leaves the send failed', async () => {
            const failed = await failedWith('Not in the clear');
            await expect(full.request('messages.resend', { id: failed.id, unencrypted: true })).rejects.toMatchObject({
                code: ERRORS.ACCESS_DENIED,
            });
            const { messages } = await client.request('messages.list', { conversation: JULIET, limit: 50 });
            expect(messages.find((m) => m.id === failed.id).status).toBe('failed');
        });

        it('is refused to a restricted connection, so that an agent cannot send a failed send again', async () => {
            const failed = await failedWith('Agents keep out');
            await expect(restricted.request('messages.resend', { id: failed.id })).rejects.toMatchObject({
                code: ERRORS.ACCESS_DENIED,
            });
            await expect(restricted.request('messages.discard', { id: failed.id })).rejects.toMatchObject({
                code: ERRORS.ACCESS_DENIED,
            });
        });
    });
});

describe('A failed send, sent in the clear by the owner', () => {
    let daemon, client, full, restricted;

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [{ jid: JULIET, name: 'Juliet Capulet' }],
            allow_unencrypted_resend: true,
        });
        client = await daemon.connect();
        full = await daemon.connect({ access: 'full' });
        restricted = await daemon.connect({ access: 'restricted' });
    });

    afterAll(async () => {
        full?.close();
        restricted?.close();
        client?.close();
        await daemon?.stop();
    });

    /**
     * Sends a message that headless refuses because its encryption failed, so
     * that it is stored as a failed send which may be sent in the clear.
     * @param {string} body
     * @returns {Promise<import('../types').MessageDTO>}
     */
    async function refused(body) {
        const chat = await daemon.api.chats.get(JULIET, {}, true);
        const stanza = vi.spyOn(chat, 'createMessageStanza').mockRejectedValue(
            Object.assign(new Error('Headless words'), {
                code: 'no-omemo-devices',
                can_send_unencrypted: true,
            }),
        );
        try {
            await client.request('messages.send', { to: JULIET, body }).catch(() => {});
        } finally {
            stanza.mockRestore();
        }
        const { messages } = await client.request('messages.list', { conversation: JULIET, limit: 50 });
        return messages.findLast((m) => m.body === body);
    }

    it('goes out with no encryption, when the owner asks for it', async () => {
        const failed = await refused('Plain words');
        const before = daemon.connection.sent_stanzas.length;
        const { outcome, message } = await full.request('messages.resend', { id: failed.id, unencrypted: true });

        expect(outcome).toBe('sent');
        expect(message).toMatchObject({ body: 'Plain words', status: 'sent', encryption: null });
        const [stanza] = daemon.connection.sent_stanzas.slice(before).filter((s) => s.nodeName === 'message');
        expect(stanza.querySelector('body').textContent).toBe('Plain words');
        expect(stanza.querySelector('encrypted')).toBeNull();
    });

    it('refuses a failed send that was not refused for encryption, even when the config allows it', async () => {
        const chat = await daemon.api.chats.get(JULIET, {}, true);
        const stanza = vi
            .spyOn(chat, 'createMessageStanza')
            .mockRejectedValue(Object.assign(new Error('Headless words'), { code: 'omemo-encrypt-failed' }));
        try {
            await client.request('messages.send', { to: JULIET, body: 'Not that kind' }).catch(() => {});
        } finally {
            stanza.mockRestore();
        }
        const { messages } = await client.request('messages.list', { conversation: JULIET, limit: 50 });
        const failed = messages.findLast((m) => m.body === 'Not that kind');
        await expect(full.request('messages.resend', { id: failed.id, unencrypted: true })).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
            message: "This failed send wasn't refused for encryption, so it can only be sent encrypted.",
        });
    });

    it('refuses a restricted connection, which cannot send a failed send in the clear whatever the config says', async () => {
        const failed = await refused('Agents stay encrypted');
        await expect(restricted.request('messages.resend', { id: failed.id, unencrypted: true })).rejects.toMatchObject(
            {
                code: ERRORS.ACCESS_DENIED,
            },
        );
        const { messages } = await client.request('messages.list', { conversation: JULIET, limit: 50 });
        expect(messages.find((m) => m.id === failed.id).status).toBe('failed');
    });

    it('refuses an "unencrypted" that is not true or false', async () => {
        const failed = await refused('Odd flag');
        await expect(full.request('messages.resend', { id: failed.id, unencrypted: 'yes' })).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
            message: '"unencrypted" must be true or false.',
        });
    });
});
