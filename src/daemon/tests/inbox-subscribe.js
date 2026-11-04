import net from 'node:net';
import readline from 'node:readline';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { converse, log } from '@converse/headless';
import { ERRORS } from '../protocol.js';
import { JID, startDaemon } from './harness.js';

const { stx, u } = converse.env;

const JULIET = 'juliet@capulet.lit';
const MERCUTIO = 'mercutio@montague.lit';

/**
 * Connects as `consumer`, and records each line the daemon sends, in the
 * order it sent them, and the bodies of the message events among them.
 * @param {Awaited<ReturnType<typeof startDaemon>>} daemon
 * @param {string} consumer
 */
async function openClient(daemon, consumer) {
    const client = await daemon.connect({ consumer });
    /** @type {Object[]} */
    const lines = [];
    readline.createInterface({ input: client.socket }).on('line', (line) => lines.push(JSON.parse(line)));
    const events = () => lines.filter((l) => l.method === 'event').map((l) => l.params);
    return {
        client,
        lines,
        /** The bodies of the message events so far. */
        bodies: () => events().map((e) => e.message.body),
        events,
    };
}

/**
 * Lets the daemon send what it has to: a message's events are sent as it's
 * stored, and those held back during a catch-up, once the answer is out.
 */
const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

/** @param {import('../types').InboxGroup[]} conversations */
const bodiesOf = (conversations) => conversations.map((g) => g.messages.map((m) => m.body));

