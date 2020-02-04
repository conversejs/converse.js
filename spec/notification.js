(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const _ = converse.env._;
    const $msg = converse.env.$msg;
    const u = converse.env.utils;

    describe("Notifications", function () {
        // Implement the protocol defined in https://xmpp.org/extensions/xep-0313.html#config

        describe("When show_desktop_notifications is set to true", function () {
            describe("And the desktop is not focused", function () {
                describe("an HTML5 Notification", function () {

                    it("is shown when a new private message is received",
                            mock.initConverse(['rosterGroupsFetched'], {}, async (done, _converse) => {

                        await test_utils.waitForRoster(_converse, 'current');
                        spyOn(_converse, 'showMessageNotification').and.callThrough();
                        spyOn(_converse, 'areDesktopNotificationsEnabled').and.returnValue(true);
                        spyOn(_converse, 'isMessageToHiddenChat').and.returnValue(true);

                        const message = 'This message will show a desktop notification';
                        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit',
                            msg = $msg({
                                from: sender_jid,
                                to: _converse.connection.jid,
                                type: 'chat',
                                id: u.getUniqueId()
                            }).c('body').t(message).up()
                            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                        await _converse.handleMessageStanza(msg); // This will emit 'message'
                        await u.waitUntil(() => _converse.api.chatviews.get(sender_jid));
                        expect(_converse.areDesktopNotificationsEnabled).toHaveBeenCalled();
                        expect(_converse.showMessageNotification).toHaveBeenCalled();
                        done();
                    }));

                    it("is shown when you are mentioned in a groupchat",
                            mock.initConverse(['rosterGroupsFetched'], {}, async (done, _converse) => {

                        await test_utils.waitForRoster(_converse, 'current');
                        await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                        const view = _converse.api.chatviews.get('lounge@montague.lit');
                        if (!view.el.querySelectorAll('.chat-area').length) {
                            view.renderChatArea();
                        }
                        let no_notification = false;
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

                        const message = 'romeo: This message will show a desktop notification';
                        const nick = mock.chatroom_names[0],
                            msg = $msg({
                                from: 'lounge@montague.lit/'+nick,
                                id: u.getUniqueId(),
                                to: 'romeo@montague.lit',
                                type: 'groupchat'
                            }).c('body').t(message).tree();
                        _converse.connection._dataRecv(test_utils.createRequest(msg));
                        await new Promise(resolve => view.model.messages.once('rendered', resolve));

                        await u.waitUntil(() => _converse.areDesktopNotificationsEnabled.calls.count() === 1);
                        expect(_converse.showMessageNotification).toHaveBeenCalled();
                        if (no_notification) {
                            delete window.Notification;
                        }
                        done();
                    }));

                    it("is shown for headline messages",
                            mock.initConverse(['rosterGroupsFetched'], {}, async (done, _converse) => {

                        spyOn(_converse, 'showMessageNotification').and.callThrough();
                        spyOn(_converse, 'isMessageToHiddenChat').and.returnValue(true);
                        spyOn(_converse, 'areDesktopNotificationsEnabled').and.returnValue(true);
                        const stanza = $msg({
                                'type': 'headline',
                                'from': 'notify.example.com',
                                'to': 'romeo@montague.lit',
                                'xml:lang': 'en'
                            })
                            .c('subject').t('SIEVE').up()
                            .c('body').t('&lt;juliet@example.com&gt; You got mail.').up()
                            .c('x', {'xmlns': 'jabber:x:oob'})
                            .c('url').t('imap://romeo@example.com/INBOX;UIDVALIDITY=385759043/;UID=18');
                        _converse.connection._dataRecv(test_utils.createRequest(stanza));
                        await u.waitUntil(() => _converse.chatboxviews.keys().length);
                        const view = _converse.chatboxviews.get('notify.example.com');
                        await new Promise(resolve => view.model.messages.once('rendered', resolve));
                        expect(
                            _.includes(_converse.chatboxviews.keys(),
                                'notify.example.com')
                            ).toBeTruthy();
                        expect(_converse.showMessageNotification).toHaveBeenCalled();
                        done();
                    }));

                    it("is not shown for full JID headline messages if allow_non_roster_messaging is false", mock.initConverse((done, _converse) => {
                        _converse.allow_non_roster_messaging = false;
                        spyOn(_converse, 'showMessageNotification').and.callThrough();
                        spyOn(_converse, 'areDesktopNotificationsEnabled').and.returnValue(true);
                        const stanza = $msg({
                                'type': 'headline',
                                'from': 'someone@notify.example.com',
                                'to': 'romeo@montague.lit',
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
                        done();
                    }));

                    it("is shown when a user changes their chat state (if show_chat_state_notifications is true)",
                            mock.initConverse(['rosterGroupsFetched'], {show_chat_state_notifications: true},
                            async (done, _converse) => {

                        await test_utils.waitForRoster(_converse, 'current', 3);
                        spyOn(_converse, 'areDesktopNotificationsEnabled').and.returnValue(true);
                        spyOn(_converse, 'showChatStateNotification');
                        const jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                        _converse.roster.get(jid).presence.set('show', 'busy'); // This will emit 'contactStatusChanged'
                        await u.waitUntil(() => _converse.areDesktopNotificationsEnabled.calls.count() === 1);
                        expect(_converse.showChatStateNotification).toHaveBeenCalled();
                        done()
                    }));
                });
            });

            describe("When a new contact request is received", function () {
                it("an HTML5 Notification is received", mock.initConverse((done, _converse) => {
                    spyOn(_converse, 'areDesktopNotificationsEnabled').and.returnValue(true);
                    spyOn(_converse, 'showContactRequestNotification');
                    _converse.api.trigger('contactRequest', {'fullname': 'Peter Parker', 'jid': 'peter@parker.com'});
                    expect(_converse.areDesktopNotificationsEnabled).toHaveBeenCalled();
                    expect(_converse.showContactRequestNotification).toHaveBeenCalled();
                    done();
                }));
            });
        });

        describe("When play_sounds is set to true", function () {
            describe("A notification sound", function () {

                it("is played when the current user is mentioned in a groupchat",
                        mock.initConverse(['rosterGroupsFetched'], {}, async (done, _converse) => {

                    test_utils.createContacts(_converse, 'current');
                    await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                    _converse.play_sounds = true;
                    spyOn(_converse, 'playSoundNotification');
                    const view = _converse.chatboxviews.get('lounge@montague.lit');
                    if (!view.el.querySelectorAll('.chat-area').length) {
                        view.renderChatArea();
                    }
                    let text = 'This message will play a sound because it mentions romeo';
                    let message = $msg({
                        from: 'lounge@montague.lit/otheruser',
                        id: '1',
                        to: 'romeo@montague.lit',
                        type: 'groupchat'
                    }).c('body').t(text);
                    await view.model.onMessage(message.nodeTree);
                    await u.waitUntil(() => _converse.playSoundNotification.calls.count());
                    expect(_converse.playSoundNotification).toHaveBeenCalled();

                    text = "This message won't play a sound";
                    message = $msg({
                        from: 'lounge@montague.lit/otheruser',
                        id: '2',
                        to: 'romeo@montague.lit',
                        type: 'groupchat'
                    }).c('body').t(text);
                    await view.model.onMessage(message.nodeTree);
                    expect(_converse.playSoundNotification, 1);
                    _converse.play_sounds = false;

                    text = "This message won't play a sound because it is sent by romeo";
                    message = $msg({
                        from: 'lounge@montague.lit/romeo',
                        id: '3',
                        to: 'romeo@montague.lit',
                        type: 'groupchat'
                    }).c('body').t(text);
                    await view.model.onMessage(message.nodeTree);
                    expect(_converse.playSoundNotification, 1);
                    _converse.play_sounds = false;
                    done();
                }));
            });
        });
    });
}));
