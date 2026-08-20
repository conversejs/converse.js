import converse from '../../../dist/converse-headless.js';
import mock from '../../../tests/mock.js';

const { stx, u } = converse.env;

/**
 * A bare-host JID (no localpart) names a server, a service or a XEP-0100
 * gateway. Such an entity is a legitimate correspondent: Prosody's
 * mod_pubsub_text_interface, for instance, is driven entirely by chat messages.
 *
 * Regression tests for https://github.com/conversejs/converse.js/issues/1509
 */
describe('A chat with a bare-host JID', function () {
    const service_jid = 'pubsub.montague.lit';

    /** @param {string} from @param {string} body @param {string} type */
    const messageFrom = (_converse, from, body, type = 'chat') => stx`
        <message type="${type}" from="${from}" to="${_converse.bare_jid}" id="${u.getUniqueId()}" xmlns="jabber:client">
            <body>${body}</body>
        </message>`;

    it(
        'can be opened at all',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            await mock.waitForRoster(_converse, 'current', 1);

            // This used to hang forever: ChatBox.setup() called setModelContact(),
            // which called api.contacts.add(), which throws on a localpart-less
            // JID, so the chatbox was never added to the collection and the
            // promise never settled.
            const chat = await api_open(_converse, service_jid);
            expect(chat).toBeDefined();
            expect(_converse.state.chatboxes.get(service_jid)).toBeDefined();
            // No roster contact exists for it, and that's fine.
            expect(chat.contact).toBe(null);
        }),
    );

    it(
        'receives type="chat" messages once the chat is open',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            await mock.waitForRoster(_converse, 'current', 1);
            await api_open(_converse, service_jid);

            await _converse.handleMessageStanza(
                messageFrom(_converse, service_jid, 'PubSub Service on montague.lit'),
            );

            const chatbox = _converse.state.chatboxes.get(service_jid);
            await u.waitUntil(() => chatbox.messages.length);
            expect(chatbox.getMostRecentMessage().get('message')).toBe('PubSub Service on montague.lit');
        }),
    );

    it(
        'receives type="chat" messages when the service is in the roster',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            await mock.waitForRoster(_converse, 'current', 1);

            // A gateway or component enters the roster via a server push, which
            // (unlike api.contacts.add) has never required a localpart.
            _converse.state.roster.create({ jid: service_jid, subscription: 'both' });

            await _converse.handleMessageStanza(messageFrom(_converse, service_jid, 'Hello from the gateway'));

            const chatbox = await u.waitUntil(() => _converse.state.chatboxes.get(service_jid));
            await u.waitUntil(() => chatbox.messages.length);
            expect(chatbox.getMostRecentMessage().get('message')).toBe('Hello from the gateway');
        }),
    );

    it(
        'still treats an unsolicited bare-host message as a server notice',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            await mock.waitForRoster(_converse, 'current', 1);

            // The behaviour the 2016 workaround exists for: Prosody's
            // mod_watchregistrations sends registration notices as type="chat".
            // With no roster entry and no open chat, they must NOT open a chatbox
            // with a textarea the user can't usefully reply into.
            await _converse.handleMessageStanza(
                messageFrom(_converse, 'montague.lit', 'User romeo just registered'),
            );

            await new Promise((resolve) => setTimeout(resolve, 250));
            expect(_converse.state.chatboxes.get('montague.lit')).toBeUndefined();
        }),
    );
});

/** Open a chat and wait for the box to actually exist, without hanging the spec. */
function api_open(_converse, jid) {
    _converse.api.chats.open(jid, {}, true);
    return u.waitUntil(() => _converse.state.chatboxes.get(jid));
}