describe('inbox.subscribe', () => {
    let daemon;
    /** @type {Awaited<ReturnType<typeof openClient>>[]} */
    const opened = [];

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [
                { jid: JULIET, name: 'Juliet Capulet' },
                { jid: MERCUTIO, name: 'Mercutio' },
            ],
        });
    });

    afterEach(() => vi.restoreAllMocks());

    afterAll(async () => {
        opened.forEach(({ client }) => client.close());
        await daemon?.stop();
    });

    /** @param {string} consumer */
    async function open(consumer) {
        const c = await openClient(daemon, consumer);
        opened.push(c);
        return c;
    }

    /**
     * Delivers a message, and waits until the daemon has stored it.
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

    /**
     * How often a conversation's messages are filtered as one arrives in it. Adding a
     * message sorts them into a new array, so that's spied on through Array.
     * @param {string} from
     * @param {string} body
     */
    async function scansFor(from, body) {
        const { messages } = await daemon.api.chats.get(from);
        const filter = vi.spyOn(Array.prototype, 'filter');
        try {
            await receive(from, body);
            return filter.mock.contexts.filter((array) => array === messages.models).length;
        } finally {
            filter.mockRestore();
        }
    }

    it('answers with the unseen messages, then sends each new one, marking all of them seen', async () => {
        const { client, bodies, events } = await open('first');
        expect(await client.request('inbox.read')).toEqual({ conversations: [] });
        await receive(JULIET, 'Before');

        const answer = await client.request('inbox.subscribe');
        expect(answer).toEqual({ subscription: expect.any(Number), conversations: [expect.any(Object)] });
        expect(bodiesOf(answer.conversations)).toEqual([['Before']]);

        await receive(MERCUTIO, 'Live');
        await flush();
        expect(bodies()).toEqual(['Live']);
        expect(events()[0]).toEqual({
            subscription: answer.subscription,
            type: 'message',
            message: expect.objectContaining({ conversation: MERCUTIO, from: MERCUTIO, body: 'Live' }),
        });
        // Both were given, so neither is unseen any more.
        expect(await client.request('inbox.read')).toEqual({ conversations: [] });
    });

    it('sends a message that arrives during the catch-up once, after the answer', async () => {
        const { client, lines, bodies } = await open('during');
        await client.request('inbox.read');
        await receive(JULIET, 'Waiting');

        // Holds the catch-up after it has gathered the conversations' messages, as a slow roster lookup would.
        const { promise: lookup, resolve: release } = Promise.withResolvers();
        const original = daemon.api.contacts.get.bind(daemon.api.contacts);
        vi.spyOn(daemon.api.contacts, 'get').mockImplementation(async (...args) => {
            await lookup;
            return original(...args);
        });
        const answering = client.request('inbox.subscribe');
        await u.waitUntil(() => vi.mocked(daemon.api.contacts.get).mock.calls.length > 0);
        await receive(JULIET, 'Meanwhile');
        await receive(MERCUTIO, 'Also meanwhile');
        release();

        const { conversations } = await answering;
        await flush();
        // Juliet's messages were gathered before hers arrived. Mercutio's may be gathered after his.
        expect(bodies()[0]).toBe('Meanwhile');
        expect([...bodiesOf(conversations).flat(), ...bodies()].sort()).toEqual([
            'Also meanwhile',
            'Meanwhile',
            'Waiting',
        ]);
        // The answer is the first line after the hello, before any event.
        const answer_at = lines.findIndex((l) => l.result?.conversations);
        expect(lines.findIndex((l) => l.method === 'event')).toBeGreaterThan(answer_at);
        expect(await client.request('inbox.read')).toEqual({ conversations: [] });
    });

    it('marks nothing seen for a client that dies during the catch-up', async () => {
        const { client } = await open('gone');
        await client.request('inbox.read');
        // An event to write, which fails once the client is gone, closes the connection then.
        await client.request('events.subscribe');
        await receive(JULIET, 'Not given');

        const { promise: lookup, resolve: release } = Promise.withResolvers();
        const original = daemon.api.contacts.get.bind(daemon.api.contacts);
        vi.spyOn(daemon.api.contacts, 'get').mockImplementation(async (...args) => {
            await lookup;
            return original(...args);
        });
        const answering = client.request('inbox.subscribe').catch((e) => e);
        await u.waitUntil(() => vi.mocked(daemon.api.contacts.get).mock.calls.length > 0);
        client.socket.destroy();
        await flush();
        await receive(JULIET, 'Meanwhile');
        await flush();
        release();
        await answering;
        await flush();
        vi.restoreAllMocks();

        // Nor is anything that arrives later marked seen, as a subscription left behind would.
        await receive(JULIET, 'Later');
        const again = await open('gone');
        const { conversations } = await again.client.request('inbox.read');
        expect(bodiesOf(conversations)).toEqual([['Not given', 'Meanwhile', 'Later']]);
    });

    it('gives a message caught up in the survey once, in the answer, not again live', async () => {
        const { client, bodies } = await open('surveyed');
        await client.request('inbox.read');

        // Holds the catch-up before it has looked at any conversation. Only its own lookup:
        // handling the message looks up its chat too.
        const { promise: listing, resolve: release } = Promise.withResolvers();
        const original = daemon.api.chats.get.bind(daemon.api.chats);
        vi.spyOn(daemon.api.chats, 'get').mockImplementationOnce(async (...args) => {
            await listing;
            return original(...args);
        });
        const answering = client.request('inbox.subscribe');
        await u.waitUntil(() => vi.mocked(daemon.api.chats.get).mock.calls.length > 0);
        await receive(JULIET, 'Just in time');
        release();

        expect(bodiesOf((await answering).conversations)).toEqual([['Just in time']]);
        await flush();
        expect(bodies()).toEqual([]);
    });

    it('repeats and loses nothing when the subscription is restarted', async () => {
        const first = await open('restarting');
        await first.client.request('inbox.read');
        await first.client.request('inbox.subscribe');
        await receive(JULIET, 'One');
        await flush();
        expect(first.bodies()).toEqual(['One']);
        first.client.close();
        await u.waitUntil(() => first.client.socket.closed);

        await receive(JULIET, 'Two, while stopped');
        const second = await open('restarting');
        const { conversations } = await second.client.request('inbox.subscribe');
        expect(bodiesOf(conversations)).toEqual([['Two, while stopped']]);
        await receive(JULIET, 'Three');
        await flush();
        expect(second.bodies()).toEqual(['Three']);
    });

    it("marks nothing seen that can't be written, as once the daemon has ended the connection", async () => {
        const { client, bodies } = await open('ending');
        await client.request('inbox.subscribe');
        // As every socket is once ended, before it closes.
        const writable = vi.spyOn(net.Socket.prototype, 'writable', 'get').mockReturnValue(false);
        await receive(JULIET, 'Not written');
        await flush();
        writable.mockRestore();
        expect(bodies()).toEqual([]);

        const { conversations } = await client.request('inbox.read');
        expect(bodiesOf(conversations)).toEqual([['Not written']]);
    });

    it("keeps passing messages on to headless's hook when sending one to a subscriber fails", async () => {
        const { client, bodies } = await open('failing');
        await client.request('inbox.subscribe');
        const error = vi.spyOn(log, 'error').mockImplementation(() => {});
        const write = net.Socket.prototype.write;
        vi.spyOn(net.Socket.prototype, 'write').mockImplementation(function (chunk, ...rest) {
            if (String(chunk).includes('"method":"event"')) throw new Error('Broken');
            return write.call(this, chunk, ...rest);
        });
        const later = vi.fn((_chatbox, message) => message);
        daemon.api.listen.on('afterMessageCreated', later);
        await receive(JULIET, 'Breaks');
        await u.waitUntil(() => later.mock.calls.length > 0);
        expect(later.mock.calls[0][1].get('body')).toBe('Breaks');
        expect(error).toHaveBeenCalledWith(expect.stringContaining('Broken'));
        daemon.api.listen.not('afterMessageCreated', later);
        vi.restoreAllMocks();

        await receive(JULIET, 'Works');
        await flush();
        expect(bodies()).toEqual(['Works']);
    });

    it("gives a live message without looking through its conversation, when it's the only one unseen", async () => {
        const { client, bodies } = await open('quick');
        const { subscription } = await client.request('inbox.subscribe');
        await receive(JULIET, 'First');
        const subscribed = await scansFor(JULIET, 'Second');
        await flush();
        expect(bodies()).toEqual(['First', 'Second']);

        // Without this subscription, what's left is what headless and the other tests' clients do.
        await client.request('events.unsubscribe', { subscription });
        expect(subscribed).toBe(await scansFor(JULIET, 'Third'));
    });

    it('still gives the next live message without looking through its conversation after an info message', async () => {
        const { client, bodies } = await open('informed');
        const { subscription } = await client.request('inbox.subscribe');
        await receive(MERCUTIO, 'First');
        const chat = await daemon.api.chats.get(MERCUTIO);
        await chat.createMessage({ type: 'info', message: 'Mercutio is now online' });

        const subscribed = await scansFor(MERCUTIO, 'Second');
        await flush();
        expect(bodies()).toEqual(['First', 'Second']);

        await client.request('events.unsubscribe', { subscription });
        await chat.createMessage({ type: 'info', message: 'Mercutio is now away' });
        expect(subscribed).toBe(await scansFor(MERCUTIO, 'Third'));
    });

    it('passes over our own messages, but marks them seen', async () => {
        const { client, bodies } = await open('sender');
        await client.request('inbox.read');
        await client.request('inbox.subscribe');
        await client.request('messages.send', { to: MERCUTIO, body: 'From me' });
        await flush();
        expect(bodies()).toEqual([]);

        const { messages } = await daemon.api.chats.get(MERCUTIO);
        const mine = messages.findWhere({ body: 'From me' });
        expect(mine.get('daemon_arrived')).toBeGreaterThan(0);
        // Saved a moment later, with whatever else moves meanwhile.
        const { promises: fs } = await import('node:fs');
        const saved = async () => JSON.parse(await fs.readFile(daemon.config.paths.cursors, 'utf8'));
        await expect
            .poll(async () => (await saved()).consumers.sender?.conversations[MERCUTIO]?.arrived)
            .toBe(mine.get('daemon_arrived'));
    });

    it('only covers the conversation given, and leaves the others unseen', async () => {
        const { client, bodies } = await open('focused');
        await client.request('inbox.read');
        await receive(MERCUTIO, 'Elsewhere, before');
        await receive(JULIET, 'Here, before');

        const lookup = vi.spyOn(daemon.api.contacts, 'get');
        const { conversations } = await client.request('inbox.subscribe', { conversation: 'Juliet Capulet' });
        expect(bodiesOf(conversations)).toEqual([['Here, before']]);
        // Nor are the others looked through.
        expect(lookup).not.toHaveBeenCalledWith(MERCUTIO);
        lookup.mockRestore();
        await receive(MERCUTIO, 'Elsewhere, live');
        await receive(JULIET, 'Here, live');
        await flush();
        expect(bodies()).toEqual(['Here, live']);

        const other = await open('focused');
        expect(bodiesOf((await other.client.request('inbox.read')).conversations)).toEqual([
            ['Elsewhere, before', 'Elsewhere, live'],
        ]);
    });

    it('refuses a filter other than the conversation, as it would mark what it leaves out seen', async () => {
        const { client } = await open('filtered');
        for (const params of [{ from: JULIET }, { mention: true }]) {
            await expect(client.request('inbox.subscribe', params)).rejects.toMatchObject({
                code: ERRORS.INVALID_PARAMS,
                message: expect.stringMatching(/^"inbox\.subscribe" takes only "conversation"/),
            });
        }
    });

    it('refuses a conversation it can not find', async () => {
        const { client } = await open('lost');
        await expect(client.request('inbox.subscribe', { conversation: 'Tybalt' })).rejects.toMatchObject({
            code: ERRORS.NOT_FOUND,
        });
    });
});

