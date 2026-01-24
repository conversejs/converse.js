/*global mock, converse */

const { u, stx } = converse.env;

describe("XEP-0461 Message Replies", function () {

    describe("A MUC Message", function () {

        it("can be replied to using a message action",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            const nick = 'romeo';
            await mock.openAndEnterMUC(_converse, muc_jid, nick);
            const view = _converse.chatboxviews.get(muc_jid);

            // Receive a message from another occupant
            const msg_id = u.getUniqueId();
            const received_stanza = stx`
                <message xmlns="jabber:client"
                    to="${_converse.jid}"
                    from="${muc_jid}/juliet"
                    type="groupchat"
                    id="${msg_id}">
                    <body>Hello from juliet</body>
                    <origin-id xmlns="urn:xmpp:sid:0" id="${msg_id}"/>
                </message>
            `;
            await view.model.handleMessageStanza(received_stanza);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);

            // Click the reply button
            const replyAction = view.querySelector('.chat-msg__action-reply');
            expect(replyAction).not.toBeNull();
            replyAction.click();

            // Check that the reply state is set
            const chatbox = view.model;
            expect(chatbox.get('reply_to_id')).toBeDefined();
            expect(chatbox.get('reply_to')).toBe(`${muc_jid}/juliet`);

            // Check that the reply preview is shown
            await u.waitUntil(() => view.querySelector('.reply-preview'));
            const replyPreview = view.querySelector('.reply-preview');
            expect(replyPreview.querySelector('.reply-preview__text').textContent).toContain('Hello from juliet');
        }));

        it("parses incoming MUC reply messages correctly",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            const nick = 'romeo';
            await mock.openAndEnterMUC(_converse, muc_jid, nick);
            const view = _converse.chatboxviews.get(muc_jid);

            // First receive a message
            const original_id = u.getUniqueId();
            const original_stanza = stx`
                <message xmlns="jabber:client"
                    to="${_converse.jid}"
                    from="${muc_jid}/juliet"
                    type="groupchat"
                    id="${original_id}">
                    <body>Original message</body>
                    <origin-id xmlns="urn:xmpp:sid:0" id="${original_id}"/>
                </message>
            `;
            await view.model.handleMessageStanza(original_stanza);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);

            // Now receive a reply
            const reply_stanza = stx`
                <message xmlns="jabber:client"
                    to="${_converse.jid}"
                    from="${muc_jid}/mercutio"
                    type="groupchat"
                    id="${u.getUniqueId()}">
                    <body>This is a reply</body>
                    <reply xmlns="urn:xmpp:reply:0" id="${original_id}" to="${muc_jid}/juliet"/>
                </message>
            `;
            await view.model.handleMessageStanza(reply_stanza);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);

            // Check that the reply context is displayed
            await u.waitUntil(() => view.querySelector('converse-reply-context'));
            const replyContext = view.querySelector('converse-reply-context');
            expect(replyContext).not.toBeNull();
            expect(replyContext.textContent).toContain('juliet');
        }));
    });
});
