(function (root, factory) {
    define(["jasmine", "mock", "converse-core", "test-utils"], factory);
} (this, function (jasmine, mock, converse, test_utils) {
    var _ = converse.env._;
    var $msg = converse.env.$msg;

    describe("The Minimized Chats Widget", function () {

        it("shows chats that have been minimized",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            test_utils.openControlBox();
            test_utils.openContactsPanel(_converse);
            _converse.minimized_chats.toggleview.model.browserStorage._clear();
            _converse.minimized_chats.initToggle();

            var contact_jid, chatview;
            contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid);
            chatview = _converse.chatboxviews.get(contact_jid);
            expect(chatview.model.get('minimized')).toBeFalsy();
            expect(_converse.minimized_chats.$el.is(':visible')).toBeFalsy();
            chatview.$el.find('.toggle-chatbox-button').click();
            expect(chatview.model.get('minimized')).toBeTruthy();
            expect(_converse.minimized_chats.$el.is(':visible')).toBeTruthy();
            expect(_converse.minimized_chats.keys().length).toBe(1);
            expect(_converse.minimized_chats.keys()[0]).toBe(contact_jid);

            contact_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid);
            chatview = _converse.chatboxviews.get(contact_jid);
            expect(chatview.model.get('minimized')).toBeFalsy();
            chatview.$el.find('.toggle-chatbox-button').click();
            expect(chatview.model.get('minimized')).toBeTruthy();
            expect(_converse.minimized_chats.$el.is(':visible')).toBeTruthy();
            expect(_converse.minimized_chats.keys().length).toBe(2);
            expect(_.includes(_converse.minimized_chats.keys(), contact_jid)).toBeTruthy();
            done();
        }));

        it("can be toggled to hide or show minimized chats",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            test_utils.openControlBox();
            test_utils.openContactsPanel(_converse);
            _converse.minimized_chats.toggleview.model.browserStorage._clear();
            _converse.minimized_chats.initToggle();

            var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid);
            var chatview = _converse.chatboxviews.get(contact_jid);
            expect(_converse.minimized_chats.$el.is(':visible')).toBeFalsy();
            chatview.model.set({'minimized': true});
            expect(_converse.minimized_chats.$el.is(':visible')).toBeTruthy();
            expect(_converse.minimized_chats.keys().length).toBe(1);
            expect(_converse.minimized_chats.keys()[0]).toBe(contact_jid);
            expect(_converse.minimized_chats.$('.minimized-chats-flyout').is(':visible')).toBeTruthy();
            expect(_converse.minimized_chats.toggleview.model.get('collapsed')).toBeFalsy();
            _converse.minimized_chats.$('#toggle-minimized-chats').click();
            expect(_converse.minimized_chats.$('.minimized-chats-flyout').is(':visible')).toBeFalsy();
            expect(_converse.minimized_chats.toggleview.model.get('collapsed')).toBeTruthy();
            done();
        }));

        it("shows the number messages received to minimized chats",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            test_utils.openControlBox();
            test_utils.openContactsPanel(_converse);
            _converse.minimized_chats.toggleview.model.browserStorage._clear();
            _converse.minimized_chats.initToggle();

            var i, contact_jid, chatview, msg;
            _converse.minimized_chats.toggleview.model.set({'collapsed': true});
            expect(_converse.minimized_chats.toggleview.$('.unread-message-count').is(':visible')).toBeFalsy();
            for (i=0; i<3; i++) {
                contact_jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                test_utils.openChatBoxFor(_converse, contact_jid);
                chatview = _converse.chatboxviews.get(contact_jid);
                chatview.model.set({'minimized': true});
                msg = $msg({
                    from: contact_jid,
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: (new Date()).getTime()
                }).c('body').t('This message is sent to a minimized chatbox').up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                _converse.chatboxes.onMessage(msg);
                expect(_converse.minimized_chats.toggleview.$('.unread-message-count').is(':visible')).toBeTruthy();
                expect(_converse.minimized_chats.toggleview.$('.unread-message-count').text()).toBe((i+1).toString());
            }
            // Chat state notifications don't increment the unread messages counter
            // <composing> state
            _converse.chatboxes.onMessage($msg({
                from: contact_jid,
                to: _converse.connection.jid,
                type: 'chat',
                id: (new Date()).getTime()
            }).c('composing', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            expect(_converse.minimized_chats.toggleview.$('.unread-message-count').text()).toBe((i).toString());

            // <paused> state
            _converse.chatboxes.onMessage($msg({
                from: contact_jid,
                to: _converse.connection.jid,
                type: 'chat',
                id: (new Date()).getTime()
            }).c('paused', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            expect(_converse.minimized_chats.toggleview.$('.unread-message-count').text()).toBe((i).toString());

            // <gone> state
            _converse.chatboxes.onMessage($msg({
                from: contact_jid,
                to: _converse.connection.jid,
                type: 'chat',
                id: (new Date()).getTime()
            }).c('gone', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            expect(_converse.minimized_chats.toggleview.$('.unread-message-count').text()).toBe((i).toString());

            // <inactive> state
            _converse.chatboxes.onMessage($msg({
                from: contact_jid,
                to: _converse.connection.jid,
                type: 'chat',
                id: (new Date()).getTime()
            }).c('inactive', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            expect(_converse.minimized_chats.toggleview.$('.unread-message-count').text()).toBe((i).toString());
            done();
        }));

        it("shows the number messages received to minimized groupchats",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            var room_jid = 'kitchen@conference.shakespeare.lit';
            test_utils.openAndEnterChatRoom(
                _converse, 'kitchen', 'conference.shakespeare.lit', 'fires').then(function () {
                var view = _converse.chatboxviews.get(room_jid);
                view.model.set({'minimized': true});

                var contact_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@localhost';
                var message = 'fires: Your attention is required';
                var nick = mock.chatroom_names[0],
                    msg = $msg({
                        from: room_jid+'/'+nick,
                        id: (new Date()).getTime(),
                        to: 'dummy@localhost',
                        type: 'groupchat'
                    }).c('body').t(message).tree();
                view.handleMUCMessage(msg);

                expect(_converse.minimized_chats.toggleview.$('.unread-message-count').is(':visible')).toBeTruthy();
                expect(_converse.minimized_chats.toggleview.$('.unread-message-count').text()).toBe('1');
                done();
            });
        }));
    });
}));
