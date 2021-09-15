/*global mock, converse */

const { Strophe } = converse.env;
const $msg = converse.env.$msg;
const u = converse.env.utils;

describe("Notifications", function () {
    // Implement the protocol defined in https://xmpp.org/extensions/xep-0313.html#config

    describe("When show_desktop_notifications is set to true", function () {
        describe("And the desktop is not focused", function () {
            describe("an HTML5 Notification", function () {

                it("is shown when a new private message is received",
                        mock.initConverse([], {}, async (_converse) => {

                    await mock.waitForRoster(_converse, 'current');
                    const stub = jasmine.createSpyObj('MyNotification', ['onclick', 'close']);
                    spyOn(window, 'Notification').and.returnValue(stub);

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
                    await u.waitUntil(() => _converse.chatboxviews.get(sender_jid));
                    expect(window.Notification).toHaveBeenCalled();
                }));

                it("is shown when you are mentioned in a groupchat",
                        mock.initConverse([], {}, async (_converse) => {

                    await mock.waitForRoster(_converse, 'current');
                    await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                    const view = _converse.chatboxviews.get('lounge@montague.lit');
                    const stub = jasmine.createSpyObj('MyNotification', ['onclick', 'close']);
                    spyOn(window, 'Notification').and.returnValue(stub);

                    // Test mention with setting false
                    const nick = mock.chatroom_names[0];
                    const makeMsg = text => $msg({
                        from: 'lounge@montague.lit/'+nick,
                        id: u.getUniqueId(),
                        to: 'romeo@montague.lit',
                        type: 'groupchat'
                    }).c('body').t(text).tree();
                    _converse.connection._dataRecv(mock.createRequest(makeMsg('romeo: this will NOT show a notification')));
                    await new Promise(resolve => view.model.messages.once('rendered', resolve));
                    expect(window.Notification).not.toHaveBeenCalled();

                    // Test reference
                    const message_with_ref = $msg({
                        from: 'lounge@montague.lit/'+nick,
                        id: u.getUniqueId(),
                        to: 'romeo@montague.lit',
                        type: 'groupchat'
                    }).c('body').t('romeo: this will show a notification').up()
                    .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'0', 'end':'5', 'type':'mention', 'uri':'xmpp:romeo@montague.lit'}).tree();
                    _converse.connection._dataRecv(mock.createRequest(message_with_ref));
                    await new Promise(resolve => view.model.messages.once('rendered', resolve));
                    expect(window.Notification.calls.count()).toBe(1);

                    // Test mention with setting true
                    _converse.api.settings.set('notify_all_room_messages', true);
                    _converse.connection._dataRecv(mock.createRequest(makeMsg('romeo: this will show a notification')));
                    await new Promise(resolve => view.model.messages.once('rendered', resolve));
                    expect(window.Notification.calls.count()).toBe(2);
                }));

                it("is shown for headline messages", mock.initConverse([], {}, async (_converse) => {
                    const stub = jasmine.createSpyObj('MyNotification', ['onclick', 'close']);
                    spyOn(window, 'Notification').and.returnValue(stub);

                    await mock.waitForRoster(_converse, 'current', 0);
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
                    _converse.connection._dataRecv(mock.createRequest(stanza));

                    await u.waitUntil(() => _converse.chatboxviews.keys().length === 2);
                    expect(_converse.chatboxviews.keys().includes('notify.example.com')).toBeTruthy();
                    expect(window.Notification).toHaveBeenCalled();
                }));

                it("is not shown for full JID headline messages if allow_non_roster_messaging is false",
                        mock.initConverse([], {'allow_non_roster_messaging': false}, (_converse) => {

                    const stub = jasmine.createSpyObj('MyNotification', ['onclick', 'close']);
                    spyOn(window, 'Notification').and.returnValue(stub);
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
                    _converse.connection._dataRecv(mock.createRequest(stanza));
                    expect(_converse.chatboxviews.keys().includes('someone@notify.example.com')).toBeFalsy();
                    expect(window.Notification).not.toHaveBeenCalled();
                }));

                it("is shown when a user changes their chat state (if show_chat_state_notifications is true)",
                        mock.initConverse([], {show_chat_state_notifications: true},
                        async (_converse) => {

                    await mock.waitForRoster(_converse, 'current', 3);
                    const stub = jasmine.createSpyObj('MyNotification', ['onclick', 'close']);
                    spyOn(window, 'Notification').and.returnValue(stub);
                    const jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    _converse.roster.get(jid).presence.set('show', 'dnd');
                    expect(window.Notification).toHaveBeenCalled();
                }));
            });
        });

        describe("When a new contact request is received", function () {
            it("an HTML5 Notification is received", mock.initConverse((_converse) => {
                const stub = jasmine.createSpyObj('MyNotification', ['onclick', 'close']);
                spyOn(window, 'Notification').and.returnValue(stub);
                _converse.api.trigger('contactRequest', {'getDisplayName': () => 'Peter Parker'});
                expect(window.Notification).toHaveBeenCalled();
            }));
        });
    });

    describe("When play_sounds is set to true", function () {
        describe("A notification sound", function () {

            it("is played when the current user is mentioned in a groupchat", mock.initConverse([], {}, async (_converse) => {

                await mock.waitForRoster(_converse, 'current');
                await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                const { api } = _converse;
                api.settings.set('play_sounds', true);

                const stub = jasmine.createSpyObj('MyAudio', ['play', 'canPlayType']);
                spyOn(window, 'Audio').and.returnValue(stub);

                const view = _converse.chatboxviews.get('lounge@montague.lit');
                if (!view.querySelectorAll('.chat-area').length) {
                    view.renderChatArea();
                }
                let text = 'This message will play a sound because it mentions romeo';
                let message = $msg({
                    from: 'lounge@montague.lit/otheruser',
                    id: '1',
                    to: 'romeo@montague.lit',
                    type: 'groupchat'
                }).c('body').t(text);
                _converse.api.settings.set('notify_all_room_messages', true);
                await view.model.handleMessageStanza(message.nodeTree);
                await u.waitUntil(() => window.Audio.calls.count());
                expect(window.Audio).toHaveBeenCalled();

                text = "This message won't play a sound";
                message = $msg({
                    from: 'lounge@montague.lit/otheruser',
                    id: '2',
                    to: 'romeo@montague.lit',
                    type: 'groupchat'
                }).c('body').t(text);
                await view.model.handleMessageStanza(message.nodeTree);
                expect(window.Audio, 1);
                api.settings.set('play_sounds', false);

                text = "This message won't play a sound because it is sent by romeo";
                message = $msg({
                    from: 'lounge@montague.lit/romeo',
                    id: '3',
                    to: 'romeo@montague.lit',
                    type: 'groupchat'
                }).c('body').t(text);
                await view.model.handleMessageStanza(message.nodeTree);
                expect(window.Audio, 1);
            }));
        });
    });


    describe("A Favicon Message Counter", function () {

        it("is incremented when the message is received and the window is not focused",
                mock.initConverse([], {'show_tab_notifications': false}, async function (_converse) {

            await mock.waitForRoster(_converse, 'current');
            await mock.openControlBox(_converse);

            const favico = jasmine.createSpyObj('favico', ['badge']);
            spyOn(converse.env, 'Favico').and.returnValue(favico);

            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const previous_state = _converse.windowState;
            const msg = $msg({
                    from: sender_jid,
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: u.getUniqueId()
                }).c('body').t('This message will increment the message counter').up()
                  .c('active', {'xmlns': Strophe.NS.CHATSTATES}).tree();
            _converse.windowState = 'hidden';

            spyOn(_converse.api, "trigger").and.callThrough();

            await _converse.handleMessageStanza(msg);
            expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));

            expect(favico.badge.calls.count()).toBe(0);

            _converse.api.settings.set('show_tab_notifications', true);
            const msg2 = $msg({
                    from: sender_jid,
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: u.getUniqueId()
                }).c('body').t('This message increment the message counter AND update the page title').up()
                  .c('active', {'xmlns': Strophe.NS.CHATSTATES}).tree();

            await _converse.handleMessageStanza(msg2);
            await u.waitUntil(() => favico.badge.calls.count() === 1);
            expect(favico.badge.calls.mostRecent().args.pop()).toBe(2);

            const view = _converse.chatboxviews.get(sender_jid);
            expect(view.model.get('num_unread')).toBe(2);

            // Check that it's cleared when the window is focused
            _converse.windowState = 'hidden';
            _converse.saveWindowState({'type': 'focus'});
            await u.waitUntil(() => favico.badge.calls.count() === 2);
            expect(favico.badge.calls.mostRecent().args.pop()).toBe(0);

            expect(view.model.get('num_unread')).toBe(0);
            _converse.windowSate = previous_state;
        }));

        it("is not incremented when the message is received and the window is focused",
                mock.initConverse([], {}, async function (_converse) {

            await mock.waitForRoster(_converse, 'current');
            await mock.openControlBox(_converse);

            const favico = jasmine.createSpyObj('favico', ['badge']);
            spyOn(converse.env, 'Favico').and.returnValue(favico);

            _converse.saveWindowState({'type': 'focus'});
            const message = 'This message will not increment the message counter';
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit',
                msg = $msg({
                    from: sender_jid,
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: u.getUniqueId()
                }).c('body').t(message).up()
                  .c('active', {'xmlns': Strophe.NS.CHATSTATES}).tree();
            await _converse.handleMessageStanza(msg);

            const promise = u.getOpenPromise();
            setTimeout(() => {
                const view = _converse.chatboxviews.get(sender_jid);
                expect(view.model.get('num_unread')).toBe(0);
                expect(favico.badge.calls.count()).toBe(0);
                promise.resolve();
            }, 500);
            return promise;
        }));

        it("is incremented from zero when chatbox was closed after viewing previously received messages and the window is not focused now",
                mock.initConverse([], {}, async function (_converse) {

            await mock.waitForRoster(_converse, 'current');
            const favico = jasmine.createSpyObj('favico', ['badge']);
            spyOn(converse.env, 'Favico').and.returnValue(favico);
            const message = 'This message will always increment the message counter from zero';
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const msgFactory = () => $msg({
                    from: sender_jid,
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: u.getUniqueId()
                })
                .c('body').t(message).up()
                .c('active', {'xmlns': Strophe.NS.CHATSTATES})
                .tree();

            // leave converse-chat page
            _converse.windowState = 'hidden';
            await _converse.handleMessageStanza(msgFactory());
            let view = _converse.chatboxviews.get(sender_jid);
            await u.waitUntil(() => favico.badge.calls.count() === 1, 1000);
            expect(favico.badge.calls.mostRecent().args.pop()).toBe(1);
            expect(view.model.get('num_unread')).toBe(1);

            // come back to converse-chat page
            _converse.saveWindowState({'type': 'focus'});


            await u.waitUntil(() => u.isVisible(view));
            expect(view.model.get('num_unread')).toBe(0);

            await u.waitUntil(() => favico.badge.calls.count() === 2);
            expect(favico.badge.calls.mostRecent().args.pop()).toBe(0);

            // close chatbox and leave converse-chat page again
            view.close();
            _converse.windowState = 'hidden';

            // check that msg_counter is incremented from zero again
            await _converse.handleMessageStanza(msgFactory());
            view = _converse.chatboxviews.get(sender_jid);
            await u.waitUntil(() => u.isVisible(view));
            await u.waitUntil(() => favico.badge.calls.count() === 3);
            expect(favico.badge.calls.mostRecent().args.pop()).toBe(1);
        }));
    });

});
