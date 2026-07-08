import converse from '../../../dist/converse-headless.js';
import mock from '../../../tests/mock.js';

const { stx } = converse.env;

describe('A ChatBox', function () {
    it(
        'keeps receiving messages after an own message stanza without a "to" attribute',
        // Regression test for https://github.com/conversejs/converse.js/issues/1237
        // An OMEMO sent-carbon from another own device arrives without a 'to'
        // attribute. This used to throw a fatal "jid is null" error inside the
        // message handler, removing it and breaking all subsequent message
        // reception. It must now be skipped gracefully.
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);

            const { handleMessageStanza } = _converse;

            // An own OMEMO message from another device, without a 'to' attribute.
            await handleMessageStanza(stx`
                <message type="chat" from="${_converse.bare_jid}/Conversations.6XS1" xmlns="jabber:client">
                    <encrypted xmlns="eu.siacs.conversations.axolotl">
                        <header sid="481260804">
                            <key rid="13480">MwohBS+dA9aZt81H1vOhR6cPQBLerWutQgFsambaeU/mmM8ZEAAYACIg</key>
                            <iv>2e5bKCRkds3hr6KasygF2A==</iv>
                        </header>
                    </encrypted>
                    <store xmlns="urn:xmpp:hints"/>
                </message>`);

            // Reception must still work after the malformed stanza above.
            await handleMessageStanza(
                mock.createChatMessage(_converse, contact_jid, 'This message must still arrive', 'chat'),
            );

            const chatbox = _converse.state.chatboxes.get(contact_jid);
            expect(chatbox.getMostRecentMessage().get('message')).toBe('This message must still arrive');
        }),
    );

    it(
        "considers both 'chat' and 'normal' messages as chat messages",
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);

            const { handleMessageStanza } = _converse;
            await handleMessageStanza(
                mock.createChatMessage(_converse, contact_jid, 'This is an info message', 'info'),
            );
            await handleMessageStanza(
                mock.createChatMessage(_converse, contact_jid, 'This is a normal message', 'normal'),
            );
            await handleMessageStanza(mock.createChatMessage(_converse, contact_jid, 'This is a chat message', 'chat'));

            const chatbox = _converse.state.chatboxes.get(contact_jid);
            const oldest_msg = chatbox.getOldestMessage();
            expect(oldest_msg.get('message')).toBe('This is a normal message');

            const newest_msg = chatbox.getMostRecentMessage();
            expect(newest_msg.get('message')).toBe('This is a chat message');
        }),
    );

    it(
        'synchronizes the unread counter when the contact object finishes loading asynchronously',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';

            const contact = _converse.state.roster.get(contact_jid);
            expect(contact).toBeDefined();

            // Prepare a promise we can resolve to simulate asynchronous loading of the contact
            let resolve_contact;
            const contact_promise = new Promise((resolve) => {
                resolve_contact = resolve;
            });

            // Spy on api.contacts.get to return our deferred promise for this contact
            const original_get = _converse.api.contacts.get;
            _converse.api.contacts.get = async function (jids) {
                if (jids === contact_jid) {
                    return contact_promise;
                }
                return original_get.call(_converse.api.contacts, jids);
            };

            const ChatBox = _converse.exports.ChatBox;
            const chatbox = new ChatBox({
                jid: contact_jid,
                type: 'chatbox'
            }, {
                collection: _converse.state.chatboxes
            });

            // The contact must not be set on the chatbox yet since it is resolving asynchronously
            expect(chatbox.contact).toBeNull();

            // A new message arrives (or we set unread count), updating num_unread on the chatbox
            chatbox.set('num_unread', 2);

            // The roster contact's unread count should be 0 at this point
            expect(contact.get('num_unread')).toBe(0);

            // Now, resolve the contact promise, simulating that the contact has loaded
            resolve_contact(contact);

            // Wait for the asynchronous tasks to complete
            await contact_promise;
            await chatbox.initialized;

            // Verify that the contact's unread counter is synchronized to 2
            expect(contact.get('num_unread')).toBe(2);

            // Clean up
            _converse.api.contacts.get = original_get;
        })
    );
});
