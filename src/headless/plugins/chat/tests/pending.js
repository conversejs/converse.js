import converse from '../../../dist/converse-headless.js';
import mock from '../../../tests/mock.js';

const { u } = converse.env;

/** As a dropped connection leaves it: the stream is gone, and so is the session. */
function goOffline(_converse) {
    const connection = _converse.api.connection.get();
    connection.authenticated = false;
    connection.connected = false;
}

/** The bodies of the messages that reached the connection, in order. */
function sentBodies(_converse) {
    return _converse.api.connection
        .get()
        .sent_stanzas.filter((s) => s.matches('message') && s.querySelector('body'))
        .map((s) => s.querySelector('body').textContent);
}

function sentRetractions(_converse) {
    return _converse.api.connection
        .get()
        .sent_stanzas.filter((s) => s.matches('message') && s.querySelector('retract'));
}

async function openChat(_converse) {
    await mock.waitForRoster(_converse, 'current', 1);
    const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
    await mock.openChatBoxFor(_converse, contact_jid);
    return _converse.chatboxes.get(contact_jid);
}

describe('A message sent without a session', function () {
    it(
        'is kept as pending, and sent in the order written once reconnected',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            const { api } = _converse;
            const chat = await openChat(_converse);
            const sent_events = [];
            api.listen.on('sendMessage', ({ message }) => sent_events.push(message.get('body')));

            goOffline(_converse);
            const first = await chat.sendMessage({ body: 'First' });
            const second = await chat.sendMessage({ body: 'Second' });
            expect(first.get('send_status')).toBe('pending');
            expect(second.get('send_status')).toBe('pending');
            expect(sentBodies(_converse)).toEqual([]);
            expect(sent_events).toEqual([]);
            const written = first.get('time');

            await api.connection.reconnect();
            await u.waitUntil(() => sentBodies(_converse).length === 2);
            expect(sentBodies(_converse)).toEqual(['First', 'Second']);
            await u.waitUntil(() => !second.get('send_status'));
            expect(first.get('send_status')).toBeUndefined();
            expect(first.get('time') >= written).toBe(true);
            expect(sent_events).toEqual(['First', 'Second']);
        }),
    );

    it(
        'is pending too when the session is lost while its stanza is built',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            const chat = await openChat(_converse);
            const build = chat.createMessageStanza.bind(chat);
            vi.spyOn(chat, 'createMessageStanza').mockImplementationOnce(async (message) => {
                const stanza = await build(message);
                goOffline(_converse);
                return stanza;
            });

            const message = await chat.sendMessage({ body: 'Into the tunnel' });
            expect(message.get('send_status')).toBe('pending');
            expect(sentBodies(_converse)).toEqual([]);
            await _converse.api.connection.reconnect();
        }),
    );

    it(
        'becomes a failed message when it can not be sent after reconnecting',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            const { api } = _converse;
            const chat = await openChat(_converse);

            goOffline(_converse);
            const message = await chat.sendMessage({ body: 'For nobody' });
            vi.spyOn(chat, 'createMessageStanza').mockRejectedValue(
                Object.assign(new Error('No OMEMO devices'), { code: 'no-omemo-devices' }),
            );

            await api.connection.reconnect();
            await u.waitUntil(() => message.get('send_status') === 'failed');
            expect(message.get('send_error_code')).toBe('no-omemo-devices');
            expect(sentBodies(_converse)).toEqual([]);
        }),
    );

    it(
        'is not sent once it was discarded, here or in another tab',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            const { api } = _converse;
            const chat = await openChat(_converse);

            goOffline(_converse);
            const discarded = await chat.sendMessage({ body: 'On second thought' });
            const elsewhere = await chat.sendMessage({ body: 'Discarded in another tab' });
            await chat.sendMessage({ body: 'Kept' });
            chat.discardFailedMessage(discarded);
            expect(chat.messages.findWhere({ body: 'On second thought' })).toBeUndefined();

            // Another tab's discard leaves this tab's copy, but takes it out of storage.
            const { store } = chat.messages.browserStorage ?? chat.messages.storage;
            const key = (chat.messages.browserStorage ?? chat.messages.storage).getItemName(elsewhere.get('id'));
            await u.waitUntil(async () => (await store.getItem(key)) !== null);
            await store.removeItem(key);

            await api.connection.reconnect();
            await u.waitUntil(() => sentBodies(_converse).length);
            expect(sentBodies(_converse)).toEqual(['Kept']);
            expect(chat.messages.findWhere({ body: 'Discarded in another tab' })).toBeUndefined();
        }),
    );

    it(
        'is kept, and sent, when the messages are cleared on reconnection',
        mock.initConverse(
            converse,
            ['rosterInitialized', 'chatBoxesInitialized'],
            { clear_messages_on_reconnection: true },
            async (_converse) => {
                const { api } = _converse;
                const chat = await openChat(_converse);
                await chat.sendMessage({ body: 'Delivered' });

                goOffline(_converse);
                await chat.sendMessage({ body: 'Written offline' });

                await api.connection.reconnect();
                await u.waitUntil(() => sentBodies(_converse).length === 2);
                expect(chat.messages.map((m) => m.get('body'))).toEqual(['Written offline']);
            },
        ),
    );

    it(
        'is only sent by a groupchat once it has been entered again, as is a retraction',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            const muc_jid = 'lounge@montague.lit';
            const muc = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const regretted = await muc.sendMessage({ body: 'Regretted' });
            api.connection.get().sent_stanzas = [];

            goOffline(_converse);
            const message = await muc.sendMessage({ body: 'Anyone here?' });
            expect(message.get('send_status')).toBe('pending');
            await muc.retractOwnMessage(regretted);
            expect(regretted.get('retraction_pending')).toBe(true);

            api.connection.get().IQ_stanzas = [];
            await api.connection.reconnect();
            await mock.waitForMUCDiscoInfo(_converse, muc_jid, []);
            await u.waitUntil(() => muc.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING);
            expect(sentBodies(_converse)).toEqual([]);

            await mock.receiveOwnMUCPresence(_converse, muc_jid, 'romeo');
            await mock.returnMemberLists(_converse, muc_jid, [], ['member', 'admin', 'owner']);
            await u.waitUntil(() => sentBodies(_converse).includes('Anyone here?'));
            expect(sentRetractions(_converse).length).toBe(1);
        }),
    );
});

