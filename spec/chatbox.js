(function (root, factory) {
    define([
        "jquery",
        "jasmine",
        "utils",
        "converse-core",
        "mock",
        "test-utils"
        ], factory);
} (this, function ($, jasmine, utils, converse, mock, test_utils) {
    "use strict";
    var _ = converse.env._;
    var $iq = converse.env.$iq;
    var $msg = converse.env.$msg;
    var Strophe = converse.env.Strophe;
    var Promise = converse.env.Promise;
    var moment = converse.env.moment;
    var u = converse.env.utils;

    return describe("Chatboxes", function () {

        describe("A Chatbox", function () {

            it("has a /help command to show the available commands",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();

                var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                test_utils.openChatBoxFor(_converse, contact_jid);
                var view = _converse.chatboxviews.get(contact_jid);
                test_utils.sendMessage(view, '/help');

                const info_messages = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info:not(.chat-date)'), 0);
                expect(info_messages.length).toBe(3);
                expect(info_messages.pop().textContent).toBe('/help: Show this menu');
                expect(info_messages.pop().textContent).toBe('/me: Write in the third person');
                expect(info_messages.pop().textContent).toBe('/clear: Remove messages');

                var msg = $msg({
                        from: contact_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: (new Date()).getTime()
                    }).c('body').t('hello world').tree();
                _converse.chatboxes.onMessage(msg);
                expect(view.content.lastElementChild.textContent.trim().indexOf('hello world')).not.toBe(-1);
                done();
            }));


            it("supports the /me command",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var view;
                test_utils.createContacts(_converse, 'current');
                test_utils.waitUntilDiscoConfirmed(_converse, 'localhost', [], ['vcard-temp'])
                .then(function () {
                    return test_utils.waitUntil(function () {
                        return _converse.xmppstatus.get('fullname');
                    }, 300);
                }).then(function () {
                    test_utils.openControlBox();
                    expect(_converse.chatboxes.length).toEqual(1);
                    var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    var message = '/me is tired';
                    var msg = $msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: (new Date()).getTime()
                        }).c('body').t(message).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();

                    _converse.chatboxes.onMessage(msg);
                    view = _converse.chatboxviews.get(sender_jid);

                    test_utils.waitUntil(function () {
                        return u.isVisible(view.el);
                    }).then(function () {
                        expect(_.includes(view.el.querySelector('.chat-msg-author').textContent, '**Max Frankfurter')).toBeTruthy();
                        expect($(view.el).find('.chat-msg-text').text()).toBe(' is tired');

                        message = '/me is as well';
                        test_utils.sendMessage(view, message);
                        expect(_.includes($(view.el).find('.chat-msg-author:last').text(), '**Max Mustermann')).toBeTruthy();
                        expect($(view.el).find('.chat-msg-text:last').text()).toBe(' is as well');
                        done();
                    });
                });
            }));

            it("is created when you click on a roster item",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();

                var i, $el, jid, chatboxview;
                // openControlBox was called earlier, so the controlbox is
                // visible, but no other chat boxes have been created.
                expect(_converse.chatboxes.length).toEqual(1);
                spyOn(_converse.chatboxviews, 'trimChats');
                expect($("#conversejs .chatbox").length).toBe(1); // Controlbox is open

                test_utils.waitUntil(function () {
                    return $(_converse.rosterview.el).find('.roster-group li').length;
                }, 700).then(function () {
                    var online_contacts = $(_converse.rosterview.el).find('.roster-group .current-xmpp-contact a.open-chat');
                    expect(online_contacts.length).toBe(15);
                    for (i=0; i<online_contacts.length; i++) {
                        $el = $(online_contacts[i]);
                        jid = $el.text().trim().replace(/ /g,'.').toLowerCase() + '@localhost';
                        $el[0].click();
                        chatboxview = _converse.chatboxviews.get(jid);
                        expect(_converse.chatboxes.length).toEqual(i+2);
                        expect(_converse.chatboxviews.trimChats).toHaveBeenCalled();
                        // Check that new chat boxes are created to the left of the
                        // controlbox (but to the right of all existing chat boxes)
                        expect($("#conversejs .chatbox").length).toBe(i+2);
                        expect($("#conversejs .chatbox")[1].id).toBe(chatboxview.model.get('box_id'));
                    }
                    done();
                });
            }));

            it("can be trimmed to conserve space",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();

                var i, $el, jid, chatbox, chatboxview, trimmedview;
                // openControlBox was called earlier, so the controlbox is
                // visible, but no other chat boxes have been created.
                var trimmed_chatboxes = _converse.minimized_chats;
                expect(_converse.chatboxes.length).toEqual(1);
                spyOn(_converse.chatboxviews, 'trimChats');
                spyOn(trimmed_chatboxes, 'addChat').and.callThrough();
                spyOn(trimmed_chatboxes, 'removeChat').and.callThrough();
                expect($("#conversejs .chatbox").length).toBe(1); // Controlbox is open

                _converse.rosterview.update(); // XXX: Hack to make sure $roster element is attached.
                test_utils.waitUntil(function () {
                    return $(_converse.rosterview.el).find('.roster-group li').length;
                }, 700).then(function () {
                    // Test that they can be maximized again
                    var online_contacts = $(_converse.rosterview.el).find('.roster-group .current-xmpp-contact a.open-chat');
                    expect(online_contacts.length).toBe(15);
                    for (i=0; i<online_contacts.length; i++) {
                        $el = $(online_contacts[i]);
                        jid = _.trim($el.text().trim()).replace(/ /g,'.').toLowerCase() + '@localhost';
                        $el[0].click();
                        expect(_converse.chatboxviews.trimChats).toHaveBeenCalled();

                        chatboxview = _converse.chatboxviews.get(jid);
                        spyOn(chatboxview, 'minimize').and.callThrough();
                        chatboxview.model.set({'minimized': true});
                        expect(trimmed_chatboxes.addChat).toHaveBeenCalled();
                        expect(chatboxview.minimize).toHaveBeenCalled();
                    }
                    return test_utils.waitUntil(function () {
                        return _converse.chatboxviews.keys().length > 1;
                    }, 500);
                }).then(function () {
                    var key = _converse.chatboxviews.keys()[1];
                    trimmedview = trimmed_chatboxes.get(key);
                    chatbox = trimmedview.model;
                    spyOn(chatbox, 'maximize').and.callThrough();
                    spyOn(trimmedview, 'restore').and.callThrough();
                    trimmedview.delegateEvents();
                    trimmedview.el.querySelector("a.restore-chat").click();

                    expect(trimmedview.restore).toHaveBeenCalled();
                    expect(chatbox.maximize).toHaveBeenCalled();
                    expect(_converse.chatboxviews.trimChats).toHaveBeenCalled();
                    done();
                });
                done();
            }));

            it("can be opened in minimized mode initially",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');

                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                var chat = _converse.api.chats.create(sender_jid, {
                    minimized: true
                });

                var chatBoxView = _converse.chatboxviews.get(sender_jid);
                expect(u.isVisible(chatBoxView.el)).toBeFalsy();

                var minimized_chat = _converse.minimized_chats.get(sender_jid);
                expect(minimized_chat).toBeTruthy();
                expect($(minimized_chat.el).is(':visible')).toBeTruthy();
                done();
            }));


            it("is focused if its already open and you click on its corresponding roster item",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                _converse.rosterview.update(); // XXX: Hack to make sure $roster element is attaced.
                test_utils.openControlBox();

                var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                var $el, jid, chatbox;
                // openControlBox was called earlier, so the controlbox is
                // visible, but no other chat boxes have been created.
                expect(_converse.chatboxes.length).toEqual(1);

                chatbox = test_utils.openChatBoxFor(_converse, contact_jid);
                $el = $(_converse.rosterview.el).find('a.open-chat:contains("'+chatbox.get('fullname')+'")');
                jid = $el.text().replace(/ /g,'.').toLowerCase() + '@localhost';

                spyOn(_converse, 'emit');
                $el[0].click();
                test_utils.waitUntil(function () {
                    return _converse.emit.calls.count();
                }, 300).then(function () {
                    expect(_converse.chatboxes.length).toEqual(2);
                    expect(_converse.emit).toHaveBeenCalledWith('chatBoxFocused', jasmine.any(Object));
                    done();
                });
            }));

            it("can be saved to, and retrieved from, browserStorage",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();

                spyOn(_converse, 'emit');
                spyOn(_converse.chatboxviews, 'trimChats');
                test_utils.openControlBox();

                test_utils.openChatBoxes(_converse, 6);
                expect(_converse.chatboxviews.trimChats).toHaveBeenCalled();
                // We instantiate a new ChatBoxes collection, which by default
                // will be empty.
                var newchatboxes = new _converse.ChatBoxes();
                expect(newchatboxes.length).toEqual(0);
                // The chatboxes will then be fetched from browserStorage inside the
                // onConnected method
                newchatboxes.onConnected();
                expect(newchatboxes.length).toEqual(7);
                // Check that the chatboxes items retrieved from browserStorage
                // have the same attributes values as the original ones.
                var attrs = ['id', 'box_id', 'visible'];
                var new_attrs, old_attrs;
                for (var i=0; i<attrs.length; i++) {
                    new_attrs = _.map(_.map(newchatboxes.models, 'attributes'), attrs[i]);
                    old_attrs = _.map(_.map(_converse.chatboxes.models, 'attributes'), attrs[i]);
                    expect(_.isEqual(new_attrs, old_attrs)).toEqual(true);
                }
                _converse.rosterview.render();
                done();
            }));

            it("can be closed by clicking a DOM element with class 'close-chatbox-button'",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();
                test_utils.waitUntil(function () {
                    return $(_converse.rosterview.el).find('.roster-group').length;
                }, 300).then(function () {
                    var chatbox = test_utils.openChatBoxes(_converse, 1)[0],
                        controlview = _converse.chatboxviews.get('controlbox'), // The controlbox is currently open
                        chatview = _converse.chatboxviews.get(chatbox.get('jid'));
                    spyOn(chatview, 'close').and.callThrough();
                    spyOn(controlview, 'close').and.callThrough();
                    spyOn(_converse, 'emit');

                    // We need to rebind all events otherwise our spy won't be called
                    controlview.delegateEvents();
                    chatview.delegateEvents();

                    controlview.el.querySelector('.close-chatbox-button').click();

                    expect(controlview.close).toHaveBeenCalled();
                    expect(_converse.emit).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                    expect(_converse.emit.calls.count(), 1);
                    chatview.el.querySelector('.close-chatbox-button').click();

                    expect(chatview.close).toHaveBeenCalled();
                    expect(_converse.emit).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                    expect(_converse.emit.calls.count(), 2);
                    done();
                });
            }));

            it("can be minimized by clicking a DOM element with class 'toggle-chatbox-button'",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var chatview;
                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();
                test_utils.waitUntil(function () {
                        return $(_converse.rosterview.el).find('.roster-group').length;
                    }, 300)
                .then(function () {
                    var chatbox = test_utils.openChatBoxes(_converse, 1)[0],
                        trimmed_chatboxes = _converse.minimized_chats,
                        trimmedview;
                    chatview = _converse.chatboxviews.get(chatbox.get('jid'));
                    spyOn(chatview, 'minimize').and.callThrough();
                    spyOn(_converse, 'emit');
                    // We need to rebind all events otherwise our spy won't be called
                    chatview.delegateEvents();

                    chatview.el.querySelector('.toggle-chatbox-button').click();

                    expect(chatview.minimize).toHaveBeenCalled();
                    expect(_converse.emit).toHaveBeenCalledWith('chatBoxMinimized', jasmine.any(Object));
                    expect(_converse.emit.calls.count(), 2);
                    expect(u.isVisible(chatview.el)).toBeFalsy();
                    expect(chatview.model.get('minimized')).toBeTruthy();
                    chatview.el.querySelector('.toggle-chatbox-button').click();
                    trimmedview = trimmed_chatboxes.get(chatview.model.get('id'));
                    spyOn(trimmedview, 'restore').and.callThrough();
                    trimmedview.delegateEvents();
                    trimmedview.el.querySelector("a.restore-chat").click();

                    expect(trimmedview.restore).toHaveBeenCalled();
                    expect(_converse.emit).toHaveBeenCalledWith('chatBoxMaximized', jasmine.any(Object));
                    return test_utils.waitUntil(function () {
                        return $(chatview.el).find('.chat-body').is(':visible');
                    }, 500);
                }).then(function () {
                    expect($(chatview.el).find('.toggle-chatbox-button').hasClass('fa-minus')).toBeTruthy();
                    expect($(chatview.el).find('.toggle-chatbox-button').hasClass('fa-plus')).toBeFalsy();
                    expect(chatview.model.get('minimized')).toBeFalsy();
                    done();
                });
            }));

            it("will be removed from browserStorage when closed",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();
                test_utils.waitUntil(function () {
                    return $(_converse.rosterview.el).find('.roster-group').length;
                }, 300).then(function () {
                    spyOn(_converse, 'emit');
                    spyOn(_converse.chatboxviews, 'trimChats');
                    _converse.chatboxes.browserStorage._clear();

                    test_utils.closeControlBox();

                    expect(_converse.emit).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                    expect(_converse.chatboxes.length).toEqual(1);
                    expect(_converse.chatboxes.pluck('id')).toEqual(['controlbox']);
                    test_utils.openChatBoxes(_converse, 6);
                    expect(_converse.chatboxviews.trimChats).toHaveBeenCalled();
                    expect(_converse.chatboxes.length).toEqual(7);
                    expect(_converse.emit).toHaveBeenCalledWith('chatBoxOpened', jasmine.any(Object));
                    test_utils.closeAllChatBoxes(_converse);

                    expect(_converse.chatboxes.length).toEqual(1);
                    expect(_converse.chatboxes.pluck('id')).toEqual(['controlbox']);
                    expect(_converse.emit).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                    var newchatboxes = new _converse.ChatBoxes();
                    expect(newchatboxes.length).toEqual(0);
                    expect(_converse.chatboxes.pluck('id')).toEqual(['controlbox']);
                    // onConnected will fetch chatboxes in browserStorage, but
                    // because there aren't any open chatboxes, there won't be any
                    // in browserStorage either. XXX except for the controlbox
                    newchatboxes.onConnected();
                    expect(newchatboxes.length).toEqual(1);
                    expect(newchatboxes.models[0].id).toBe("controlbox");
                    done();
                });
            }));

            describe("A chat toolbar", function () {

                it("can be found on each chat box",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();

                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    var chatbox = _converse.chatboxes.get(contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    expect(chatbox).toBeDefined();
                    expect(view).toBeDefined();
                    var $toolbar = $(view.el).find('ul.chat-toolbar');
                    expect($toolbar.length).toBe(1);
                    expect($toolbar.children('li').length).toBe(2);
                    done();
                }));

                it("contains a button for inserting emojis",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();

                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    var toolbar = view.el.querySelector('ul.chat-toolbar');
                    expect(toolbar.querySelectorAll('li.toggle-smiley').length).toBe(1);
                    // Register spies
                    spyOn(view, 'toggleEmojiMenu').and.callThrough();
                    spyOn(view, 'insertEmoji').and.callThrough();

                    view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                    toolbar.querySelector('li.toggle-smiley').click();

                    var timeout = false;

                    test_utils.waitUntil(function () {
                        return utils.isVisible(view.el.querySelector('.toggle-smiley .emoji-picker-container'));
                    }, 150).then(function () {
                        var picker = view.el.querySelector('.toggle-smiley .emoji-picker-container');
                        var items = picker.querySelectorAll('.emoji-picker li');
                        items[0].click()
                        expect(view.insertEmoji).toHaveBeenCalled();

                        setTimeout(function () { timeout = true; }, 100);
                        return test_utils.waitUntil(function () {
                            return timeout;
                        }, 300);
                    }).then(function () {
                        timeout = false;
                        toolbar.querySelector('li.toggle-smiley').click(); // Close the panel again
                        return test_utils.waitUntil(function () {
                            return !view.el.querySelector('.toggle-smiley .toolbar-menu').offsetHeight;
                        }, 300);
                    }).then(function () {
                        setTimeout(function () { timeout = true; }, 100);
                        return test_utils.waitUntil(function () {
                            return timeout;
                        }, 300);
                    }).then(function () {
                        toolbar.querySelector('li.toggle-smiley').click();
                        expect(view.toggleEmojiMenu).toHaveBeenCalled();
                        return test_utils.waitUntil(function () {
                            var $picker = $(view.el).find('.toggle-smiley .emoji-picker-container');
                            return u.isVisible($picker[0]);
                        }, 300);
                    }).then(function () {
                        var nodes = view.el.querySelectorAll('.toggle-smiley ul li');
                        nodes[nodes.length-1].click();
                        expect(view.el.querySelector('textarea.chat-textarea').value).toBe(':grinning: ');
                        expect(view.insertEmoji).toHaveBeenCalled();
                        done();
                    }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                }));

                it("contains a button for starting an encrypted chat session",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    var timeout = true, $toolbar, view;
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();

                    test_utils.waitUntil(function () {
                        return $(_converse.rosterview.el).find('.roster-group').length;
                    }, 300).then(function () {
                        // TODO: More tests can be added here...
                        var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                        test_utils.openChatBoxFor(_converse, contact_jid);
                        view = _converse.chatboxviews.get(contact_jid);
                        $toolbar = $(view.el).find('ul.chat-toolbar');
                        expect($toolbar.find('.toggle-otr').length).toBe(1);
                        // Register spies
                        spyOn(view, 'toggleOTRMenu').and.callThrough();
                        view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called

                        timeout = false;
                        $toolbar[0].querySelector('.toggle-otr').click();
                        return test_utils.waitUntil(function () {
                            return view.el.querySelector('.otr-menu').offsetHeight;
                        }, 300)
                    }).then(function () {
                        expect(view.toggleOTRMenu).toHaveBeenCalled();
                        done();
                    });
                }));

                it("can contain a button for starting a call",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();

                    var view;
                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                    spyOn(_converse, 'emit');
                    // First check that the button doesn't show if it's not enabled
                    // via "visible_toolbar_buttons"
                    _converse.visible_toolbar_buttons.call = false;
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    view = _converse.chatboxviews.get(contact_jid);
                    var toolbar = view.el.querySelector('ul.chat-toolbar');
                    var call_button = toolbar.querySelector('.toggle-call');
                    expect(_.isNull(call_button)).toBeTruthy();
                    view.close();
                    // Now check that it's shown if enabled and that it emits
                    // callButtonClicked
                    _converse.visible_toolbar_buttons.call = true; // enable the button
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    view = _converse.chatboxviews.get(contact_jid);
                    toolbar = view.el.querySelector('ul.chat-toolbar');
                    call_button = toolbar.querySelector('.toggle-call');
                    call_button.click();
                    expect(_converse.emit).toHaveBeenCalledWith('callButtonClicked', jasmine.any(Object));
                    done();
                }));
            });

            describe("A Chat Message", function () {

                describe("when received from someone else", function () {

                    it("will open a chatbox and be displayed inside it",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.waitUntil(function () {
                                return $(_converse.rosterview.el).find('.roster-group').length;
                            }, 300)
                        .then(function () {
                            spyOn(_converse, 'emit');
                            var message = 'This is a received message';
                            var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                            var msg = $msg({
                                    from: sender_jid,
                                    to: _converse.connection.jid,
                                    type: 'chat',
                                    id: (new Date()).getTime()
                                }).c('body').t(message).up()
                                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();

                            // We don't already have an open chatbox for this user
                            expect(_converse.chatboxes.get(sender_jid)).not.toBeDefined();

                            // onMessage is a handler for received XMPP messages
                            _converse.chatboxes.onMessage(msg);
                            expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));

                            // Check that the chatbox and its view now exist
                            var chatbox = _converse.chatboxes.get(sender_jid);
                            var chatboxview = _converse.chatboxviews.get(sender_jid);
                            expect(chatbox).toBeDefined();
                            expect(chatboxview).toBeDefined();
                            // Check that the message was received and check the message parameters
                            expect(chatbox.messages.length).toEqual(1);
                            var msg_obj = chatbox.messages.models[0];
                            expect(msg_obj.get('message')).toEqual(message);
                            expect(msg_obj.get('fullname')).toEqual(mock.cur_names[0]);
                            expect(msg_obj.get('sender')).toEqual('them');
                            expect(msg_obj.get('delayed')).toEqual(false);
                            // Now check that the message appears inside the chatbox in the DOM
                            var chat_content = chatboxview.el.querySelector('.chat-content');
                            expect(chat_content.querySelector('.chat-msg .chat-msg-text').textContent).toEqual(message);
                            expect(chat_content.querySelector('.chat-msg-time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
                            expect(chat_content.querySelector('span.chat-msg-author').textContent).toBe('Max Frankfurter');
                            done();
                        });
                    }));

                    describe("when a chatbox is opened for someone who is not in the roster", function () {

                        it("the VCard for that user is fetched and the chatbox updated with the results",
                            mock.initConverseWithPromises(
                                null, ['rosterGroupsFetched'], {},
                                function (done, _converse) {

                            _converse.allow_non_roster_messaging = true;
                            spyOn(_converse, 'emit').and.callThrough();

                            var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                            var vcard_fetched = false;
                            spyOn(_converse.api.vcard, "get").and.callFake(function () {
                                vcard_fetched = true;
                                return Promise.resolve({
                                    'fullname': mock.cur_names[0],
                                    'vcard_updated': moment().format(),
                                    'jid': sender_jid
                                });
                            });
                            var message = 'This is a received message from someone not on the roster';
                            var msg = $msg({
                                    from: sender_jid,
                                    to: _converse.connection.jid,
                                    type: 'chat',
                                    id: (new Date()).getTime()
                                }).c('body').t(message).up()
                                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();

                            // We don't already have an open chatbox for this user
                            expect(_converse.chatboxes.get(sender_jid)).not.toBeDefined();

                            _converse.chatboxes.onMessage(msg);
                            expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));

                            // Check that the chatbox and its view now exist
                            var chatbox = _converse.chatboxes.get(sender_jid);
                            var chatboxview = _converse.chatboxviews.get(sender_jid);
                            expect(chatbox).toBeDefined();
                            expect(chatboxview).toBeDefined();

                            var author_el = chatboxview.el.querySelector('.chat-msg-author');
                            expect(chatbox.get('fullname') === sender_jid);
                            expect( _.includes(author_el.textContent, 'max.frankfurter@localhost')).toBeTruthy();

                            test_utils.waitUntil(function () { return vcard_fetched; }, 100)
                            .then(function () {
                                expect(_converse.api.vcard.get).toHaveBeenCalled();
                                return test_utils.waitUntil(function () {
                                    return chatbox.get('fullname') === mock.cur_names[0];
                                }, 100);
                            }).then(function () {
                                var author_el = chatboxview.el.querySelector('.chat-msg-author');
                                expect( _.includes(author_el.textContent, 'Max Frankfurter')).toBeTruthy();
                                done();
                            });
                        }));
                    });

                    describe("who is not on the roster", function () {

                        it("will open a chatbox and be displayed inside it if allow_non_roster_messaging is true",
                            mock.initConverseWithPromises(
                                null, ['rosterGroupsFetched'], {},
                                function (done, _converse) {

                            _converse.allow_non_roster_messaging = false;

                            spyOn(_converse, 'emit');
                            var message = 'This is a received message from someone not on the roster';
                            var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                            var msg = $msg({
                                    from: sender_jid,
                                    to: _converse.connection.jid,
                                    type: 'chat',
                                    id: (new Date()).getTime()
                                }).c('body').t(message).up()
                                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();

                            // We don't already have an open chatbox for this user
                            expect(_converse.chatboxes.get(sender_jid)).not.toBeDefined();

                            var chatbox = _converse.chatboxes.get(sender_jid);
                            expect(chatbox).not.toBeDefined();

                            // onMessage is a handler for received XMPP messages
                            _converse.chatboxes.onMessage(msg);
                            expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));

                            // onMessage is a handler for received XMPP messages
                            _converse.allow_non_roster_messaging =true;
                            _converse.chatboxes.onMessage(msg);
                            expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));

                            // Check that the chatbox and its view now exist
                            chatbox = _converse.chatboxes.get(sender_jid);
                            var chatboxview = _converse.chatboxviews.get(sender_jid);
                            expect(chatbox).toBeDefined();
                            expect(chatboxview).toBeDefined();
                            // Check that the message was received and check the message parameters
                            expect(chatbox.messages.length).toEqual(1);
                            var msg_obj = chatbox.messages.models[0];
                            expect(msg_obj.get('message')).toEqual(message);
                            expect(msg_obj.get('fullname')).toEqual(undefined);
                            expect(msg_obj.get('sender')).toEqual('them');
                            expect(msg_obj.get('delayed')).toEqual(false);
                            // Now check that the message appears inside the chatbox in the DOM
                            var chat_content = chatboxview.el.querySelector('.chat-content');
                            expect(chat_content.querySelector('.chat-msg .chat-msg-text').textContent).toEqual(message);
                            expect(chat_content.querySelector('.chat-msg-time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
                            expect(chat_content.querySelector('span.chat-msg-author').textContent).toBe('max.frankfurter@localhost');
                            done();
                        }));
                    });

                    describe("and for which then an error message is received from the server", function () {

                        it("will have the error message displayed after itself",
                            mock.initConverseWithPromises(
                                null, ['rosterGroupsFetched'], {},
                                function (done, _converse) {

                            test_utils.createContacts(_converse, 'current');
                            test_utils.openControlBox();

                            // TODO: what could still be done for error
                            // messages... if the <error> element has type
                            // "cancel", then we know the messages wasn't sent,
                            // and can give the user a nicer indication of
                            // that.

                            /* <message from="scotty@enterprise.com/_converse.js-84843526"
                             *          to="kirk@enterprise.com.com"
                             *          type="chat"
                             *          id="82bc02ce-9651-4336-baf0-fa04762ed8d2"
                             *          xmlns="jabber:client">
                             *      <body>yo</body>
                             *      <active xmlns="http://jabber.org/protocol/chatstates"/>
                             *  </message>
                             */
                            var sender_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@localhost';
                            var fullname = _converse.xmppstatus.get('fullname');
                            fullname = _.isEmpty(fullname)? _converse.bare_jid: fullname;
                            _converse.api.chats.open(sender_jid);
                            var msg_text = 'This message will not be sent, due to an error';
                            var view = _converse.chatboxviews.get(sender_jid);
                            var message = view.model.messages.create({
                                'msgid': '82bc02ce-9651-4336-baf0-fa04762ed8d2',
                                'fullname': fullname,
                                'sender': 'me',
                                'time': moment().format(),
                                'message': msg_text
                            });
                            view.model.sendMessage(message);
                            var $chat_content = $(view.el).find('.chat-content');
                            var msg_txt = $chat_content.find('.chat-msg:last').find('.chat-msg-text').text();
                            expect(msg_txt).toEqual(msg_text);

                            // We send another message, for which an error will
                            // not be received, to test that errors appear
                            // after the relevant message.
                            msg_text = 'This message will be sent, and also receive an error';
                            message = view.model.messages.create({
                                'msgid': '6fcdeee3-000f-4ce8-a17e-9ce28f0ae104',
                                'fullname': fullname,
                                'sender': 'me',
                                'time': moment().format(),
                                'message': msg_text
                            });
                            view.model.sendMessage(message);
                            msg_txt = $chat_content.find('.chat-msg:last').find('.chat-msg-text').text();
                            expect(msg_txt).toEqual(msg_text);

                            /* <message xmlns="jabber:client"
                             *          to="scotty@enterprise.com/_converse.js-84843526"
                             *          type="error"
                             *          id="82bc02ce-9651-4336-baf0-fa04762ed8d2"
                             *          from="kirk@enterprise.com.com">
                             *     <error type="cancel">
                             *         <remote-server-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                             *         <text xmlns="urn:ietf:params:xml:ns:xmpp-stanzas">Server-to-server connection failed: Connecting failed: connection timeout</text>
                             *     </error>
                             * </message>
                             */
                            var error_txt = 'Server-to-server connection failed: Connecting failed: connection timeout';
                            var stanza = $msg({
                                    'to': _converse.connection.jid,
                                    'type':'error',
                                    'id':'82bc02ce-9651-4336-baf0-fa04762ed8d2',
                                    'from': sender_jid
                                })
                                .c('error', {'type': 'cancel'})
                                .c('remote-server-not-found', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" }).up()
                                .c('text', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" })
                                    .t('Server-to-server connection failed: Connecting failed: connection timeout');
                            _converse.connection._dataRecv(test_utils.createRequest(stanza));
                            expect($chat_content.find('.chat-error').text()).toEqual(error_txt);

                            stanza = $msg({
                                    'to': _converse.connection.jid,
                                    'type':'error',
                                    'id':'some-other-unused-id',
                                    'from': sender_jid
                                })
                                .c('error', {'type': 'cancel'})
                                .c('remote-server-not-found', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" }).up()
                                .c('text', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" })
                                    .t('Server-to-server connection failed: Connecting failed: connection timeout');
                            _converse.connection._dataRecv(test_utils.createRequest(stanza));
                            expect($chat_content.find('.chat-error').length).toEqual(2);

                            // If the last message is already an error message,
                            // then we don't render it another time.
                            stanza = $msg({
                                    'to': _converse.connection.jid,
                                    'type':'error',
                                    'id':'another-unused-id',
                                    'from': sender_jid
                                })
                                .c('error', {'type': 'cancel'})
                                .c('remote-server-not-found', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" }).up()
                                .c('text', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" })
                                    .t('Server-to-server connection failed: Connecting failed: connection timeout');
                            _converse.connection._dataRecv(test_utils.createRequest(stanza));
                            expect($chat_content.find('.chat-error').length).toEqual(2);

                            // A different error message will however render
                            stanza = $msg({
                                    'to': _converse.connection.jid,
                                    'type':'error',
                                    'id':'another-id',
                                    'from': sender_jid
                                })
                                .c('error', {'type': 'cancel'})
                                .c('remote-server-not-found', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" }).up()
                                .c('text', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" })
                                    .t('Something else went wrong as well');
                            _converse.connection._dataRecv(test_utils.createRequest(stanza));
                            expect($chat_content.find('.chat-error').length).toEqual(3);
                            done();
                        }));
                    });

                    it("will cause the chat area to be scrolled down only if it was at the bottom originally",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();

                        var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                        test_utils.openChatBoxFor(_converse, sender_jid);

                        var chatboxview = _converse.chatboxviews.get(sender_jid);
                        spyOn(chatboxview, 'onScrolledDown').and.callThrough();

                        // Create enough messages so that there's a scrollbar.
                        var message = 'This message is received while the chat area is scrolled up';
                        for (var i=0; i<20; i++) {
                            _converse.chatboxes.onMessage($msg({
                                    from: sender_jid,
                                    to: _converse.connection.jid,
                                    type: 'chat',
                                    id: (new Date()).getTime()
                                }).c('body').t('Message: '+i).up()
                                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
                        }
                        return test_utils.waitUntil(function () {
                            return chatboxview.content.scrollTop;
                        }, 1000).then(function () {
                            return test_utils.waitUntil(function () {
                                return !chatboxview.model.get('auto_scrolled');
                            }, 500);
                        }).then(function () {
                            chatboxview.content.scrollTop = 0;
                            return test_utils.waitUntil(function () {
                                return chatboxview.model.get('scrolled');
                            }, 900);
                        }).then(function () {
                            _converse.chatboxes.onMessage($msg({
                                    from: sender_jid,
                                    to: _converse.connection.jid,
                                    type: 'chat',
                                    id: (new Date()).getTime()
                                }).c('body').t(message).up()
                                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());

                            // Now check that the message appears inside the chatbox in the DOM
                            var $chat_content = $(chatboxview.el).find('.chat-content');
                            var msg_txt = $chat_content.find('.chat-msg:last').find('.chat-msg-text').text();
                            expect(msg_txt).toEqual(message);
                            return test_utils.waitUntil(function () {
                                return u.isVisible(chatboxview.el.querySelector('.new-msgs-indicator'));
                            }, 500);
                        }).then(function () {
                            expect(chatboxview.model.get('scrolled')).toBe(true);
                            expect(chatboxview.content.scrollTop).toBe(0);
                            expect(u.isVisible(chatboxview.el.querySelector('.new-msgs-indicator'))).toBeTruthy();
                            // Scroll down again
                            chatboxview.content.scrollTop = chatboxview.content.scrollHeight;
                            return test_utils.waitUntil(function () {
                                return !u.isVisible(chatboxview.el.querySelector('.new-msgs-indicator'));
                            }, 700);
                        }).then(done);
                    }));

                    it("is ignored if it's intended for a different resource and filter_by_resource is set to true",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();

                        test_utils.waitUntil(function () {
                                return $(_converse.rosterview.el).find('.roster-group').length;
                            }, 300)
                        .then(function () {
                            // Send a message from a different resource
                            var message, sender_jid, msg;
                            spyOn(_converse, 'log');
                            spyOn(_converse.chatboxes, 'getChatBox').and.callThrough();
                            _converse.filter_by_resource = true;
                            sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                            msg = $msg({
                                    from: sender_jid,
                                    to: _converse.bare_jid+"/some-other-resource",
                                    type: 'chat',
                                    id: (new Date()).getTime()
                                }).c('body').t("This message will not be shown").up()
                                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                            _converse.chatboxes.onMessage(msg);

                            expect(_converse.log).toHaveBeenCalledWith(
                                    "onMessage: Ignoring incoming message intended for a different resource: dummy@localhost/some-other-resource",
                                    Strophe.LogLevel.INFO);
                            expect(_converse.chatboxes.getChatBox).not.toHaveBeenCalled();
                            _converse.filter_by_resource = false;

                            message = "This message sent to a different resource will be shown";
                            msg = $msg({
                                    from: sender_jid,
                                    to: _converse.bare_jid+"/some-other-resource",
                                    type: 'chat',
                                    id: '134234623462346'
                                }).c('body').t(message).up()
                                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                            _converse.chatboxes.onMessage(msg);

                            expect(_converse.chatboxes.getChatBox).toHaveBeenCalled();
                            var chatboxview = _converse.chatboxviews.get(sender_jid);
                            var $chat_content = $(chatboxview.el).find('.chat-content:last');
                            var msg_txt = $chat_content.find('.chat-msg').find('.chat-msg-text').text();
                            expect(msg_txt).toEqual(message);
                            done();
                        });
                    }));
                });

                it("can be received out of order, and will still be displayed in the right order",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {


                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();

                    test_utils.waitUntil(function () {
                            return $(_converse.rosterview.el).find('.roster-group').length;
                        }, 300)
                    .then(function () {
                        var message, msg;
                        spyOn(_converse, 'log');
                        spyOn(_converse.chatboxes, 'getChatBox').and.callThrough();
                        _converse.filter_by_resource = true;
                        var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';

                        /*  <message id='aeb213' to='juliet@capulet.lit/chamber'>
                         *    <forwarded xmlns='urn:xmpp:forward:0'>
                         *      <delay xmlns='urn:xmpp:delay' stamp='2010-07-10T23:08:25Z'/>
                         *      <message xmlns='jabber:client'
                         *          to='juliet@capulet.lit/balcony'
                         *          from='romeo@montague.lit/orchard'
                         *          type='chat'>
                         *          <body>Call me but love, and I'll be new baptized; Henceforth I never will be Romeo.</body>
                         *      </message>
                         *    </forwarded>
                         *  </message>
                         */
                        msg = $msg({'id': 'aeb213', 'to': _converse.bare_jid})
                            .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                                .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':'2018-01-02T13:08:25Z'}).up()
                                .c('message', {
                                    'xmlns': 'jabber:client',
                                    'to': _converse.bare_jid,
                                    'from': sender_jid,
                                    'type': 'chat'})
                                .c('body').t("message")
                                .tree();
                        _converse.chatboxes.onMessage(msg);

                        msg = $msg({'id': 'aeb214', 'to': _converse.bare_jid})
                            .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                                .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':'2017-12-31T22:08:25Z'}).up()
                                .c('message', {
                                    'xmlns': 'jabber:client',
                                    'to': _converse.bare_jid,
                                    'from': sender_jid,
                                    'type': 'chat'})
                                .c('body').t("Older message")
                                .tree();
                        _converse.chatboxes.onMessage(msg);

                        msg = $msg({'id': 'aeb215', 'to': _converse.bare_jid})
                            .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                                .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':'2018-01-01T13:18:23Z'}).up()
                                .c('message', {
                                    'xmlns': 'jabber:client',
                                    'to': _converse.bare_jid,
                                    'from': sender_jid,
                                    'type': 'chat'})
                                .c('body').t("Inbetween message").up()
                                .tree();
                        _converse.chatboxes.onMessage(msg);

                        msg = $msg({'id': 'aeb216', 'to': _converse.bare_jid})
                            .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                                .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':'2018-01-01T13:18:23Z'}).up()
                                .c('message', {
                                    'xmlns': 'jabber:client',
                                    'to': _converse.bare_jid,
                                    'from': sender_jid,
                                    'type': 'chat'})
                                .c('body').t("another inbetween message")
                                .tree();
                        _converse.chatboxes.onMessage(msg);

                        msg = $msg({'id': 'aeb217', 'to': _converse.bare_jid})
                            .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                                .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':'2018-01-02T12:18:23Z'}).up()
                                .c('message', {
                                    'xmlns': 'jabber:client',
                                    'to': _converse.bare_jid,
                                    'from': sender_jid,
                                    'type': 'chat'})
                                .c('body').t("An earlier message on the next day")
                                .tree();
                        _converse.chatboxes.onMessage(msg);

                        msg = $msg({'id': 'aeb218', 'to': _converse.bare_jid})
                            .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                                .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':'2018-01-02T22:28:23Z'}).up()
                                .c('message', {
                                    'xmlns': 'jabber:client',
                                    'to': _converse.bare_jid,
                                    'from': sender_jid,
                                    'type': 'chat'})
                                .c('body').t("newer message from the next day")
                                .tree();
                        _converse.chatboxes.onMessage(msg);

                        // Insert <composing> message, to also check that
                        // text messages are inserted correctly with
                        // temporary chat events in the chat contents.
                        msg = $msg({
                                'id': 'aeb219',
                                'to': _converse.bare_jid,
                                'xmlns': 'jabber:client',
                                'from': sender_jid,
                                'type': 'chat'})
                            .c('composing', {'xmlns': Strophe.NS.CHATSTATES}).up()
                            .tree();
                        _converse.chatboxes.onMessage(msg);

                        msg = $msg({
                                'id': 'aeb220',
                                'to': _converse.bare_jid,
                                'xmlns': 'jabber:client',
                                'from': sender_jid,
                                'type': 'chat'})
                            .c('composing', {'xmlns': Strophe.NS.CHATSTATES}).up()
                            .c('body').t("latest message")
                            .tree();
                        _converse.chatboxes.onMessage(msg);

                        var chatboxview = _converse.chatboxviews.get(sender_jid);
                        var $chat_content = $(chatboxview.el).find('.chat-content');
                        chatboxview.clearSpinner(); //cleanup

                        expect($chat_content[0].querySelectorAll('.date-separator').length).toEqual(4);

                        var $day = $chat_content.find('.date-separator:first');
                        expect($day.data('isodate')).toEqual(moment('2017-12-31T00:00:00').format());

                        var $time = $chat_content.find('time:first');
                        expect($time.text()).toEqual('Sunday Dec 31st 2017')

                        $day = $chat_content.find('.date-separator:first');
                        expect($day[0].nextElementSibling.querySelector('.chat-msg-text').textContent).toBe('Older message');

                        var $el = $chat_content.find('.chat-msg:first').find('.chat-msg-text')
                        expect($el.text()).toEqual('Older message');

                        $time = $chat_content.find('time:eq(1)');
                        expect($time.text()).toEqual("Monday Jan 1st 2018");

                        $day = $chat_content.find('.date-separator:eq(1)');
                        expect($day.data('isodate')).toEqual(moment('2018-01-01T00:00:00').format());
                        expect($day[0].nextElementSibling.querySelector('.chat-msg-text').textContent).toBe('Inbetween message');

                        $el = $chat_content.find('.chat-msg:eq(1)');
                        expect($el.find('.chat-msg-text').text()).toEqual('Inbetween message');
                        expect($el[0].nextElementSibling.querySelector('.chat-msg-text').textContent).toEqual('another inbetween message');
                        $el = $chat_content.find('.chat-msg:eq(2)');
                        expect($el.find('.chat-msg-text').text()).toEqual('another inbetween message');

                        $time = $chat_content.find('time:nth(2)');
                        expect($time.text()).toEqual("Tuesday Jan 2nd 2018");

                        $day = $chat_content.find('.date-separator:nth(2)');
                        expect($day.data('isodate')).toEqual(moment('2018-01-02T00:00:00').format());
                        expect($day[0].nextElementSibling.querySelector('.chat-msg-text').textContent).toBe('An earlier message on the next day');

                        $el = $chat_content.find('.chat-msg:eq(3)');
                        expect($el.find('.chat-msg-text').text()).toEqual('An earlier message on the next day');

                        $el = $chat_content.find('.chat-msg:eq(4)');
                        expect($el.find('.chat-msg-text').text()).toEqual('message');
                        expect($el[0].nextElementSibling.querySelector('.chat-msg-text').textContent).toEqual('newer message from the next day');

                        $day = $chat_content.find('.date-separator:last');
                        expect($day.data('isodate')).toEqual(moment().startOf('day').format());
                        expect($day[0].nextElementSibling.querySelector('.chat-msg-text').textContent).toBe('latest message');
                        done();
                    });
                }));

                it("is ignored if it's a malformed headline message",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();

                    /* Ideally we wouldn't have to filter out headline
                     * messages, but Prosody gives them the wrong 'type' :(
                     */
                    sinon.spy(_converse, 'log');
                    sinon.spy(_converse.chatboxes, 'getChatBox');
                    sinon.spy(utils, 'isHeadlineMessage');
                    var msg = $msg({
                            from: 'localhost',
                            to: _converse.bare_jid,
                            type: 'chat',
                            id: (new Date()).getTime()
                        }).c('body').t("This headline message will not be shown").tree();
                    _converse.chatboxes.onMessage(msg);
                    expect(_converse.log.calledWith(
                        "onMessage: Ignoring incoming headline message sent with type 'chat' from JID: localhost",
                        Strophe.LogLevel.INFO
                    )).toBeTruthy();
                    expect(utils.isHeadlineMessage.called).toBeTruthy();
                    expect(utils.isHeadlineMessage.returned(true)).toBeTruthy();
                    expect(_converse.chatboxes.getChatBox.called).toBeFalsy();
                    // Remove sinon spies
                    _converse.log.restore();
                    _converse.chatboxes.getChatBox.restore();
                    utils.isHeadlineMessage.restore();
                    done();
                }));


                it("can be a carbon message, as defined in XEP-0280",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();

                    // Send a message from a different resource
                    spyOn(_converse, 'log');
                    var msgtext = 'This is a carbon message';
                    var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                    var msg = $msg({
                            'from': sender_jid,
                            'id': (new Date()).getTime(),
                            'to': _converse.connection.jid,
                            'type': 'chat',
                            'xmlns': 'jabber:client'
                        }).c('received', {'xmlns': 'urn:xmpp:carbons:2'})
                          .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                          .c('message', {
                                'xmlns': 'jabber:client',
                                'from': sender_jid,
                                'to': _converse.bare_jid+'/another-resource',
                                'type': 'chat'
                        }).c('body').t(msgtext).tree();
                    _converse.chatboxes.onMessage(msg);

                    // Check that the chatbox and its view now exist
                    var chatbox = _converse.chatboxes.get(sender_jid);
                    var chatboxview = _converse.chatboxviews.get(sender_jid);
                    expect(chatbox).toBeDefined();
                    expect(chatboxview).toBeDefined();
                    // Check that the message was received and check the message parameters
                    expect(chatbox.messages.length).toEqual(1);
                    var msg_obj = chatbox.messages.models[0];
                    expect(msg_obj.get('message')).toEqual(msgtext);
                    expect(msg_obj.get('fullname')).toEqual(mock.cur_names[1]);
                    expect(msg_obj.get('sender')).toEqual('them');
                    expect(msg_obj.get('delayed')).toEqual(false);
                    // Now check that the message appears inside the chatbox in the DOM
                    var chat_content = chatboxview.el.querySelector('.chat-content');
                    expect(chat_content.querySelector('.chat-msg .chat-msg-text').textContent).toEqual(msgtext);
                    expect(chat_content.querySelector('.chat-msg-time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
                    expect(chat_content.querySelector('span.chat-msg-author').textContent).toBe('Candice van der Knijff');
                    done();
                }));

                it("can be a carbon message that this user sent from a different client, as defined in XEP-0280",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    var contact, sent_stanza, IQ_id, stanza;
                    test_utils.waitUntilDiscoConfirmed(_converse, 'localhost', [], ['vcard-temp'])
                    .then(function () {
                        return test_utils.waitUntil(function () {
                            return _converse.xmppstatus.get('fullname');
                        }, 300);
                    }).then(function () {
                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();

                        // Send a message from a different resource
                        spyOn(_converse, 'log');
                        var msgtext = 'This is a sent carbon message';
                        var recipient_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@localhost';
                        var msg = $msg({
                                'from': _converse.bare_jid,
                                'id': (new Date()).getTime(),
                                'to': _converse.connection.jid,
                                'type': 'chat',
                                'xmlns': 'jabber:client'
                            }).c('sent', {'xmlns': 'urn:xmpp:carbons:2'})
                            .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                            .c('message', {
                                    'xmlns': 'jabber:client',
                                    'from': _converse.bare_jid+'/another-resource',
                                    'to': recipient_jid,
                                    'type': 'chat'
                            }).c('body').t(msgtext).tree();
                        _converse.chatboxes.onMessage(msg);

                        // Check that the chatbox and its view now exist
                        var chatbox = _converse.chatboxes.get(recipient_jid);
                        var chatboxview = _converse.chatboxviews.get(recipient_jid);
                        expect(chatbox).toBeDefined();
                        expect(chatboxview).toBeDefined();
                        // Check that the message was received and check the message parameters
                        expect(chatbox.messages.length).toEqual(1);
                        var msg_obj = chatbox.messages.models[0];
                        expect(msg_obj.get('message')).toEqual(msgtext);
                        expect(msg_obj.get('fullname')).toEqual(_converse.xmppstatus.get('fullname'));
                        expect(msg_obj.get('sender')).toEqual('me');
                        expect(msg_obj.get('delayed')).toEqual(false);
                        // Now check that the message appears inside the chatbox in the DOM
                        var $chat_content = $(chatboxview.el).find('.chat-content');
                        var msg_txt = $chat_content.find('.chat-msg').find('.chat-msg-text').text();
                        expect(msg_txt).toEqual(msgtext);
                        done();
                    });
                }));

                it("will be discarded if it's a malicious message meant to look like a carbon copy",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    /* <message from="mallory@evil.example" to="b@xmpp.example">
                     *    <received xmlns='urn:xmpp:carbons:2'>
                     *      <forwarded xmlns='urn:xmpp:forward:0'>
                     *          <message from="alice@xmpp.example" to="bob@xmpp.example/client1">
                     *              <body>Please come to Creepy Valley tonight, alone!</body>
                     *          </message>
                     *      </forwarded>
                     *    </received>
                     * </message>
                     */
                    spyOn(_converse, 'log');
                    var msgtext = 'Please come to Creepy Valley tonight, alone!';
                    var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                    var impersonated_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                    var msg = $msg({
                            'from': sender_jid,
                            'id': (new Date()).getTime(),
                            'to': _converse.connection.jid,
                            'type': 'chat',
                            'xmlns': 'jabber:client'
                        }).c('received', {'xmlns': 'urn:xmpp:carbons:2'})
                          .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                          .c('message', {
                                'xmlns': 'jabber:client',
                                'from': impersonated_jid,
                                'to': _converse.connection.jid,
                                'type': 'chat'
                        }).c('body').t(msgtext).tree();
                    _converse.chatboxes.onMessage(msg);

                    // Check that chatbox for impersonated user is not created.
                    var chatbox = _converse.chatboxes.get(impersonated_jid);
                    expect(chatbox).not.toBeDefined();

                    // Check that the chatbox for the malicous user is not created
                    chatbox = _converse.chatboxes.get(sender_jid);
                    expect(chatbox).not.toBeDefined();
                    done();
                }));

                it("received for a minimized chat box will increment a counter on its header",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.waitUntil(function () {
                            return $(_converse.rosterview.el).find('.roster-group').length;
                        }, 300)
                    .then(function () {
                        var contact_name = mock.cur_names[0];
                        var contact_jid = contact_name.replace(/ /g,'.').toLowerCase() + '@localhost';

                        spyOn(_converse, 'emit').and.callThrough();
                        test_utils.openChatBoxFor(_converse, contact_jid);
                        var chatview = _converse.chatboxviews.get(contact_jid);
                        expect(u.isVisible(chatview.el)).toBeTruthy();
                        expect(chatview.model.get('minimized')).toBeFalsy();
                        chatview.el.querySelector('.toggle-chatbox-button').click();
                        expect(chatview.model.get('minimized')).toBeTruthy();
                        var message = 'This message is sent to a minimized chatbox';
                        var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                        var msg = $msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: (new Date()).getTime()
                        }).c('body').t(message).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                        _converse.chatboxes.onMessage(msg);
                        expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                        var trimmed_chatboxes = _converse.minimized_chats;
                        var trimmedview = trimmed_chatboxes.get(contact_jid);
                        var $count = $(trimmedview.el).find('.message-count');
                        expect(u.isVisible(chatview.el)).toBeFalsy();
                        expect(trimmedview.model.get('minimized')).toBeTruthy();
                        expect(u.isVisible($count[0])).toBeTruthy();
                        expect($count.html()).toBe('1');
                        _converse.chatboxes.onMessage(
                            $msg({
                                from: mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                                to: _converse.connection.jid,
                                type: 'chat',
                                id: (new Date()).getTime()
                            }).c('body').t('This message is also sent to a minimized chatbox').up()
                            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree()
                        );
                        expect(u.isVisible(chatview.el)).toBeFalsy();
                        expect(trimmedview.model.get('minimized')).toBeTruthy();
                        $count = $(trimmedview.el).find('.message-count');
                        expect(u.isVisible($count[0])).toBeTruthy();
                        expect($count.html()).toBe('2');
                        trimmedview.el.querySelector('.restore-chat').click();
                        expect(trimmed_chatboxes.keys().length).toBe(0);
                        done();
                    });
                }));

                it("will indicate when it has a time difference of more than a day between it and its predecessor",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.waitUntil(function () {
                            return $(_converse.rosterview.el).find('.roster-group').length;
                        }, 300)
                    .then(function () {
                        spyOn(_converse, 'emit');
                        var contact_name = mock.cur_names[1];
                        var contact_jid = contact_name.replace(/ /g,'.').toLowerCase() + '@localhost';
                        test_utils.openChatBoxFor(_converse, contact_jid);
                        test_utils.clearChatBoxMessages(_converse, contact_jid);
                        var one_day_ago = moment();
                        one_day_ago.subtract('days', 1);
                        var message = 'This is a day old message';
                        var chatbox = _converse.chatboxes.get(contact_jid);
                        var chatboxview = _converse.chatboxviews.get(contact_jid);
                        var $chat_content = $(chatboxview.el).find('.chat-content');
                        var msg_obj;
                        var msg_txt;
                        var sender_txt;

                        var msg = $msg({
                            from: contact_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: one_day_ago.unix()
                        }).c('body').t(message).up()
                        .c('delay', { xmlns:'urn:xmpp:delay', from: 'localhost', stamp: one_day_ago.format() })
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                        _converse.chatboxes.onMessage(msg);
                        expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                        expect(chatbox.messages.length).toEqual(1);
                        msg_obj = chatbox.messages.models[0];
                        expect(msg_obj.get('message')).toEqual(message);
                        expect(msg_obj.get('fullname')).toEqual(contact_name);
                        expect(msg_obj.get('sender')).toEqual('them');
                        expect(msg_obj.get('delayed')).toEqual(true);

                        var chat_content = chatboxview.el.querySelector('.chat-content');
                        expect(chat_content.querySelector('.chat-msg .chat-msg-text').textContent).toEqual(message);
                        expect(chat_content.querySelector('.chat-msg-time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
                        expect(chat_content.querySelector('span.chat-msg-author').textContent).toBe('Candice van der Knijff');

                        var $day = $chat_content.find('.date-separator');
                        expect($day.length).toEqual(1);
                        expect($day.attr('class')).toEqual('message date-separator');
                        expect($day.data('isodate')).toEqual(moment(one_day_ago.startOf('day')).format());

                        var $time = $chat_content.find('time.separator-text');
                        expect($time.text()).toEqual(moment(one_day_ago.startOf('day')).format("dddd MMM Do YYYY"));

                        message = 'This is a current message';
                        msg = $msg({
                            from: contact_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: new Date().getTime()
                        }).c('body').t(message).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                        _converse.chatboxes.onMessage(msg);
                        expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                        // Check that there is a <time> element, with the required
                        // props.
                        expect($chat_content[0].querySelectorAll('time').length).toEqual(2); // There are now two time elements

                        var message_date = new Date();
                        $day = $chat_content.find('.date-separator:last');
                        expect($day.length).toEqual(1);
                        expect($day.attr('class')).toEqual('message date-separator');
                        expect($day.data('isodate')).toEqual(moment(message_date).startOf('day').format());

                        $time = $chat_content.find('time.separator-text:last');
                        expect($time.text()).toEqual(moment(message_date).startOf('day').format("dddd MMM Do YYYY"));

                        // Normal checks for the 2nd message
                        expect(chatbox.messages.length).toEqual(2);
                        msg_obj = chatbox.messages.models[1];
                        expect(msg_obj.get('message')).toEqual(message);
                        expect(msg_obj.get('fullname')).toEqual(contact_name);
                        expect(msg_obj.get('sender')).toEqual('them');
                        expect(msg_obj.get('delayed')).toEqual(false);
                        msg_txt = $chat_content.find('.chat-msg').last().find('.chat-msg-text').text();
                        expect(msg_txt).toEqual(message);

                        expect(chat_content.querySelector('.chat-msg:last-child .chat-msg-text').textContent).toEqual(message);
                        expect(chat_content.querySelector('.chat-msg:last-child .chat-msg-time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
                        expect(chat_content.querySelector('.chat-msg:last-child .chat-msg-author').textContent).toBe('Candice van der Knijff');
                        done();
                    });
                }));

                it("can be sent from a chatbox, and will appear inside it",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();

                    spyOn(_converse, 'emit');
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    expect(_converse.emit).toHaveBeenCalledWith('chatBoxFocused', jasmine.any(Object));
                    var view = _converse.chatboxviews.get(contact_jid);
                    var message = 'This message is sent from this chatbox';
                    spyOn(view.model, 'sendMessage').and.callThrough();
                    test_utils.sendMessage(view, message);
                    expect(view.model.sendMessage).toHaveBeenCalled();
                    expect(view.model.messages.length, 2);
                    expect(_converse.emit.calls.mostRecent().args, ['messageSend', message]);
                    expect($(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg-text').text()).toEqual(message);
                    done();
                }));

                it("is sanitized to prevent Javascript injection attacks",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();

                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    var message = '<p>This message contains <em>some</em> <b>markup</b></p>';
                    spyOn(view.model, 'sendMessage').and.callThrough();
                    test_utils.sendMessage(view, message);
                    expect(view.model.sendMessage).toHaveBeenCalled();
                    var msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg-text');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('&lt;p&gt;This message contains &lt;em&gt;some&lt;/em&gt; &lt;b&gt;markup&lt;/b&gt;&lt;/p&gt;');
                    done();
                }));

                it("can contain hyperlinks, which will be clickable",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();

                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    var message = 'This message contains a hyperlink: www.opkode.com';
                    spyOn(view.model, 'sendMessage').and.callThrough();
                    test_utils.sendMessage(view, message);
                    expect(view.model.sendMessage).toHaveBeenCalled();
                    var msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg-text');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('This message contains a hyperlink: <a target="_blank" rel="noopener" href="http://www.opkode.com">www.opkode.com</a>');
                    done();
                }));

                it("will have properly escaped URLs",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();

                    var message, msg;
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    spyOn(view.model, 'sendMessage').and.callThrough();
                    message = "http://www.opkode.com/'onmouseover='alert(1)'whatever";
                    test_utils.sendMessage(view, message);
                    expect(view.model.sendMessage).toHaveBeenCalled();
                    msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg-text');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('<a target="_blank" rel="noopener" href="http://www.opkode.com/%27onmouseover=%27alert%281%29%27whatever">http://www.opkode.com/\'onmouseover=\'alert(1)\'whatever</a>');
                    message = 'http://www.opkode.com/"onmouseover="alert(1)"whatever';
                    test_utils.sendMessage(view, message);

                    expect(view.model.sendMessage).toHaveBeenCalled();
                    msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg-text');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('<a target="_blank" rel="noopener" href="http://www.opkode.com/%22onmouseover=%22alert%281%29%22whatever">http://www.opkode.com/"onmouseover="alert(1)"whatever</a>');

                    message = "https://en.wikipedia.org/wiki/Ender's_Game";
                    test_utils.sendMessage(view, message);

                    expect(view.model.sendMessage).toHaveBeenCalled();
                    msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg-text');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('<a target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/Ender%27s_Game">'+message+'</a>');

                    message = "https://en.wikipedia.org/wiki/Ender's_Game";
                    test_utils.sendMessage(view, message);

                    expect(view.model.sendMessage).toHaveBeenCalled();
                    msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg-text');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('<a target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/Ender%27s_Game">'+message+'</a>');
                    done();
                }));

                it("will render audio from oob mp3 URLs",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    spyOn(view.model, 'sendMessage').and.callThrough();

                    var stanza = Strophe.xmlHtmlNode(
                        "<message from='"+contact_jid+"'"+
                        "         type='chat'"+
                        "         to='dummy@localhost/resource'>"+
                        "    <body>Have you heard this funny audio?</body>"+
                        "    <x xmlns='jabber:x:oob'><url>http://localhost/audio.mp3</url></x>"+
                        "</message>").firstChild;
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    test_utils.waitUntil(function () {
                        return view.el.querySelectorAll('.chat-content .chat-msg audio').length;
                    }, 1000).then(function () {
                        var msg = view.el.querySelector('.chat-msg .chat-msg-text');
                        expect(msg.outerHTML).toEqual('<span class="chat-msg-text">Have you heard this funny audio?</span>');
                        var media = view.el.querySelector('.chat-msg .chat-msg-media');
                        expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                            '<audio controls=""><source src="http://localhost/audio.mp3" type="audio/mpeg"></audio>'+
                            '<a target="_blank" rel="noopener" href="http://localhost/audio.mp3">Download audio file</a>');

                        // If the <url> and <body> contents is the same, don't duplicate.
                        var stanza = Strophe.xmlHtmlNode(
                            "<message from='"+contact_jid+"'"+
                            "         type='chat'"+
                            "         to='dummy@localhost/resource'>"+
                            "    <body>http://localhost/audio.mp3</body>"+
                            "    <x xmlns='jabber:x:oob'><url>http://localhost/audio.mp3</url></x>"+
                            "</message>").firstChild;
                        _converse.connection._dataRecv(test_utils.createRequest(stanza));

                        msg = view.el.querySelector('.chat-msg:last-child .chat-msg-text');
                        expect(msg.innerHTML).toEqual('');
                        media = view.el.querySelector('.chat-msg:last-child .chat-msg-media');
                        expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                            '<audio controls=""><source src="http://localhost/audio.mp3" type="audio/mpeg"></audio>'+
                            '<a target="_blank" rel="noopener" href="http://localhost/audio.mp3">Download audio file</a>');
                        done();
                    });
                }));

                it("will render video from oob mp4 URLs",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    spyOn(view.model, 'sendMessage').and.callThrough();

                    var stanza = Strophe.xmlHtmlNode(
                        "<message from='"+contact_jid+"'"+
                        "         type='chat'"+
                        "         to='dummy@localhost/resource'>"+
                        "    <body>Have you seen this funny video?</body>"+
                        "    <x xmlns='jabber:x:oob'><url>http://localhost/video.mp4</url></x>"+
                        "</message>").firstChild;
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    test_utils.waitUntil(function () {
                        return view.el.querySelectorAll('.chat-content .chat-msg video').length;
                    }, 2000).then(function () {
                        var msg = view.el.querySelector('.chat-msg .chat-msg-text');
                        expect(msg.outerHTML).toEqual('<span class="chat-msg-text">Have you seen this funny video?</span>');
                        var media = view.el.querySelector('.chat-msg .chat-msg-media');
                        expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                            '<video controls=""><source src="http://localhost/video.mp4" type="video/mp4"></video>'+
                            '<a target="_blank" rel="noopener" href="http://localhost/video.mp4">Download video file</a>');

                        // If the <url> and <body> contents is the same, don't duplicate.
                        var stanza = Strophe.xmlHtmlNode(
                            "<message from='"+contact_jid+"'"+
                            "         type='chat'"+
                            "         to='dummy@localhost/resource'>"+
                            "    <body>http://localhost/video.mp4</body>"+
                            "    <x xmlns='jabber:x:oob'><url>http://localhost/video.mp4</url></x>"+
                            "</message>").firstChild;
                        _converse.connection._dataRecv(test_utils.createRequest(stanza));

                        msg = view.el.querySelector('.chat-msg:last-child .chat-msg-text');
                        expect(msg.innerHTML).toEqual('');
                        media = view.el.querySelector('.chat-msg:last-child .chat-msg-media');
                        expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                            '<video controls=""><source src="http://localhost/video.mp4" type="video/mp4"></video>'+
                            '<a target="_blank" rel="noopener" href="http://localhost/video.mp4">Download video file</a>');
                        done();
                    });
                }));

                it("will render download links for files from oob URLs",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    spyOn(view.model, 'sendMessage').and.callThrough();

                    var stanza = Strophe.xmlHtmlNode(
                        "<message from='"+contact_jid+"'"+
                        "         type='chat'"+
                        "         to='dummy@localhost/resource'>"+
                        "    <body>Have you downloaded this funny file?</body>"+
                        "    <x xmlns='jabber:x:oob'><url>http://localhost/funny.pdf</url></x>"+
                        "</message>").firstChild;
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    test_utils.waitUntil(function () {
                        return view.el.querySelectorAll('.chat-content .chat-msg a').length;
                    }, 1000).then(function () {
                        var msg = view.el.querySelector('.chat-msg .chat-msg-text');
                        expect(msg.outerHTML).toEqual('<span class="chat-msg-text">Have you downloaded this funny file?</span>');
                        var media = view.el.querySelector('.chat-msg .chat-msg-media');
                        expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                            '<a target="_blank" rel="noopener" href="http://localhost/funny.pdf">Download: "funny.pdf</a>');
                        done();
                    });
                }));

                it("will render images from oob URLs",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    spyOn(view.model, 'sendMessage').and.callThrough();
                    var base_url = document.URL.split(window.location.pathname)[0];
                    var url = base_url+"/logo/conversejs-filled.svg";

                    var stanza = Strophe.xmlHtmlNode(
                        "<message from='"+contact_jid+"'"+
                        "         type='chat'"+
                        "         to='dummy@localhost/resource'>"+
                        "    <body>Have you seen this funny image?</body>"+
                        "    <x xmlns='jabber:x:oob'><url>"+url+"</url></x>"+
                        "</message>").firstChild;
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    test_utils.waitUntil(function () {
                        return view.el.querySelectorAll('.chat-content .chat-msg img').length;
                    }, 2000).then(function () {
                        var msg = view.el.querySelector('.chat-msg .chat-msg-text');
                        expect(msg.outerHTML).toEqual('<span class="chat-msg-text">Have you seen this funny image?</span>');
                        var media = view.el.querySelector('.chat-msg .chat-msg-media');
                        expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                            '<a href="http://localhost:8000/logo/conversejs-filled.svg" target="_blank" rel="noopener">'+
                                '<img class="chat-image img-thumbnail" src="http://localhost:8000/logo/conversejs-filled.svg">'+
                            '</a>');
                        done();
                    });
                }));

                it("will render images from their URLs",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    var base_url = document.URL.split(window.location.pathname)[0];
                    var message = base_url+"/logo/conversejs-filled.svg";
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    spyOn(view.model, 'sendMessage').and.callThrough();
                    test_utils.sendMessage(view, message);

                    test_utils.waitUntil(function () {
                        return view.el.querySelectorAll('.chat-content .chat-image').length;
                    }, 1000).then(function () {
                        expect(view.model.sendMessage).toHaveBeenCalled();
                        var msg = $(view.el).find('.chat-content .chat-msg').last().find('.chat-msg-text');
                        expect(msg.html().trim()).toEqual(
                            '<a href="'+base_url+'/logo/conversejs-filled.svg" target="_blank" rel="noopener"><img class="chat-image img-thumbnail"'+
                            ' src="' + message + '"></a>');
                        message += "?param1=val1&param2=val2";
                        test_utils.sendMessage(view, message);
                        return test_utils.waitUntil(function () {
                            return view.el.querySelectorAll('.chat-content .chat-image').length === 2;
                        }, 1000);
                    }).then(function () {
                        expect(view.model.sendMessage).toHaveBeenCalled();
                        var msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg-text');
                        expect(msg.html().trim()).toEqual(
                            '<a href="'+base_url+'/logo/conversejs-filled.svg?param1=val1&amp;param2=val2" target="_blank" rel="noopener"><img'+
                            ' class="chat-image img-thumbnail" src="'+message.replace(/&/g, '&amp;')+'"></a>')

                        // Test now with two images in one message
                        message += ' hello world '+base_url+"/logo/conversejs-filled.svg";
                        test_utils.sendMessage(view, message);
                        return test_utils.waitUntil(function () {
                            return view.el.querySelectorAll('.chat-content .chat-image').length === 4;
                        }, 1000);
                    }).then(function () {
                        expect(view.model.sendMessage).toHaveBeenCalled();
                        var msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg-text');
                        expect(msg[0].textContent.trim()).toEqual('hello world');
                        expect(msg[0].querySelectorAll('img').length).toEqual(2);
                        done();
                    });
                }));

                it("will render the message time as configured",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');

                    _converse.time_format = 'hh:mm';
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    var message = 'This message is sent from this chatbox';
                    test_utils.sendMessage(view, message);

                    var chatbox = _converse.chatboxes.get(contact_jid);
                    expect(chatbox.messages.models.length, 1);
                    var msg_object = chatbox.messages.models[0];

                    var msg_author = view.el.querySelector('.chat-content .chat-msg:last-child .chat-msg-author');
                    expect(msg_author.textContent).toBe('dummy@localhost');

                    var msg_time = view.el.querySelector('.chat-content .chat-msg:last-child .chat-msg-time');
                    var time = moment(msg_object.get('time')).format(_converse.time_format);
                    expect(msg_time.textContent).toBe(time);
                    done();
                }));
            });

            describe("A Chat Status Notification", function () {

                it("does not open a new chatbox",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();

                    spyOn(_converse, 'emit');
                    var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                    // <composing> state
                    var msg = $msg({
                            'from': sender_jid,
                            'to': _converse.connection.jid,
                            'type': 'chat',
                            'id': (new Date()).getTime()
                        }).c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                    _converse.chatboxes.onMessage(msg);
                    expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                    done();
                }));

                describe("An active notification", function () {

                    it("is sent when the user opens a chat box",
                            mock.initConverseWithPromises(
                                null, ['rosterGroupsFetched'], {},
                                function (done, _converse) {

                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.waitUntil(function () {
                            return $(_converse.rosterview.el).find('.roster-group').length;
                        }, 300).then(function () {
                            spyOn(_converse.connection, 'send');
                            var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                            test_utils.openChatBoxFor(_converse, contact_jid);
                            var view = _converse.chatboxviews.get(contact_jid);
                            expect(view.model.get('chat_state')).toBe('active');
                            expect(_converse.connection.send).toHaveBeenCalled();
                            var $stanza = $(_converse.connection.send.calls.argsFor(0)[0].tree());
                            expect($stanza.attr('to')).toBe(contact_jid);
                            expect($stanza.children().length).toBe(3);
                            expect($stanza.children().get(0).tagName).toBe('active');
                            expect($stanza.children().get(1).tagName).toBe('no-store');
                            expect($stanza.children().get(2).tagName).toBe('no-permanent-store');
                            done();
                        });
                    }));

                    it("is sent when the user maximizes a minimized a chat box", mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';

                        test_utils.waitUntil(function () {
                            return $(_converse.rosterview.el).find('.roster-group').length;
                        }, 500).then(function () {
                            test_utils.openChatBoxFor(_converse, contact_jid);
                            var view = _converse.chatboxviews.get(contact_jid);
                            view.model.minimize();
                            expect(view.model.get('chat_state')).toBe('inactive');
                            spyOn(_converse.connection, 'send');
                            view.model.maximize();
                            return test_utils.waitUntil(function () {
                                return view.model.get('chat_state') === 'active';
                            }, 700);
                        }).then(function () {
                            expect(_converse.connection.send).toHaveBeenCalled();
                            var calls = _.filter(_converse.connection.send.calls.all(), function (call) {
                                return call.args[0] instanceof Strophe.Builder;
                            });
                            expect(calls.length).toBe(1);
                            var $stanza = $(calls[0].args[0].tree());
                            expect($stanza.attr('to')).toBe(contact_jid);
                            expect($stanza.children().length).toBe(3);
                            expect($stanza.children().get(0).tagName).toBe('active');
                            expect($stanza.children().get(1).tagName).toBe('no-store');
                            expect($stanza.children().get(2).tagName).toBe('no-permanent-store');
                            done();
                        });
                    }));
                });

                describe("A composing notification", function () {

                    it("is sent as soon as the user starts typing a message which is not a command",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.waitUntil(function () {
                            return $(_converse.rosterview.el).find('.roster-group').length;
                        }, 300).then(function () {
                            var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                            test_utils.openChatBoxFor(_converse, contact_jid);
                            var view = _converse.chatboxviews.get(contact_jid);
                            expect(view.model.get('chat_state')).toBe('active');
                            spyOn(_converse.connection, 'send');
                            spyOn(_converse, 'emit');
                            view.keyPressed({
                                target: $(view.el).find('textarea.chat-textarea'),
                                keyCode: 1
                            });
                            expect(view.model.get('chat_state')).toBe('composing');
                            expect(_converse.connection.send).toHaveBeenCalled();
                            var $stanza = $(_converse.connection.send.calls.argsFor(0)[0].tree());
                            expect($stanza.attr('to')).toBe(contact_jid);
                            expect($stanza.children().get(0).tagName).toBe('composing');
                            expect($stanza.children().get(1).tagName).toBe('no-store');
                            expect($stanza.children().get(2).tagName).toBe('no-permanent-store');

                            // The notification is not sent again
                            view.keyPressed({
                                target: $(view.el).find('textarea.chat-textarea'),
                                keyCode: 1
                            });
                            expect(view.model.get('chat_state')).toBe('composing');
                            expect(_converse.emit.calls.count(), 1);
                            done();
                        });
                    }));

                    it("will be shown if received",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();

                        // See XEP-0085 http://xmpp.org/extensions/xep-0085.html#definitions
                        spyOn(_converse, 'emit');
                        var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                        test_utils.openChatBoxFor(_converse, sender_jid);

                        // <composing> state
                        var msg = $msg({
                                from: sender_jid,
                                to: _converse.connection.jid,
                                type: 'chat',
                                id: (new Date()).getTime()
                            }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        _converse.chatboxes.onMessage(msg);
                        expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                        var chatboxview = _converse.chatboxviews.get(sender_jid);
                        expect(chatboxview).toBeDefined();
                        // Check that the notification appears inside the chatbox in the DOM
                        var events = chatboxview.el.querySelectorAll('.chat-state-notification');
                        expect(events.length).toBe(1);
                        expect(events[0].textContent).toEqual(mock.cur_names[1] + ' is typing');

                        // Check that it doesn't appear twice
                        msg = $msg({
                                from: sender_jid,
                                to: _converse.connection.jid,
                                type: 'chat',
                                id: (new Date()).getTime()
                            }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        _converse.chatboxes.onMessage(msg);
                        events = chatboxview.el.querySelectorAll('.chat-state-notification');
                        expect(events.length).toBe(1);
                        expect(events[0].textContent).toEqual(mock.cur_names[1] + ' is typing');
                        done();
                    }));

                    it("can be a composing carbon message that this user sent from a different client",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        var contact, sent_stanza, IQ_id, stanza;
                        test_utils.waitUntilDiscoConfirmed(_converse, 'localhost', [], ['vcard-temp'])
                        .then(function () {
                            return test_utils.waitUntil(function () {
                                return _converse.xmppstatus.get('fullname');
                            }, 300);
                        }).then(function () {
                            test_utils.createContacts(_converse, 'current');
                            // Send a message from a different resource
                            spyOn(_converse, 'log');
                            var recipient_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@localhost';
                            test_utils.openChatBoxFor(_converse, recipient_jid);
                            var msg = $msg({
                                    'from': _converse.bare_jid,
                                    'id': (new Date()).getTime(),
                                    'to': _converse.connection.jid,
                                    'type': 'chat',
                                    'xmlns': 'jabber:client'
                                }).c('sent', {'xmlns': 'urn:xmpp:carbons:2'})
                                  .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                                  .c('message', {
                                        'xmlns': 'jabber:client',
                                        'from': _converse.bare_jid+'/another-resource',
                                        'to': recipient_jid,
                                        'type': 'chat'
                                }).c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                            _converse.chatboxes.onMessage(msg);

                            // Check that the chatbox and its view now exist
                            var chatbox = _converse.chatboxes.get(recipient_jid);
                            var chatboxview = _converse.chatboxviews.get(recipient_jid);
                            // Check that the message was received and check the message parameters
                            expect(chatbox.messages.length).toEqual(1);
                            var msg_obj = chatbox.messages.models[0];
                            expect(msg_obj.get('fullname')).toEqual(_converse.xmppstatus.get('fullname'));
                            expect(msg_obj.get('sender')).toEqual('me');
                            expect(msg_obj.get('delayed')).toEqual(false);
                            var $chat_content = $(chatboxview.el).find('.chat-content');
                            var status_text = $chat_content.find('.chat-info.chat-state-notification').text();
                            expect(status_text).toBe('Typing from another device');
                            done();
                        });
                    }));
                });

                describe("A paused notification", function () {

                    it("is sent if the user has stopped typing since 30 seconds",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        var view, contact_jid;
                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.waitUntil(function () {
                                return $(_converse.rosterview.el).find('.roster-group li').length;
                        }, 700).then(function () {
                            _converse.TIMEOUTS.PAUSED = 200; // Make the timeout shorter so that we can test

                            contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                            test_utils.openChatBoxFor(_converse, contact_jid);
                            view = _converse.chatboxviews.get(contact_jid);
                            spyOn(_converse.connection, 'send');
                            spyOn(view, 'setChatState').and.callThrough();
                            expect(view.model.get('chat_state')).toBe('active');
                            view.keyPressed({
                                target: $(view.el).find('textarea.chat-textarea'),
                                keyCode: 1
                            });
                            expect(view.model.get('chat_state')).toBe('composing');
                            expect(_converse.connection.send).toHaveBeenCalled();
                            var $stanza = $(_converse.connection.send.calls.argsFor(0)[0].tree());
                            expect($stanza.children().get(0).tagName).toBe('composing');
                            return test_utils.waitUntil(function () {
                                return view.model.get('chat_state') === 'paused';
                            }, 500);
                        }).then(function () {
                            expect(_converse.connection.send).toHaveBeenCalled();
                            var calls = _.filter(_converse.connection.send.calls.all(), function (call) {
                                return call.args[0] instanceof Strophe.Builder;
                            });
                            expect(calls.length).toBe(2);
                            var $stanza = $(calls[1].args[0].tree());

                            expect($stanza.attr('to')).toBe(contact_jid);
                            expect($stanza.children().length).toBe(3);
                            expect($stanza.children().get(0).tagName).toBe('paused');
                            expect($stanza.children().get(1).tagName).toBe('no-store');
                            expect($stanza.children().get(2).tagName).toBe('no-permanent-store');
                            // Test #359. A paused notification should not be sent
                            // out if the user simply types longer than the
                            // timeout.
                            view.keyPressed({
                                target: $(view.el).find('textarea.chat-textarea'),
                                keyCode: 1
                            });
                            expect(view.setChatState).toHaveBeenCalled();
                            expect(view.model.get('chat_state')).toBe('composing');

                            view.keyPressed({
                                target: $(view.el).find('textarea.chat-textarea'),
                                keyCode: 1
                            });
                            expect(view.model.get('chat_state')).toBe('composing');
                            done();
                        });
                    }));

                    it("will be shown if received",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.waitUntil(function () {
                                return $(_converse.rosterview.el).find('.roster-group').length;
                            }, 300)
                        .then(function () {
                            // TODO: only show paused state if the previous state was composing
                            // See XEP-0085 http://xmpp.org/extensions/xep-0085.html#definitions
                            spyOn(_converse, 'emit');
                            var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                            // <paused> state
                            var msg = $msg({
                                    from: sender_jid,
                                    to: _converse.connection.jid,
                                    type: 'chat',
                                    id: (new Date()).getTime()
                                }).c('body').c('paused', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                            _converse.chatboxes.onMessage(msg);
                            expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                            var chatboxview = _converse.chatboxviews.get(sender_jid);
                            var $events = $(chatboxview.el).find('.chat-info.chat-state-notification');
                            expect($events.text()).toEqual(mock.cur_names[1] + ' has stopped typing');
                            done();
                        });
                    }));

                    it("can be a paused carbon message that this user sent from a different client",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        var contact, sent_stanza, IQ_id, stanza;
                        test_utils.waitUntilDiscoConfirmed(_converse, 'localhost', [], ['vcard-temp'])
                        .then(function () {
                            return test_utils.waitUntil(function () {
                                return _converse.xmppstatus.get('fullname');
                            }, 300);
                        }).then(function () {
                            test_utils.createContacts(_converse, 'current');
                            // Send a message from a different resource
                            spyOn(_converse, 'log');
                            var recipient_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@localhost';
                            test_utils.openChatBoxFor(_converse, recipient_jid);
                            var msg = $msg({
                                    'from': _converse.bare_jid,
                                    'id': (new Date()).getTime(),
                                    'to': _converse.connection.jid,
                                    'type': 'chat',
                                    'xmlns': 'jabber:client'
                                }).c('sent', {'xmlns': 'urn:xmpp:carbons:2'})
                                  .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                                  .c('message', {
                                        'xmlns': 'jabber:client',
                                        'from': _converse.bare_jid+'/another-resource',
                                        'to': recipient_jid,
                                        'type': 'chat'
                                }).c('paused', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                            _converse.chatboxes.onMessage(msg);

                            // Check that the chatbox and its view now exist
                            var chatbox = _converse.chatboxes.get(recipient_jid);
                            var chatboxview = _converse.chatboxviews.get(recipient_jid);
                            // Check that the message was received and check the message parameters
                            expect(chatbox.messages.length).toEqual(1);
                            var msg_obj = chatbox.messages.models[0];
                            expect(msg_obj.get('fullname')).toEqual(_converse.xmppstatus.get('fullname'));
                            expect(msg_obj.get('sender')).toEqual('me');
                            expect(msg_obj.get('delayed')).toEqual(false);
                            var $chat_content = $(chatboxview.el).find('.chat-content');
                            var status_text = $chat_content.find('.chat-info.chat-state-notification').text();
                            expect(status_text).toBe('Stopped typing on the other device');
                            done();
                        });
                    }));
                });

                describe("An inactive notifciation", function () {

                    it("is sent if the user has stopped typing since 2 minutes",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        var view, contact_jid;
                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.waitUntil(function () {
                            return $(_converse.rosterview.el).find('.roster-group').length;
                        }, 500).then(function () {
                            // Make the timeouts shorter so that we can test
                            _converse.TIMEOUTS.PAUSED = 200;
                            _converse.TIMEOUTS.INACTIVE = 200;
                            contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                            test_utils.openChatBoxFor(_converse, contact_jid);
                            view = _converse.chatboxviews.get(contact_jid);
                            return test_utils.waitUntil(function () {
                                return view.model.get('chat_state') === 'active';
                            }, 500);
                        }).then(function () {
                            console.log('chat_state set to active');
                            view = _converse.chatboxviews.get(contact_jid);
                            expect(view.model.get('chat_state')).toBe('active');
                            view.keyPressed({
                                target: $(view.el).find('textarea.chat-textarea'),
                                keyCode: 1
                            });
                            return test_utils.waitUntil(function () {
                                return view.model.get('chat_state') === 'composing';
                            }, 500);
                        }).then(function () {
                            console.log('chat_state set to composing');
                            view = _converse.chatboxviews.get(contact_jid);
                            expect(view.model.get('chat_state')).toBe('composing');
                            spyOn(_converse.connection, 'send');
                            return test_utils.waitUntil(function () {
                                return view.model.get('chat_state') === 'paused';
                            }, 500);
                        }).then(function () {
                            console.log('chat_state set to paused');
                            return test_utils.waitUntil(function () {
                                return view.model.get('chat_state') === 'inactive';
                            }, 500);
                        }).then(function () {
                            console.log('chat_state set to inactive');
                            expect(_converse.connection.send).toHaveBeenCalled();
                            var calls = _.filter(_converse.connection.send.calls.all(), function (call) {
                                return call.args[0] instanceof Strophe.Builder;
                            });
                            expect(calls.length).toBe(2);
                            var $stanza = $(calls[0].args[0].tree());
                            expect($stanza.attr('to')).toBe(contact_jid);
                            expect($stanza.children().length).toBe(3);
                            expect($stanza.children().get(0).tagName).toBe('paused');
                            expect($stanza.children().get(1).tagName).toBe('no-store');
                            expect($stanza.children().get(2).tagName).toBe('no-permanent-store');

                            $stanza = $(_converse.connection.send.calls.mostRecent().args[0].tree());
                            expect($stanza.attr('to')).toBe(contact_jid);
                            expect($stanza.children().length).toBe(3);
                            expect($stanza.children().get(0).tagName).toBe('inactive');
                            expect($stanza.children().get(1).tagName).toBe('no-store');
                            expect($stanza.children().get(2).tagName).toBe('no-permanent-store');
                        }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL))
                          .then(done);
                    }));

                    it("is sent when the user a minimizes a chat box",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();

                        var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                        test_utils.openChatBoxFor(_converse, contact_jid);
                        var view = _converse.chatboxviews.get(contact_jid);
                        spyOn(_converse.connection, 'send');
                        view.minimize();
                        expect(view.model.get('chat_state')).toBe('inactive');
                        expect(_converse.connection.send).toHaveBeenCalled();
                        var $stanza = $(_converse.connection.send.calls.argsFor(0)[0].tree());
                        expect($stanza.attr('to')).toBe(contact_jid);
                        expect($stanza.children().get(0).tagName).toBe('inactive');
                        done();
                    }));

                    it("is sent if the user closes a chat box",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.waitUntil(function () {
                            return $(_converse.rosterview.el).find('.roster-group').length;
                        }, 300).then(function () {
                            var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                            test_utils.openChatBoxFor(_converse, contact_jid);
                            var view = _converse.chatboxviews.get(contact_jid);
                            expect(view.model.get('chat_state')).toBe('active');
                            spyOn(_converse.connection, 'send');
                            view.close();
                            expect(view.model.get('chat_state')).toBe('inactive');
                            expect(_converse.connection.send).toHaveBeenCalled();
                            var $stanza = $(_converse.connection.send.calls.argsFor(0)[0].tree());
                            expect($stanza.attr('to')).toBe(contact_jid);
                            expect($stanza.children().length).toBe(3);
                            expect($stanza.children().get(0).tagName).toBe('inactive');
                            expect($stanza.children().get(1).tagName).toBe('no-store');
                            expect($stanza.children().get(2).tagName).toBe('no-permanent-store');
                            done();
                        });
                    }));

                    it("will clear any other chat status notifications",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();

                        // See XEP-0085 http://xmpp.org/extensions/xep-0085.html#definitions
                        spyOn(_converse, 'emit');
                        var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                        test_utils.openChatBoxFor(_converse, sender_jid);
                        var view = _converse.chatboxviews.get(sender_jid);
                        expect(view.el.querySelectorAll('.chat-event').length).toBe(0);
                        // Insert <composing> message, to also check that
                        // text messages are inserted correctly with
                        // temporary chat events in the chat contents.
                        var msg = $msg({
                                'to': _converse.bare_jid,
                                'xmlns': 'jabber:client',
                                'from': sender_jid,
                                'type': 'chat'})
                            .c('composing', {'xmlns': Strophe.NS.CHATSTATES}).up()
                            .tree();
                        _converse.chatboxes.onMessage(msg);
                        expect(view.el.querySelectorAll('.chat-state-notification').length).toBe(1);
                        msg = $msg({
                                from: sender_jid,
                                to: _converse.connection.jid,
                                type: 'chat',
                                id: (new Date()).getTime()
                            }).c('body').c('inactive', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        _converse.chatboxes.onMessage(msg);
                        expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                        expect($(view.el).find('.chat-state-notification').length).toBe(0);
                        done();
                    }));
                });

                describe("A gone notifciation", function () {

                    it("will be shown if received",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();

                        spyOn(_converse, 'emit');
                        var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                        // <paused> state
                        var msg = $msg({
                                from: sender_jid,
                                to: _converse.connection.jid,
                                type: 'chat',
                                id: (new Date()).getTime()
                            }).c('body').c('gone', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        _converse.chatboxes.onMessage(msg);
                        expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                        var chatboxview = _converse.chatboxviews.get(sender_jid);
                        var $events = $(chatboxview.el).find('.chat-state-notification');
                        expect($events.text()).toEqual(mock.cur_names[1] + ' has gone away');
                        done();
                    }));
                });
            });
        });

        describe("Special Messages", function () {

            it("'/clear' can be used to clear messages in a conversation",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();

                spyOn(_converse, 'emit');
                var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                test_utils.openChatBoxFor(_converse, contact_jid);
                var view = _converse.chatboxviews.get(contact_jid);
                var message = 'This message is another sent from this chatbox';
                // Lets make sure there is at least one message already
                // (e.g for when this test is run on its own).
                test_utils.sendMessage(view, message);
                expect(view.model.messages.length > 0).toBeTruthy();
                expect(view.model.messages.browserStorage.records.length > 0).toBeTruthy();
                expect(_converse.emit).toHaveBeenCalledWith('messageSend', message);

                message = '/clear';
                spyOn(view, 'onMessageSubmitted').and.callThrough();
                spyOn(view, 'clearMessages').and.callThrough();
                spyOn(window, 'confirm').and.callFake(function () {
                    return true;
                });
                test_utils.sendMessage(view, message);
                expect(view.onMessageSubmitted).toHaveBeenCalled();
                expect(view.clearMessages).toHaveBeenCalled();
                expect(window.confirm).toHaveBeenCalled();
                expect(view.model.messages.length, 0); // The messages must be removed from the chatbox
                expect(view.model.messages.browserStorage.records.length, 0); // And also from browserStorage
                expect(_converse.emit.calls.count(), 1);
                expect(_converse.emit.calls.mostRecent().args, ['messageSend', message]);
                done();
            }));
        });

        describe("A Message Counter", function () {

            it("is incremented when the message is received and the window is not focused",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();

                spyOn(_converse, 'emit');
                expect(_converse.msg_counter).toBe(0);
                spyOn(_converse, 'incrementMsgCounter').and.callThrough();
                spyOn(_converse, 'clearMsgCounter').and.callThrough();

                var previous_state = _converse.windowState;
                var message = 'This message will increment the message counter';
                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                    msg = $msg({
                        from: sender_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: (new Date()).getTime()
                    }).c('body').t(message).up()
                      .c('active', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                _converse.windowState = 'hidden';
                _converse.chatboxes.onMessage(msg);
                expect(_converse.incrementMsgCounter).toHaveBeenCalled();
                expect(_converse.clearMsgCounter).not.toHaveBeenCalled();
                expect(_converse.msg_counter).toBe(1);
                expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                _converse.windowSate = previous_state;
                done();
            }));

            it("is cleared when the window is focused",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();
                _converse.windowState = 'hidden';
                spyOn(_converse, 'clearMsgCounter').and.callThrough();
                _converse.saveWindowState(null, 'focus');
                _converse.saveWindowState(null, 'blur');
                expect(_converse.clearMsgCounter).toHaveBeenCalled();
                done();
            }));

            it("is not incremented when the message is received and the window is focused",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();

                expect(_converse.msg_counter).toBe(0);
                spyOn(_converse, 'incrementMsgCounter').and.callThrough();
                _converse.saveWindowState(null, 'focus');
                var message = 'This message will not increment the message counter';
                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                    msg = $msg({
                        from: sender_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: (new Date()).getTime()
                    }).c('body').t(message).up()
                      .c('active', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                _converse.chatboxes.onMessage(msg);
                expect(_converse.incrementMsgCounter).not.toHaveBeenCalled();
                expect(_converse.msg_counter).toBe(0);
                done();
            }));

            it("is incremented from zero when chatbox was closed after viewing previously received messages and the window is not focused now",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');

                // initial state
                expect(_converse.msg_counter).toBe(0);

                var message = 'This message will always increment the message counter from zero',
                    sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                    msgFactory = function () {
                        return $msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: (new Date()).getTime()
                        })
                        .c('body').t(message).up()
                        .c('active', {'xmlns': Strophe.NS.CHATSTATES})
                        .tree();
                 };

                // leave converse-chat page
                _converse.windowState = 'hidden';
                _converse.chatboxes.onMessage(msgFactory());
                expect(_converse.msg_counter).toBe(1);

                // come back to converse-chat page
                _converse.saveWindowState(null, 'focus');
                var view = _converse.chatboxviews.get(sender_jid);
                expect(u.isVisible(view.el)).toBeTruthy();
                expect(_converse.msg_counter).toBe(0);

                // close chatbox and leave converse-chat page again
                view.close();
                _converse.windowState = 'hidden';

                // check that msg_counter is incremented from zero again
                _converse.chatboxes.onMessage(msgFactory());
                view = _converse.chatboxviews.get(sender_jid);
                expect(u.isVisible(view.el)).toBeTruthy();
                expect(_converse.msg_counter).toBe(1);
                done();
            }));
        });

        describe("A ChatBox's Unread Message Count", function () {

            it("is incremented when the message is received and ChatBoxView is scrolled up",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');

                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                    msg = test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread');

                test_utils.openChatBoxFor(_converse, sender_jid);
                var chatbox = _converse.chatboxes.get(sender_jid);
                chatbox.save('scrolled', true);

                _converse.chatboxes.onMessage(msg);
                expect(chatbox.get('num_unread')).toBe(1);
                done();
            }));

            it("is not incremented when the message is received and ChatBoxView is scrolled down",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');

                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                    msg = test_utils.createChatMessage(_converse, sender_jid, 'This message will be read');

                test_utils.openChatBoxFor(_converse, sender_jid);
                var chatbox = _converse.chatboxes.get(sender_jid);

                _converse.chatboxes.onMessage(msg);
                expect(chatbox.get('num_unread')).toBe(0);
                done();
            }));

            it("is incremeted when message is received, chatbox is scrolled down and the window is not focused",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');

                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                var msgFactory = function () {
                    return test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread');
                };

                test_utils.openChatBoxFor(_converse, sender_jid);
                var chatbox = _converse.chatboxes.get(sender_jid);

                _converse.windowState = 'hidden';
                _converse.chatboxes.onMessage(msgFactory());

                expect(chatbox.get('num_unread')).toBe(1);
                done();
            }));

            it("is incremeted when message is received, chatbox is scrolled up and the window is not focused",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');

                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                var msgFactory = function () {
                    return test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread');
                };

                test_utils.openChatBoxFor(_converse, sender_jid);
                var chatbox = _converse.chatboxes.get(sender_jid);
                chatbox.save('scrolled', true);

                _converse.windowState = 'hidden';
                _converse.chatboxes.onMessage(msgFactory());

                expect(chatbox.get('num_unread')).toBe(1);
                done();
            }));

            it("is cleared when ChatBoxView was scrolled down and the window become focused",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');

                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                var msgFactory = function () {
                    return test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread');
                };

                test_utils.openChatBoxFor(_converse, sender_jid);
                var chatbox = _converse.chatboxes.get(sender_jid);

                _converse.windowState = 'hidden';
                _converse.chatboxes.onMessage(msgFactory());
                expect(chatbox.get('num_unread')).toBe(1);

                _converse.saveWindowState(null, 'focus');
                expect(chatbox.get('num_unread')).toBe(0);
                done();
            }));

            it("is not cleared when ChatBoxView was scrolled up and the windows become focused",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');

                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                var msgFactory = function () {
                    return test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread');
                };

                test_utils.openChatBoxFor(_converse, sender_jid);
                var chatbox = _converse.chatboxes.get(sender_jid);
                chatbox.save('scrolled', true);

                _converse.windowState = 'hidden';
                _converse.chatboxes.onMessage(msgFactory());
                expect(chatbox.get('num_unread')).toBe(1);

                _converse.saveWindowState(null, 'focus');
                expect(chatbox.get('num_unread')).toBe(1);
                done();
            }));
        });

        describe("A RosterView's Unread Message Count", function () {

            it("is updated when message is received and chatbox is scrolled up",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.waitUntil(function () {
                    return $(_converse.rosterview.el).find('.roster-group').length;
                }, 500)
                .then(function () {
                    var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, sender_jid);
                    var chatbox = _converse.chatboxes.get(sender_jid);
                    chatbox.save('scrolled', true);

                    var msg = test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread');
                    _converse.chatboxes.onMessage(msg);

                    var msgIndicatorSelector = 'a.open-chat:contains("' + chatbox.get('fullname') + '") .msgs-indicator',
                        $msgIndicator = $($(_converse.rosterview.el).find(msgIndicatorSelector));

                    expect($msgIndicator.text()).toBe('1');

                    msg = test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread too');
                    _converse.chatboxes.onMessage(msg);

                    $msgIndicator = $($(_converse.rosterview.el).find(msgIndicatorSelector));
                    expect($msgIndicator.text()).toBe('2');
                    done();
                });
            }));

            it("is updated when message is received and chatbox is minimized",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.waitUntil(function () {
                    return $(_converse.rosterview.el).find('.roster-group').length;
                }, 500)
                .then(function () {
                    var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, sender_jid);
                    var chatbox = _converse.chatboxes.get(sender_jid);
                    var chatboxview = _converse.chatboxviews.get(sender_jid);
                    chatboxview.minimize();

                    var msg = test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread');
                    _converse.chatboxes.onMessage(msg);

                    var msgIndicatorSelector = 'a.open-chat:contains("' + chatbox.get('fullname') + '") .msgs-indicator',
                        $msgIndicator = $($(_converse.rosterview.el).find(msgIndicatorSelector));

                    expect($msgIndicator.text()).toBe('1');

                    msg = test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread too');
                    _converse.chatboxes.onMessage(msg);

                    $msgIndicator = $($(_converse.rosterview.el).find(msgIndicatorSelector));
                    expect($msgIndicator.text()).toBe('2');
                    done();
                });
            }));

            it("is cleared when chatbox is maximzied after receiving messages in minimized mode",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.waitUntil(function () {
                    return $(_converse.rosterview.el).find('.roster-group').length;
                }, 500)
                .then(function () {
                    var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, sender_jid);
                    var chatbox = _converse.chatboxes.get(sender_jid);
                    var chatboxview = _converse.chatboxviews.get(sender_jid);
                    var msgsIndicatorSelector = 'a.open-chat:contains("' + chatbox.get('fullname') + '") .msgs-indicator';
                    var selectMsgsIndicator = function () { return $($(_converse.rosterview.el).find(msgsIndicatorSelector)); };
                    var msgFactory = function () {
                        return test_utils.createChatMessage(_converse, sender_jid, 'This message will be received as unread, but eventually will be read');
                    };

                    chatboxview.minimize();

                    _converse.chatboxes.onMessage(msgFactory());
                    expect(selectMsgsIndicator().text()).toBe('1');

                    _converse.chatboxes.onMessage(msgFactory());
                    expect(selectMsgsIndicator().text()).toBe('2');

                    chatboxview.maximize();
                    expect(selectMsgsIndicator().length).toBe(0);
                    done();
                });
            }));

            it("is cleared when unread messages are viewed which were received in scrolled-up chatbox",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.waitUntil(function () {
                    return $(_converse.rosterview.el).find('.roster-group').length;
                }, 500)
                .then(function () {
                    var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, sender_jid);
                    var chatbox = _converse.chatboxes.get(sender_jid);
                    var chatboxview = _converse.chatboxviews.get(sender_jid);
                    var msgFactory = function () {
                        return test_utils.createChatMessage(_converse, sender_jid, 'This message will be received as unread, but eventually will be read');
                    };
                    var msgsIndicatorSelector = 'a.open-chat:contains("' + chatbox.get('fullname') + '") .msgs-indicator',
                        selectMsgsIndicator = function () { return $($(_converse.rosterview.el).find(msgsIndicatorSelector)); };

                    chatbox.save('scrolled', true);

                    _converse.chatboxes.onMessage(msgFactory());
                    expect(selectMsgsIndicator().text()).toBe('1');

                    chatboxview.viewUnreadMessages();
                    _converse.rosterview.render();
                    expect(selectMsgsIndicator().length).toBe(0);
                    done();
                });
            }));

            it("is not cleared after user clicks on roster view when chatbox is already opened and scrolled up",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.waitUntil(function () {
                    return $(_converse.rosterview.el).find('.roster-group').length;
                }, 500)
                .then(function () {
                    var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, sender_jid);
                    var chatbox = _converse.chatboxes.get(sender_jid);
                    var chatboxview = _converse.chatboxviews.get(sender_jid);
                    var msgFactory = function () {
                        return test_utils.createChatMessage(_converse, sender_jid, 'This message will be received as unread, but eventually will be read');
                    };
                    var msgsIndicatorSelector = 'a.open-chat:contains("' + chatbox.get('fullname') + '") .msgs-indicator',
                        selectMsgsIndicator = function () { return $($(_converse.rosterview.el).find(msgsIndicatorSelector)); };

                    chatbox.save('scrolled', true);

                    _converse.chatboxes.onMessage(msgFactory());
                    expect(selectMsgsIndicator().text()).toBe('1');

                    test_utils.openChatBoxFor(_converse, sender_jid);
                    expect(selectMsgsIndicator().text()).toBe('1');
                    done();
                });
            }));
        });

        describe("A Minimized ChatBoxView's Unread Message Count", function () {

            it("is displayed when scrolled up chatbox is minimized after receiving unread messages",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');

                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                test_utils.openChatBoxFor(_converse, sender_jid);
                var msgFactory = function () {
                    return test_utils.createChatMessage(_converse, sender_jid, 'This message will be received as unread, but eventually will be read');
                };
                var selectUnreadMsgCount = function () {
                    var minimizedChatBoxView = _converse.minimized_chats.get(sender_jid);
                    return $(minimizedChatBoxView.el).find('.message-count');
                };

                var chatbox = _converse.chatboxes.get(sender_jid);
                chatbox.save('scrolled', true);
                _converse.chatboxes.onMessage(msgFactory());

                var chatboxview = _converse.chatboxviews.get(sender_jid);
                chatboxview.minimize();

                var $unreadMsgCount = selectUnreadMsgCount();
                expect(u.isVisible($unreadMsgCount[0])).toBeTruthy();
                expect($unreadMsgCount.html()).toBe('1');
                done();
            }));

            it("is incremented when message is received and windows is not focused",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');

                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                test_utils.openChatBoxFor(_converse, sender_jid);
                var msgFactory = function () {
                    return test_utils.createChatMessage(_converse, sender_jid, 'This message will be received as unread, but eventually will be read');
                };
                var selectUnreadMsgCount = function () {
                    var minimizedChatBoxView = _converse.minimized_chats.get(sender_jid);
                    return $(minimizedChatBoxView.el).find('.message-count');
                };

                var chatboxview = _converse.chatboxviews.get(sender_jid);
                chatboxview.minimize();

                _converse.chatboxes.onMessage(msgFactory());

                var $unreadMsgCount = selectUnreadMsgCount();
                expect(u.isVisible($unreadMsgCount[0])).toBeTruthy();
                expect($unreadMsgCount.html()).toBe('1');
                done();
            }));

            it("will render Openstreetmap-URL from geo-URI",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    var base_url = document.URL.split(window.location.pathname)[0];
                    var message = "geo:37.786971,-122.399677";
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    spyOn(view.model, 'sendMessage').and.callThrough();
                    test_utils.sendMessage(view, message);

                    test_utils.waitUntil(function () {
                        return $(view.el).find('.chat-content').find('.chat-msg').length;
                    }, 1000).then(function () {
                        expect(view.model.sendMessage).toHaveBeenCalled();
                        var msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg-text');
                        expect(msg.html()).toEqual(
                            '<a target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=37.786971&amp;'+
                            'mlon=-122.399677#map=18/37.786971/-122.399677">https://www.openstreetmap.org/?mlat=37.7869'+
                            '71&amp;mlon=-122.399677#map=18/37.786971/-122.399677</a>');
                        done();
                    });
                }));
        });
    });
}));
