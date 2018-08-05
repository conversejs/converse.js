(function (root, factory) {
    define(["jquery", "jasmine", "mock", "test-utils"], factory);
} (this, function ($, jasmine, mock, test_utils) {
    const _ = converse.env._;
    const  $msg = converse.env.$msg;
    const u = converse.env.utils;

    describe("The Minimized Chats Widget", function () {

        it("shows chats that have been minimized",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');

            test_utils.openControlBox();
            _converse.minimized_chats.toggleview.model.browserStorage._clear();
            _converse.minimized_chats.initToggle();

            let contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            let chatview;
            test_utils.openChatBoxFor(_converse, contact_jid)
            .then(() => {
                chatview = _converse.chatboxviews.get(contact_jid);
                expect(chatview.model.get('minimized')).toBeFalsy();
                expect($(_converse.minimized_chats.el).is(':visible')).toBeFalsy();
                chatview.el.querySelector('.toggle-chatbox-button').click();
                expect(chatview.model.get('minimized')).toBeTruthy();
                expect($(_converse.minimized_chats.el).is(':visible')).toBeTruthy();
                expect(_converse.minimized_chats.keys().length).toBe(1);
                expect(_converse.minimized_chats.keys()[0]).toBe(contact_jid);

                contact_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                return test_utils.openChatBoxFor(_converse, contact_jid);
            }).then(() => {
                chatview = _converse.chatboxviews.get(contact_jid);
                expect(chatview.model.get('minimized')).toBeFalsy();
                chatview.el.querySelector('.toggle-chatbox-button').click();
                expect(chatview.model.get('minimized')).toBeTruthy();
                expect($(_converse.minimized_chats.el).is(':visible')).toBeTruthy();
                expect(_converse.minimized_chats.keys().length).toBe(2);
                expect(_.includes(_converse.minimized_chats.keys(), contact_jid)).toBeTruthy();
                done();
            });
        }));

        it("can be toggled to hide or show minimized chats",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');

            test_utils.openControlBox();
            _converse.minimized_chats.toggleview.model.browserStorage._clear();
            _converse.minimized_chats.initToggle();

            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid)
            .then(() => {
                const chatview = _converse.chatboxviews.get(contact_jid);
                expect(u.isVisible(_converse.minimized_chats.el)).toBeFalsy();
                chatview.model.set({'minimized': true});
                expect(u.isVisible(_converse.minimized_chats.el)).toBeTruthy();
                expect(_converse.minimized_chats.keys().length).toBe(1);
                expect(_converse.minimized_chats.keys()[0]).toBe(contact_jid);
                expect(u.isVisible(_converse.minimized_chats.el.querySelector('.minimized-chats-flyout'))).toBeTruthy();
                expect(_converse.minimized_chats.toggleview.model.get('collapsed')).toBeFalsy();
                _converse.minimized_chats.el.querySelector('#toggle-minimized-chats').click();
                return test_utils.waitUntil(() => u.isVisible(_converse.minimized_chats.el.querySelector('.minimized-chats-flyout')));
            }).then(() => {
                expect(_converse.minimized_chats.toggleview.model.get('collapsed')).toBeTruthy();
                done();
            });
        }));

        it("shows the number messages received to minimized chats",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');

            test_utils.openControlBox();
            _converse.minimized_chats.toggleview.model.browserStorage._clear();
            _converse.minimized_chats.initToggle();

            var i, contact_jid, chatview, msg;
            _converse.minimized_chats.toggleview.model.set({'collapsed': true});

            const unread_el = _converse.minimized_chats.toggleview.el.querySelector('.unread-message-count');
            expect(_.isNull(unread_el)).toBe(true);

            for (i=0; i<3; i++) {
                contact_jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                test_utils.openChatBoxFor(_converse, contact_jid);
            }
            return test_utils.waitUntil(() => _converse.chatboxes.length == 4).then(() => {
                for (i=0; i<3; i++) {
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
                    expect($(_converse.minimized_chats.toggleview.el.querySelector('.unread-message-count')).is(':visible')).toBeTruthy();
                    expect($(_converse.minimized_chats.toggleview.el.querySelector('.unread-message-count')).text()).toBe((i+1).toString());
                }
                // Chat state notifications don't increment the unread messages counter
                // <composing> state
                _converse.chatboxes.onMessage($msg({
                    from: contact_jid,
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: (new Date()).getTime()
                }).c('composing', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
                expect($(_converse.minimized_chats.toggleview.el.querySelector('.unread-message-count')).text()).toBe((i).toString());

                // <paused> state
                _converse.chatboxes.onMessage($msg({
                    from: contact_jid,
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: (new Date()).getTime()
                }).c('paused', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
                expect($(_converse.minimized_chats.toggleview.el.querySelector('.unread-message-count')).text()).toBe((i).toString());

                // <gone> state
                _converse.chatboxes.onMessage($msg({
                    from: contact_jid,
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: (new Date()).getTime()
                }).c('gone', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
                expect($(_converse.minimized_chats.toggleview.el.querySelector('.unread-message-count')).text()).toBe((i).toString());

                // <inactive> state
                _converse.chatboxes.onMessage($msg({
                    from: contact_jid,
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: (new Date()).getTime()
                }).c('inactive', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
                expect($(_converse.minimized_chats.toggleview.el.querySelector('.unread-message-count')).text()).toBe((i).toString());
                done();
            });
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
                view.model.onMessage(msg);

                expect($(_converse.minimized_chats.toggleview.el.querySelector('.unread-message-count')).is(':visible')).toBeTruthy();
                expect($(_converse.minimized_chats.toggleview.el.querySelector('.unread-message-count')).text()).toBe('1');
                done();
            });
        }));
    });
}));
