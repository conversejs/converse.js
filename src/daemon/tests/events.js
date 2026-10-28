import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { converse } from '@converse/headless';
import { ERRORS } from '../protocol.js';
import { JID, startDaemon } from './harness.js';

const { stx, u } = converse.env;

const JULIET = 'juliet@capulet.lit';
const MERCUTIO = 'mercutio@montague.lit';

describe('Event subscriptions', () => {
    let daemon, client;
    /** Every event any of the clients below has been sent. */
    let events = [];
    /** @type {import('../client.js').Client[]} */
    const clients = [];

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [
                { jid: JULIET, name: 'Juliet Capulet' },
                { jid: MERCUTIO, name: 'Mercutio' },
            ],
        });
        client = await openClient();
    });

    afterAll(async () => {
        clients.forEach((c) => c.close());
        await daemon?.stop();
    });

    /**
     * Connects a client, and collects the events it's sent into `events`.
     */
    async function openClient() {
        const c = await daemon.connect();
        c.onEvent((event) => events.push(event));
        clients.push(c);
        return c;
    }

    /**
     * Delivers a message, and waits until the daemon has stored it, which is
     * after it has sent out any events for it.
     * @param {Object} attrs
     * @param {string} attrs.from
     * @param {string} attrs.body
     * @param {string} [attrs.id]
     */
    async function receive({ from, body, id = u.getUniqueId() }) {
        const { promise, resolve } = Promise.withResolvers();
        daemon.api.listen.once('message', resolve);
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${from}/balcony" to="${JID}" type="chat" id="${id}">
                <body>${body}</body>
            </message>`);
        await promise;
    }

    /**
     * Requests on one connection are answered in order, and its events arrive
     * in order too. So once this returns, every event sent before it is in `events`.
     */
    const flush = () => Promise.all(clients.map((c) => c.request('daemon.status')));

    /**
     * The bodies of the messages a subscription was sent, in order.
     * @param {number} subscription
     */
    const bodiesFor = (subscription) =>
        events.filter((e) => e.subscription === subscription).map((e) => e.message.body);

    it('sends each incoming message to a subscriber, as an event carrying the message', async () => {
        events = [];
        const { subscription } = await client.request('events.subscribe', {});
        await receive({ from: JULIET, body: 'Wherefore art thou?', id: 'event-1' });
        await flush();

        expect(events).toEqual([
            {
                subscription,
                type: 'message',
                message: {
                    id: 'event-1',
                    conversation: JULIET,
                    from: JULIET,
                    nick: null,
                    direction: 'incoming',
                    time: expect.any(String),
                    body: 'Wherefore art thou?',
                    encryption: null,
                    reply_to: null,
                    edited: null,
                    retracted: null,
                    reactions: {},
                },
            },
        ]);
    });

    it('sends only the messages that match the sender filter', async () => {
        events = [];
        const { subscription } = await client.request('events.subscribe', { from: JULIET });
        await receive({ from: MERCUTIO, body: 'Not this one' });
        await receive({ from: JULIET, body: 'This one' });
        await flush();

        expect(bodiesFor(subscription)).toEqual(['This one']);
    });

    it('sends our own messages as outgoing, to the subscribers that asked for outgoing', async () => {
        events = [];
        const incoming = (await client.request('events.subscribe', { direction: 'incoming' })).subscription;
        const outgoing = (await client.request('events.subscribe', { direction: 'outgoing' })).subscription;
        await client.request('messages.send', { to: JULIET, body: 'Sent by me' });
        await flush();

        expect(bodiesFor(outgoing)).toEqual(['Sent by me']);
        expect(bodiesFor(incoming)).toEqual([]);
    });

    it('sends only the messages that match the conversation filter', async () => {
        events = [];
        const { subscription } = await client.request('events.subscribe', { conversation: MERCUTIO });
        await receive({ from: JULIET, body: 'Not this one' });
        await receive({ from: `${MERCUTIO}/home`, body: 'This one' });
        await flush();

        expect(bodiesFor(subscription)).toEqual(['This one']);
    });

    it('sends only the messages that name the account, as a whole word, in any case', async () => {
        events = [];
        const { subscription } = await client.request('events.subscribe', { mention: true });
        await receive({ from: JULIET, body: 'Romeos are plenty' });
        await receive({ from: JULIET, body: 'What ho, ROMEO' });
        await receive({ from: JULIET, body: 'Romeo, come here' });
        await flush();

        expect(bodiesFor(subscription)).toEqual(['What ho, ROMEO', 'Romeo, come here']);
    });

    it('in a room, matches the sender by the JID the room shows, and a mention by our nickname there', async () => {
        const GARDEN = 'garden@conference.montague.lit';
        const joined = client.request('rooms.join', { room: GARDEN, nick: 'Friar' });
        await daemon.enterRoom(GARDEN, 'Friar');
        await joined;

        // The room shows Juliet's JID, but not Mercutio's. The occupant id is what ties her messages to that JID.
        daemon.receive(stx`
            <presence xmlns="jabber:client" from="${GARDEN}/jules" to="${JID}">
                <x xmlns="http://jabber.org/protocol/muc#user">
                    <item affiliation="member" role="participant" jid="${JULIET}/balcony"/>
                </x>
                <occupant-id xmlns="urn:xmpp:occupant-id:0" id="occupant-jules"/>
            </presence>`);
        const room = await daemon.api.rooms.get(GARDEN);
        await u.waitUntil(() => room.occupants.findWhere({ nick: 'jules' }));

        events = [];
        const by_sender = (await client.request('events.subscribe', { from: JULIET })).subscription;
        const by_mention = (await client.request('events.subscribe', { mention: true })).subscription;

        /** @param {string} nick @param {string} body @param {string} [occupant_id] */
        const say = async (nick, body, occupant_id) => {
            daemon.receive(stx`
                <message xmlns="jabber:client" from="${GARDEN}/${nick}" to="${JID}" type="groupchat"
                        id="${u.getUniqueId()}">
                    <body>${body}</body>
                    ${occupant_id ? stx`<occupant-id xmlns="urn:xmpp:occupant-id:0" id="${occupant_id}"/>` : ''}
                </message>`);
            await u.waitUntil(() => room.messages.findWhere({ body }));
        };
        await say('jules', 'Good morrow', 'occupant-jules');
        await say('mercu', 'A word, friar!');
        await say('mercu', 'Where is Romeo?');
        await say('mercu', 'Friars are plenty');
        await flush();

        expect(bodiesFor(by_sender)).toEqual(['Good morrow']);
        // Our JID's name isn't how the room knows us, so "Romeo" doesn't name us there.
        expect(bodiesFor(by_mention)).toEqual(['A word, friar!']);
    });

    it('ends a subscription made with "once" after its first event', async () => {
        events = [];
        const once = (await client.request('events.subscribe', { once: true })).subscription;
        const all = (await client.request('events.subscribe', {})).subscription;
        await receive({ from: JULIET, body: 'First' });
        await receive({ from: JULIET, body: 'Second' });
        await flush();

        expect(bodiesFor(once)).toEqual(['First']);
        expect(bodiesFor(all)).toEqual(['First', 'Second']);
    });

    it('delivers to several subscribers at once, and lets each end its own subscription', async () => {
        events = [];
        const other = await openClient();
        const mine = (await client.request('events.subscribe', { from: JULIET })).subscription;
        const theirs = (await other.request('events.subscribe', {})).subscription;

        await receive({ from: JULIET, body: 'Both hear this' });
        await flush();
        expect(bodiesFor(mine)).toEqual(['Both hear this']);
        expect(bodiesFor(theirs)).toEqual(['Both hear this']);

        // A client can't end another's subscription, so theirs keeps going.
        await client.request('events.unsubscribe', { subscription: theirs });
        await receive({ from: JULIET, body: 'Still hears this' });
        await flush();
        expect(bodiesFor(mine)).toEqual(['Both hear this', 'Still hears this']);
        expect(bodiesFor(theirs)).toEqual(['Both hear this', 'Still hears this']);

        await other.request('events.unsubscribe', { subscription: theirs });
        await receive({ from: JULIET, body: 'Nobody hears this' });
        await flush();
        expect(bodiesFor(theirs)).toEqual(['Both hear this', 'Still hears this']);
        expect(bodiesFor(mine)).toEqual(['Both hear this', 'Still hears this', 'Nobody hears this']);
    });

    it('treats ending a subscription twice, or one that never existed, as nothing to do', async () => {
        await expect(client.request('events.unsubscribe', { subscription: 999 })).resolves.toEqual({});
    });

    it('refuses a filter it cannot apply, saying what is wrong with it', async () => {
        await expect(client.request('events.subscribe', { type: 'presence' })).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
            message: '"type" must be one of: message, draft.',
        });
        await expect(client.request('events.subscribe', { direction: 'sideways' })).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
            message: '"direction" must be "incoming" or "outgoing".',
        });
        await expect(client.request('events.subscribe', { mention: 'yes' })).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
            message: '"mention" and "once" must be true or false.',
        });
        await expect(client.request('events.subscribe', { from: '' })).rejects.toMatchObject({
            code: ERRORS.INVALID_PARAMS,
            message: '"from" must be a JID, or the name of a contact or room.',
        });
    });

    it('needs the hello handshake before subscribing', async () => {
        const socket = net.createConnection(daemon.config.paths.socket);
        await new Promise((resolve) => socket.once('connect', resolve));
        socket.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'events.subscribe', params: {} }) + '\n');
        const [line] = await new Promise((resolve) => socket.once('data', (d) => resolve(d.toString().split('\n'))));
        socket.end();
        expect(JSON.parse(line).error.code).toBe(ERRORS.HELLO_REQUIRED);
    });
});
