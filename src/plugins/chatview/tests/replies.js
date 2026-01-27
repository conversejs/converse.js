/*global mock, converse */

const { u, stx } = converse.env;

describe("XEP-0461 Message Replies", function () {

    describe("A Chat Message", function () {

        it("can be replied to using a message action",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            const textarea = view.querySelector('textarea.chat-textarea');

            const firstMessageText = 'But soft, what light through yonder airlock breaks?';

            textarea.value = firstMessageText;
            const message_form = view.querySelector('converse-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                key: "Enter",
            });
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);

            // Click the reply button
            const replyAction = view.querySelector('.chat-msg__action-reply');
            expect(replyAction).not.toBeNull();
            replyAction.click();

            // Check that the reply state is set on the chatbox
            const chatbox = view.model;
            expect(chatbox.get('reply_to_id')).toBeDefined();
            expect(chatbox.get('reply_to')).toBeDefined();

            // Check that the reply preview is shown
            await u.waitUntil(() => view.querySelector('.reply-preview'));
            const replyPreview = view.querySelector('.reply-preview');
            expect(replyPreview).not.toBeNull();
            expect(replyPreview.querySelector('.reply-preview__text').textContent).toContain(firstMessageText);
        }));

        it("can cancel a reply in progress",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            const textarea = view.querySelector('textarea.chat-textarea');

            const firstMessageText = 'Hello world';

            textarea.value = firstMessageText;
            const message_form = view.querySelector('converse-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                key: "Enter",
            });
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);

            // Click the reply button
            const replyAction = view.querySelector('.chat-msg__action-reply');
            replyAction.click();

            await u.waitUntil(() => view.querySelector('.reply-preview'));

            // Click the cancel button
            const cancelButton = view.querySelector('.reply-preview__cancel');
            expect(cancelButton).not.toBeNull();
            cancelButton.click();

            // Check that the reply state is cleared
            const chatbox = view.model;
            await u.waitUntil(() => chatbox.get('reply_to_id') === undefined);
            expect(chatbox.get('reply_to')).toBeUndefined();

            // Check that the reply preview is hidden
            await u.waitUntil(() => !view.querySelector('.reply-preview'));
        }));

        it("includes reply element in outgoing stanza when replying",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            const textarea = view.querySelector('textarea.chat-textarea');

            // Send a message first
            const firstMessageText = 'Original message';
            textarea.value = firstMessageText;
            const message_form = view.querySelector('converse-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                key: "Enter",
            });
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);

            // Click reply
            const replyAction = view.querySelector('.chat-msg__action-reply');
            replyAction.click();
            await u.waitUntil(() => view.querySelector('.reply-preview'));

            // Send a reply
            let sent_stanzas = [];
            const send = api.connection.get().send;
            spyOn(api.connection.get(), 'send').and.callFake(stanza => {
                sent_stanzas.push(stanza);
                return send.call(api.connection.get(), stanza);
            });

            textarea.value = 'This is my reply';
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                key: "Enter",
            });

            await u.waitUntil(() => sent_stanzas.length === 1);

            // Check that the sent stanza includes the reply element
            const sent_stanza = sent_stanzas[0];
            const reply_el = sent_stanza.querySelector('reply');
            expect(reply_el).not.toBeNull();
            expect(reply_el.getAttribute('xmlns')).toBe('urn:xmpp:reply:0');
            expect(reply_el.getAttribute('id')).toBeDefined();
        }));

        it("parses incoming reply messages correctly",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            // First send a message to reply to
            const original_id = u.getUniqueId();
            const original_stanza = stx`
                <message xmlns="jabber:client"
                    from="${contact_jid}"
                    to="${api.connection.get().jid}"
                    type="chat"
                    id="${original_id}">
                    <body>Original message</body>
                    <active xmlns="http://jabber.org/protocol/chatstates"/>
                </message>
            `;
            _converse.handleMessageStanza(original_stanza);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);

            // Now send a reply message
            const reply_stanza = stx`
                <message xmlns="jabber:client"
                    from="${contact_jid}"
                    to="${api.connection.get().jid}"
                    type="chat"
                    id="${u.getUniqueId()}">
                    <body>This is a reply</body>
                    <reply xmlns="urn:xmpp:reply:0" id="${original_id}" to="${api.connection.get().jid}"/>
                    <active xmlns="http://jabber.org/protocol/chatstates"/>
                </message>
            `;

            _converse.handleMessageStanza(reply_stanza);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);

            // Check that the reply context is displayed
            await u.waitUntil(() => view.querySelector('converse-reply-context'));
            const replyContext = view.querySelector('converse-reply-context');
            expect(replyContext).not.toBeNull();
        }));
    });
});
