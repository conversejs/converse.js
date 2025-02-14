/*global mock, converse */

const { u, sizzle, stx } = converse.env;


describe("A Groupchat Message", function () {

    it("supports the /me command", mock.initConverse([], {}, async function (_converse) {
        const muc_jid = 'lounge@montague.lit';
        await mock.waitUntilDiscoConfirmed(_converse, 'montague.lit', [], ['vcard-temp']);
        await u.waitUntil(() => _converse.xmppstatus.vcard.get('fullname'));
        await mock.waitForRoster(_converse, 'current');
        await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);
        if (!view.querySelectorAll('.chat-area').length) {
            view.renderChatArea();
        }
        let message = '/me is tired';
        const nick = mock.chatroom_names[0];

        let msg = stx`<message from="${muc_jid}/${nick}"
            id="${u.getUniqueId()}"
            to="romeo@montague.lit"
            type="groupchat"
            xmlns="jabber:client">
            <body>${message}</body>
        </message>`;
        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => sizzle('.chat-msg:last .chat-msg__text', view).pop());
        await u.waitUntil(() => view.querySelector('.chat-msg__text').textContent.trim() === 'is tired');
        expect(view.querySelector('.chat-msg__author').textContent.includes('**Dyon van de Wege')).toBeTruthy();

        message = '/me is as well';
        msg = stx`<message from="${muc_jid}/Romeo Montague"
            id="${u.getUniqueId()}"
            to="romeo@montague.lit"
            type="groupchat"
            xmlns="jabber:client">
            <body>${message}</body>
        </message>`;
        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 2);
        await u.waitUntil(() => Array.from(view.querySelectorAll('.chat-msg__text')).pop().textContent.trim() === 'is as well');
        expect(sizzle('.chat-msg__author:last', view).pop().textContent.includes('**Romeo Montague')).toBeTruthy();

        // Check rendering of a mention inside a me message
        const msg_text = "/me mentions romeo";
        msg = stx`<message from="${muc_jid}/gibson"
            id="${u.getUniqueId()}"
            to="romeo@montague.lit"
            type="groupchat"
            xmlns="jabber:client">
            <body>${msg_text}</body>
            <reference xmlns="urn:xmpp:reference:0"
                begin="13"
                end="19"
                type="mention"
                uri="xmpp:romeo@montague.lit"/>
        </message>`;
        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 3);
        await u.waitUntil(() => sizzle('.chat-msg__text:last', view).pop().innerHTML.replace(/<!-.*?->/g, '') ===
            'mentions <span class="mention mention--self badge badge-info" data-uri="xmpp:romeo@montague.lit">romeo</span>');
    }));
});
