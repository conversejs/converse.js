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
                .then(() => test_utils.waitUntil(() => _converse.xmppstatus.vcard.get('fullname')), 300)
                .then(function () {
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
                        expect(view.el.querySelectorAll('.chat-action').length).toBe(1);
                        expect(_.includes(view.el.querySelector('.chat-msg-author').textContent, '**Max Frankfurter')).toBeTruthy();
                        expect($(view.el).find('.chat-msg-text').text()).toBe(' is tired');

                        message = '/me is as well';
                        test_utils.sendMessage(view, message);
                        expect(view.el.querySelectorAll('.chat-action').length).toBe(2);

                        return test_utils.waitUntil(() => $(view.el).find('.chat-msg-author:last').text() === '**Max Mustermann');
                    }).then(function () {
                        expect($(view.el).find('.chat-msg-text:last').text()).toBe(' is as well');
                        expect($(view.el).find('.chat-msg:last').hasClass('chat-msg-followup')).toBe(false);

                        // Check that /me messages after a normal message don't
                        // get the 'chat-msg-followup' class.
                        message = 'This a normal message';
                        test_utils.sendMessage(view, message);
                        let message_el = view.el.querySelector('.message:last-child');
                        expect(u.hasClass('chat-msg-followup', message_el)).toBeFalsy();

                        message = '/me wrote a 3rd person message';
                        test_utils.sendMessage(view, message);
                        message_el = view.el.querySelector('.message:last-child');
                        expect(view.el.querySelectorAll('.chat-action').length).toBe(3);
                        expect($(view.el).find('.chat-msg-text:last').text()).toBe(' wrote a 3rd person message');
                        expect($(view.el).find('.chat-msg-author:last').is(':visible')).toBeTruthy();
                        expect(u.hasClass('chat-msg-followup', message_el)).toBeFalsy();
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
                $el = $(_converse.rosterview.el).find('a.open-chat:contains("'+chatbox.getDisplayName()+'")');
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
                    }, 500).then(function () {
                        var picker = view.el.querySelector('.toggle-smiley .emoji-picker-container');
                        var items = picker.querySelectorAll('.emoji-picker li');
                        items[0].click()
                        expect(view.insertEmoji).toHaveBeenCalled();

                        setTimeout(function () { timeout = true; }, 100);
                        return test_utils.waitUntil(function () {
                            return timeout;
                        }, 500);
                    }).then(function () {
                        timeout = false;
                        toolbar.querySelector('li.toggle-smiley').click(); // Close the panel again
                        return test_utils.waitUntil(function () {
                            return !view.el.querySelector('.toggle-smiley .toolbar-menu').offsetHeight;
                        }, 500);
                    }).then(function () {
                        setTimeout(function () { timeout = true; }, 100);
                        return test_utils.waitUntil(function () {
                            return timeout;
                        }, 500);
                    }).then(function () {
                        toolbar.querySelector('li.toggle-smiley').click();
                        expect(view.toggleEmojiMenu).toHaveBeenCalled();
                        return test_utils.waitUntil(function () {
                            var $picker = $(view.el).find('.toggle-smiley .emoji-picker-container');
                            return u.isVisible($picker[0]);
                        }, 500);
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
                        var view = _converse.chatboxviews.get(sender_jid);
                        expect(view).toBeDefined();

                        test_utils.waitUntil(() => view.model.vcard.get('fullname') === mock.cur_names[1])
                        .then(function () {
                            var view = _converse.chatboxviews.get(sender_jid);
                            // Check that the notification appears inside the chatbox in the DOM
                            var events = view.el.querySelectorAll('.chat-state-notification');
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
                            events = view.el.querySelectorAll('.chat-state-notification');
                            expect(events.length).toBe(1);
                            expect(events[0].textContent).toEqual(mock.cur_names[1] + ' is typing');
                            done();
                        })
                    }));

                    it("can be a composing carbon message that this user sent from a different client",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        var contact, sent_stanza, IQ_id, stanza;
                        test_utils.waitUntilDiscoConfirmed(_converse, 'localhost', [], ['vcard-temp'])
                        .then(function () {
                            return test_utils.waitUntil(function () {
                                return _converse.xmppstatus.vcard.get('fullname');
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
                            var view = _converse.chatboxviews.get(sender_jid);
                            test_utils.waitUntil(() => view.model.vcard.get('fullname') === mock.cur_names[1])
                            .then(function () {
                                var view = _converse.chatboxviews.get(sender_jid);
                                var event = view.el.querySelector('.chat-info.chat-state-notification');
                                expect(event.textContent).toEqual(mock.cur_names[1] + ' has stopped typing');
                                done();
                            });
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
                                return _converse.xmppstatus.vcard.get('fullname');
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
                        var view = _converse.chatboxviews.get(sender_jid);
                        test_utils.waitUntil(() => view.model.vcard.get('fullname') === mock.cur_names[1])
                        .then(function () {
                            var view = _converse.chatboxviews.get(sender_jid);
                            var event = view.el.querySelector('.chat-state-notification');
                            expect(event.textContent).toEqual(mock.cur_names[1] + ' has gone away');
                            done();
                        });
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
