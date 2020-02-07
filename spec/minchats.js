(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    const _ = converse.env._;
    const  $msg = converse.env.$msg;
    const u = converse.env.utils;

    describe("The Minimized Chats Widget", function () {

        it("shows chats that have been minimized",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current');
            await test_utils.openControlBox(_converse);
            _converse.minimized_chats.initToggle();

            let contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await test_utils.openChatBoxFor(_converse, contact_jid)
            let chatview = _converse.chatboxviews.get(contact_jid);
            expect(chatview.model.get('minimized')).toBeFalsy();
            expect(u.isVisible(_converse.minimized_chats.el)).toBe(false);
            chatview.el.querySelector('.toggle-chatbox-button').click();
            expect(chatview.model.get('minimized')).toBeTruthy();
            expect(u.isVisible(_converse.minimized_chats.el)).toBe(true);
            expect(_converse.minimized_chats.keys().length).toBe(1);
            expect(_converse.minimized_chats.keys()[0]).toBe(contact_jid);

            contact_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await test_utils.openChatBoxFor(_converse, contact_jid);
            chatview = _converse.chatboxviews.get(contact_jid);
            expect(chatview.model.get('minimized')).toBeFalsy();
            chatview.el.querySelector('.toggle-chatbox-button').click();
            expect(chatview.model.get('minimized')).toBeTruthy();
            expect(u.isVisible(_converse.minimized_chats.el)).toBe(true);
            expect(_converse.minimized_chats.keys().length).toBe(2);
            expect(_.includes(_converse.minimized_chats.keys(), contact_jid)).toBeTruthy();
            done();
        }));

        it("can be toggled to hide or show minimized chats",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current');
            await test_utils.openControlBox(_converse);
            _converse.minimized_chats.initToggle();

            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await test_utils.openChatBoxFor(_converse, contact_jid);
            const chatview = _converse.chatboxviews.get(contact_jid);
            expect(u.isVisible(_converse.minimized_chats.el)).toBeFalsy();
            chatview.model.set({'minimized': true});
            expect(u.isVisible(_converse.minimized_chats.el)).toBeTruthy();
            expect(_converse.minimized_chats.keys().length).toBe(1);
            expect(_converse.minimized_chats.keys()[0]).toBe(contact_jid);
            expect(u.isVisible(_converse.minimized_chats.el.querySelector('.minimized-chats-flyout'))).toBeTruthy();
            expect(_converse.minimized_chats.toggleview.model.get('collapsed')).toBeFalsy();
            _converse.minimized_chats.el.querySelector('#toggle-minimized-chats').click();
            await u.waitUntil(() => u.isVisible(_converse.minimized_chats.el.querySelector('.minimized-chats-flyout')));
            expect(_converse.minimized_chats.toggleview.model.get('collapsed')).toBeTruthy();
            done();
        }));

        it("shows the number messages received to minimized chats",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current', 4);
            await test_utils.openControlBox(_converse);
            _converse.minimized_chats.initToggle();

            var i, contact_jid, chatview, msg;
            _converse.minimized_chats.toggleview.model.set({'collapsed': true});

            const unread_el = _converse.minimized_chats.toggleview.el.querySelector('.unread-message-count');
            expect(unread_el === null).toBe(true);

            for (i=0; i<3; i++) {
                contact_jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                test_utils.openChatBoxFor(_converse, contact_jid);
            }
            await u.waitUntil(() => _converse.chatboxes.length == 4);

            chatview = _converse.chatboxviews.get(contact_jid);
            chatview.model.set({'minimized': true});
            for (i=0; i<3; i++) {
                msg = $msg({
                    from: contact_jid,
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: u.getUniqueId()
                }).c('body').t('This message is sent to a minimized chatbox').up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                _converse.handleMessageStanza(msg);
            }
            await u.waitUntil(() => chatview.model.messages.length === 3, 500);

            expect(u.isVisible(_converse.minimized_chats.toggleview.el.querySelector('.unread-message-count'))).toBeTruthy();
            expect(_converse.minimized_chats.toggleview.el.querySelector('.unread-message-count').textContent).toBe((3).toString());
            // Chat state notifications don't increment the unread messages counter
            // <composing> state
            _converse.handleMessageStanza($msg({
                from: contact_jid,
                to: _converse.connection.jid,
                type: 'chat',
                id: u.getUniqueId()
            }).c('composing', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            expect(_converse.minimized_chats.toggleview.el.querySelector('.unread-message-count').textContent).toBe((i).toString());

            // <paused> state
            _converse.handleMessageStanza($msg({
                from: contact_jid,
                to: _converse.connection.jid,
                type: 'chat',
                id: u.getUniqueId()
            }).c('paused', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            expect(_converse.minimized_chats.toggleview.el.querySelector('.unread-message-count').textContent).toBe((i).toString());

            // <gone> state
            _converse.handleMessageStanza($msg({
                from: contact_jid,
                to: _converse.connection.jid,
                type: 'chat',
                id: u.getUniqueId()
            }).c('gone', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            expect(_converse.minimized_chats.toggleview.el.querySelector('.unread-message-count').textContent).toBe((i).toString());

            // <inactive> state
            _converse.handleMessageStanza($msg({
                from: contact_jid,
                to: _converse.connection.jid,
                type: 'chat',
                id: u.getUniqueId()
            }).c('inactive', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            expect(_converse.minimized_chats.toggleview.el.querySelector('.unread-message-count').textContent).toBe((i).toString());
            done();
        }));

        it("shows the number messages received to minimized groupchats",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'kitchen@conference.shakespeare.lit';
            await test_utils.openAndEnterChatRoom(_converse, 'kitchen@conference.shakespeare.lit', 'fires');
            const view = _converse.chatboxviews.get(muc_jid);
            view.model.set({'minimized': true});
            const message = 'fires: Your attention is required';
            const nick = mock.chatroom_names[0];
            const msg = $msg({
                    from: muc_jid+'/'+nick,
                    id: u.getUniqueId(),
                    to: 'romeo@montague.lit',
                    type: 'groupchat'
                }).c('body').t(message).tree();
            view.model.onMessage(msg);
            await u.waitUntil(() => view.model.messages.length);
            expect(u.isVisible(_converse.minimized_chats.toggleview.el.querySelector('.unread-message-count'))).toBeTruthy();
            expect(_converse.minimized_chats.toggleview.el.querySelector('.unread-message-count').textContent).toBe('1');
            done();
        }));
    });
}));
