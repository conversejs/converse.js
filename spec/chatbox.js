(function (root, factory) {
    define([
        "utils",
        "converse-api",
        "mock",
        "test_utils"
        ], factory);
} (this, function (utils, converse_api, mock, test_utils) {
    "use strict";
    var _ = converse_api.env._;
    var $ = converse_api.env.jQuery;
    var $msg = converse_api.env.$msg;
    var Strophe = converse_api.env.Strophe;
    var moment = converse_api.env.moment;

    return describe("Chatboxes", function() {
        describe("A Chatbox", function () {
            afterEach(function () {
                converse_api.user.logout();
                converse_api.listen.not();
                test_utils.clearBrowserStorage();
            });

            it("is created when you click on a roster item", mock.initConverse(function (converse) {
                test_utils.createContacts(converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(converse);

                var i, $el, jid, chatboxview;
                // openControlBox was called earlier, so the controlbox is
                // visible, but no other chat boxes have been created.
                expect(converse.chatboxes.length).toEqual(1);
                spyOn(converse.chatboxviews, 'trimChats');
                expect($("#conversejs .chatbox").length).toBe(1); // Controlbox is open

                var online_contacts = converse.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact').find('a.open-chat');
                for (i=0; i<online_contacts.length; i++) {
                    $el = $(online_contacts[i]);
                    jid = $el.text().replace(/ /g,'.').toLowerCase() + '@localhost';
                    $el.click();
                    chatboxview = converse.chatboxviews.get(jid);
                    expect(converse.chatboxes.length).toEqual(i+2);
                    expect(converse.chatboxviews.trimChats).toHaveBeenCalled();
                    // Check that new chat boxes are created to the left of the
                    // controlbox (but to the right of all existing chat boxes)
                    expect($("#conversejs .chatbox").length).toBe(i+2);
                    expect($("#conversejs .chatbox")[1].id).toBe(chatboxview.model.get('box_id'));
                }
            }));

            it("can be trimmed to conserve space", mock.initConverse(function (converse) {
                test_utils.createContacts(converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(converse);

                var i, $el, jid, chatbox, chatboxview, trimmedview;
                // openControlBox was called earlier, so the controlbox is
                // visible, but no other chat boxes have been created.
                var trimmed_chatboxes = converse.minimized_chats;
                expect(converse.chatboxes.length).toEqual(1);
                spyOn(converse.chatboxviews, 'trimChats');
                spyOn(trimmed_chatboxes, 'addChat').andCallThrough();
                spyOn(trimmed_chatboxes, 'removeChat').andCallThrough();
                expect($("#conversejs .chatbox").length).toBe(1); // Controlbox is open

                // Test that they can be trimmed
                runs(function () {
                    converse.rosterview.update(); // XXX: Hack to make sure $roster element is attaced.
                });
                waits(50);
                runs(function () {
                    // Test that they can be maximized again
                    var online_contacts = converse.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact').find('a.open-chat');
                    for (i=0; i<online_contacts.length; i++) {
                        $el = $(online_contacts[i]);
                        jid = $el.text().replace(/ /g,'.').toLowerCase() + '@localhost';
                        $el.click();
                        expect(converse.chatboxviews.trimChats).toHaveBeenCalled();

                        chatboxview = converse.chatboxviews.get(jid);
                        spyOn(chatboxview, 'minimize').andCallThrough();
                        chatboxview.model.set({'minimized': true});
                        expect(trimmed_chatboxes.addChat).toHaveBeenCalled();
                        expect(chatboxview.minimize).toHaveBeenCalled();
                        trimmedview = trimmed_chatboxes.get(jid);
                    }
                    var key = converse.chatboxviews.keys()[1];
                    trimmedview = trimmed_chatboxes.get(key);
                    chatbox = trimmedview.model;
                    spyOn(chatbox, 'maximize').andCallThrough();
                    spyOn(trimmedview, 'restore').andCallThrough();
                    trimmedview.delegateEvents();
                    trimmedview.$("a.restore-chat").click();
                });
                waits(250);
                runs(function () {
                    expect(trimmedview.restore).toHaveBeenCalled();
                    expect(chatbox.maximize).toHaveBeenCalled();
                    expect(converse.chatboxviews.trimChats).toHaveBeenCalled();
                });
            }));

            it("is focused if its already open and you click on its corresponding roster item", mock.initConverse(function (converse) {
                test_utils.createContacts(converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(converse);

                var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                var $el, jid, chatboxview, chatbox;
                // openControlBox was called earlier, so the controlbox is
                // visible, but no other chat boxes have been created.
                expect(converse.chatboxes.length).toEqual(1);
                chatbox = test_utils.openChatBoxFor(converse, contact_jid);
                chatboxview = converse.chatboxviews.get(contact_jid);
                spyOn(chatboxview, 'focus');
                // Test that they can be trimmed
                runs(function () {
                    converse.rosterview.update(); // XXX: Hack to make sure $roster element is attaced.
                });
                waits(300); // ChatBox.show() is debounced for 250ms
                runs(function () {
                    $el = converse.rosterview.$el.find('a.open-chat:contains("'+chatbox.get('fullname')+'")');
                    jid = $el.text().replace(/ /g,'.').toLowerCase() + '@localhost';
                    $el.click();
                    expect(converse.chatboxes.length).toEqual(2);
                    expect(chatboxview.focus).toHaveBeenCalled();
                });
            }));

            it("can be saved to, and retrieved from, browserStorage", mock.initConverse(function (converse) {
                test_utils.createContacts(converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(converse);

                spyOn(converse, 'emit');
                spyOn(converse.chatboxviews, 'trimChats');
                runs(function () {
                    test_utils.openControlBox();
                });
                waits(250);
                runs(function () {
                    test_utils.openChatBoxes(converse, 6);
                    expect(converse.chatboxviews.trimChats).toHaveBeenCalled();
                    // We instantiate a new ChatBoxes collection, which by default
                    // will be empty.
                    var newchatboxes = new converse.ChatBoxes();
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
                        new_attrs = _.pluck(_.pluck(newchatboxes.models, 'attributes'), attrs[i]);
                        old_attrs = _.pluck(_.pluck(converse.chatboxes.models, 'attributes'), attrs[i]);
                        expect(_.isEqual(new_attrs, old_attrs)).toEqual(true);
                    }
                    converse.rosterview.render();
                });
            }));

            it("can be closed by clicking a DOM element with class 'close-chatbox-button'", mock.initConverse(function (converse) {
                test_utils.createContacts(converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(converse);

                var chatbox = test_utils.openChatBoxes(converse, 1)[0],
                    controlview = converse.chatboxviews.get('controlbox'), // The controlbox is currently open
                    chatview = converse.chatboxviews.get(chatbox.get('jid'));
                spyOn(chatview, 'close').andCallThrough();
                spyOn(controlview, 'close').andCallThrough();
                spyOn(converse, 'emit');

                // We need to rebind all events otherwise our spy won't be called
                controlview.delegateEvents();
                chatview.delegateEvents();

                runs(function () {
                    controlview.$el.find('.close-chatbox-button').click();
                });
                waits(250);
                runs(function () {
                    expect(controlview.close).toHaveBeenCalled();
                    expect(converse.emit).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                    expect(converse.emit.callCount, 1);
                    chatview.$el.find('.close-chatbox-button').click();
                });
                waits(250);
                runs(function () {
                    expect(chatview.close).toHaveBeenCalled();
                    expect(converse.emit).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                    expect(converse.emit.callCount, 2);
                });
            }));

            it("can be minimized by clicking a DOM element with class 'toggle-chatbox-button'", mock.initConverse(function (converse) {
                test_utils.createContacts(converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(converse);

                var chatbox = test_utils.openChatBoxes(converse, 1)[0],
                    chatview = converse.chatboxviews.get(chatbox.get('jid')),
                    trimmed_chatboxes = converse.minimized_chats,
                    trimmedview;
                spyOn(chatview, 'minimize').andCallThrough();
                spyOn(converse, 'emit');
                // We need to rebind all events otherwise our spy won't be called
                chatview.delegateEvents();

                runs(function () {
                    chatview.$el.find('.toggle-chatbox-button').click();
                });
                waits(250);
                runs(function () {
                    expect(chatview.minimize).toHaveBeenCalled();
                    expect(converse.emit).toHaveBeenCalledWith('chatBoxMinimized', jasmine.any(Object));
                    expect(converse.emit.callCount, 2);
                    expect(chatview.$el.is(':visible')).toBeFalsy();
                    expect(chatview.model.get('minimized')).toBeTruthy();
                    chatview.$el.find('.toggle-chatbox-button').click();
                    trimmedview = trimmed_chatboxes.get(chatview.model.get('id'));
                    spyOn(trimmedview, 'restore').andCallThrough();
                    trimmedview.delegateEvents();
                    trimmedview.$("a.restore-chat").click();
                });
                waits(250);
                runs(function () {
                    expect(trimmedview.restore).toHaveBeenCalled();
                    expect(converse.emit).toHaveBeenCalledWith('chatBoxMaximized', jasmine.any(Object));
                    expect(chatview.$el.find('.chat-body').is(':visible')).toBeTruthy();
                    expect(chatview.$el.find('.toggle-chatbox-button').hasClass('icon-minus')).toBeTruthy();
                    expect(chatview.$el.find('.toggle-chatbox-button').hasClass('icon-plus')).toBeFalsy();
                    expect(chatview.model.get('minimized')).toBeFalsy();
                });
            }));

            it("will be removed from browserStorage when closed", mock.initConverse(function (converse) {
                test_utils.createContacts(converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(converse);

                spyOn(converse, 'emit');
                spyOn(converse.chatboxviews, 'trimChats');
                converse.chatboxes.browserStorage._clear();
                runs(function () {
                    test_utils.closeControlBox();
                });
                waits(50);
                runs(function () {
                    expect(converse.emit).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                    expect(converse.chatboxes.length).toEqual(1);
                    expect(converse.chatboxes.pluck('id')).toEqual(['controlbox']);
                    test_utils.openChatBoxes(converse, 6);
                    expect(converse.chatboxviews.trimChats).toHaveBeenCalled();
                    expect(converse.chatboxes.length).toEqual(7);
                    expect(converse.emit).toHaveBeenCalledWith('chatBoxOpened', jasmine.any(Object));
                    test_utils.closeAllChatBoxes(converse);
                });
                waits(50);
                runs(function () {
                    expect(converse.chatboxes.length).toEqual(1);
                    expect(converse.chatboxes.pluck('id')).toEqual(['controlbox']);
                    expect(converse.emit).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                    var newchatboxes = new converse.ChatBoxes();
                    expect(newchatboxes.length).toEqual(0);
                    expect(converse.chatboxes.pluck('id')).toEqual(['controlbox']);
                    // onConnected will fetch chatboxes in browserStorage, but
                    // because there aren't any open chatboxes, there won't be any
                    // in browserStorage either. XXX except for the controlbox
                    newchatboxes.onConnected();
                    expect(newchatboxes.length).toEqual(1);
                    expect(newchatboxes.models[0].id).toBe("controlbox");
                });
            }));

            describe("A chat toolbar", function () {
                afterEach(function () {
                    converse_api.user.logout();
                    converse_api.listen.not();
                    test_utils.clearBrowserStorage();
                });

                it("can be found on each chat box", mock.initConverse(function (converse) {
                    test_utils.createContacts(converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(converse);

                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(converse, contact_jid);
                    var chatbox = converse.chatboxes.get(contact_jid);
                    var view = converse.chatboxviews.get(contact_jid);
                    expect(chatbox).toBeDefined();
                    expect(view).toBeDefined();
                    var $toolbar = view.$el.find('ul.chat-toolbar');
                    expect($toolbar.length).toBe(1);
                    expect($toolbar.children('li').length).toBe(3);
                }));

                it("contains a button for inserting emoticons", mock.initConverse(function (converse) {
                    test_utils.createContacts(converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(converse);

                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost',
                        view, $toolbar, $textarea;
                    waits(300); // ChatBox.show() is debounced for 250ms
                    runs(function () {
                        test_utils.openChatBoxFor(converse, contact_jid);
                        view = converse.chatboxviews.get(contact_jid);
                        $toolbar = view.$el.find('ul.chat-toolbar');
                        $textarea = view.$el.find('textarea.chat-textarea');
                        expect($toolbar.children('li.toggle-smiley').length).toBe(1);
                        // Register spies
                        spyOn(view, 'toggleEmoticonMenu').andCallThrough();
                        spyOn(view, 'insertEmoticon').andCallThrough();
                        view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                        $toolbar.children('li.toggle-smiley').click();
                    });
                    waits(250);
                    runs(function () {
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
                    });
                    waits(250);
                    runs(function () {
                        expect(view.insertEmoticon).toHaveBeenCalled();
                        expect($textarea.val()).toBe(':) ');
                        expect(view.$el.find('.toggle-smiley ul').is(':visible')).toBeFalsy();
                        $toolbar.children('li.toggle-smiley').click();
                    });
                    waits(250);
                    runs(function () {
                        expect(view.toggleEmoticonMenu).toHaveBeenCalled();
                        expect(view.$el.find('.toggle-smiley ul').is(':visible')).toBeTruthy();
                        view.$el.find('.toggle-smiley ul').children('li').last().click();
                    });
                    waits(250);
                    runs(function () {
                        expect(view.insertEmoticon).toHaveBeenCalled();
                        expect(view.$el.find('.toggle-smiley ul').is(':visible')).toBeFalsy();
                        expect($textarea.val()).toBe(':) <3 ');
                    });
                }));

                it("contains a button for starting an encrypted chat session", mock.initConverse(function (converse) {
                    test_utils.createContacts(converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(converse);

                    // TODO: More tests can be added here...
                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(converse, contact_jid);
                    var view = converse.chatboxviews.get(contact_jid);
                    var $toolbar = view.$el.find('ul.chat-toolbar');
                    expect($toolbar.children('li.toggle-otr').length).toBe(1);
                    // Register spies
                    spyOn(view, 'toggleOTRMenu').andCallThrough();
                    view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called

                    runs(function () {
                        $toolbar.children('li.toggle-otr').click();
                    });
                    waits(250);
                    runs(function () {
                        expect(view.toggleOTRMenu).toHaveBeenCalled();
                        var $menu = view.$el.find('.toggle-otr ul');
                        expect($menu.is(':visible')).toBeTruthy();
                        expect($menu.children('li').length).toBe(2);
                    });

                }));

                it("can contain a button for starting a call", mock.initConverse(function (converse) {
                    test_utils.createContacts(converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(converse);

                    var view, callButton, $toolbar;
                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                    spyOn(converse, 'emit');
                    // First check that the button doesn't show if it's not enabled
                    // via "visible_toolbar_buttons"
                    converse.visible_toolbar_buttons.call = false;
                    test_utils.openChatBoxFor(converse, contact_jid);
                    view = converse.chatboxviews.get(contact_jid);
                    $toolbar = view.$el.find('ul.chat-toolbar');
                    callButton = $toolbar.find('.toggle-call');
                    expect(callButton.length).toBe(0);
                    view.close();
                    // Now check that it's shown if enabled and that it emits
                    // callButtonClicked
                    converse.visible_toolbar_buttons.call = true; // enable the button
                    test_utils.openChatBoxFor(converse, contact_jid);
                    view = converse.chatboxviews.get(contact_jid);
                    $toolbar = view.$el.find('ul.chat-toolbar');
                    callButton = $toolbar.find('.toggle-call');
                    expect(callButton.length).toBe(1);
                    callButton.click();
                    expect(converse.emit).toHaveBeenCalledWith('callButtonClicked', jasmine.any(Object));
                }));

                it("can contain a button for clearing messages", mock.initConverse(function (converse) {
                    test_utils.createContacts(converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(converse);

                    var view, clearButton, $toolbar;
                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                    // First check that the button doesn't show if it's not enabled
                    // via "visible_toolbar_buttons"
                    converse.visible_toolbar_buttons.clear = false;
                    test_utils.openChatBoxFor(converse, contact_jid);
                    view = converse.chatboxviews.get(contact_jid);
                    view = converse.chatboxviews.get(contact_jid);
                    $toolbar = view.$el.find('ul.chat-toolbar');
                    clearButton = $toolbar.find('.toggle-clear');
                    expect(clearButton.length).toBe(0);
                    view.close();
                    // Now check that it's shown if enabled and that it calls
                    // clearMessages
                    converse.visible_toolbar_buttons.clear = true; // enable the button
                    test_utils.openChatBoxFor(converse, contact_jid);
                    view = converse.chatboxviews.get(contact_jid);
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
                afterEach(function () {
                    converse_api.user.logout();
                    converse_api.listen.not();
                    test_utils.clearBrowserStorage();
                });

                describe("when received from someone else", function () {
                    it("can be received which will open a chatbox and be displayed inside it", mock.initConverse(function (converse) {
                        test_utils.createContacts(converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(converse);

                        spyOn(converse, 'emit');
                        var message = 'converse is a received message';
                        var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                        var msg = $msg({
                                from: sender_jid,
                                to: converse.connection.jid,
                                type: 'chat',
                                id: (new Date()).getTime()
                            }).c('body').t(message).up()
                            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();

                        // We don't already have an open chatbox for this user
                        expect(converse.chatboxes.get(sender_jid)).not.toBeDefined();

                        runs(function () {
                            // onMessage is a handler for received XMPP messages
                            converse.chatboxes.onMessage(msg);
                            expect(converse.emit).toHaveBeenCalledWith('message', msg);
                        });
                        waits(50);
                        runs(function () {
                            // Check that the chatbox and its view now exist
                            var chatbox = converse.chatboxes.get(sender_jid);
                            var chatboxview = converse.chatboxviews.get(sender_jid);
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
                        });
                    }));

                    describe("and for which then an error message is received from the server", function () {
                        afterEach(function () {
                            converse_api.user.logout();
                            converse_api.listen.not();
                            test_utils.clearBrowserStorage();
                        });

                        it("will have the error message displayed after itself", mock.initConverse(function (converse) {
                            test_utils.createContacts(converse, 'current');
                            test_utils.openControlBox();
                            test_utils.openContactsPanel(converse);

                            // TODO: what could still be done for error
                            // messages... if the <error> element has type
                            // "cancel", then we know the messages wasn't sent,
                            // and can give the user a nicer indication of
                            // that.

                            /* <message from="scotty@enterprise.com/converse.js-84843526"
                             *          to="kirk@enterprise.com.com"
                             *          type="chat"
                             *          id="82bc02ce-9651-4336-baf0-fa04762ed8d2"
                             *          xmlns="jabber:client">
                             *      <body>yo</body>
                             *      <active xmlns="http://jabber.org/protocol/chatstates"/>
                             *  </message>
                             */
                            var sender_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@localhost';
                            var fullname = converse.xmppstatus.get('fullname');
                            fullname = _.isEmpty(fullname)? converse.bare_jid: fullname;
                            converse_api.chats.open(sender_jid);
                            var msg_text = 'This message will not be sent, due to an error';
                            var view = converse.chatboxviews.get(sender_jid);
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
                             *          to="scotty@enterprise.com/converse.js-84843526"
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
                                    'to': converse.connection.jid,
                                    'type':'error',
                                    'id':'82bc02ce-9651-4336-baf0-fa04762ed8d2',
                                    'from': sender_jid
                                })
                                .c('error', {'type': 'cancel'})
                                .c('remote-server-not-found', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" }).up()
                                .c('text', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" })
                                    .t('Server-to-server connection failed: Connecting failed: connection timeout');
                            converse.connection._dataRecv(test_utils.createRequest(stanza));
                            expect($chat_content.find('.chat-error').text()).toEqual(error_txt);

                            /* Incoming error messages that are not tied to a
                             * certain show message (via the msgid attribute),
                             * are not shown at all. The reason for this is
                             * that we may get error messages for chat state
                             * notifications as well.
                             */
                            stanza = $msg({
                                    'to': converse.connection.jid,
                                    'type':'error',
                                    'id':'some-other-unused-id',
                                    'from': sender_jid
                                })
                                .c('error', {'type': 'cancel'})
                                .c('remote-server-not-found', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" }).up()
                                .c('text', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" })
                                    .t('Server-to-server connection failed: Connecting failed: connection timeout');
                            converse.connection._dataRecv(test_utils.createRequest(stanza));
                            expect($chat_content.find('.chat-error').length).toEqual(1);
                        }));
                    });

                    it("will cause the chat area to be scrolled down only if it was at the bottom already", mock.initConverse(function (converse) {
                        test_utils.createContacts(converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(converse);

                        var message = 'This message is received while the chat area is scrolled up';
                        var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                        test_utils.openChatBoxFor(converse, sender_jid);
                        var chatboxview = converse.chatboxviews.get(sender_jid);
                        spyOn(chatboxview, 'scrollDown').andCallThrough();
                        runs(function () {
                            /* Create enough messages so that there's a
                             * scrollbar.
                             */
                            for (var i=0; i<20; i++) {
                                converse.chatboxes.onMessage($msg({
                                        from: sender_jid,
                                        to: converse.connection.jid,
                                        type: 'chat',
                                        id: (new Date()).getTime()
                                    }).c('body').t('Message: '+i).up()
                                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
                            }
                        });
                        waits(50);
                        runs(function () {
                            chatboxview.$content.scrollTop(0);
                        });
                        waits(250);
                        runs(function () {
                            converse.chatboxes.onMessage($msg({
                                    from: sender_jid,
                                    to: converse.connection.jid,
                                    type: 'chat',
                                    id: (new Date()).getTime()
                                }).c('body').t(message).up()
                                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
                        });
                        waits(150);
                        runs(function () {
                            // Now check that the message appears inside the chatbox in the DOM
                            var $chat_content = chatboxview.$el.find('.chat-content');
                            var msg_txt = $chat_content.find('.chat-message:last').find('.chat-msg-content').text();
                            expect(msg_txt).toEqual(message);
                            expect(chatboxview.model.get('scrolled')).toBeTruthy();
                            expect(chatboxview.$content.scrollTop()).toBe(0);
                            expect(chatboxview.$('.new-msgs-indicator').is(':visible')).toBeTruthy();
                            // Scroll down again
                            chatboxview.$content.scrollTop(chatboxview.$content[0].scrollHeight);
                        });
                        waits(250);
                        runs(function () {
                            expect(chatboxview.$('.new-msgs-indicator').is(':visible')).toBeFalsy();
                        });
                    }));

                    it("is ignored if it's intended for a different resource and filter_by_resource is set to true", mock.initConverse(function (converse) {
                        test_utils.createContacts(converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(converse);

                        // Send a message from a different resource
                        var message, sender_jid, msg;
                        spyOn(converse, 'log');
                        spyOn(converse.chatboxes, 'getChatBox').andCallThrough();
                        runs(function () {
                            converse.filter_by_resource = true;
                            sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                            msg = $msg({
                                    from: sender_jid,
                                    to: converse.bare_jid+'/'+"some-other-resource",
                                    type: 'chat',
                                    id: (new Date()).getTime()
                                }).c('body').t("This message will not be shown").up()
                                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                            converse.chatboxes.onMessage(msg);
                        });
                        waits(50);
                        runs(function () {
                            expect(converse.log).toHaveBeenCalledWith(
                                    "onMessage: Ignoring incoming message intended for a different resource: dummy@localhost/some-other-resource", "info");
                            expect(converse.chatboxes.getChatBox).not.toHaveBeenCalled();
                            converse.filter_by_resource = false;
                        });
                        waits(50);
                        runs(function () {
                            message = "This message sent to a different resource will be shown";
                            msg = $msg({
                                    from: sender_jid,
                                    to: converse.bare_jid+'/'+"some-other-resource",
                                    type: 'chat',
                                    id: '134234623462346'
                                }).c('body').t(message).up()
                                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                            converse.chatboxes.onMessage(msg);
                        });
                        waits(50);
                        runs(function () {
                            expect(converse.chatboxes.getChatBox).toHaveBeenCalled();
                            var chatboxview = converse.chatboxviews.get(sender_jid);
                            var $chat_content = chatboxview.$el.find('.chat-content:last');
                            var msg_txt = $chat_content.find('.chat-message').find('.chat-msg-content').text();
                            expect(msg_txt).toEqual(message);
                        });
                    }));
                });

                describe("when sent by the current user", function () {
                    it("will always cause the chat area to be scrolled down", mock.initConverse(function (converse) {
                        // TODO
                    }));
                });

                it("is ignored if it's a malformed headline message", mock.initConverse(function (converse) {
                    test_utils.createContacts(converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(converse);

                    /* Ideally we wouldn't have to filter out headline
                     * messages, but Prosody gives them the wrong 'type' :(
                     */
                    sinon.spy(converse, 'log');
                    sinon.spy(converse.chatboxes, 'getChatBox');
                    sinon.spy(utils, 'isHeadlineMessage');
                    var msg = $msg({
                            from: 'localhost',
                            to: converse.bare_jid,
                            type: 'chat',
                            id: (new Date()).getTime()
                        }).c('body').t("This headline message will not be shown").tree();
                    converse.chatboxes.onMessage(msg);
                    expect(converse.log.calledWith(
                        "onMessage: Ignoring incoming headline message sent with type 'chat' from JID: localhost",
                        "info"
                    )).toBeTruthy();
                    expect(utils.isHeadlineMessage.called).toBeTruthy();
                    expect(utils.isHeadlineMessage.returned(true)).toBeTruthy();
                    expect(converse.chatboxes.getChatBox.called).toBeFalsy();
                    // Remove sinon spies
                    converse.log.restore();
                    converse.chatboxes.getChatBox.restore();
                    utils.isHeadlineMessage.restore();
                }));

                it("can be a carbon message, as defined in XEP-0280", mock.initConverse(function (converse) {
                    test_utils.createContacts(converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(converse);

                    // Send a message from a different resource
                    spyOn(converse, 'log');
                    var msgtext = 'This is a carbon message';
                    var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                    var msg = $msg({
                            'from': sender_jid,
                            'id': (new Date()).getTime(),
                            'to': converse.connection.jid,
                            'type': 'chat',
                            'xmlns': 'jabber:client'
                        }).c('received', {'xmlns': 'urn:xmpp:carbons:2'})
                          .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                          .c('message', {
                                'xmlns': 'jabber:client',
                                'from': sender_jid,
                                'to': converse.bare_jid+'/another-resource',
                                'type': 'chat'
                        }).c('body').t(msgtext).tree();
                    converse.chatboxes.onMessage(msg);

                    // Check that the chatbox and its view now exist
                    var chatbox = converse.chatboxes.get(sender_jid);
                    var chatboxview = converse.chatboxviews.get(sender_jid);
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

                it("can be a carbon message that this user sent from a different client, as defined in XEP-0280", mock.initConverse(function (converse) {
                    test_utils.createContacts(converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(converse);

                    // Send a message from a different resource
                    spyOn(converse, 'log');
                    var msgtext = 'This is a sent carbon message';
                    var recipient_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@localhost';
                    var msg = $msg({
                            'from': converse.bare_jid,
                            'id': (new Date()).getTime(),
                            'to': converse.connection.jid,
                            'type': 'chat',
                            'xmlns': 'jabber:client'
                        }).c('sent', {'xmlns': 'urn:xmpp:carbons:2'})
                          .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                          .c('message', {
                                'xmlns': 'jabber:client',
                                'from': converse.bare_jid+'/another-resource',
                                'to': recipient_jid,
                                'type': 'chat'
                        }).c('body').t(msgtext).tree();
                    converse.chatboxes.onMessage(msg);

                    // Check that the chatbox and its view now exist
                    var chatbox = converse.chatboxes.get(recipient_jid);
                    var chatboxview = converse.chatboxviews.get(recipient_jid);
                    expect(chatbox).toBeDefined();
                    expect(chatboxview).toBeDefined();
                    // Check that the message was received and check the message parameters
                    expect(chatbox.messages.length).toEqual(1);
                    var msg_obj = chatbox.messages.models[0];
                    expect(msg_obj.get('message')).toEqual(msgtext);
                    expect(msg_obj.get('fullname')).toEqual(mock.cur_names[5]);
                    expect(msg_obj.get('sender')).toEqual('me');
                    expect(msg_obj.get('delayed')).toEqual(false);
                    // Now check that the message appears inside the chatbox in the DOM
                    var $chat_content = chatboxview.$el.find('.chat-content');
                    var msg_txt = $chat_content.find('.chat-message').find('.chat-msg-content').text();
                    expect(msg_txt).toEqual(msgtext);
                }));

                it("will be discarded if it's a malicious message meant to look like a carbon copy", mock.initConverse(function (converse) {
                    test_utils.createContacts(converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(converse);
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
                    spyOn(converse, 'log');
                    var msgtext = 'Please come to Creepy Valley tonight, alone!';
                    var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                    var impersonated_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                    var msg = $msg({
                            'from': sender_jid,
                            'id': (new Date()).getTime(),
                            'to': converse.connection.jid,
                            'type': 'chat',
                            'xmlns': 'jabber:client'
                        }).c('received', {'xmlns': 'urn:xmpp:carbons:2'})
                          .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                          .c('message', {
                                'xmlns': 'jabber:client',
                                'from': impersonated_jid,
                                'to': converse.connection.jid,
                                'type': 'chat'
                        }).c('body').t(msgtext).tree();
                    converse.chatboxes.onMessage(msg);

                    // Check that chatbox for impersonated user is not created.
                    var chatbox = converse.chatboxes.get(impersonated_jid);
                    expect(chatbox).not.toBeDefined();

                    // Check that the chatbox for the malicous user is not created
                    chatbox = converse.chatboxes.get(sender_jid);
                    expect(chatbox).not.toBeDefined();
                }));

                it("received for a minimized chat box will increment a counter on its header", mock.initConverse(function (converse) {
                    test_utils.createContacts(converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(converse);
                    var contact_name = mock.cur_names[0];
                    var contact_jid = contact_name.replace(/ /g,'.').toLowerCase() + '@localhost';
                    runs(function () {
                        spyOn(converse, 'emit').andCallThrough();
                        test_utils.openChatBoxFor(converse, contact_jid);
                        var chatview = converse.chatboxviews.get(contact_jid);
                        expect(chatview.$el.is(':visible')).toBeTruthy();
                        expect(chatview.model.get('minimized')).toBeFalsy();
                        chatview.$el.find('.toggle-chatbox-button').click();
                        expect(chatview.model.get('minimized')).toBeTruthy();
                        var message = 'This message is sent to a minimized chatbox';
                        var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                        var msg = $msg({
                            from: sender_jid,
                            to: converse.connection.jid,
                            type: 'chat',
                            id: (new Date()).getTime()
                        }).c('body').t(message).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                        converse.chatboxes.onMessage(msg);
                        expect(converse.emit).toHaveBeenCalledWith('message', msg);
                        var trimmed_chatboxes = converse.minimized_chats;
                        var trimmedview = trimmed_chatboxes.get(contact_jid);
                        var $count = trimmedview.$el.find('.chat-head-message-count');
                        expect(chatview.$el.is(':visible')).toBeFalsy();
                        expect(trimmedview.model.get('minimized')).toBeTruthy();
                        expect($count.is(':visible')).toBeTruthy();
                        expect($count.html()).toBe('1');
                        converse.chatboxes.onMessage(
                            $msg({
                                from: mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                                to: converse.connection.jid,
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
                    });
                }));

                it("will indicate when it has a time difference of more than a day between it and its predecessor", mock.initConverse(function (converse) {
                    test_utils.createContacts(converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(converse);

                    spyOn(converse, 'emit');
                    var contact_name = mock.cur_names[1];
                    var contact_jid = contact_name.replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(converse, contact_jid);
                    test_utils.clearChatBoxMessages(converse, contact_jid);
                    var one_day_ago = moment();
                    one_day_ago.subtract('days', 1);
                    var message = 'This is a day old message';
                    var chatbox = converse.chatboxes.get(contact_jid);
                    var chatboxview = converse.chatboxviews.get(contact_jid);
                    var $chat_content = chatboxview.$el.find('.chat-content');
                    var msg_obj;
                    var msg_txt;
                    var sender_txt;

                    var msg = $msg({
                        from: contact_jid,
                        to: converse.connection.jid,
                        type: 'chat',
                        id: one_day_ago.unix()
                    }).c('body').t(message).up()
                      .c('delay', { xmlns:'urn:xmpp:delay', from: 'localhost', stamp: one_day_ago.format() })
                      .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                    converse.chatboxes.onMessage(msg);
                    expect(converse.emit).toHaveBeenCalledWith('message', msg);
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
                        to: converse.connection.jid,
                        type: 'chat',
                        id: new Date().getTime()
                    }).c('body').t(message).up()
                      .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                    converse.chatboxes.onMessage(msg);
                    expect(converse.emit).toHaveBeenCalledWith('message', msg);
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
                }));

                it("can be sent from a chatbox, and will appear inside it", mock.initConverse(function (converse) {
                    test_utils.createContacts(converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(converse);

                    spyOn(converse, 'emit');
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(converse, contact_jid);
                    expect(converse.emit).toHaveBeenCalledWith('chatBoxFocused', jasmine.any(Object));
                    var view = converse.chatboxviews.get(contact_jid);
                    var message = 'This message is sent from this chatbox';
                    spyOn(view, 'sendMessage').andCallThrough();
                    test_utils.sendMessage(view, message);
                    expect(view.sendMessage).toHaveBeenCalled();
                    expect(view.model.messages.length, 2);
                    expect(converse.emit.mostRecentCall.args, ['messageSend', message]);
                    expect(view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content').text()).toEqual(message);
                }));

                it("is sanitized to prevent Javascript injection attacks", mock.initConverse(function (converse) {
                    test_utils.createContacts(converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(converse);

                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(converse, contact_jid);
                    var view = converse.chatboxviews.get(contact_jid);
                    var message = '<p>This message contains <em>some</em> <b>markup</b></p>';
                    spyOn(view, 'sendMessage').andCallThrough();
                    test_utils.sendMessage(view, message);
                    expect(view.sendMessage).toHaveBeenCalled();
                    var msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('&lt;p&gt;This message contains &lt;em&gt;some&lt;/em&gt; &lt;b&gt;markup&lt;/b&gt;&lt;/p&gt;');
                }));

                it("should display emoticons correctly", mock.initConverse(function (converse) {
                    test_utils.createContacts(converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(converse);

                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(converse, contact_jid);
                    var view = converse.chatboxviews.get(contact_jid);
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
                    spyOn(view, 'sendMessage').andCallThrough();
                    for (var i = 0; i < messages.length; i++) {
                        var message = messages[i];
                        test_utils.sendMessage(view, message);
                        expect(view.sendMessage).toHaveBeenCalled();
                        var msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content');
                        expect(msg.html()).toEqual(emoticons[i]);
                    }
                }));

                it("can contain hyperlinks, which will be clickable", mock.initConverse(function (converse) {
                    test_utils.createContacts(converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(converse);

                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(converse, contact_jid);
                    var view = converse.chatboxviews.get(contact_jid);
                    var message = 'This message contains a hyperlink: www.opkode.com';
                    spyOn(view, 'sendMessage').andCallThrough();
                    runs(function () {
                        test_utils.sendMessage(view, message);
                    });
                    waits(500);
                    runs(function () {
                        expect(view.sendMessage).toHaveBeenCalled();
                        var msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content');
                        expect(msg.text()).toEqual(message);
                        expect(msg.html()).toEqual('This message contains a hyperlink: <a target="_blank" rel="noopener" href="http://www.opkode.com">www.opkode.com</a>');
                    });
                }));

                it("will have properly escaped URLs", mock.initConverse(function (converse) {
                    test_utils.createContacts(converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(converse);

                    var message, msg;
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(converse, contact_jid);
                    var view = converse.chatboxviews.get(contact_jid);
                    spyOn(view, 'sendMessage').andCallThrough();
                    runs(function () {
                        message = "http://www.opkode.com/'onmouseover='alert(1)'whatever";
                        test_utils.sendMessage(view, message);
                    });
                    waits(50);
                    runs(function () {
                        expect(view.sendMessage).toHaveBeenCalled();
                        msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content');
                        expect(msg.text()).toEqual(message);
                        expect(msg.html()).toEqual('<a target="_blank" rel="noopener" href="http://www.opkode.com/%27onmouseover=%27alert%281%29%27whatever">http://www.opkode.com/\'onmouseover=\'alert(1)\'whatever</a>');

                        message = 'http://www.opkode.com/"onmouseover="alert(1)"whatever';
                        test_utils.sendMessage(view, message);
                    });
                    waits(50);
                    runs(function () {
                        expect(view.sendMessage).toHaveBeenCalled();
                        msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content');
                        expect(msg.text()).toEqual(message);
                        expect(msg.html()).toEqual('<a target="_blank" rel="noopener" href="http://www.opkode.com/%22onmouseover=%22alert%281%29%22whatever">http://www.opkode.com/"onmouseover="alert(1)"whatever</a>');

                        message = "https://en.wikipedia.org/wiki/Ender's_Game";
                        test_utils.sendMessage(view, message);
                    });
                    waits(50);
                    runs(function () {
                        expect(view.sendMessage).toHaveBeenCalled();
                        msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content');
                        expect(msg.text()).toEqual(message);
                        expect(msg.html()).toEqual('<a target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/Ender%27s_Game">https://en.wikipedia.org/wiki/Ender\'s_Game</a>');

                        message = "https://en.wikipedia.org/wiki/Ender%27s_Game";
                        test_utils.sendMessage(view, message);
                    });
                    waits(50);
                    runs(function () {
                        expect(view.sendMessage).toHaveBeenCalled();
                        msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content');
                        expect(msg.text()).toEqual(message);
                        expect(msg.html()).toEqual('<a target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/Ender%27s_Game">https://en.wikipedia.org/wiki/Ender%27s_Game</a>');
                    });
                }));

                it("will render images from their URLs", mock.initConverse(function (converse) {
                    test_utils.createContacts(converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(converse);

                    if (/PhantomJS/.test(window.navigator.userAgent)) {
                        // Doesn't work when running tests in PhantomJS, since
                        // the page is loaded via file:///
                        return;
                    }
                    var message = document.URL.split(window.location.pathname)[0] + "/logo/conversejs.svg";
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(converse, contact_jid);
                    var view = converse.chatboxviews.get(contact_jid);
                    spyOn(view, 'sendMessage').andCallThrough();
                    runs(function () {
                        test_utils.sendMessage(view, message);
                    });
                    waits(500);
                    runs(function () {
                        expect(view.sendMessage).toHaveBeenCalled();
                        var msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-msg-content');
                        expect(msg.html()).toEqual('<img src="'+message+'" class="chat-image">');
                    });
                }));

            });

            describe("A Chat Status Notification", function () {
                afterEach(function () {
                    converse_api.user.logout();
                    converse_api.listen.not();
                    test_utils.clearBrowserStorage();
                });

                it("does not open automatically if a chat state notification is received", mock.initConverse(function (converse) {
                    test_utils.createContacts(converse, 'current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel(converse);

                    spyOn(converse, 'emit');
                    var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                    // <composing> state
                    var msg = $msg({
                            from: sender_jid,
                            to: converse.connection.jid,
                            type: 'chat',
                            id: (new Date()).getTime()
                        }).c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                    converse.chatboxes.onMessage(msg);
                    expect(converse.emit).toHaveBeenCalledWith('message', msg);
                }));

                describe("An active notification", function () {
                    afterEach(function () {
                        converse_api.user.logout();
                        converse_api.listen.not();
                        test_utils.clearBrowserStorage();
                    });

                    it("is sent when the user opens a chat box", mock.initConverse(function (converse) {
                        test_utils.createContacts(converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(converse);

                        waits(300); // ChatBox.show() is debounced for 250ms
                        runs(function () {
                            spyOn(converse.connection, 'send');
                            var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                            test_utils.openChatBoxFor(converse, contact_jid);
                            var view = converse.chatboxviews.get(contact_jid);
                            expect(view.model.get('chat_state')).toBe('active');
                            expect(converse.connection.send).toHaveBeenCalled();
                            var $stanza = $(converse.connection.send.argsForCall[0][0].tree());
                            expect($stanza.attr('to')).toBe(contact_jid);
                            expect($stanza.children().length).toBe(3);
                            expect($stanza.children().get(0).tagName).toBe('active');
                            expect($stanza.children().get(1).tagName).toBe('no-store');
                            expect($stanza.children().get(2).tagName).toBe('no-permanent-store');
                        });
                    }));

                    it("is sent when the user maximizes a minimized a chat box", mock.initConverse(function (converse) {
                        test_utils.createContacts(converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(converse);
                        var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';

                        runs(function () {
                            test_utils.openChatBoxFor(converse, contact_jid);
                        });
                        waits(300); // ChatBox.show() is debounced for 250ms
                        runs(function () {
                            var view = converse.chatboxviews.get(contact_jid);
                            view.model.minimize();
                            expect(view.model.get('chat_state')).toBe('inactive');
                            spyOn(converse.connection, 'send');
                            view.model.maximize();
                            expect(view.model.get('chat_state')).toBe('active');
                            expect(converse.connection.send).toHaveBeenCalled();
                            var $stanza = $(converse.connection.send.argsForCall[0][0].tree());
                            expect($stanza.attr('to')).toBe(contact_jid);
                            expect($stanza.children().length).toBe(3);
                            expect($stanza.children().get(0).tagName).toBe('active');
                            expect($stanza.children().get(1).tagName).toBe('no-store');
                            expect($stanza.children().get(2).tagName).toBe('no-permanent-store');
                        });
                    }));
                });

                describe("A composing notification", function () {
                    afterEach(function () {
                        converse_api.user.logout();
                        converse_api.listen.not();
                        test_utils.clearBrowserStorage();
                    });

                    it("is sent as soon as the user starts typing a message which is not a command", mock.initConverse(function (converse) {
                        test_utils.createContacts(converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(converse);

                        waits(300); // ChatBox.show() is debounced for 250ms
                        runs(function () {
                            var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                            test_utils.openChatBoxFor(converse, contact_jid);
                            var view = converse.chatboxviews.get(contact_jid);
                            expect(view.model.get('chat_state')).toBe('active');
                            spyOn(converse.connection, 'send');
                            view.keyPressed({
                                target: view.$el.find('textarea.chat-textarea'),
                                keyCode: 1
                            });
                            expect(view.model.get('chat_state')).toBe('composing');
                            expect(converse.connection.send).toHaveBeenCalled();
                            var $stanza = $(converse.connection.send.argsForCall[0][0].tree());
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
                            expect(converse.emit.callCount, 1);
                        });
                    }));

                    it("will be shown if received", mock.initConverse(function (converse) {
                        test_utils.createContacts(converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(converse);

                        // See XEP-0085 http://xmpp.org/extensions/xep-0085.html#definitions
                        spyOn(converse, 'emit');
                        var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';

                        // <composing> state
                        var msg = $msg({
                                from: sender_jid,
                                to: converse.connection.jid,
                                type: 'chat',
                                id: (new Date()).getTime()
                            }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        converse.chatboxes.onMessage(msg);
                        expect(converse.emit).toHaveBeenCalledWith('message', msg);
                        var chatboxview = converse.chatboxviews.get(sender_jid);
                        expect(chatboxview).toBeDefined();
                        // Check that the notification appears inside the chatbox in the DOM
                        var $events = chatboxview.$el.find('.chat-event');
                        expect($events.text()).toEqual(mock.cur_names[1] + ' is typing');
                    }));
                });

                describe("A paused notification", function () {
                    afterEach(function () {
                        converse_api.user.logout();
                        converse_api.listen.not();
                        test_utils.clearBrowserStorage();
                    });

                    it("is sent if the user has stopped typing since 30 seconds", mock.initConverse(function (converse) {
                        test_utils.createContacts(converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(converse);

                        var view, contact_jid;
                        converse.TIMEOUTS.PAUSED = 200; // Make the timeout shorter so that we can test
                        waits(300); // ChatBox.show() is debounced for 250ms
                        runs(function () {
                            contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                            test_utils.openChatBoxFor(converse, contact_jid);
                            view = converse.chatboxviews.get(contact_jid);
                            spyOn(converse.connection, 'send');
                            spyOn(view, 'setChatState').andCallThrough();
                            expect(view.model.get('chat_state')).toBe('active');
                            view.keyPressed({
                                target: view.$el.find('textarea.chat-textarea'),
                                keyCode: 1
                            });
                            expect(view.model.get('chat_state')).toBe('composing');
                            expect(converse.connection.send).toHaveBeenCalled();
                            var $stanza = $(converse.connection.send.argsForCall[0][0].tree());
                            expect($stanza.children().get(0).tagName).toBe('composing');
                        });
                        waits(250);
                        runs(function () {
                            expect(view.model.get('chat_state')).toBe('paused');
                            expect(converse.connection.send).toHaveBeenCalled();
                            var $stanza = $(converse.connection.send.argsForCall[1][0].tree());
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
                        });
                        waits(100);
                        runs(function () {
                            view.keyPressed({
                                target: view.$el.find('textarea.chat-textarea'),
                                keyCode: 1
                            });
                            expect(view.model.get('chat_state')).toBe('composing');
                        });
                        waits(150);
                        runs(function () {
                            expect(view.model.get('chat_state')).toBe('composing');
                        });
                    }));

                    it("will be shown if received", mock.initConverse(function (converse) {
                        test_utils.createContacts(converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(converse);

                        // TODO: only show paused state if the previous state was composing
                        // See XEP-0085 http://xmpp.org/extensions/xep-0085.html#definitions
                        spyOn(converse, 'emit');
                        var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                        // <paused> state
                        var msg = $msg({
                                from: sender_jid,
                                to: converse.connection.jid,
                                type: 'chat',
                                id: (new Date()).getTime()
                            }).c('body').c('paused', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        converse.chatboxes.onMessage(msg);
                        expect(converse.emit).toHaveBeenCalledWith('message', msg);
                        var chatboxview = converse.chatboxviews.get(sender_jid);
                        var $events = chatboxview.$el.find('.chat-event');
                        expect($events.text()).toEqual(mock.cur_names[1] + ' has stopped typing');
                    }));
                });

                describe("An inactive notifciation", function () {
                    afterEach(function () {
                        converse_api.user.logout();
                        converse_api.listen.not();
                        test_utils.clearBrowserStorage();
                    });

                    it("is sent if the user has stopped typing since 2 minutes", mock.initConverse(function (converse) {
                        test_utils.createContacts(converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(converse);

                        // Make the timeouts shorter so that we can test
                        converse.TIMEOUTS.PAUSED = 200;
                        converse.TIMEOUTS.INACTIVE = 200;
                        var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                        test_utils.openChatBoxFor(converse, contact_jid);
                        var view = converse.chatboxviews.get(contact_jid);
                        runs(function () {
                            expect(view.model.get('chat_state')).toBe('active');
                            view.keyPressed({
                                target: view.$el.find('textarea.chat-textarea'),
                                keyCode: 1
                            });
                            expect(view.model.get('chat_state')).toBe('composing');
                        });
                        waits(250);
                        runs(function () {
                            expect(view.model.get('chat_state')).toBe('paused');
                            spyOn(converse.connection, 'send');
                        });
                        waits(250);
                        runs(function () {
                            expect(view.model.get('chat_state')).toBe('inactive');
                            expect(converse.connection.send).toHaveBeenCalled();
                            var $stanza = $(converse.connection.send.argsForCall[0][0].tree());
                            expect($stanza.attr('to')).toBe(contact_jid);
                            expect($stanza.children().length).toBe(3);
                            expect($stanza.children().get(0).tagName).toBe('inactive');
                            expect($stanza.children().get(1).tagName).toBe('no-store');
                            expect($stanza.children().get(2).tagName).toBe('no-permanent-store');

                        });
                    }));

                    it("is sent when the user a minimizes a chat box", mock.initConverse(function (converse) {
                        test_utils.createContacts(converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(converse);

                        var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                        test_utils.openChatBoxFor(converse, contact_jid);
                        var view = converse.chatboxviews.get(contact_jid);
                        spyOn(converse.connection, 'send');
                        view.minimize();
                        expect(view.model.get('chat_state')).toBe('inactive');
                        expect(converse.connection.send).toHaveBeenCalled();
                        var $stanza = $(converse.connection.send.argsForCall[0][0].tree());
                        expect($stanza.attr('to')).toBe(contact_jid);
                        expect($stanza.children().get(0).tagName).toBe('inactive');
                    }));

                    it("is sent if the user closes a chat box", mock.initConverse(function (converse) {
                        test_utils.createContacts(converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(converse);

                        waits(300); // ChatBox.show() is debounced for 250ms
                        runs(function () {
                            var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                            test_utils.openChatBoxFor(converse, contact_jid);
                            var view = converse.chatboxviews.get(contact_jid);
                            expect(view.model.get('chat_state')).toBe('active');
                            spyOn(converse.connection, 'send');
                            view.close();
                            expect(view.model.get('chat_state')).toBe('inactive');
                            expect(converse.connection.send).toHaveBeenCalled();
                            var $stanza = $(converse.connection.send.argsForCall[0][0].tree());
                            expect($stanza.attr('to')).toBe(contact_jid);
                            expect($stanza.children().length).toBe(3);
                            expect($stanza.children().get(0).tagName).toBe('inactive');
                            expect($stanza.children().get(1).tagName).toBe('no-store');
                            expect($stanza.children().get(2).tagName).toBe('no-permanent-store');
                        });
                    }));

                    it("will clear any other chat status notifications if its received", mock.initConverse(function (converse) {
                        test_utils.createContacts(converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(converse);

                        // See XEP-0085 http://xmpp.org/extensions/xep-0085.html#definitions
                        spyOn(converse, 'emit');
                        var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                        test_utils.openChatBoxFor(converse, sender_jid);
                        var view = converse.chatboxviews.get(sender_jid);
                        expect(view.$el.find('.chat-event').length).toBe(0);
                        view.showStatusNotification(sender_jid+' '+'is typing');
                        expect(view.$el.find('.chat-event').length).toBe(1);
                        var msg = $msg({
                                from: sender_jid,
                                to: converse.connection.jid,
                                type: 'chat',
                                id: (new Date()).getTime()
                            }).c('body').c('inactive', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        converse.chatboxes.onMessage(msg);
                        expect(converse.emit).toHaveBeenCalledWith('message', msg);
                        expect(view.$el.find('.chat-event').length).toBe(0);
                    }));

                });

                describe("A gone notifciation", function () {
                    afterEach(function () {
                        converse_api.user.logout();
                        converse_api.listen.not();
                        test_utils.clearBrowserStorage();
                    });

                    it("will be shown if received", mock.initConverse(function (converse) {
                        test_utils.createContacts(converse, 'current');
                        test_utils.openControlBox();
                        test_utils.openContactsPanel(converse);

                        spyOn(converse, 'emit');
                        var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                        // <paused> state
                        var msg = $msg({
                                from: sender_jid,
                                to: converse.connection.jid,
                                type: 'chat',
                                id: (new Date()).getTime()
                            }).c('body').c('gone', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        converse.chatboxes.onMessage(msg);
                        expect(converse.emit).toHaveBeenCalledWith('message', msg);
                        var chatboxview = converse.chatboxviews.get(sender_jid);
                        var $events = chatboxview.$el.find('.chat-event');
                        expect($events.text()).toEqual(mock.cur_names[1] + ' has gone away');
                    }));
                });
            });
        });

        describe("Special Messages", function () {
            afterEach(function () {
                converse_api.user.logout();
                converse_api.listen.not();
                test_utils.clearBrowserStorage();
            });

            it("'/clear' can be used to clear messages in a conversation", mock.initConverse(function (converse) {
                test_utils.createContacts(converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(converse);

                spyOn(converse, 'emit');
                var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                test_utils.openChatBoxFor(converse, contact_jid);
                var view = converse.chatboxviews.get(contact_jid);
                var message = 'This message is another sent from this chatbox';
                // Lets make sure there is at least one message already
                // (e.g for when this test is run on its own).
                test_utils.sendMessage(view, message);
                expect(view.model.messages.length > 0).toBeTruthy();
                expect(view.model.messages.browserStorage.records.length > 0).toBeTruthy();
                expect(converse.emit).toHaveBeenCalledWith('messageSend', message);

                message = '/clear';
                spyOn(view, 'onMessageSubmitted').andCallThrough();
                spyOn(view, 'clearMessages').andCallThrough();
                spyOn(window, 'confirm').andCallFake(function () {
                    return true;
                });
                test_utils.sendMessage(view, message);
                expect(view.onMessageSubmitted).toHaveBeenCalled();
                expect(view.clearMessages).toHaveBeenCalled();
                expect(window.confirm).toHaveBeenCalled();
                expect(view.model.messages.length, 0); // The messages must be removed from the chatbox
                expect(view.model.messages.browserStorage.records.length, 0); // And also from browserStorage
                expect(converse.emit.callCount, 1);
                expect(converse.emit.mostRecentCall.args, ['messageSend', message]);
            }));
        });

        describe("A Message Counter", function () {
            afterEach(function () {
                converse_api.user.logout();
                converse_api.listen.not();
                test_utils.clearBrowserStorage();
            });

            it("is incremented when the message is received and the window is not focused", mock.initConverse(function (converse) {
                test_utils.createContacts(converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(converse);

                spyOn(converse, 'emit');
                expect(converse.msg_counter).toBe(0);
                spyOn(converse, 'incrementMsgCounter').andCallThrough();
                var previous_state = converse.windowState;
                var message = 'This message will increment the message counter';
                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                    msg = $msg({
                        from: sender_jid,
                        to: converse.connection.jid,
                        type: 'chat',
                        id: (new Date()).getTime()
                    }).c('body').t(message).up()
                      .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                converse.windowState = 'hidden';
                converse.chatboxes.onMessage(msg);
                expect(converse.incrementMsgCounter).toHaveBeenCalled();
                expect(converse.msg_counter).toBe(1);
                expect(converse.emit).toHaveBeenCalledWith('message', msg);
                converse.windowSate = previous_state;
            }));

            it("is cleared when the window is focused", mock.initConverse(function (converse) {
                test_utils.createContacts(converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(converse);

                converse.windowState = 'hidden';
                spyOn(converse, 'clearMsgCounter').andCallThrough();
                runs(function () {
                    converse.saveWindowState(null, 'focus');
                    converse.saveWindowState(null, 'blur');
                });
                waits(50);
                runs(function () {
                    expect(converse.clearMsgCounter).toHaveBeenCalled();
                });
            }));

            it("is not incremented when the message is received and the window is focused", mock.initConverse(function (converse) {
                test_utils.createContacts(converse, 'current');
                test_utils.openControlBox();
                test_utils.openContactsPanel(converse);

                expect(converse.msg_counter).toBe(0);
                spyOn(converse, 'incrementMsgCounter').andCallThrough();
                converse.saveWindowState(null, 'focus');
                var message = 'This message will not increment the message counter';
                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                    msg = $msg({
                        from: sender_jid,
                        to: converse.connection.jid,
                        type: 'chat',
                        id: (new Date()).getTime()
                    }).c('body').t(message).up()
                      .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                converse.chatboxes.onMessage(msg);
                expect(converse.incrementMsgCounter).not.toHaveBeenCalled();
                expect(converse.msg_counter).toBe(0);
            }));
        });
    });
}));
