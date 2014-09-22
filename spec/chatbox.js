(function (root, factory) {
    define([
        "mock",
        "test_utils"
        ], function (mock, test_utils) {
            return factory(mock, test_utils);
        }
    );
} (this, function (mock, test_utils) {
    return describe("Chatboxes", $.proxy(function(mock, test_utils) {
        describe("A Chatbox", $.proxy(function () {
            beforeEach(function () {
                runs(function () {
                    test_utils.closeAllChatBoxes();
                    test_utils.removeControlBox();
                    test_utils.clearBrowserStorage();
                    test_utils.initConverse();
                    test_utils.createContacts('current');
                    test_utils.openControlBox();
                    test_utils.openContactsPanel();
                });
            });

            it("is created when you click on a roster item", $.proxy(function () {
                var i, $el, click, jid, chatboxview;
                // openControlBox was called earlier, so the controlbox is
                // visible, but no other chat boxes have been created.
                expect(this.chatboxes.length).toEqual(1);
                spyOn(this.chatboxviews, 'trimChats');
                expect($("#conversejs .chatbox").length).toBe(1); // Controlbox is open

                var online_contacts = this.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact').find('a.open-chat');
                for (i=0; i<online_contacts.length; i++) {
                    $el = $(online_contacts[i]);
                    jid = $el.text().replace(/ /g,'.').toLowerCase() + '@localhost';
                    $el.click();
                    chatboxview = this.chatboxviews.get(jid);
                    expect(this.chatboxes.length).toEqual(i+2);
                    expect(this.chatboxviews.trimChats).toHaveBeenCalled();
                    // Check that new chat boxes are created to the left of the
                    // controlbox (but to the right of all existing chat boxes)
                    expect($("#conversejs .chatbox").length).toBe(i+2);
                    expect($("#conversejs .chatbox")[1].id).toBe(chatboxview.model.get('box_id'));
                }
            }, converse));

            it("can be trimmed to conserve space", $.proxy(function () {
                var i, $el, click, jid, key, chatbox, chatboxview;
                // openControlBox was called earlier, so the controlbox is
                // visible, but no other chat boxes have been created.
                var trimmed_chatboxes = converse.minimized_chats;
                expect(this.chatboxes.length).toEqual(1);
                spyOn(this.chatboxviews, 'trimChats');
                spyOn(trimmed_chatboxes, 'addChat').andCallThrough();
                spyOn(trimmed_chatboxes, 'removeChat').andCallThrough();
                expect($("#conversejs .chatbox").length).toBe(1); // Controlbox is open

                // Test that they can be trimmed
                var online_contacts = this.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact').find('a.open-chat');
                for (i=0; i<online_contacts.length; i++) {
                    $el = $(online_contacts[i]);
                    jid = $el.text().replace(/ /g,'.').toLowerCase() + '@localhost';
                    $el.click();
                    expect(this.chatboxviews.trimChats).toHaveBeenCalled();

                    chatboxview = this.chatboxviews.get(jid);
                    spyOn(chatboxview, 'hide').andCallThrough();
                    chatboxview.model.set({'minimized': true});
                    expect(trimmed_chatboxes.addChat).toHaveBeenCalled();
                    expect(chatboxview.hide).toHaveBeenCalled();
                    trimmedview = trimmed_chatboxes.get(jid);
                }

                // Test that they can be maximized again
                runs($.proxy(function () {
                    var key = this.chatboxviews.keys()[1];
                    trimmedview = trimmed_chatboxes.get(key);
                    chatbox = trimmedview.model;
                    spyOn(chatbox, 'maximize').andCallThrough();
                    spyOn(trimmedview, 'restore').andCallThrough();
                    trimmedview.delegateEvents();
                    trimmedview.$("a.restore-chat").click();
                }, this));
                waits(250);
                runs($.proxy(function () {
                    expect(trimmedview.restore).toHaveBeenCalled();
                    expect(chatbox.maximize).toHaveBeenCalled();
                    expect(this.chatboxviews.trimChats).toHaveBeenCalled();
                }, this));
            }, converse));

            it("is focused if its already open and you click on its corresponding roster item", $.proxy(function () {
                var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                var i, $el, click, jid, chatboxview, chatbox;
                // openControlBox was called earlier, so the controlbox is
                // visible, but no other chat boxes have been created.
                expect(this.chatboxes.length).toEqual(1);
                chatbox = test_utils.openChatBoxFor(contact_jid);
                chatboxview = this.chatboxviews.get(contact_jid);
                spyOn(chatboxview, 'focus');
                $el = this.rosterview.$el.find('a.open-chat:contains("'+chatbox.get('fullname')+'")');
                jid = $el.text().replace(/ /g,'.').toLowerCase() + '@localhost';
                $el.click();
                expect(this.chatboxes.length).toEqual(2);
                expect(chatboxview.focus).toHaveBeenCalled();
            }, converse));

            it("can be saved to, and retrieved from, browserStorage", $.proxy(function () {
                spyOn(converse, 'emit');
                spyOn(this.chatboxviews, 'trimChats');
                runs(function () {
                    test_utils.openControlBox();
                });
                waits(250);
                runs(function () {
                    test_utils.openChatBoxes(6);
                    expect(this.chatboxviews.trimChats).toHaveBeenCalled();
                    // We instantiate a new ChatBoxes collection, which by default
                    // will be empty.
                    var newchatboxes = new this.ChatBoxes();
                    expect(newchatboxes.length).toEqual(0);
                    // The chatboxes will then be fetched from browserStorage inside the
                    // onConnected method
                    newchatboxes.onConnected();
                    expect(newchatboxes.length).toEqual(7);
                    // Check that the chatboxes items retrieved from browserStorage
                    // have the same attributes values as the original ones.
                    attrs = ['id', 'box_id', 'visible'];
                    for (i=0; i<attrs.length; i++) {
                        new_attrs = _.pluck(_.pluck(newchatboxes.models, 'attributes'), attrs[i]);
                        old_attrs = _.pluck(_.pluck(this.chatboxes.models, 'attributes'), attrs[i]);
                        expect(_.isEqual(new_attrs, old_attrs)).toEqual(true);
                    }
                    this.rosterview.render();
                }.bind(converse));
            }, converse));

            it("can be closed by clicking a DOM element with class 'close-chatbox-button'", $.proxy(function () {
                var chatbox = test_utils.openChatBoxes(1)[0],
                    controlview = this.chatboxviews.get('controlbox'), // The controlbox is currently open
                    chatview = this.chatboxviews.get(chatbox.get('jid'));
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
            }, converse));

            it("can be minimized by clicking a DOM element with class 'toggle-chatbox-button'", function () {
                var chatbox = test_utils.openChatBoxes(1)[0],
                    chatview = this.chatboxviews.get(chatbox.get('jid')),
                    trimmed_chatboxes = this.minimized_chats,
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
            }.bind(converse));

            it("will be removed from browserStorage when closed", $.proxy(function () {
                spyOn(converse, 'emit');
                spyOn(converse.chatboxviews, 'trimChats');
                this.chatboxes.browserStorage._clear();
                runs(function () {
                    test_utils.closeControlBox();
                });
                waits(50);
                runs(function () {
                    expect(converse.emit).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                    expect(converse.chatboxes.length).toEqual(1);
                    expect(converse.chatboxes.pluck('id')).toEqual(['controlbox']);
                    test_utils.openChatBoxes(6);
                    expect(converse.chatboxviews.trimChats).toHaveBeenCalled();
                    expect(converse.chatboxes.length).toEqual(7);
                    expect(converse.emit).toHaveBeenCalledWith('chatBoxOpened', jasmine.any(Object));
                    test_utils.closeAllChatBoxes();
                });
                waits(50);
                runs(function () {
                    expect(converse.chatboxes.length).toEqual(1);
                    expect(converse.chatboxes.pluck('id')).toEqual(['controlbox']);
                    expect(converse.emit).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                    var newchatboxes = new this.ChatBoxes();
                    expect(newchatboxes.length).toEqual(0);
                    expect(converse.chatboxes.pluck('id')).toEqual(['controlbox']);
                    // onConnected will fetch chatboxes in browserStorage, but
                    // because there aren't any open chatboxes, there won't be any
                    // in browserStorage either. XXX except for the controlbox
                    newchatboxes.onConnected();
                    expect(newchatboxes.length).toEqual(1);
                    expect(newchatboxes.models[0].id).toBe("controlbox");
                }.bind(converse));
            }, converse));

            describe("A chat toolbar", $.proxy(function () {
                it("can be found on each chat box", $.proxy(function () {
                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(contact_jid);
                    var chatbox = this.chatboxes.get(contact_jid);
                    var view = this.chatboxviews.get(contact_jid);
                    expect(chatbox).toBeDefined();
                    expect(view).toBeDefined();
                    var $toolbar = view.$el.find('ul.chat-toolbar');
                    expect($toolbar.length).toBe(1);
                    expect($toolbar.children('li').length).toBe(3);
                }, converse));

                it("contains a button for inserting emoticons", $.proxy(function () {
                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(contact_jid);
                    var view = this.chatboxviews.get(contact_jid);
                    var $toolbar = view.$el.find('ul.chat-toolbar');
                    var $textarea = view.$el.find('textarea.chat-textarea');
                    expect($toolbar.children('li.toggle-smiley').length).toBe(1);
                    // Register spies
                    spyOn(view, 'toggleEmoticonMenu').andCallThrough();
                    spyOn(view, 'insertEmoticon').andCallThrough();
                    view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called

                    runs(function () {
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
                }, converse));

                it("contains a button for starting an encrypted chat session", $.proxy(function () {
                    // TODO: More tests can be added here...
                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(contact_jid);
                    var view = this.chatboxviews.get(contact_jid);
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

                }, converse));

                it("can contain a button for starting a call", $.proxy(function () {
                    var view, callButton, $toolbar;
                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                    spyOn(converse, 'emit');
                    // First check that the button doesn't show if it's not enabled
                    // via "visible_toolbar_buttons"
                    converse.visible_toolbar_buttons.call = false;
                    test_utils.openChatBoxFor(contact_jid);
                    view = this.chatboxviews.get(contact_jid);
                    $toolbar = view.$el.find('ul.chat-toolbar');
                    callButton = $toolbar.find('.toggle-call');
                    expect(callButton.length).toBe(0);
                    view.close();
                    // Now check that it's shown if enabled and that it emits
                    // callButtonClicked
                    converse.visible_toolbar_buttons.call = true; // enable the button
                    test_utils.openChatBoxFor(contact_jid);
                    view = this.chatboxviews.get(contact_jid);
                    $toolbar = view.$el.find('ul.chat-toolbar');
                    callButton = $toolbar.find('.toggle-call');
                    expect(callButton.length).toBe(1);
                    callButton.click();
                    expect(converse.emit).toHaveBeenCalledWith('callButtonClicked', jasmine.any(Object));
                }, converse));

                it("can contain a button for clearing messages", $.proxy(function () {
                    var view, clearButton, $toolbar;
                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                    // First check that the button doesn't show if it's not enabled
                    // via "visible_toolbar_buttons"
                    converse.visible_toolbar_buttons.clear = false;
                    test_utils.openChatBoxFor(contact_jid);
                    view = this.chatboxviews.get(contact_jid);
                    view = this.chatboxviews.get(contact_jid);
                    $toolbar = view.$el.find('ul.chat-toolbar');
                    clearButton = $toolbar.find('.toggle-clear');
                    expect(clearButton.length).toBe(0);
                    view.close();
                    // Now check that it's shown if enabled and that it calls
                    // clearMessages
                    converse.visible_toolbar_buttons.clear = true; // enable the button
                    test_utils.openChatBoxFor(contact_jid);
                    view = this.chatboxviews.get(contact_jid);
                    $toolbar = view.$el.find('ul.chat-toolbar');
                    clearButton = $toolbar.find('.toggle-clear');
                    expect(clearButton.length).toBe(1);
                    spyOn(view, 'clearMessages');
                    view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                    clearButton.click();
                    expect(view.clearMessages).toHaveBeenCalled();
                }, converse));

            }, converse));

            describe("A Chat Message", $.proxy(function () {

                beforeEach(function () {
                    runs(function () {
                        test_utils.closeAllChatBoxes();
                    });
                    waits(250);
                    runs(function () {});
                });

                it("can be received which will open a chatbox and be displayed inside it", $.proxy(function () {
                    spyOn(converse, 'emit');
                    var message = 'This is a received message';
                    var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                        msg = $msg({
                            from: sender_jid,
                            to: this.connection.jid,
                            type: 'chat',
                            id: (new Date()).getTime()
                        }).c('body').t(message).up()
                          .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();

                    // We don't already have an open chatbox for this user
                    expect(this.chatboxes.get(sender_jid)).not.toBeDefined();

                    runs($.proxy(function () {
                        // onMessage is a handler for received XMPP messages
                        this.chatboxes.onMessage(msg);
                        expect(converse.emit).toHaveBeenCalledWith('message', msg);
                    }, converse));
                    waits(250);
                    runs($.proxy(function () {
                        // Check that the chatbox and its view now exist
                        var chatbox = this.chatboxes.get(sender_jid);
                        var chatboxview = this.chatboxviews.get(sender_jid);
                        expect(chatbox).toBeDefined();
                        expect(chatboxview).toBeDefined();
                        // Check that the message was received and check the
                        // message parameters
                        expect(chatbox.messages.length).toEqual(1);
                        var msg_obj = chatbox.messages.models[0];
                        expect(msg_obj.get('message')).toEqual(message);
                        // XXX: This is stupid, fullname is actually only the
                        // users first name
                        expect(msg_obj.get('fullname')).toEqual(mock.cur_names[0].split(' ')[0]);
                        expect(msg_obj.get('sender')).toEqual('them');
                        expect(msg_obj.get('delayed')).toEqual(false);
                        // Now check that the message appears inside the
                        // chatbox in the DOM
                        var $chat_content = chatboxview.$el.find('.chat-content');
                        var msg_txt = $chat_content.find('.chat-message').find('.chat-message-content').text();
                        expect(msg_txt).toEqual(message);
                        var sender_txt = $chat_content.find('span.chat-message-them').text();
                        expect(sender_txt.match(/^[0-9][0-9]:[0-9][0-9] /)).toBeTruthy();
                    }, converse));
                }, converse));

                it("received for a minimized chat box will increment a counter on its header", $.proxy(function () {
                    var contact_name = mock.cur_names[0];
                    var contact_jid = contact_name.replace(/ /g,'.').toLowerCase() + '@localhost';
                    spyOn(this, 'emit');
                    runs(function () {
                        test_utils.openChatBoxFor(contact_jid);
                        var chatview = converse.chatboxviews.get(contact_jid);
                        expect(chatview.model.get('minimized')).toBeFalsy();
                        chatview.$el.find('.toggle-chatbox-button').click();
                    });
                    waits(50);
                    runs($.proxy(function () {
                        var chatview = this.chatboxviews.get(contact_jid);
                        expect(chatview.model.get('minimized')).toBeTruthy();
                        var message = 'This message is sent to a minimized chatbox';
                        var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                        msg = $msg({
                            from: sender_jid,
                            to: this.connection.jid,
                            type: 'chat',
                            id: (new Date()).getTime()
                        }).c('body').t(message).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                        this.chatboxes.onMessage(msg);
                        expect(this.emit).toHaveBeenCalledWith('message', msg);
                    }, converse));
                    waits(50);
                    runs($.proxy(function () {
                        var trimmed_chatboxes = this.minimized_chats;
                        var trimmedview = trimmed_chatboxes.get(contact_jid);
                        var $count = trimmedview.$el.find('.chat-head-message-count');
                        expect(trimmedview.model.get('minimized')).toBeTruthy();
                        expect($count.is(':visible')).toBeTruthy();
                        expect($count.html()).toBe('1');
                        this.chatboxes.onMessage(
                            $msg({
                                from: mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                                to: this.connection.jid,
                                type: 'chat',
                                id: (new Date()).getTime()
                            }).c('body').t('This message is also sent to a minimized chatbox').up()
                            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree()
                        );
                    }, converse));
                    waits(50);
                    runs($.proxy(function () {
                        var trimmed_chatboxes = this.minimized_chats;
                        var trimmedview = trimmed_chatboxes.get(contact_jid);
                        var $count = trimmedview.$el.find('.chat-head-message-count');
                        expect(trimmedview.model.get('minimized')).toBeTruthy();
                        expect($count.is(':visible')).toBeTruthy();
                        expect($count.html()).toBe('2');
                        trimmedview.$el.find('.restore-chat').click();
                    }, converse));
                    waits(250);
                    runs($.proxy(function () {
                        var trimmed_chatboxes = this.minimized_chats;
                        expect(trimmed_chatboxes.keys().length).toBe(0);
                    }, converse));
                }, converse));
 
                it("will indicate when it has a time difference of more than a day between it and its predecessor", $.proxy(function () {
                    spyOn(converse, 'emit');
                    var contact_name = mock.cur_names[1];
                    var contact_jid = contact_name.replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(contact_jid);
                    test_utils.clearChatBoxMessages(contact_jid);
                    var one_day_ago = moment();
                    one_day_ago.subtract('days', 1);
                    var message = 'This is a day old message';
                    var chatbox = this.chatboxes.get(contact_jid);
                    var chatboxview = this.chatboxviews.get(contact_jid);
                    var $chat_content = chatboxview.$el.find('.chat-content');
                    var msg_obj;
                    var msg_txt;
                    var sender_txt;

                    var msg = $msg({
                        from: contact_jid,
                        to: this.connection.jid,
                        type: 'chat',
                        id: one_day_ago.unix()
                    }).c('body').t(message).up()
                      .c('delay', { xmlns:'urn:xmpp:delay', from: 'localhost', stamp: one_day_ago.format() })
                      .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                    this.chatboxes.onMessage(msg);
                    expect(converse.emit).toHaveBeenCalledWith('message', msg);
                    expect(chatbox.messages.length).toEqual(1);
                    msg_obj = chatbox.messages.models[0];
                    expect(msg_obj.get('message')).toEqual(message);
                    expect(msg_obj.get('fullname')).toEqual(contact_name.split(' ')[0]);
                    expect(msg_obj.get('sender')).toEqual('them');
                    expect(msg_obj.get('delayed')).toEqual(true);
                    msg_txt = $chat_content.find('.chat-message').find('.chat-message-content').text();
                    expect(msg_txt).toEqual(message);
                    sender_txt = $chat_content.find('span.chat-message-them').text();
                    expect(sender_txt.match(/^[0-9][0-9]:[0-9][0-9] /)).toBeTruthy();

                    message = 'This is a current message';
                    msg = $msg({
                        from: contact_jid,
                        to: this.connection.jid,
                        type: 'chat',
                        id: new Date().getTime()
                    }).c('body').t(message).up()
                      .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                    this.chatboxes.onMessage(msg);
                    expect(converse.emit).toHaveBeenCalledWith('message', msg);
                    // Check that there is a <time> element, with the required
                    // props.
                    var $time = $chat_content.find('time');
                    var message_date = new Date();
                    expect($time.length).toEqual(1);
                    expect($time.attr('class')).toEqual('chat-date');
                    expect($time.attr('datetime')).toEqual(moment(message_date).format("YYYY-MM-DD"));
                    expect($time.text()).toEqual(moment(message_date).format("dddd MMM Do YYYY"));

                    // Normal checks for the 2nd message
                    expect(chatbox.messages.length).toEqual(2);
                    msg_obj = chatbox.messages.models[1];
                    expect(msg_obj.get('message')).toEqual(message);
                    expect(msg_obj.get('fullname')).toEqual(contact_name.split(' ')[0]);
                    expect(msg_obj.get('sender')).toEqual('them');
                    expect(msg_obj.get('delayed')).toEqual(false);
                    msg_txt = $chat_content.find('.chat-message').last().find('.chat-message-content').text();
                    expect(msg_txt).toEqual(message);
                    sender_txt = $chat_content.find('span.chat-message-them').last().text();
                    expect(sender_txt.match(/^[0-9][0-9]:[0-9][0-9] /)).toBeTruthy();
                }, converse));

                it("can be sent from a chatbox, and will appear inside it", $.proxy(function () {
                    spyOn(converse, 'emit');
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    runs(function () {
                        test_utils.openChatBoxFor(contact_jid);
                    });
                    waits(250);
                    runs(function () {
                        expect(converse.emit).toHaveBeenCalledWith('chatBoxFocused', jasmine.any(Object));
                        var view = this.chatboxviews.get(contact_jid);
                        var message = 'This message is sent from this chatbox';
                        spyOn(view, 'sendMessage').andCallThrough();
                        test_utils.sendMessage(view, message);
                        expect(view.sendMessage).toHaveBeenCalled();
                        expect(view.model.messages.length, 2);
                        expect(converse.emit.mostRecentCall.args, ['messageSend', message]);
                        expect(view.$el.find('.chat-content').find('.chat-message').last().find('.chat-message-content').text()).toEqual(message);
                    }.bind(converse));
                }, converse));

                it("is sanitized to prevent Javascript injection attacks", $.proxy(function () {
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(contact_jid);
                    var view = this.chatboxviews.get(contact_jid);
                    var message = '<p>This message contains <em>some</em> <b>markup</b></p>';
                    spyOn(view, 'sendMessage').andCallThrough();
                    test_utils.sendMessage(view, message);
                    expect(view.sendMessage).toHaveBeenCalled();
                    var msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-message-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('&lt;p&gt;This message contains &lt;em&gt;some&lt;/em&gt; &lt;b&gt;markup&lt;/b&gt;&lt;/p&gt;');
                }, converse));

                it("can contain hyperlinks, which will be clickable", $.proxy(function () {
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(contact_jid);
                    var view = this.chatboxviews.get(contact_jid);
                    var message = 'This message contains a hyperlink: www.opkode.com';
                    spyOn(view, 'sendMessage').andCallThrough();
                    test_utils.sendMessage(view, message);
                    expect(view.sendMessage).toHaveBeenCalled();
                    var msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-message-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('This message contains a hyperlink: <a target="_blank" href="http://www.opkode.com">www.opkode.com</a>');
                }, converse));

                it("should display emoticons correctly", $.proxy(function () {
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(contact_jid);
                    var view = this.chatboxviews.get(contact_jid);
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
                        var msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-message-content');
                        expect(msg.html()).toEqual(emoticons[i]);
                    }
                }, converse));

                it("will have properly escaped URLs", $.proxy(function () {
                    var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.openChatBoxFor(contact_jid);
                    var view = this.chatboxviews.get(contact_jid);
                    spyOn(view, 'sendMessage').andCallThrough();

                    var message = "http://www.opkode.com/'onmouseover='alert(1)'whatever";
                    test_utils.sendMessage(view, message);
                    expect(view.sendMessage).toHaveBeenCalled();
                    var msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-message-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('<a target="_blank" href="http://www.opkode.com/%27onmouseover=%27alert%281%29%27whatever">http://www.opkode.com/\'onmouseover=\'alert(1)\'whatever</a>');

                    message = 'http://www.opkode.com/"onmouseover="alert(1)"whatever';
                    test_utils.sendMessage(view, message);
                    expect(view.sendMessage).toHaveBeenCalled();
                    msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-message-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('<a target="_blank" href="http://www.opkode.com/%22onmouseover=%22alert%281%29%22whatever">http://www.opkode.com/"onmouseover="alert(1)"whatever</a>');

                    message = "https://en.wikipedia.org/wiki/Ender's_Game";
                    test_utils.sendMessage(view, message);
                    expect(view.sendMessage).toHaveBeenCalled();
                    msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-message-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('<a target="_blank" href="https://en.wikipedia.org/wiki/Ender%27s_Game">https://en.wikipedia.org/wiki/Ender\'s_Game</a>');

                    message = "https://en.wikipedia.org/wiki/Ender%27s_Game";
                    test_utils.sendMessage(view, message);
                    expect(view.sendMessage).toHaveBeenCalled();
                    msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-message-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('<a target="_blank" href="https://en.wikipedia.org/wiki/Ender%27s_Game">https://en.wikipedia.org/wiki/Ender%27s_Game</a>');
                }, converse));

            }, converse));
        }, converse));

        describe("Special Messages", $.proxy(function () {
            beforeEach(function () {
                test_utils.closeAllChatBoxes();
                test_utils.removeControlBox();
                converse.roster.browserStorage._clear();
                test_utils.initConverse();
                test_utils.createContacts('current');
                test_utils.openControlBox();
                test_utils.openContactsPanel();
            });

            it("'/clear' can be used to clear messages in a conversation", $.proxy(function () {
                spyOn(converse, 'emit');
                var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                test_utils.openChatBoxFor(contact_jid);
                var view = this.chatboxviews.get(contact_jid);
                var message = 'This message is another sent from this chatbox';
                // Lets make sure there is at least one message already
                // (e.g for when this test is run on its own).
                test_utils.sendMessage(view, message);
                expect(view.model.messages.length > 0).toBeTruthy();
                expect(view.model.messages.browserStorage.records.length > 0).toBeTruthy();
                expect(converse.emit).toHaveBeenCalledWith('messageSend', message);

                message = '/clear';
                var old_length = view.model.messages.length;
                spyOn(view, 'sendMessage').andCallThrough();
                spyOn(view, 'clearMessages').andCallThrough();
                spyOn(window, 'confirm').andCallFake(function () {
                    return true;
                });
                test_utils.sendMessage(view, message);
                expect(view.sendMessage).toHaveBeenCalled();
                expect(view.clearMessages).toHaveBeenCalled();
                expect(window.confirm).toHaveBeenCalled();
                expect(view.model.messages.length, 0); // The messages must be removed from the chatbox
                expect(view.model.messages.browserStorage.records.length, 0); // And also from browserStorage
                expect(converse.emit.callCount, 1);
                expect(converse.emit.mostRecentCall.args, ['messageSend', message]);
            }, converse));
        }, converse));

        describe("A Message Counter", $.proxy(function () {
            beforeEach($.proxy(function () {
                converse.clearMsgCounter();
            }, converse));

            it("is incremented when the message is received and the window is not focused", $.proxy(function () {
                spyOn(converse, 'emit');
                expect(this.msg_counter).toBe(0);
                spyOn(converse, 'incrementMsgCounter').andCallThrough();
                $(window).trigger('blur');
                var message = 'This message will increment the message counter';
                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    msg = $msg({
                        from: sender_jid,
                        to: this.connection.jid,
                        type: 'chat',
                        id: (new Date()).getTime()
                    }).c('body').t(message).up()
                      .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                this.chatboxes.onMessage(msg);
                expect(converse.incrementMsgCounter).toHaveBeenCalled();
                expect(this.msg_counter).toBe(1);
                expect(converse.emit).toHaveBeenCalledWith('message', msg);
            }, converse));

            it("is cleared when the window is focused", $.proxy(function () {
                spyOn(converse, 'clearMsgCounter').andCallThrough();
                runs(function () {
                    $(window).triggerHandler('blur');
                    $(window).triggerHandler('focus');
                });
                waits(50);
                runs(function () {
                    expect(converse.clearMsgCounter).toHaveBeenCalled();
                });
            }, converse));

            it("is not incremented when the message is received and the window is focused", $.proxy(function () {
                expect(this.msg_counter).toBe(0);
                spyOn(converse, 'incrementMsgCounter').andCallThrough();
                $(window).trigger('focus');
                var message = 'This message will not increment the message counter';
                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    msg = $msg({
                        from: sender_jid,
                        to: this.connection.jid,
                        type: 'chat',
                        id: (new Date()).getTime()
                    }).c('body').t(message).up()
                      .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                this.chatboxes.onMessage(msg);
                expect(converse.incrementMsgCounter).not.toHaveBeenCalled();
                expect(this.msg_counter).toBe(0);
            }, converse));
        }, converse));
    }, converse, mock, test_utils));
}));
