/*global mock, converse */

const { Promise, u } = converse.env;

describe("A Private Groupchat Message", function () {

    it("will be indicated as such",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);
        const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
        textarea.value = 'hello world'
        const enter_event = {
            'target': textarea,
            'preventDefault': function preventDefault () {},
            'stopPropagation': function stopPropagation () {},
            'keyCode': 13 // Enter
        }
        const message_form = view.querySelector('converse-muc-message-form');
        message_form.onKeyDown(enter_event);
        await new Promise(resolve => view.model.messages.once('rendered', resolve));

        const msg = view.model.messages.at(0);
        const err_msg_text = "Message rejected because you're sending messages too quickly";
        const error = u.toStanza(`
            <message xmlns="jabber:client" id="${msg.get('msgid')}" from="${muc_jid}" to="${_converse.jid}" type="error">
                <error type="wait">
                    <policy-violation xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                    <text xmlns="urn:ietf:params:xml:ns:xmpp-stanzas">${err_msg_text}</text>
                </error>
                <body>hello world</body>
            </message>
        `);
        _converse.connection._dataRecv(mock.createRequest(error));
        expect(await u.waitUntil(() => view.querySelector('.chat-msg__error')?.textContent?.trim())).toBe(err_msg_text);
        expect(view.model.messages.length).toBe(1);
        const message = view.model.messages.at(0);
        expect(message.get('received')).toBeUndefined();
        expect(message.get('body')).toBe('hello world');
        expect(message.get('error_text')).toBe(err_msg_text);
        expect(message.get('editable')).toBe(false);
    }));
});
