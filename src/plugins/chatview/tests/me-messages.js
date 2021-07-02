/*global mock, converse */

const { u, sizzle, $msg } = converse.env;

describe("A Message", function () {

    it("supports the /me command", mock.initConverse([], {}, async function (_converse) {
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
        await u.waitUntil(() => view.querySelector('.chat-msg__text').textContent.trim() === 'is tired');
        expect(view.querySelector('.chat-msg__author').textContent.includes('**Mercutio')).toBeTruthy();

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
    }));
});
