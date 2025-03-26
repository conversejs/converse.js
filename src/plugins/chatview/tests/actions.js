/*global mock, converse */

const { $msg, u } = converse.env;

describe("A Chat Message", function () {

    it("Can be copied using a message action",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const { api } = _converse;
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

        const spyClipboard = spyOn(navigator.clipboard, 'writeText');
        let firstAction = view.querySelector('.chat-msg__action-copy');
        expect(firstAction).not.toBeNull();
        firstAction.click();
        expect(spyClipboard).toHaveBeenCalledOnceWith(firstMessageText);

        // Test messages from other users
        const secondMessageText = 'Hello';
        _converse.handleMessageStanza(
            $msg({
                'from': contact_jid,
                'to': api.connection.get().jid,
                'type': 'chat',
                'id': u.getUniqueId()
            }).c('body').t(secondMessageText).up()
            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree()
        );
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);
        const copyActions = view.querySelectorAll('.chat-msg__action-copy');
        expect(copyActions.length).toBe(2);
        let secondAction = copyActions[copyActions.length - 1];
        expect(secondAction).not.toBeNull();
        secondAction.click();
        expect(spyClipboard).toHaveBeenCalledWith(secondMessageText);
    }));

    it("Can be quoted using a message action",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const { api } = _converse;
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

        // Quote with empty text area
        expect(textarea.value).toBe('');
        let firstAction = view.querySelector('.chat-msg__action-quote');
        expect(firstAction).not.toBeNull();
        firstAction.click();
        expect(textarea.value).toBe('> ' + firstMessageText + '\n');
        // Quote with already-present text
        textarea.value = 'Hi!';
        firstAction.click();
        expect(textarea.value).toBe('Hi!\n> ' + firstMessageText + '\n');

        // Test messages from other users
        textarea.value = '';
        const secondMessageText = 'Hello';
        _converse.handleMessageStanza(
            $msg({
                'from': contact_jid,
                'to': api.connection.get().jid,
                'type': 'chat',
                'id': u.getUniqueId()
            }).c('body').t(secondMessageText).up()
            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree()
        );
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);
        const quoteActions = view.querySelectorAll('.chat-msg__action-quote');
        expect(quoteActions.length).toBe(2);
        let secondAction = quoteActions[quoteActions.length - 1];
        expect(secondAction).not.toBeNull();
        secondAction.click();
        expect(textarea.value).toBe('> ' + secondMessageText + '\n');
    }));

});