describe('inbox.subscribe and the archive', () => {
    let daemon;
    /** @type {Awaited<ReturnType<typeof openClient>>[]} */
    const opened = [];

    // In the archive, but not yet held: as what was missed while disconnected is.
    const missed = (id, body, offset) => ({
        id,
        from: JULIET,
        to: 'romeo@montague.lit',
        body,
        time: new Date(Date.now() + offset).toISOString(),
    });

    beforeEach(async () => {
        daemon = await startDaemon({
            roster: [{ jid: JULIET, name: 'Juliet Capulet' }],
            archive: [missed('a1', 'Missed one', 1000), missed('a2', 'Missed two', 2000)],
        });
    });

    afterEach(async () => {
        opened.splice(0).forEach(({ client }) => client.close());
        await daemon?.stop();
    });

    /** @param {string} consumer */
    async function open(consumer) {
        const c = await openClient(daemon, consumer);
        opened.push(c);
        return c;
    }

    it("keeps what's caught up from the archive out of the stream, for the next subscription", async () => {
        const first = await open('agent');
        expect(await first.client.request('inbox.subscribe')).toMatchObject({ conversations: [] });

        // Opening the conversation pages its history in from the archive.
        const { messages } = await first.client.request('messages.list', { conversation: JULIET });
        expect(messages.map((m) => m.body)).toEqual(['Missed one', 'Missed two']);
        await flush();
        expect(first.bodies()).toEqual([]);
        first.client.close();
        await u.waitUntil(() => first.client.socket.closed);

        const second = await open('agent');
        const { conversations } = await second.client.request('inbox.subscribe');
        expect(bodiesOf(conversations)).toEqual([['Missed one', 'Missed two']]);
    });

    it('sends what was caught up in a conversation before its next live message, which would pass it', async () => {
        const { client, bodies } = await open('agent');
        await client.request('inbox.subscribe');
        await client.request('messages.list', { conversation: JULIET });
        await flush();
        expect(bodies()).toEqual([]);

        const { promise, resolve } = Promise.withResolvers();
        daemon.api.listen.once('message', resolve);
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${JULIET}/balcony" to="${JID}" type="chat" id="${u.getUniqueId()}">
                <body>Live</body>
            </message>`);
        await promise;
        await flush();
        expect(bodies()).toEqual(['Missed one', 'Missed two', 'Live']);
        expect(await client.request('inbox.read')).toEqual({ conversations: [] });
    });
});
