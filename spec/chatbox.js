(function (root, factory) {
    define([
        "utils",
        "converse-core",
        "mock",
        "test-utils"
        ], factory);
} (this, function (utils, converse, mock, test_utils) {
    "use strict";
    var _ = converse.env._;
    var $ = converse.env.jQuery;
    var $msg = converse.env.$msg;
    var Strophe = converse.env.Strophe;
    var moment = converse.env.moment;

    return describe("Chatboxes", function() {
        describe("A Chatbox", function () {

            it("supports the /me command", mock.initConverse(function (_converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(_converse);
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
                var view = _converse.chatboxviews.get(sender_jid);
                expect(_.includes(view.$el.find('.chat-msg-author').text(), '**Max Frankfurter')).toBeTruthy();
                expect(view.$el.find('.chat-msg-content').text()).toBe(' is tired');

                message = '/me is as well';
                test_utils.sendMessage(view, message);
                expect(_.includes(view.$el.find('.chat-msg-author:last').text(), '**Max Mustermann')).toBeTruthy();
                expect(view.$el.find('.chat-msg-content:last').text()).toBe(' is as well');
            }));

            it("is created when you click on a roster item", mock.initConverse(function (_converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(_converse);

                var i, $el, jid, chatboxview;
                // openControlBox was called earlier, so the controlbox is
                // visible, but no other chat boxes have been created.
                expect(_converse.chatboxes.length).toEqual(1);
                spyOn(_converse.chatboxviews, 'trimChats');
                expect($("#conversejs .chatbox").length).toBe(1); // Controlbox is open

                var online_contacts = _converse.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact').find('a.open-chat');
                for (i=0; i<online_contacts.length; i++) {
                    $el = $(online_contacts[i]);
                    jid = $el.text().replace(/ /g,'.').toLowerCase() + '@localhost';
                    $el.click();
                    chatboxview = _converse.chatboxviews.get(jid);
                    expect(_converse.chatboxes.length).toEqual(i+2);
                    expect(_converse.chatboxviews.trimChats).toHaveBeenCalled();
                    // Check that new chat boxes are created to the left of the
                    // controlbox (but to the right of all existing chat boxes)
                    expect($("#conversejs .chatbox").length).toBe(i+2);
                    expect($("#conversejs .chatbox")[1].id).toBe(chatboxview.model.get('box_id'));
                }
            }));

            it("can be trimmed to conserve space", mock.initConverseWithAsync(function (done, _converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(_converse);

                var i, $el, jid, chatbox, chatboxview, trimmedview;
                // openControlBox was called earlier, so the controlbox is
                // visible, but no other chat boxes have been created.
                var trimmed_chatboxes = _converse.minimized_chats;
                expect(_converse.chatboxes.length).toEqual(1);
                spyOn(_converse.chatboxviews, 'trimChats');
                spyOn(trimmed_chatboxes, 'addChat').and.callThrough();
                spyOn(trimmed_chatboxes, 'removeChat').and.callThrough();
                expect($("#conversejs .chatbox").length).toBe(1); // Controlbox is open

                _converse.rosterview.update(); // XXX: Hack to make sure $roster element is attaced.
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                    }, 300)
                .then(function () {
                    // Test that they can be maximized again
                    var online_contacts = _converse.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact').find('a.open-chat');
                    for (i=0; i<online_contacts.length; i++) {
                        $el = $(online_contacts[i]);
                        jid = _.trim($el.text()).replace(/ /g,'.').toLowerCase() + '@localhost';
                        $el.click();
                        expect(_converse.chatboxviews.trimChats).toHaveBeenCalled();

                        chatboxview = _converse.chatboxviews.get(jid);
                        spyOn(chatboxview, 'minimize').and.callThrough();
                        chatboxview.model.set({'minimized': true});
                        expect(trimmed_chatboxes.addChat).toHaveBeenCalled();
                        expect(chatboxview.minimize).toHaveBeenCalled();
                    }
                    return test_utils.waitUntil(function () {
                            return _converse.chatboxviews.keys().length > 1;
                        }, 500)
                }).then(function () {
                    var key = _converse.chatboxviews.keys()[1];
                    trimmedview = trimmed_chatboxes.get(key);
                    chatbox = trimmedview.model;
                    spyOn(chatbox, 'maximize').and.callThrough();
                    spyOn(trimmedview, 'restore').and.callThrough();
                    trimmedview.delegateEvents();
                    trimmedview.$("a.restore-chat").click();

                    expect(trimmedview.restore).toHaveBeenCalled();
                    expect(chatbox.maximize).toHaveBeenCalled();
                    expect(_converse.chatboxviews.trimChats).toHaveBeenCalled();
                    done();
                });
            }));

            it("can be opened in minimized mode initially", mock.initConverse(function(_converse) {
                test_utils.createContacts(_converse, 'current');

                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                var chat = _converse.api.chats.open(sender_jid, {
                    minimized: true
                });

                var chatBoxView = _converse.chatboxviews.get(sender_jid);
                expect(chatBoxView.$el.is(':visible')).toBeFalsy();

                var minimized_chat = _converse.minimized_chats.get(sender_jid);
                expect(minimized_chat).toBeTruthy();
                expect(minimized_chat.$el.is(':visible')).toBeTruthy();
            }));

            it("is focused if its already open and you click on its corresponding roster item", mock.initConverseWithAsync(function (done, _converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(_converse);

                var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                var $el, jid, chatboxview, chatbox;
                // openControlBox was called earlier, so the controlbox is
                // visible, but no other chat boxes have been created.
                expect(_converse.chatboxes.length).toEqual(1);
                chatbox = test_utils.openChatBoxFor(_converse, contact_jid);
                chatboxview = _converse.chatboxviews.get(contact_jid);
                spyOn(chatboxview, 'focus');
                // Test that they can be trimmed
                _converse.rosterview.update(); // XXX: Hack to make sure $roster element is attaced.
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                    }, 300)
                .then(function () {
                    $el = _converse.rosterview.$el.find('a.open-chat:contains("'+chatbox.get('fullname')+'")');
                    jid = $el.text().replace(/ /g,'.').toLowerCase() + '@localhost';
                    $el.click();
                    setTimeout(function () {
                        expect(_converse.chatboxes.length).toEqual(2);
                        expect(chatboxview.focus).toHaveBeenCalled();
                        done();
                    }, 500);
                });
            }));

            it("can be saved to, and retrieved from, browserStorage", mock.initConverse(function (_converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(_converse);

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
            }));

            it("can be closed by clicking a DOM element with class 'close-chatbox-button'", mock.initConverseWithAsync(function (done, _converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(_converse);
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                    }, 300)
                .then(function () {
                    var chatbox = test_utils.openChatBoxes(_converse, 1)[0],
                        controlview = _converse.chatboxviews.get('controlbox'), // The controlbox is currently open
                        chatview = _converse.chatboxviews.get(chatbox.get('jid'));
                    spyOn(chatview, 'close').and.callThrough();
                    spyOn(controlview, 'close').and.callThrough();
                    spyOn(_converse, 'emit');

                    // We need to rebind all events otherwise our spy won't be called
                    controlview.delegateEvents();
                    chatview.delegateEvents();

                    controlview.$el.find('.close-chatbox-button').click();

                    expect(controlview.close).toHaveBeenCalled();
                    expect(_converse.emit).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                    expect(_converse.emit.calls.count(), 1);
                    chatview.$el.find('.close-chatbox-button').click();

                    expect(chatview.close).toHaveBeenCalled();
                    expect(_converse.emit).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                    expect(_converse.emit.calls.count(), 2);
                    done();
                });
            }));

            it("can be minimized by clicking a DOM element with class 'toggle-chatbox-button'", mock.initConverseWithAsync(function (done, _converse) {
                var chatview;
                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(_converse);
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
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

                    chatview.$el.find('.toggle-chatbox-button').click();

                    expect(chatview.minimize).toHaveBeenCalled();
                    expect(_converse.emit).toHaveBeenCalledWith('chatBoxMinimized', jasmine.any(Object));
                    expect(_converse.emit.calls.count(), 2);
                    expect(chatview.$el.is(':visible')).toBeFalsy();
                    expect(chatview.model.get('minimized')).toBeTruthy();
                    chatview.$el.find('.toggle-chatbox-button').click();
                    trimmedview = trimmed_chatboxes.get(chatview.model.get('id'));
                    spyOn(trimmedview, 'restore').and.callThrough();
                    trimmedview.delegateEvents();
                    trimmedview.$("a.restore-chat").click();

                    expect(trimmedview.restore).toHaveBeenCalled();
                    expect(_converse.emit).toHaveBeenCalledWith('chatBoxMaximized', jasmine.any(Object));
                    return test_utils.waitUntil(function () {
                        return chatview.$el.find('.chat-body').is(':visible');
                    }, 500)
                }).then(function () {
                    expect(chatview.$el.find('.toggle-chatbox-button').hasClass('icon-minus')).toBeTruthy();
                    expect(chatview.$el.find('.toggle-chatbox-button').hasClass('icon-plus')).toBeFalsy();
                    expect(chatview.model.get('minimized')).toBeFalsy();
                    done();
                });
            }));

            it("will be removed from browserStorage when closed", mock.initConverseWithAsync(function (done, _converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(_converse);
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                    }, 300)
                .then(function () {
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

                it("can be found on each chat box", mock.initConverse(function (_converse) {
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(_converse);

                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    var chatbox = _converse.chatboxes.get(contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    expect(chatbox).toBeDefined();
                    expect(view).toBeDefined();
                    var $toolbar = view.$el.find('ul.chat-toolbar');
                    expect($toolbar.length).toBe(1);
                    expect($toolbar.children('li').length).toBe(3);
                }));

                it("contains a button for inserting emoticons", mock.initConverseWithAsync(function (done, _converse) {
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(_converse);

                    test_utils.waitUntil(function () {
                            return _converse.rosterview.$el.find('dt').length;
                        }, 300)
                    .then(function () {
                        var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost',
                            view, $toolbar, $textarea;
                        test_utils.openChatBoxFor(_converse, contact_jid);
                        view = _converse.chatboxviews.get(contact_jid);
                        $toolbar = view.$el.find('ul.chat-toolbar');
                        $textarea = view.$el.find('textarea.chat-textarea');
                        expect($toolbar.children('li.toggle-smiley').length).toBe(1);
                        // Register spies
                        spyOn(view, 'toggleEmoticonMenu').and.callThrough();
                        spyOn(view, 'insertEmoticon').and.callThrough();
                        view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                        $toolbar.children('li.toggle-smiley').click();

                        expect(view.toggleEmoticonMenu).toHaveBeenCalled();
                        var $menu = view.$el.find('.toggle-smiley ul');
                        var $items = $menu.children('li');
                        expect($menu.is(':visible')).toBeTruthy();
                        expect($items.length).toBe(13);
                        expect($($items[0]).children('a').data('emoticon')).toBe(':)');
                        expect($($items[1]).children('a').data('emoticon')).toBe(';)');
                        expect($($items[2]).children('a').data('emoticon')).toBe(':D');
                        expect($($items[3]).children('a').data('emoticon')).toBe(':P');
                        expect($($items[4]).children('a').data('emoticon')).toBe('8)');
                        expect($($items[5]).children('a').data('emoticon')).toBe('>:)');
                        expect($($items[6]).children('a').data('emoticon')).toBe(':S');
                        expect($($items[7]).children('a').data('emoticon')).toBe(':\\');
                        expect($($items[8]).children('a').data('emoticon')).toBe('>:(');
                        expect($($items[9]).children('a').data('emoticon')).toBe(':(');
                        expect($($items[10]).children('a').data('emoticon')).toBe(':O');
                        expect($($items[11]).children('a').data('emoticon')).toBe('(^.^)b');
                        expect($($items[12]).children('a').data('emoticon')).toBe('<3');
                        $items.first().click();

                        expect(view.insertEmoticon).toHaveBeenCalled();
                        expect($textarea.val()).toBe(':) ');
                        expect(view.$el.find('.toggle-smiley ul').is(':visible')).toBeFalsy();
                        $toolbar.children('li.toggle-smiley').click();

                        expect(view.toggleEmoticonMenu).toHaveBeenCalled();
                        expect(view.$el.find('.toggle-smiley ul').is(':visible')).toBeTruthy();
                        view.$el.find('.toggle-smiley ul').children('li').last().click();

                        expect(view.insertEmoticon).toHaveBeenCalled();
                        expect(view.$el.find('.toggle-smiley ul').is(':visible')).toBeFalsy();
                        expect($textarea.val()).toBe(':) <3 ');
                        done();
                    });
                }));

                it("contains a button for starting an encrypted chat session", mock.initConverseWithAsync(function (done, _converse) {
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(_converse);

                    test_utils.waitUntil(function () {
                            return _converse.rosterview.$el.find('dt').length;
                        }, 300)
                    .then(function () {
                        // TODO: More tests can be added here...
                        var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                        test_utils.openChatBoxFor(_converse, contact_jid);
                        var view = _converse.chatboxviews.get(contact_jid);
                        var $toolbar = view.$el.find('ul.chat-toolbar');
                        expect($toolbar.children('li.toggle-otr').length).toBe(1);
                        // Register spies
                        spyOn(view, 'toggleOTRMenu').and.callThrough();
                        view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called

                        $toolbar.children('li.toggle-otr').click();

                        expect(view.toggleOTRMenu).toHaveBeenCalled();
                        var $menu = view.$el.find('.toggle-otr ul');
                        expect($menu.is(':visible')).toBeTruthy();
                        expect($menu.children('li').length).toBe(2);
                        done();
                    });
                }));

                it("can contain a button for starting a call", mock.initConverse(function (_converse) {
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(_converse);

                    var view, callButton, $toolbar;
                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                    spyOn(_converse, 'emit');
                    // First check that the button doesn't show if it's not enabled
                    // via "visible_toolbar_buttons"
                    _converse.visible_toolbar_buttons.call = false;
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    view = _converse.chatboxviews.get(contact_jid);
                    $toolbar = view.$el.find('ul.chat-toolbar');
                    callButton = $toolbar.find('.toggle-call');
                    expect(callButton.length).toBe(0);
                    view.close();
                    // Now check that it's shown if enabled and that it emits
                    // callButtonClicked
                    _converse.visible_toolbar_buttons.call = true; // enable the button
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    view = _converse.chatboxviews.get(contact_jid);
                    $toolbar = view.$el.find('ul.chat-toolbar');
                    callButton = $toolbar.find('.toggle-call');
                    expect(callButton.length).toBe(1);
                    callButton.click();
                    expect(_converse.emit).toHaveBeenCalledWith('callButtonClicked', jasmine.any(Object));
                }));

                it("can contain a button for clearing messages", mock.initConverse(function (_converse) {
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(_converse);

                    var view, clearButton, $toolbar;
                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                    // First check that the button doesn't show if it's not enabled
                    // via "visible_toolbar_buttons"
                    _converse.visible_toolbar_buttons.clear = false;
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    view = _converse.chatboxviews.get(contact_jid);
                    view = _converse.chatboxviews.get(contact_jid);
                    $toolbar = view.$el.find('ul.chat-toolbar');
                    clearButton = $toolbar.find('.toggle-clear');
                    expect(clearButton.length).toBe(0);
                    view.close();
                    // Now check that it's shown if enabled and that it calls
                    // clearMessages
                    _converse.visible_toolbar_buttons.clear = true; // enable the button
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    view = _converse.chatboxviews.get(contact_jid);
                    $toolbar = view.$el.find('ul.chat-toolbar');
                    clearButton = $toolbar.find('.toggle-clear');
                    expect(clearButton.length).toBe(1);
                    spyOn(view, 'clearMessages');
                    view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                    clearButton.click();
                    expect(view.clearMessages).toHaveBeenCalled();
                }));
            });

            describe("A Chat Message", function () {

                describe("when received from someone else", function () {
                    it("can be received which will open a chatbox and be displayed inside it", mock.initConverseWithAsync(function (done, _converse) {
                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(_converse);
                        test_utils.waitUntil(function () {
                                return _converse.rosterview.$el.find('dt').length;
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
                            var $chat_content = chatboxview.$el.find('.chat-content');
                            var msg_txt = $chat_content.find('.chat-message').find('.chat-msg-content').text();
                            expect(msg_txt).toEqual(message);
                            var sender_txt = $chat_content.find('span.chat-msg-them').text();
                            expect(sender_txt.match(/^[0-9][0-9]:[0-9][0-9] /)).toBeTruthy();
                            done();
                        });
                    }));

                    describe("who is not on the roster", function () {
                        it("will open a chatbox and be displayed inside it if allow_non_roster_messaging is true", mock.initConverse(function (_converse) {
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

                            // onMessage is a handler for received XMPP messages
                            _converse.chatboxes.onMessage(msg);
                            expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));

                            var chatbox = _converse.chatboxes.get(sender_jid);
                            expect(chatbox).not.toBeDefined();

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
                            expect(msg_obj.get('fullname')).toEqual(sender_jid);
                            expect(msg_obj.get('sender')).toEqual('them');
                            expect(msg_obj.get('delayed')).toEqual(false);
                            // Now check that the message appears inside the chatbox in the DOM
                            var $chat_content = chatboxview.$el.find('.chat-content');
                            var msg_txt = $chat_content.find('.chat-message').find('.chat-msg-content').text();
                            expect(msg_txt).toEqual(message);
                            var sender_txt = $chat_content.find('span.chat-msg-them').text();
                            expect(sender_txt.match(/^[0-9][0-9]:[0-9][0-9] /)).toBeTruthy();
                        }));
                    });

                    describe("and for which then an error message is received from the server", function () {

                        it("will have the error message displayed after itself", mock.initConverse(function (_converse) {
                            test_utils.createContacts(_converse, 'current');
                            test_utils.openControlBox();
                            test_utils.openContactsPanel(_converse);

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
                            view.sendMessage(message);
                            var $chat_content = view.$el.find('.chat-content');
                            var msg_txt = $chat_content.find('.chat-message:last').find('.chat-msg-content').text();
                            expect(msg_txt).toEqual(msg_text);

                            // We send another message, for which an error will
                            // not be received, to test that errors appear
                            // after the relevant message.
                            msg_text = 'This message will be sent, and not receive an error';
                            message = view.model.messages.create({
                                'msgid': '6fcdeee3-000f-4ce8-a17e-9ce28f0ae104',
                                'fullname': fullname,
                                'sender': 'me',
                                'time': moment().format(),
                                'message': msg_text
                            });
                            view.sendMessage(message);
                            msg_txt = $chat_content.find('.chat-message:last').find('.chat-msg-content').text();
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

                            /* Incoming error messages that are not tied to a
                             * certain show message (via the msgid attribute),
                             * are not shown at all. The reason for this is
                             * that we may get error messages for chat state
                             * notifications as well.
                             */
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
                            expect($chat_content.find('.chat-error').length).toEqual(1);
                        }));
                    });

                    it("will cause the chat area to be scrolled down only if it was at the bottom already", mock.initConverseWithAsync(function (done, _converse) {
                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(_converse);

                        var message = 'This message is received while the chat area is scrolled up';
                        var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                        test_utils.openChatBoxFor(_converse, sender_jid);
                        var chatboxview = _converse.chatboxviews.get(sender_jid);
                        spyOn(chatboxview, 'scrollDown').and.callThrough();
                        var $chat_content = chatboxview.$el.find('.chat-content');
                        /* Create enough messages so that there's a
                         * scrollbar.
                         */
                        for (var i=0; i<20; i++) {
                            _converse.chatboxes.onMessage($msg({
                                    from: sender_jid,
                                    to: _converse.connection.jid,
                                    type: 'chat',
                                    id: (new Date()).getTime()
                                }).c('body').t('Message: '+i).up()
                                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
                        }

                        test_utils.waitUntil(function () {
                                return chatboxview.$content.scrollTop();
                            }, 300)
                        .then(function () {
                            return test_utils.waitUntil(function () {
                                return !chatboxview.model.get('auto_scrolled');
                            }, 300)
                        }).then(function () {
                            chatboxview.$content.scrollTop(0);
                            return test_utils.waitUntil(function () {
                                return chatboxview.model.get('scrolled');
                            }, 900)
                        }).then(function () {
                            _converse.chatboxes.onMessage($msg({
                                    from: sender_jid,
                                    to: _converse.connection.jid,
                                    type: 'chat',
                                    id: (new Date()).getTime()
                                }).c('body').t(message).up()
                                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());

                            // Now check that the message appears inside the chatbox in the DOM
                            var $chat_content = chatboxview.$el.find('.chat-content');
                            var msg_txt = $chat_content.find('.chat-message:last').find('.chat-msg-content').text();
                            expect(msg_txt).toEqual(message);
                            return test_utils.waitUntil(function () {
                                return chatboxview.$('.new-msgs-indicator').is(':visible');
                            }, 300)
                        }).then(function () {
                            expect(chatboxview.model.get('scrolled')).toBe(true);
                            expect(chatboxview.$content.scrollTop()).toBe(0);
                            expect(chatboxview.$('.new-msgs-indicator').is(':visible')).toBeTruthy();
                            // Scroll down again
                            chatboxview.$content.scrollTop(chatboxview.$content[0].scrollHeight);
                            return test_utils.waitUntil(function () {
                                return !chatboxview.$('.new-msgs-indicator').is(':visible');
                            }, 300)
                        }).then(done);
                    }));

                    it("is ignored if it's intended for a different resource and filter_by_resource is set to true",
                            mock.initConverseWithAsync(function (done, _converse) {
                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(_converse);

                        test_utils.waitUntil(function () {
                                return _converse.rosterview.$el.find('dt').length;
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
                                    "onMessage: Ignoring incoming message intended for a different resource: dummy@localhost/some-other-resource", "info");
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
                            var $chat_content = chatboxview.$el.find('.chat-content:last');
                            var msg_txt = $chat_content.find('.chat-message').find('.chat-msg-content').text();
                            expect(msg_txt).toEqual(message);
                            done();
                        });
                    }));
                });

                it("is ignored if it's a malformed headline message", mock.initConverse(function (_converse) {
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(_converse);

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
                        "info"
                    )).toBeTruthy();
                    expect(utils.isHeadlineMessage.called).toBeTruthy();
                    expect(utils.isHeadlineMessage.returned(true)).toBeTruthy();
                    expect(_converse.chatboxes.getChatBox.called).toBeFalsy();
                    // Remove sinon spies
                    _converse.log.restore();
                    _converse.chatboxes.getChatBox.restore();
                    utils.isHeadlineMessage.restore();
                }));

                it("can be a carbon message, as defined in XEP-0280", mock.initConverse(function (_converse) {
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(_converse);

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
                    var $chat_content = chatboxview.$el.find('.chat-content');
                    var msg_txt = $chat_content.find('.chat-message').find('.chat-msg-content').text();
                    expect(msg_txt).toEqual(msgtext);
                    var sender_txt = $chat_content.find('span.chat-msg-them').text();
                    expect(sender_txt.match(/^[0-9][0-9]:[0-9][0-9] /)).toBeTruthy();
                }));

                it("can be a carbon message that this user sent from a different client, as defined in XEP-0280", mock.initConverse(function (_converse) {
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(_converse);

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
                    var $chat_content = chatboxview.$el.find('.chat-content');
                    var msg_txt = $chat_content.find('.chat-message').find('.chat-msg-content').text();
                    expect(msg_txt).toEqual(msgtext);
                }));

                it("will be discarded if it's a malicious message meant to look like a carbon copy", mock.initConverse(function (_converse) {
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(_converse);
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
                }));

                it("received for a minimized chat box will increment a counter on its header",
                        mock.initConverseWithAsync(function (done, _converse) {
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(_converse);
                    test_utils.waitUntil(function () {
                            return _converse.rosterview.$el.find('dt').length;
                        }, 300)
                    .then(function () {
                        var contact_name = mock.cur_names[0];
                        var contact_jid = contact_name.replace(/ /g,'.').toLowerCase() + '@localhost';

                        spyOn(_converse, 'emit').and.callThrough();
                        test_utils.openChatBoxFor(_converse, contact_jid);
                        var chatview = _converse.chatboxviews.get(contact_jid);
                        expect(chatview.$el.is(':visible')).toBeTruthy();
                        expect(chatview.model.get('minimized')).toBeFalsy();
                        chatview.$el.find('.toggle-chatbox-button').click();
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
                        var $count = trimmedview.$el.find('.chat-head-message-count');
                        expect(chatview.$el.is(':visible')).toBeFalsy();
                        expect(trimmedview.model.get('minimized')).toBeTruthy();
                        expect($count.is(':visible')).toBeTruthy();
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
                        expect(chatview.$el.is(':visible')).toBeFalsy();
                        expect(trimmedview.model.get('minimized')).toBeTruthy();
                        $count = trimmedview.$el.find('.chat-head-message-count');
                        expect($count.is(':visible')).toBeTruthy();
                        expect($count.html()).toBe('2');
                        trimmedview.$el.find('.restore-chat').click();
                        expect(trimmed_chatboxes.keys().length).toBe(0);
                        done();
                    });
                }));

                it("will indicate when it has a time difference of more than a day between it and its predecessor",
                        mock.initConverseWithAsync(function (done, _converse) {
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(_converse);
                    test_utils.waitUntil(function () {
                            return _converse.rosterview.$el.find('dt').length;
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
                        var $chat_content = chatboxview.$el.find('.chat-content');
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
                        msg_txt = $chat_content.find('.chat-message').find('.chat-msg-content').text();
                        expect(msg_txt).toEqual(message);
                        sender_txt = $chat_content.find('span.chat-msg-them').text();
                        expect(sender_txt.match(/^[0-9][0-9]:[0-9][0-9] /)).toBeTruthy();

                        var $time = $chat_content.find('time');
                        expect($time.length).toEqual(1);
                        expect($time.attr('class')).toEqual('chat-info chat-date');
                        expect($time.data('isodate')).toEqual(moment(one_day_ago.startOf('day')).format());
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
                        $time = $chat_content.find('time');
                        expect($time.length).toEqual(2); // There are now two time elements
                        $time = $chat_content.find('time:last'); // We check the last one
                        var message_date = new Date();
                        expect($time.attr('class')).toEqual('chat-info chat-date');
                        expect($time.data('isodate')).toEqual(moment(message_date).startOf('day').format());
                        expect($time.text()).toEqual(moment(message_date).startOf('day').format("dddd MMM Do YYYY"));

                        // Normal checks for the 2nd message
                        expect(chatbox.messages.length).toEqual(2);
                        msg_obj = chatbox.messages.models[1];
                        expect(msg_obj.get('message')).toEqual(message);
                        expect(msg_obj.get('fullname')).toEqual(contact_name);
                        expect(msg_obj.get('sender')).toEqual('them');
                        expect(msg_obj.get('delayed')).toEqual(false);
                        msg_txt = $chat_content.find('.chat-message').last().find('.chat-msg-content').text();
                        expect(msg_txt).toEqual(message);
                        sender_txt = $chat_content.find('span.chat-msg-them').last().text();
                        expect(sender_txt.match(/^[0-9][0-9]:[0-9][0-9] /)).toBeTruthy();
                        done();
                    });
                }));

                it("can be sent from a chatbox, and will appear inside it", mock.initConverse(function (_converse) {
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(_converse);

                    spyOn(_converse, 'emit');
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    expect(_converse.emit).toHaveBeenCalledWith('chatBoxFocused', jasmine.any(Object));
                    var view = _converse.chatboxviews.get(contact_jid);
                    var message = 'This message is sent from this chatbox';
                    spyOn(view, 'sendMessage').and.callThrough();
                    test_utils.sendMessage(view, message);
                    expect(view.sendMessage).toHaveBeenCalled();
                    expect(view.model.messages.length, 2);
                    expect(_converse.emit.calls.mostRecent().args, ['messageSend', message]);
                    expect(view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content').text()).toEqual(message);
                }));

                it("is sanitized to prevent Javascript injection attacks", mock.initConverse(function (_converse) {
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(_converse);

                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    var message = '<p>This message contains <em>some</em> <b>markup</b></p>';
                    spyOn(view, 'sendMessage').and.callThrough();
                    test_utils.sendMessage(view, message);
                    expect(view.sendMessage).toHaveBeenCalled();
                    var msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('&lt;p&gt;This message contains &lt;em&gt;some&lt;/em&gt; &lt;b&gt;markup&lt;/b&gt;&lt;/p&gt;');
                }));

                it("should display emoticons correctly", mock.initConverse(function (_converse) {
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(_converse);

                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    var messages = [':)', ';)', ':D', ':P', '8)', '>:)', ':S', ':\\', '>:(', ':(', ':O', '(^.^)b', '<3'];
                    var emoticons = [
                        '<span class="emoticon icon-smiley"></span>', '<span class="emoticon icon-wink"></span>',
                        '<span class="emoticon icon-grin"></span>', '<span class="emoticon icon-tongue"></span>',
                        '<span class="emoticon icon-cool"></span>', '<span class="emoticon icon-evil"></span>',
                        '<span class="emoticon icon-confused"></span>', '<span class="emoticon icon-wondering"></span>',
                        '<span class="emoticon icon-angry"></span>', '<span class="emoticon icon-sad"></span>',
                        '<span class="emoticon icon-shocked"></span>', '<span class="emoticon icon-thumbs-up"></span>',
                        '<span class="emoticon icon-heart"></span>'
                        ];
                    spyOn(view, 'sendMessage').and.callThrough();
                    for (var i = 0; i < messages.length; i++) {
                        var message = messages[i];
                        test_utils.sendMessage(view, message);
                        expect(view.sendMessage).toHaveBeenCalled();
                        var msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content');
                        expect(msg.html()).toEqual(emoticons[i]);
                    }
                }));

                it("can contain hyperlinks, which will be clickable", mock.initConverse(function (_converse) {
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(_converse);

                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    var message = 'This message contains a hyperlink: www.opkode.com';
                    spyOn(view, 'sendMessage').and.callThrough();
                    test_utils.sendMessage(view, message);
                    expect(view.sendMessage).toHaveBeenCalled();
                    var msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('This message contains a hyperlink: <a target="_blank" rel="noopener" href="http://www.opkode.com">www.opkode.com</a>');
                }));

                it("will have properly escaped URLs", mock.initConverse(function (_converse) {
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(_converse);

                    var message, msg;
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    spyOn(view, 'sendMessage').and.callThrough();
                    message = "http://www.opkode.com/'onmouseover='alert(1)'whatever";
                    test_utils.sendMessage(view, message);
                    expect(view.sendMessage).toHaveBeenCalled();
                    msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('<a target="_blank" rel="noopener" href="http://www.opkode.com/%27onmouseover=%27alert%281%29%27whatever">http://www.opkode.com/\'onmouseover=\'alert(1)\'whatever</a>');

                    message = 'http://www.opkode.com/"onmouseover="alert(1)"whatever';
                    test_utils.sendMessage(view, message);

                    expect(view.sendMessage).toHaveBeenCalled();
                    msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('<a target="_blank" rel="noopener" href="http://www.opkode.com/%22onmouseover=%22alert%281%29%22whatever">http://www.opkode.com/"onmouseover="alert(1)"whatever</a>');

                    message = "https://en.wikipedia.org/wiki/Ender's_Game";
                    test_utils.sendMessage(view, message);

                    expect(view.sendMessage).toHaveBeenCalled();
                    msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('<a target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/Ender%27s_Game">https://en.wikipedia.org/wiki/Ender\'s_Game</a>');

                    message = "https://en.wikipedia.org/wiki/Ender%27s_Game";
                    test_utils.sendMessage(view, message);

                    expect(view.sendMessage).toHaveBeenCalled();
                    msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('<a target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/Ender%27s_Game">https://en.wikipedia.org/wiki/Ender%27s_Game</a>');
                }));

                it("will render images from their URLs", mock.initConverseWithAsync(function (done, _converse) {
                    if (/PhantomJS/.test(window.navigator.userAgent)) {
                        // Doesn't work when running tests in PhantomJS, since
                        // the page is loaded via file:///
                        done();
                        return;
                    }
                    test_utils.createContacts(_converse, 'current');
                    var base_url = document.URL.split(window.location.pathname)[0];
                    var message = base_url+"/logo/conversejs.svg";
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    spyOn(view, 'sendMessage').and.callThrough();
                    test_utils.sendMessage(view, message);

                    test_utils.waitUntil(function () {
                        return view.$el.find('.chat-content').find('.chat-message img').length;
                    }, 500).then(function () {
                        expect(view.sendMessage).toHaveBeenCalled();
                        var msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content');
                        expect(msg.html()).toEqual('<img src="'+message+'" class="chat-image">');
                        message += "?param1=val1&param2=val2";
                        test_utils.sendMessage(view, message);
                        return test_utils.waitUntil(function () {
                            return view.$el.find('.chat-content').find('.chat-message img').length === 2;
                        }, 500)
                    }).then(function () {
                        expect(view.sendMessage).toHaveBeenCalled();
                        var msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content');
                        expect(msg.html()).toEqual('<img src="'+message.replace(/&/g, '&amp;')+'" class="chat-image">');
                        done();
                    });
                }));

                it("will render the message time as configured", mock.initConverse(function (_converse) {
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
                    var msg_time_author = view.$el.find('.chat-content').find('.chat-message')
                                            .last().find('.chat-msg-author.chat-msg-me').text();
                    var msg_time_rendered = msg_time_author.split(" ",1);
                    var msg_time = moment(msg_object.get('time')).format(_converse.time_format);
                    expect(msg_time_rendered[0]).toBe(msg_time);
                }));
            });

            describe("A Chat Status Notification", function () {

                it("does not open automatically if a chat state notification is received", mock.initConverse(function (_converse) {
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(_converse);

                    spyOn(_converse, 'emit');
                    var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                    // <composing> state
                    var msg = $msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: (new Date()).getTime()
                        }).c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                    _converse.chatboxes.onMessage(msg);
                    expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                }));

                describe("An active notification", function () {

                    it("is sent when the user opens a chat box", mock.initConverseWithAsync(function (done, _converse) {
                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(_converse);
                        test_utils.waitUntil(function () {
                            return _converse.rosterview.$el.find('dt').length;
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

                    it("is sent when the user maximizes a minimized a chat box", mock.initConverseWithAsync(function (done, _converse) {
                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(_converse);
                        var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';

                        test_utils.waitUntil(function () {
                            return _converse.rosterview.$el.find('dt').length;
                        }, 300).then(function () {
                            test_utils.openChatBoxFor(_converse, contact_jid);
                            var view = _converse.chatboxviews.get(contact_jid);
                            view.model.minimize();
                            expect(view.model.get('chat_state')).toBe('inactive');
                            spyOn(_converse.connection, 'send');
                            view.model.maximize();
                            return test_utils.waitUntil(function () {
                                return view.model.get('chat_state') === 'active';
                            }, 300)
                        }).then(function () {
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
                });

                describe("A composing notification", function () {

                    it("is sent as soon as the user starts typing a message which is not a command", mock.initConverseWithAsync(function (done, _converse) {
                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(_converse);
                        test_utils.waitUntil(function () {
                                return _converse.rosterview.$el.find('dt').length;
                            }, 300)
                        .then(function () {
                            var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                            test_utils.openChatBoxFor(_converse, contact_jid);
                            var view = _converse.chatboxviews.get(contact_jid);
                            expect(view.model.get('chat_state')).toBe('active');
                            spyOn(_converse.connection, 'send');
                            spyOn(_converse, 'emit');
                            view.keyPressed({
                                target: view.$el.find('textarea.chat-textarea'),
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
                                target: view.$el.find('textarea.chat-textarea'),
                                keyCode: 1
                            });
                            expect(view.model.get('chat_state')).toBe('composing');
                            expect(_converse.emit.calls.count(), 1);
                            done();
                        });
                    }));

                    it("will be shown if received", mock.initConverse(function (_converse) {
                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(_converse);

                        // See XEP-0085 http://xmpp.org/extensions/xep-0085.html#definitions
                        spyOn(_converse, 'emit');
                        var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';

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
                        var $events = chatboxview.$el.find('.chat-event');
                        expect($events.text()).toEqual(mock.cur_names[1] + ' is typing');
                    }));

                    it("can be a composing carbon message that this user sent from a different client", mock.initConverse(function (_converse) {
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
                        var $chat_content = chatboxview.$el.find('.chat-content');
                        var status_text = $chat_content.find('.chat-info.chat-event').text();
                        expect(status_text).toBe('Typing from another device');
                    }));
                });

                describe("A paused notification", function () {

                    it("is sent if the user has stopped typing since 30 seconds", mock.initConverseWithAsync(function (done, _converse) {
                        var view, contact_jid;
                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(_converse);
                        test_utils.waitUntil(function () {
                                return _converse.rosterview.$el.find('dt').length;
                            }, 300)
                        .then(function () {
                            _converse.TIMEOUTS.PAUSED = 200; // Make the timeout shorter so that we can test

                            contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                            test_utils.openChatBoxFor(_converse, contact_jid);
                            view = _converse.chatboxviews.get(contact_jid);
                            spyOn(_converse.connection, 'send');
                            spyOn(view, 'setChatState').and.callThrough();
                            expect(view.model.get('chat_state')).toBe('active');
                            view.keyPressed({
                                target: view.$el.find('textarea.chat-textarea'),
                                keyCode: 1
                            });
                            expect(view.model.get('chat_state')).toBe('composing');
                            expect(_converse.connection.send).toHaveBeenCalled();
                            var $stanza = $(_converse.connection.send.calls.argsFor(0)[0].tree());
                            expect($stanza.children().get(0).tagName).toBe('composing');
                            return test_utils.waitUntil(function () {
                                return view.model.get('chat_state') === 'paused';
                            }, 500)
                    }).then(function () {
                            expect(_converse.connection.send).toHaveBeenCalled();
                            var $stanza = $(_converse.connection.send.calls.argsFor(1)[0].tree());
                            expect($stanza.attr('to')).toBe(contact_jid);
                            expect($stanza.children().length).toBe(3);
                            expect($stanza.children().get(0).tagName).toBe('paused');
                            expect($stanza.children().get(1).tagName).toBe('no-store');
                            expect($stanza.children().get(2).tagName).toBe('no-permanent-store');
                            // Test #359. A paused notification should not be sent
                            // out if the user simply types longer than the
                            // timeout.
                            view.keyPressed({
                                target: view.$el.find('textarea.chat-textarea'),
                                keyCode: 1
                            });
                            expect(view.setChatState).toHaveBeenCalled();
                            expect(view.model.get('chat_state')).toBe('composing');

                            view.keyPressed({
                                target: view.$el.find('textarea.chat-textarea'),
                                keyCode: 1
                            });
                            expect(view.model.get('chat_state')).toBe('composing');
                            done();
                        });
                    }));

                    it("will be shown if received", mock.initConverseWithAsync(function (done, _converse) {
                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(_converse);
                        test_utils.waitUntil(function () {
                                return _converse.rosterview.$el.find('dt').length;
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
                            var $events = chatboxview.$el.find('.chat-event');
                            expect($events.text()).toEqual(mock.cur_names[1] + ' has stopped typing');
                            done();
                        });
                    }));

                    it("can be a paused carbon message that this user sent from a different client", mock.initConverse(function (_converse) {
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
                        var $chat_content = chatboxview.$el.find('.chat-content');
                        var status_text = $chat_content.find('.chat-info.chat-event').text();
                        expect(status_text).toBe('Stopped typing on the other device');
                    }));
                });

                describe("An inactive notifciation", function () {

                    it("is sent if the user has stopped typing since 2 minutes", mock.initConverseWithAsync(function (done, _converse) {
                        var view, contact_jid;
                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(_converse);
                        test_utils.waitUntil(function () {
                            return _converse.rosterview.$el.find('dt').length;
                        }, 300).then(function () {
                            // Make the timeouts shorter so that we can test
                            _converse.TIMEOUTS.PAUSED = 200;
                            _converse.TIMEOUTS.INACTIVE = 200;
                            contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                            test_utils.openChatBoxFor(_converse, contact_jid);
                            view = _converse.chatboxviews.get(contact_jid);
                            expect(view.model.get('chat_state')).toBe('active');
                            view.keyPressed({
                                target: view.$el.find('textarea.chat-textarea'),
                                keyCode: 1
                            });
                            expect(view.model.get('chat_state')).toBe('composing');
                            spyOn(_converse.connection, 'send');
                            return test_utils.waitUntil(function () {
                                if (view.model.get('chat_state') === 'paused') {
                                    return true;
                                }
                                return false;
                            }, 250)
                        }).then(function () {
                            return test_utils.waitUntil(function () {
                                return view.model.get('chat_state') === 'inactive';
                            }, 250)
                        }).then(function () {
                            expect(_converse.connection.send).toHaveBeenCalled();
                            var $stanza = $(_converse.connection.send.calls.first().args[0].tree());
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
                            done();
                        });
                    }));

                    it("is sent when the user a minimizes a chat box", mock.initConverse(function (_converse) {
                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(_converse);

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
                    }));

                    it("is sent if the user closes a chat box", mock.initConverseWithAsync(function (done, _converse) {
                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(_converse);
                        test_utils.waitUntil(function () {
                            return _converse.rosterview.$el.find('dt').length;
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

                    it("will clear any other chat status notifications if its received", mock.initConverse(function (_converse) {
                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(_converse);

                        // See XEP-0085 http://xmpp.org/extensions/xep-0085.html#definitions
                        spyOn(_converse, 'emit');
                        var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                        test_utils.openChatBoxFor(_converse, sender_jid);
                        var view = _converse.chatboxviews.get(sender_jid);
                        expect(view.$el.find('.chat-event').length).toBe(0);
                        view.showStatusNotification(sender_jid+' is typing');
                        expect(view.$el.find('.chat-event').length).toBe(1);
                        var msg = $msg({
                                from: sender_jid,
                                to: _converse.connection.jid,
                                type: 'chat',
                                id: (new Date()).getTime()
                            }).c('body').c('inactive', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        _converse.chatboxes.onMessage(msg);
                        expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                        expect(view.$el.find('.chat-event').length).toBe(0);
                    }));

                });

                describe("A gone notifciation", function () {

                    it("will be shown if received", mock.initConverse(function (_converse) {
                        test_utils.createContacts(_converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(_converse);

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
                        var $events = chatboxview.$el.find('.chat-event');
                        expect($events.text()).toEqual(mock.cur_names[1] + ' has gone away');
                    }));
                });
            });
        });

        describe("Special Messages", function () {

            it("'/clear' can be used to clear messages in a conversation", mock.initConverse(function (_converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(_converse);

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
            }));
        });

        describe("A Message Counter", function () {

            it("is incremented when the message is received and the window is not focused", mock.initConverse(function (_converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(_converse);

                spyOn(_converse, 'emit');
                spyOn(_converse, 'incrementMsgCounter').and.callThrough();
                spyOn(_converse, 'clearMsgCounter').and.callThrough();
                expect(_converse.getUnreadMsgCount()).toBe(0);
                
                var previous_state = _converse.windowState;
                var message = 'This message will increment the message counter';
                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                    msg = $msg({
                        from: sender_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: (new Date()).getTime()
                    }).c('body').t(message).up()
                      .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                _converse.windowState = 'hidden';
                _converse.chatboxes.onMessage(msg);
                
                expect(_converse.getUnreadMsgCount()).toBe(1);
                expect(_converse.clearMsgCounter).not.toHaveBeenCalled();
                expect(_converse.incrementMsgCounter).toHaveBeenCalled();
                expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                _converse.windowSate = previous_state;
            }));

            it("is cleared when the window is focused", mock.initConverse(function (_converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(_converse);
                _converse.windowState = 'hidden';
                spyOn(_converse, 'clearMsgCounter').and.callThrough();
                _converse.saveWindowState(null, 'focus');
                _converse.saveWindowState(null, 'blur');
                expect(_converse.clearMsgCounter).toHaveBeenCalled();
            }));

            it("is not incremented when the message is received and the window is focused", mock.initConverse(function (_converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(_converse);

                expect(_converse.getUnreadMsgCount()).toBe(0);
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
                      .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                _converse.chatboxes.onMessage(msg);
                expect(_converse.incrementMsgCounter).not.toHaveBeenCalled();
                expect(_converse.getUnreadMsgCount()).toBe(0);
            }));

            it("is incremented from zero when chatbox was closed after viewing previously received messages and the window is not focused now", mock.initConverse(function (_converse) {
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
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'})
                        .tree();
                 };

                // leave converse-chat page
                _converse.windowState = 'hidden';
                _converse.chatboxes.onMessage(msgFactory());
                expect(_converse.msg_counter).toBe(1);

                // come back to converse-chat page
                _converse.saveWindowState(null, 'focus');
                var view = _converse.chatboxviews.get(sender_jid);
                expect(view.$el.is(':visible')).toBeTruthy();
                expect(_converse.msg_counter).toBe(0);

                // close chatbox and leave converse-chat page again
                view.close();
                _converse.windowState = 'hidden';

                // check that msg_counter is incremented from zero again
                _converse.chatboxes.onMessage(msgFactory());
                view = _converse.chatboxviews.get(sender_jid);
                expect(view.$el.is(':visible')).toBeTruthy();
                expect(_converse.msg_counter).toBe(1);
            }));
        });

        describe("A ChatBox's Unread Message Count", function () {

            it("is incremented when the message is received and ChatBoxView is scrolled up", mock.initConverse(function (_converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openContactsPanel(_converse);

                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                    msg = test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread');
                
                test_utils.openChatBoxFor(_converse, sender_jid);
                var chatbox = _converse.chatboxes.get(sender_jid);
                chatbox.save('scrolled', true);

                _converse.chatboxes.onMessage(msg);
                
                expect(chatbox.get('num_unread')).toBe(1);
            }));

            it("is not incremented when the message is received and ChatBoxView is scrolled down", mock.initConverse(function (_converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openContactsPanel(_converse);

                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                    msg = test_utils.createChatMessage(_converse, sender_jid, 'This message will be read');
                
                test_utils.openChatBoxFor(_converse, sender_jid);
                var chatbox = _converse.chatboxes.get(sender_jid);

                _converse.chatboxes.onMessage(msg);
                
                expect(chatbox.get('num_unread')).toBe(0);
            }));

            it("is incremeted when message is received, chatbox is scrolled down and the window is not focused", mock.initConverse(function (_converse) {
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
            }));

            it("is incremeted when message is received, chatbox is scrolled up and the window is not focused", mock.initConverse(function (_converse) {
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
            }));

            it("is cleared when ChatBoxView was scrolled down and the window become focused", mock.initConverse(function (_converse) {
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
            }));

            it("is not cleared when ChatBoxView was scrolled up and the windows become focused", mock.initConverse(function (_converse) {
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
            }));
        });

        describe("A RosterView's Unread Message Count", function () {
            
            it("is updated when message is received and chatbox is scrolled up", mock.initConverseWithAsync(function (done, _converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openContactsPanel(_converse);
                test_utils.waitUntil(function () {
                    return _converse.rosterview.$el.find('dt').length;
                }, 500)
                .then(function () {
                    var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, sender_jid);
                    var chatbox = _converse.chatboxes.get(sender_jid);
                    chatbox.save('scrolled', true);

                    var msg = test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread');
                    _converse.chatboxes.onMessage(msg);

                    var msgIndicatorSelector = 'a.open-chat:contains("' + chatbox.get('fullname') + '") .msgs-indicactor',
                        $msgIndicator = $(_converse.rosterview.$el.find(msgIndicatorSelector));

                    expect($msgIndicator.text()).toBe('1');

                    msg = test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread too');
                    _converse.chatboxes.onMessage(msg);

                    $msgIndicator = $(_converse.rosterview.$el.find(msgIndicatorSelector));
                    expect($msgIndicator.text()).toBe('2');

                    done();  
                });
            }));

            it("is updated when message is received and chatbox is minimized", mock.initConverseWithAsync(function (done, _converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openContactsPanel(_converse);
                test_utils.waitUntil(function () {
                    return _converse.rosterview.$el.find('dt').length;
                }, 500)
                .then(function () {
                    var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, sender_jid);
                    var chatbox = _converse.chatboxes.get(sender_jid);
                    var chatboxview = _converse.chatboxviews.get(sender_jid);
                    chatboxview.minimize();

                    var msg = test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread');
                    _converse.chatboxes.onMessage(msg);

                    var msgIndicatorSelector = 'a.open-chat:contains("' + chatbox.get('fullname') + '") .msgs-indicactor',
                        $msgIndicator = $(_converse.rosterview.$el.find(msgIndicatorSelector));

                    expect($msgIndicator.text()).toBe('1');

                    msg = test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread too');
                    _converse.chatboxes.onMessage(msg);

                    $msgIndicator = $(_converse.rosterview.$el.find(msgIndicatorSelector));
                    expect($msgIndicator.text()).toBe('2');

                    done();  
                });
            }));

            it("is cleared when chatbox is maximzied after receiving messages in minimized mode", mock.initConverseWithAsync(function (done, _converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openContactsPanel(_converse);
                test_utils.waitUntil(function () {
                    return _converse.rosterview.$el.find('dt').length;
                }, 500)
                .then(function () {
                    var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, sender_jid);
                    var chatbox = _converse.chatboxes.get(sender_jid);
                    var chatboxview = _converse.chatboxviews.get(sender_jid);
                    var msgsIndicatorSelector = 'a.open-chat:contains("' + chatbox.get('fullname') + '") .msgs-indicactor';
                    var selectMsgsIndicator = () => $(_converse.rosterview.$el.find(msgsIndicatorSelector));
                    var msgFactory = () => test_utils.createChatMessage(_converse, sender_jid, 'This message will be received as unread, but eventually will be read');
                    
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

            it("is cleared when unread messages are viewed which were received in scrolled-up chatbox", mock.initConverseWithAsync(function (done, _converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openContactsPanel(_converse);
                test_utils.waitUntil(function () {
                    return _converse.rosterview.$el.find('dt').length;
                }, 500)
                .then(function () {
                    var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(_converse, sender_jid);
                    var chatbox = _converse.chatboxes.get(sender_jid);
                    var chatboxview = _converse.chatboxviews.get(sender_jid);
                    var msgFactory = () => test_utils.createChatMessage(_converse, sender_jid, 'This message will be received as unread, but eventually will be read');
                    var msgsIndicatorSelector = 'a.open-chat:contains("' + chatbox.get('fullname') + '") .msgs-indicactor',
                        selectMsgsIndicator = () => $(_converse.rosterview.$el.find(msgsIndicatorSelector));
                    
                    chatbox.save('scrolled', true);

                    _converse.chatboxes.onMessage(msgFactory());
                    expect(selectMsgsIndicator().text()).toBe('1');
                    
                    chatboxview.viewUnreadMessages();
                    _converse.rosterview.render();
                    expect(selectMsgsIndicator().length).toBe(0);

                    done();  
                });
            }));
        });

        describe("A Minimized ChatBoxView's Unread Message Count", function () {
           
            it("is displayed when scrolled up chatbox is minimized after receiving unread messages", mock.initConverse(function (_converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openContactsPanel(_converse);

                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                test_utils.openChatBoxFor(_converse, sender_jid);
                var msgFactory = function () { 
                    return test_utils.createChatMessage(_converse, sender_jid, 'This message will be received as unread, but eventually will be read'); 
                };
                var selectUnreadMsgCount = function () {
                    var minimizedChatBoxView = _converse.minimized_chats.get(sender_jid);
                    return minimizedChatBoxView.$el.find('.chat-head-message-count');
                };

                var chatbox = _converse.chatboxes.get(sender_jid);    
                chatbox.save('scrolled', true);
                _converse.chatboxes.onMessage(msgFactory());

                var chatboxview = _converse.chatboxviews.get(sender_jid);
                chatboxview.minimize();

                var $unreadMsgCount = selectUnreadMsgCount();
                expect($unreadMsgCount.is(':visible')).toBeTruthy();
                expect($unreadMsgCount.html()).toBe('1');
            }));

            it("is incremented when message is received and windows is not focused", mock.initConverse(function (_converse) {
                test_utils.createContacts(_converse, 'current');
                test_utils.openContactsPanel(_converse);

                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                test_utils.openChatBoxFor(_converse, sender_jid);
                var msgFactory = function () { 
                    return test_utils.createChatMessage(_converse, sender_jid, 'This message will be received as unread, but eventually will be read'); 
                };
                var selectUnreadMsgCount = function () {
                    var minimizedChatBoxView = _converse.minimized_chats.get(sender_jid);
                    return minimizedChatBoxView.$el.find('.chat-head-message-count');
                };

                var chatboxview = _converse.chatboxviews.get(sender_jid);
                chatboxview.minimize();
  
                _converse.chatboxes.onMessage(msgFactory());

                var $unreadMsgCount = selectUnreadMsgCount();
                expect($unreadMsgCount.is(':visible')).toBeTruthy();
                expect($unreadMsgCount.html()).toBe('1');
            }));
        });
    });
}));
