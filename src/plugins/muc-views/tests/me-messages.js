/*global mock, converse */

const { u, sizzle, $msg } = converse.env;


describe("A Groupchat Message", function () {

    it("supports the /me command", mock.initConverse([], {}, async function (_converse) {
        await mock.waitUntilDiscoConfirmed(_converse, 'montague.lit', [], ['vcard-temp']);
        await u.waitUntil(() => _converse.xmppstatus.vcard.get('fullname'));
        await mock.waitForRoster(_converse, 'current');
        await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
        const view = _converse.chatboxviews.get('lounge@montague.lit');
        if (!view.querySelectorAll('.chat-area').length) {
            view.renderChatArea();
        }
        let message = '/me is tired';
        const nick = mock.chatroom_names[0];
        let msg = $msg({
                'from': 'lounge@montague.lit/'+nick,
                'id': u.getUniqueId(),
                'to': 'romeo@montague.lit',
                'type': 'groupchat'
            }).c('body').t(message).tree();
        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => sizzle('.chat-msg:last .chat-msg__text', view).pop());
        await u.waitUntil(() => view.querySelector('.chat-msg__text').textContent.trim() === 'is tired');
        expect(view.querySelector('.chat-msg__author').textContent.includes('**Dyon van de Wege')).toBeTruthy();

        message = '/me is as well';
        msg = $msg({
            from: 'lounge@montague.lit/Romeo Montague',
            id: u.getUniqueId(),
            to: 'romeo@montague.lit',
            type: 'groupchat'
        }).c('body').t(message).tree();
        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 2);
        await u.waitUntil(() => Array.from(view.querySelectorAll('.chat-msg__text')).pop().textContent.trim() === 'is as well');
        expect(sizzle('.chat-msg__author:last', view).pop().textContent.includes('**Romeo Montague')).toBeTruthy();

        // Check rendering of a mention inside a me message
        const msg_text = "/me mentions romeo";
        msg = $msg({
                from: 'lounge@montague.lit/gibson',
                id: u.getUniqueId(),
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t(msg_text).up()
                .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'13', 'end':'19', 'type':'mention', 'uri':'xmpp:romeo@montague.lit'}).nodeTree;
        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 3);
        await u.waitUntil(() => sizzle('.chat-msg__text:last', view).pop().innerHTML.replace(/<!-.*?->/g, '') ===
            'mentions <span class="mention mention--self badge badge-info" data-uri="xmpp:romeo@montague.lit">romeo</span>');
    }));
});
