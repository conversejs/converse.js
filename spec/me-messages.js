/*global mock, converse */

const { u, sizzle, $msg } = converse.env;

describe("A Groupchat Message", function () {

    it("supports the /me command",
        mock.initConverse(
            ['rosterContactsFetched'], {},
            async function (done, _converse) {

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
        await u.waitUntil(() => sizzle('.chat-msg:last .chat-msg__text', view.content).pop());
        expect(view.querySelector('.chat-msg__author').textContent.includes('**Dyon van de Wege')).toBeTruthy();
        expect(view.querySelector('.chat-msg__text').textContent.trim()).toBe('is tired');

        message = '/me is as well';
        msg = $msg({
            from: 'lounge@montague.lit/Romeo Montague',
            id: u.getUniqueId(),
            to: 'romeo@montague.lit',
            type: 'groupchat'
        }).c('body').t(message).tree();
        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 2);
        expect(sizzle('.chat-msg__author:last', view).pop().textContent.includes('**Romeo Montague')).toBeTruthy();
        expect(sizzle('.chat-msg__text:last', view).pop().textContent.trim()).toBe('is as well');

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
        await u.waitUntil(() => sizzle('.chat-msg__text:last', view).pop().innerHTML.replace(/<!---->/g, '') ===
            'mentions <span class="mention mention--self badge badge-info">romeo</span>');
        done();
    }));
});

describe("A Message", function () {

    it("supports the /me command", mock.initConverse(['rosterContactsFetched'], {}, async function (done, _converse) {
        await mock.waitForRoster(_converse, 'current');
        await mock.waitUntilDiscoConfirmed(_converse, 'montague.lit', [], ['vcard-temp']);
        await u.waitUntil(() => _converse.xmppstatus.vcard.get('fullname'));
        await mock.openControlBox(_converse);
        expect(_converse.chatboxes.length).toEqual(1);
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        let message = '/me is tired';
        const msg = $msg({
                from: sender_jid,
                to: _converse.connection.jid,
                type: 'chat',
                id: u.getUniqueId()
            }).c('body').t(message).up()
            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();

        await _converse.handleMessageStanza(msg);
        const view = _converse.chatboxviews.get(sender_jid);
        await u.waitUntil(() => view.querySelector('.chat-msg__text'));
        expect(view.querySelectorAll('.chat-msg--action').length).toBe(1);
        expect(view.querySelector('.chat-msg__author').textContent.includes('**Mercutio')).toBeTruthy();
        expect(view.querySelector('.chat-msg__text').textContent).toBe('is tired');

        message = '/me is as well';
        await mock.sendMessage(view, message);
        expect(view.querySelectorAll('.chat-msg--action').length).toBe(2);
        await u.waitUntil(() => sizzle('.chat-msg__author:last', view).pop().textContent.trim() === '**Romeo Montague');
        const last_el = sizzle('.chat-msg__text:last', view).pop();
        await u.waitUntil(() => last_el.textContent === 'is as well');
        expect(u.hasClass('chat-msg--followup', last_el)).toBe(false);

        // Check that /me messages after a normal message don't
        // get the 'chat-msg--followup' class.
        message = 'This a normal message';
        await mock.sendMessage(view, message);
        const msg_txt_sel = 'converse-chat-message:last-child .chat-msg__text';
        await u.waitUntil(() => view.querySelector(msg_txt_sel).textContent.trim() === message);
        let el = view.querySelector('converse-chat-message:last-child .chat-msg__body');
        expect(u.hasClass('chat-msg--followup', el)).toBeFalsy();

        message = '/me wrote a 3rd person message';
        await mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelector(msg_txt_sel).textContent.trim() === message.replace('/me ', ''));
        el = view.querySelector('converse-chat-message:last-child .chat-msg__body');
        expect(view.querySelectorAll('.chat-msg--action').length).toBe(3);

        expect(sizzle('.chat-msg__text:last', view).pop().textContent).toBe('wrote a 3rd person message');
        expect(u.isVisible(sizzle('.chat-msg__author:last', view).pop())).toBeTruthy();
        done();
    }));
});