describe('A retraction made without a session', function () {
    it(
        'is sent once reconnected',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            const { api } = _converse;
            const chat = await openChat(_converse);
            const message = await chat.sendMessage({ body: 'Regretted' });

            goOffline(_converse);
            chat.retractOwnMessage(message);
            expect(message.get('retracted')).toBeTruthy();
            expect(message.get('retraction_pending')).toBe(true);
            expect(sentRetractions(_converse).length).toBe(0);

            await api.connection.reconnect();
            await u.waitUntil(() => sentRetractions(_converse).length);
            const [retraction] = sentRetractions(_converse);
            expect(retraction.querySelector('retract').getAttribute('id')).toBe(message.get('origin_id'));
            await u.waitUntil(() => !message.get('retraction_pending'));
        }),
    );

    it(
        'removes a message that is still pending, and sends nothing for it',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            const { api } = _converse;
            const chat = await openChat(_converse);

            goOffline(_converse);
            const message = await chat.sendMessage({ body: 'Never mind' });
            chat.retractOwnMessage(message);
            expect(chat.messages.length).toBe(0);

            await api.connection.reconnect();
            await chat.sendPendingMessages();
            expect(sentBodies(_converse)).toEqual([]);
            expect(sentRetractions(_converse).length).toBe(0);
        }),
    );
});

describe('A reaction made without a session', function () {
    it(
        'is not shown on the message',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            const { api } = _converse;
            const chat = await openChat(_converse);
            const message = await chat.sendMessage({ body: 'React to me' });

            goOffline(_converse);
            await api.reactions.send(message, ['👍']);
            expect(message.get('reactions')).toEqual({});
        }),
    );
});
