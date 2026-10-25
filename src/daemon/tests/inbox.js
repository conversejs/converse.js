import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { converse } from '@converse/headless';
import { JID, startDaemon } from './harness.js';

const { stx, u } = converse.env;

const JULIET = 'juliet@capulet.lit';
const MERCUTIO = 'mercutio@montague.lit';

/**
 * Read cursors, from the point of view of two consumers reading the same
 * account. The scenario runs in order: each step builds on the last.
 */
describe('Inbox and conversations', () => {
    let daemon, claude, other;

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [
                { jid: JULIET, name: 'Juliet Capulet' },
                { jid: MERCUTIO, name: 'Mercutio' },
            ],
        });
        claude = await daemon.connect({ consumer: 'claude' });
        other = await daemon.connect({ consumer: 'other' });
    });

    afterAll(async () => {
        claude?.close();
        other?.close();
        await daemon?.stop();
    });

    /**
     * Delivers a message from `from`, and waits until the daemon has stored it.
     * @param {string} from
     * @param {string} body
     */
    async function receive(from, body) {
        const { promise, resolve } = Promise.withResolvers();
        daemon.api.listen.once('message', resolve);
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${from}/balcony" to="${JID}" type="chat" id="${u.getUniqueId()}">
                <body>${body}</body>
            </message>`);
        await promise;
    }

    const bodies = (group) => group.messages.map((m) => m.body);

    it('starts a consumer from the moment it first looks, so earlier messages are not unread', async () => {
        expect(await claude.request('conversations.list')).toEqual({ conversations: [] });
        expect(await other.request('inbox.read')).toEqual({ conversations: [] });
    });

    it('counts unread messages per conversation for each consumer, most recent first', async () => {
        await receive(JULIET, 'one');
        await receive(MERCUTIO, 'two');
        await receive(JULIET, 'three');

        const { conversations } = await claude.request('conversations.list');
        expect(conversations).toEqual([
            {
                jid: JULIET,
                type: 'chat',
                name: 'Juliet Capulet',
                unread: 2,
                last_activity: expect.any(String),
            },
            { jid: MERCUTIO, type: 'chat', name: 'Mercutio', unread: 1, last_activity: expect.any(String) },
        ]);
    });

    it('returns unread messages grouped by conversation, oldest first, then marks them read for that consumer', async () => {
        const { conversations } = await claude.request('inbox.read');
        expect(conversations.map((g) => [g.conversation.jid, bodies(g)])).toEqual([
            [JULIET, ['one', 'three']],
            [MERCUTIO, ['two']],
        ]);
        expect(conversations[0].messages[0]).toEqual({
            id: expect.any(String),
            conversation: JULIET,
            from: JULIET,
            nick: null,
            direction: 'incoming',
            time: expect.any(String),
            body: 'one',
        });

        expect(await claude.request('inbox.read')).toEqual({ conversations: [] });
        const { conversations: summaries } = await claude.request('conversations.list');
        expect(summaries.map((c) => c.unread)).toEqual([0, 0]);
    });

    it("keeps a second consumer's cursors separate from the first's", async () => {
        const { conversations } = await other.request('inbox.read');
        expect(conversations.map((g) => [g.conversation.jid, bodies(g)])).toEqual([
            [JULIET, ['one', 'three']],
            [MERCUTIO, ['two']],
        ]);
        expect(await other.request('inbox.read')).toEqual({ conversations: [] });
    });

    it("leaves the user's own unread count alone", async () => {
        await receive(JULIET, 'four');
        const chat = await daemon.api.chats.get(JULIET);
        const before = chat.get('num_unread');
        expect(before).toBeGreaterThan(0);

        await claude.request('inbox.read');
        expect(chat.get('num_unread')).toBe(before);
    });

    it('passes over messages sent from this account, without showing them', async () => {
        await claude.request('inbox.read');
        await claude.request('messages.send', { to: JULIET, body: 'Reply' });
        await receive(JULIET, 'five');

        const { conversations } = await claude.request('inbox.read');
        expect(conversations.map((g) => bodies(g))).toEqual([['five']]);
    });

    it('does not show a message sent after the last read as unread', async () => {
        await claude.request('messages.send', { to: JULIET, body: 'Last word' });
        expect(await claude.request('inbox.read')).toEqual({ conversations: [] });

        const { conversations } = await claude.request('conversations.list');
        expect(conversations[0]).toMatchObject({ jid: JULIET, unread: 0 });
    });
});
