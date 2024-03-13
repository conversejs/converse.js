/*global mock, converse */

const { $msg, u } = converse.env;

describe("A Groupchat Message", function () {

    it("Can be copied using a message action",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const stanza = $pres({
                to: 'romeo@montague.lit/_converse.js-29092160',
                from: 'coven@chat.shakespeare.lit/newguy'
            })
            .c('x', {xmlns: Strophe.NS.MUC_USER})
            .c('item', {
                'affiliation': 'none',
                'jid': 'newguy@montague.lit/_converse.js-290929789',
                'role': 'participant'
            }).tree();
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

        const view = _converse.chatboxviews.get(muc_jid);
        const textarea = await u.waitUntil(() => view.querySelector('textarea.chat-textarea'));
        const message_form = view.querySelector('converse-muc-message-form');
        const spyClipboard = spyOn(navigator.clipboard, 'writeText');

        const firstMessageText = 'But soft, what light through yonder airlock breaks?';
        const msg_id = u.getUniqueId();
        await model.handleMessageStanza($msg({
                'from': 'lounge@montague.lit/newguy',
                'to': _converse.api.connection.get().jid,
                'type': 'groupchat',
                'id': msg_id,
            }).c('body').t(firstMessageText).tree());
        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);
        let firstAction = view.querySelector('.chat-msg__action-copy');
        expect(firstAction).not.toBeNull();
        firstAction.click();
        expect(spyClipboard).toHaveBeenCalledOnceWith(firstMessageText);

        const secondMessageText = 'Hello';
        textarea.value = secondMessageText;
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 2);
        const copyActions = view.querySelectorAll('.chat-msg__action-copy');
        expect(copyActions.length).toBe(2);
        let secondAction = copyActions[copyActions.length - 1];
        expect(secondAction).not.toBeNull();
        secondAction.click();
        expect(spyClipboard).toHaveBeenCalledWith(secondMessageText);
    }));

    it("Can be quoted using a message action",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const stanza = $pres({
                to: 'romeo@montague.lit/_converse.js-29092160',
                from: 'coven@chat.shakespeare.lit/newguy'
            })
            .c('x', {xmlns: Strophe.NS.MUC_USER})
            .c('item', {
                'affiliation': 'none',
                'jid': 'newguy@montague.lit/_converse.js-290929789',
                'role': 'participant'
            }).tree();
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

        const firstMessageText = 'But soft, what light through yonder airlock breaks?';
        const msg_id = u.getUniqueId();
        await model.handleMessageStanza($msg({
                'from': 'lounge@montague.lit/newguy',
                'to': _converse.api.connection.get().jid,
                'type': 'groupchat',
                'id': msg_id,
            }).c('body').t(firstMessageText).tree());

        const view = _converse.chatboxviews.get(muc_jid);
        const textarea = await u.waitUntil(() => view.querySelector('textarea.chat-textarea'));

        // Quote with empty text area
        expect(textarea.value).toBe('');
        let firstAction = await u.waitUntil(() => view.querySelector('.chat-msg__action-quote'));
        expect(firstAction).not.toBeNull();
        firstAction.click();
        expect(textarea.value).toBe('> ' + firstMessageText + '\n');
        // Quote with already-present text
        textarea.value = 'Hi!';
        firstAction.click();
        expect(textarea.value).toBe('Hi!\n> ' + firstMessageText + '\n');

        // Quote with already-present text
        textarea.value = 'Hi!';
        firstAction.click();
        expect(textarea.value).toBe('Hi!\n> ' + firstMessageText + '\n');

    }));

    it("Cannot be quoted without permission to speak",
            mock.initConverse([], {}, async function (_converse) {
        const muc_jid = 'lounge@montague.lit';
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', ['muc_moderated']);
        const stanza = $pres({
                to: 'romeo@montague.lit/_converse.js-29092160',
                from: 'coven@chat.shakespeare.lit/newguy'
            })
            .c('x', {xmlns: Strophe.NS.MUC_USER})
            .c('item', {
                'affiliation': 'none',
                'jid': 'newguy@montague.lit/_converse.js-290929789',
                'role': 'participant'
            }).tree();
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

        const view = _converse.chatboxviews.get(muc_jid);

        const msg_id = u.getUniqueId();
        await model.handleMessageStanza($msg({
                'from': 'lounge@montague.lit/newguy',
                'to': _converse.api.connection.get().jid,
                'type': 'groupchat',
                'id': msg_id,
            }).c('body').t('But soft, what light through yonder airlock breaks?').tree());
        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);
        // Quoting should be available before losing permission to speak
        expect(view.querySelector('.chat-msg__action-quote')).not.toBeNull();

        const presence = $pres({
                to: 'romeo@montague.lit/orchard',
                from: `${muc_jid}/romeo`
            }).c('x', {xmlns: Strophe.NS.MUC_USER})
            .c('item', {'affiliation': 'none', 'role': 'visitor'}).up()
            .c('status', {code: '110'});
        _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
        const occupant = view.model.occupants.findWhere({'jid': _converse.bare_jid});
        await u.waitUntil(() => occupant.get('role') === 'visitor');
        expect(view.querySelector('.chat-msg__action-quote')).toBeNull();
    }));

});
