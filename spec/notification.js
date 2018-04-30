(function (root, factory) {
    define(["jquery", "jasmine", "mock", "converse-core", "test-utils", "utils"], factory);
} (this, function ($, jasmine, mock, converse, test_utils, utils) {
    "use strict";
    var _ = converse.env._;
    var $msg = converse.env.$msg;

    describe("Notifications", function () {
        // Implement the protocol defined in https://xmpp.org/extensions/xep-0313.html#config

        describe("When show_desktop_notifications is set to true", function () {
            describe("And the desktop is not focused", function () {
                describe("an HTML5 Notification", function () {

                    it("is shown when a new private message is received",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        // TODO: not yet testing show_desktop_notifications setting
                        test_utils.createContacts(_converse, 'current');
                        spyOn(_converse, 'showMessageNotification');
                        spyOn(_converse, 'areDesktopNotificationsEnabled').and.returnValue(true);
                        spyOn(_converse, 'isMessageToHiddenChat').and.returnValue(true);
                        
                        var message = 'This message will show a desktop notification';
                        var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                            msg = $msg({
                                from: sender_jid,
                                to: _converse.connection.jid,
                                type: 'chat',
                                id: (new Date()).getTime()
                            }).c('body').t(message).up()
                            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                        _converse.chatboxes.onMessage(msg); // This will emit 'message'
                        expect(_converse.areDesktopNotificationsEnabled).toHaveBeenCalled();
                        expect(_converse.showMessageNotification).toHaveBeenCalled();
                        done();
                    }));

                    it("is shown when you are mentioned in a chat room",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        test_utils.createContacts(_converse, 'current');
                        test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                            var view = _converse.chatboxviews.get('lounge@localhost');
                            if (!$(view.el).find('.chat-area').length) { view.renderChatArea(); }
                            var no_notification = false;
                            if (typeof window.Notification === 'undefined') {
                                no_notification = true;
                                window.Notification = function () {
                                    return {
                                        'close': function () {}
                                    };
                                };
                            }
                            spyOn(_converse, 'showMessageNotification').and.callThrough();
                            spyOn(_converse, 'areDesktopNotificationsEnabled').and.returnValue(true);
                            
                            var message = 'dummy: This message will show a desktop notification';
                            var nick = mock.chatroom_names[0],
                                msg = $msg({
                                    from: 'lounge@localhost/'+nick,
                                    id: (new Date()).getTime(),
                                    to: 'dummy@localhost',
                                    type: 'groupchat'
                                }).c('body').t(message).tree();
                            _converse.chatboxes.onMessage(msg); // This will emit 'message'
                            expect(_converse.areDesktopNotificationsEnabled).toHaveBeenCalled();
                            expect(_converse.showMessageNotification).toHaveBeenCalled();
                            if (no_notification) {
                                delete window.Notification;
                            }
                            done();
                        });
                    }));

                    it("is shown for headline messages",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        spyOn(_converse, 'showMessageNotification').and.callThrough();
                        spyOn(_converse, 'isMessageToHiddenChat').and.returnValue(true);
                        spyOn(_converse, 'areDesktopNotificationsEnabled').and.returnValue(true);
                        var stanza = $msg({
                                'type': 'headline',
                                'from': 'notify.example.com',
                                'to': 'dummy@localhost',
                                'xml:lang': 'en'
                            })
                            .c('subject').t('SIEVE').up()
                            .c('body').t('&lt;juliet@example.com&gt; You got mail.').up()
                            .c('x', {'xmlns': 'jabber:x:oob'})
                            .c('url').t('imap://romeo@example.com/INBOX;UIDVALIDITY=385759043/;UID=18');
                        _converse.connection._dataRecv(test_utils.createRequest(stanza));
                        expect(
                            _.includes(_converse.chatboxviews.keys(),
                                'notify.example.com')
                            ).toBeTruthy();
                        expect(_converse.showMessageNotification).toHaveBeenCalled();
                        done();
                    }));

                    it("is not shown for full JID headline messages if allow_non_roster_messaging is false", mock.initConverse(function (_converse) {
                        _converse.allow_non_roster_messaging = false;
                        spyOn(_converse, 'showMessageNotification').and.callThrough();
                        spyOn(_converse, 'areDesktopNotificationsEnabled').and.returnValue(true);
                        var stanza = $msg({
                                'type': 'headline',
                                'from': 'someone@notify.example.com',
                                'to': 'dummy@localhost',
                                'xml:lang': 'en'
                            })
                            .c('subject').t('SIEVE').up()
                            .c('body').t('&lt;juliet@example.com&gt; You got mail.').up()
                            .c('x', {'xmlns': 'jabber:x:oob'})
                            .c('url').t('imap://romeo@example.com/INBOX;UIDVALIDITY=385759043/;UID=18');
                        _converse.connection._dataRecv(test_utils.createRequest(stanza));
                        expect(
                            _.includes(_converse.chatboxviews.keys(),
                                'someone@notify.example.com')
                            ).toBeFalsy();
                        expect(_converse.showMessageNotification).not.toHaveBeenCalled();
                    }));

                    it("is shown when a user changes their chat state (if show_chatstate_notifications is true)", mock.initConverse(function (_converse) {
                        // TODO: not yet testing show_desktop_notifications setting
                        _converse.show_chatstate_notifications = true;

                        test_utils.createContacts(_converse, 'current');
                        spyOn(_converse, 'areDesktopNotificationsEnabled').and.returnValue(true);
                        spyOn(_converse, 'showChatStateNotification');
                        var jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).set('chat_status', 'busy'); // This will emit 'contactStatusChanged'
                        expect(_converse.areDesktopNotificationsEnabled).toHaveBeenCalled();
                        expect(_converse.showChatStateNotification).toHaveBeenCalled();
                    }));
                });
            });

            describe("When a new contact request is received", function () {
                it("an HTML5 Notification is received", mock.initConverse(function (_converse) {
                    spyOn(_converse, 'areDesktopNotificationsEnabled').and.returnValue(true);
                    spyOn(_converse, 'showContactRequestNotification');
                    _converse.emit('contactRequest', {'fullname': 'Peter Parker', 'jid': 'peter@parker.com'});
                    expect(_converse.areDesktopNotificationsEnabled).toHaveBeenCalled();
                    expect(_converse.showContactRequestNotification).toHaveBeenCalled();
                }));
            });
        });

        describe("When play_sounds is set to true", function () {
            describe("A notification sound", function () {

                it("is played when the current user is mentioned in a chat room",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                        _converse.play_sounds = true;
                        spyOn(_converse, 'playSoundNotification');
                        var view = _converse.chatboxviews.get('lounge@localhost');
                        if (!$(view.el).find('.chat-area').length) { view.renderChatArea(); }
                        var text = 'This message will play a sound because it mentions dummy';
                        var message = $msg({
                            from: 'lounge@localhost/otheruser',
                            id: '1',
                            to: 'dummy@localhost',
                            type: 'groupchat'
                        }).c('body').t(text);
                        view.model.onMessage(message.nodeTree);
                        expect(_converse.playSoundNotification).toHaveBeenCalled();

                        text = "This message won't play a sound";
                        message = $msg({
                            from: 'lounge@localhost/otheruser',
                            id: '2',
                            to: 'dummy@localhost',
                            type: 'groupchat'
                        }).c('body').t(text);
                        view.model.onMessage(message.nodeTree);
                        expect(_converse.playSoundNotification, 1);
                        _converse.play_sounds = false;

                        text = "This message won't play a sound because it is sent by dummy";
                        message = $msg({
                            from: 'lounge@localhost/dummy',
                            id: '3',
                            to: 'dummy@localhost',
                            type: 'groupchat'
                        }).c('body').t(text);
                        view.model.onMessage(message.nodeTree);
                        expect(_converse.playSoundNotification, 1);
                        _converse.play_sounds = false;
                        done();
                    });
                }));
            });
        });
    });
}));
