(function (root, factory) {
    define([
        "mock",
        "utils"
        ], function (mock, utils) {
            return factory(mock, utils);
        }
    );
} (this, function (mock, utils) {
    return describe("Chatboxes", $.proxy(function(mock, utils) {
        describe("A Chatbox", $.proxy(function () {
            beforeEach(function () {
                runs(function () {
                    utils.closeAllChatBoxes();
                    utils.removeControlBox();
                });
                waits(250);
                runs(function () {
                    converse.roster.localStorage._clear();
                    utils.initConverse();
                    utils.createCurrentContacts();
                    utils.openControlBox();
                });
                waits(250);
                runs(function () {
                    utils.openContactsPanel();
                });
                waits(250);
                runs(function () {});
            });

            it("is created when you click on a roster item", $.proxy(function () {
                var i, $el, click, jid, view;
                // openControlBox was called earlier, so the controlbox is
                // visible, but no other chat boxes have been created.
                expect(this.chatboxes.length).toEqual(1);
                spyOn(this.chatboxviews, 'trimOpenChats');

                var online_contacts = this.rosterview.$el.find('dt#xmpp-contacts').siblings('dd.current-xmpp-contact').find('a.open-chat');
                for (i=0; i<online_contacts.length; i++) {
                    $el = $(online_contacts[i]);
                    jid = $el.text().replace(' ','.').toLowerCase() + '@localhost';
                    view = this.rosterview.get(jid);
                    spyOn(view, 'openChat').andCallThrough();
                    view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                    $el.click();
                    expect(view.openChat).toHaveBeenCalled();
                    expect(this.chatboxes.length).toEqual(i+2);
                    expect(this.chatboxviews.trimOpenChats).toHaveBeenCalled();
                }
            }, converse));

            it("is focused if its already open and you click on its corresponding roster item", $.proxy(function () {
                var contact_jid = mock.cur_names[2].replace(' ','.').toLowerCase() + '@localhost';
                var i, $el, click, jid, view, chatboxview, chatbox;
                // openControlBox was called earlier, so the controlbox is
                // visible, but no other chat boxes have been created.
                expect(this.chatboxes.length).toEqual(1);
                chatbox = utils.openChatBoxFor(contact_jid);
                chatboxview = this.chatboxviews.get(contact_jid);
                spyOn(chatboxview, 'focus');
                $el = this.rosterview.$el.find('a.open-chat:contains("'+chatbox.get('fullname')+'")');
                jid = $el.text().replace(' ','.').toLowerCase() + '@localhost';
                view = this.rosterview.get(jid);
                spyOn(view, 'openChat').andCallThrough();
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                $el.click();
                expect(view.openChat).toHaveBeenCalled();
                expect(this.chatboxes.length).toEqual(2);
                expect(chatboxview.focus).toHaveBeenCalled();
            }, converse));

            it("can be saved to, and retrieved from, localStorage", $.proxy(function () {
                spyOn(converse, 'emit');
                spyOn(this.chatboxviews, 'trimOpenChats');
                runs(function () {
                    utils.openControlBox();
                });
                waits(250);
                runs(function () {
                    utils.openChatBoxes(6);
                    expect(this.chatboxviews.trimOpenChats).toHaveBeenCalled();
                    // We instantiate a new ChatBoxes collection, which by default
                    // will be empty.
                    var newchatboxes = new this.ChatBoxes();
                    expect(newchatboxes.length).toEqual(0);
                    // The chatboxes will then be fetched from localStorage inside the
                    // onConnected method
                    newchatboxes.onConnected();
                    expect(newchatboxes.length).toEqual(7);
                    // Check that the chatboxes items retrieved from localStorage
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
                var chatbox = utils.openChatBoxes(1)[0],
                    controlview = this.chatboxviews.get('controlbox'), // The controlbox is currently open
                    chatview = this.chatboxviews.get(chatbox.get('jid'));
                spyOn(chatview, 'closeChat').andCallThrough();
                spyOn(controlview, 'closeChat').andCallThrough();
                spyOn(converse, 'emit');

                // We need to rebind all events otherwise our spy won't be called
                controlview.delegateEvents();
                chatview.delegateEvents();

                runs(function () {
                    controlview.$el.find('.close-chatbox-button').click();
                });
                waits(250);
                runs(function () {
                    expect(controlview.closeChat).toHaveBeenCalled();
                    expect(converse.emit).toHaveBeenCalledWith('onChatBoxClosed', jasmine.any(Object));
                    expect(converse.emit.callCount, 1);
                    chatview.$el.find('.close-chatbox-button').click();
                });
                waits(250);
                runs(function () {
                    expect(chatview.closeChat).toHaveBeenCalled();
                    expect(converse.emit).toHaveBeenCalledWith('onChatBoxClosed', jasmine.any(Object));
                    expect(converse.emit.callCount, 2);
                });
            }, converse));

            it("can be toggled by clicking a DOM element with class 'toggle-chatbox-button'", function () {
                var chatbox = utils.openChatBoxes(1)[0],
                    chatview = this.chatboxviews.get(chatbox.get('jid'));
                spyOn(chatview, 'toggleChatBox').andCallThrough();
                spyOn(converse, 'emit');
                // We need to rebind all events otherwise our spy won't be called
                chatview.delegateEvents();

                runs(function () {
                    chatview.$el.find('.toggle-chatbox-button').click();
                });
                waits(250);
                runs(function () {
                    expect(chatview.toggleChatBox).toHaveBeenCalled();
                    expect(converse.emit).toHaveBeenCalledWith('onChatBoxToggled', jasmine.any(Object));
                    expect(converse.emit.callCount, 2);
                    expect(chatview.$el.find('.chat-body').is(':visible')).toBeFalsy();
                    expect(chatview.$el.find('.toggle-chatbox-button').hasClass('icon-minus')).toBeFalsy();
                    expect(chatview.$el.find('.toggle-chatbox-button').hasClass('icon-plus')).toBeTruthy();
                    expect(chatview.model.get('minimized')).toBeTruthy();
                    chatview.$el.find('.toggle-chatbox-button').click();
                });
                waits(250);
                runs(function () {
                    expect(chatview.toggleChatBox).toHaveBeenCalled();
                    expect(converse.emit).toHaveBeenCalledWith('onChatBoxToggled', jasmine.any(Object));
                    expect(chatview.$el.find('.chat-body').is(':visible')).toBeTruthy();
                    expect(chatview.$el.find('.toggle-chatbox-button').hasClass('icon-minus')).toBeTruthy();
                    expect(chatview.$el.find('.toggle-chatbox-button').hasClass('icon-plus')).toBeFalsy();
                    expect(chatview.model.get('minimized')).toBeFalsy();
                    expect(converse.emit.callCount, 3);
                });
            }.bind(converse));

            it("will be removed from localStorage when closed", $.proxy(function () {
                spyOn(converse, 'emit');
                spyOn(converse.chatboxviews, 'trimOpenChats');
                this.chatboxes.localStorage._clear();
                runs(function () {
                    utils.closeControlBox();
                });
                waits(250);
                runs(function () {
                    expect(converse.emit).toHaveBeenCalledWith('onChatBoxClosed', jasmine.any(Object));
                    expect(converse.chatboxes.length).toEqual(0);
                    utils.openChatBoxes(6);
                    expect(converse.chatboxviews.trimOpenChats).toHaveBeenCalled();
                    expect(converse.chatboxes.length).toEqual(6);
                    expect(converse.emit).toHaveBeenCalledWith('onChatBoxOpened', jasmine.any(Object));
                    utils.closeAllChatBoxes();
                });
                waits(250);
                runs(function () {
                    expect(converse.chatboxes.length).toEqual(0);
                    expect(converse.emit).toHaveBeenCalledWith('onChatBoxClosed', jasmine.any(Object));
                    var newchatboxes = new this.ChatBoxes();
                    expect(newchatboxes.length).toEqual(0);
                    // onConnected will fetch chatboxes in localStorage, but
                    // because there aren't any open chatboxes, there won't be any
                    // in localStorage either. XXX except for the controlbox
                    newchatboxes.onConnected();
                    expect(newchatboxes.length).toEqual(1);
                    expect(newchatboxes.models[0].id).toBe("controlbox");
                }.bind(converse));
            }, converse));

            describe("A chat toolbar", $.proxy(function () {
                it("can be found on each chat box", $.proxy(function () {
                    var contact_jid = mock.cur_names[2].replace(' ','.').toLowerCase() + '@localhost';
                    utils.openChatBoxFor(contact_jid);
                    var chatbox = this.chatboxes.get(contact_jid);
                    var view = this.chatboxviews.get(contact_jid);
                    expect(chatbox).toBeDefined();
                    expect(view).toBeDefined();
                    var $toolbar = view.$el.find('ul.chat-toolbar');
                    expect($toolbar.length).toBe(1);
                    expect($toolbar.children('li').length).toBe(3);
                }, converse));

                it("contains a button for inserting emoticons", $.proxy(function () {
                    var contact_jid = mock.cur_names[2].replace(' ','.').toLowerCase() + '@localhost';
                    utils.openChatBoxFor(contact_jid);
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
                    var contact_jid = mock.cur_names[2].replace(' ','.').toLowerCase() + '@localhost';
                    utils.openChatBoxFor(contact_jid);
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
                    var contact_jid = mock.cur_names[2].replace(' ','.').toLowerCase() + '@localhost';
                    spyOn(converse, 'emit');
                    // First check that the button doesn't show if it's not enabled
                    // via "visible_toolbar_buttons"
                    converse.visible_toolbar_buttons.call = false;
                    utils.openChatBoxFor(contact_jid);
                    view = this.chatboxviews.get(contact_jid);
                    $toolbar = view.$el.find('ul.chat-toolbar');
                    callButton = $toolbar.find('.toggle-call');
                    expect(callButton.length).toBe(0);
                    view.closeChat();
                    // Now check that it's shown if enabled and that it emits
                    // onCallButtonClicked
                    converse.visible_toolbar_buttons.call = true; // enable the button
                    utils.openChatBoxFor(contact_jid);
                    view = this.chatboxviews.get(contact_jid);
                    $toolbar = view.$el.find('ul.chat-toolbar');
                    callButton = $toolbar.find('.toggle-call');
                    expect(callButton.length).toBe(1);
                    callButton.click();
                    expect(converse.emit).toHaveBeenCalledWith('onCallButtonClicked', jasmine.any(Object));
                }, converse));

                it("can contain a button for clearing messages", $.proxy(function () {
                    var view, clearButton, $toolbar;
                    var contact_jid = mock.cur_names[2].replace(' ','.').toLowerCase() + '@localhost';
                    // First check that the button doesn't show if it's not enabled
                    // via "visible_toolbar_buttons"
                    converse.visible_toolbar_buttons.clear = false;
                    utils.openChatBoxFor(contact_jid);
                    view = this.chatboxviews.get(contact_jid);
                    view = this.chatboxviews.get(contact_jid);
                    $toolbar = view.$el.find('ul.chat-toolbar');
                    clearButton = $toolbar.find('.toggle-clear');
                    expect(clearButton.length).toBe(0);
                    view.closeChat();
                    // Now check that it's shown if enabled and that it calls
                    // clearMessages
                    converse.visible_toolbar_buttons.clear = true; // enable the button
                    utils.openChatBoxFor(contact_jid);
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
                        utils.closeAllChatBoxes();
                    });
                    waits(250);
                    runs(function () {});
                });

                it("can be received which will open a chatbox and be displayed inside it", $.proxy(function () {
                    spyOn(converse, 'emit');
                    var message = 'This is a received message';
                    var sender_jid = mock.cur_names[0].replace(' ','.').toLowerCase() + '@localhost';
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
                        expect(converse.emit).toHaveBeenCalledWith('onMessage', msg);
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
                    var contact_jid = contact_name.replace(' ','.').toLowerCase() + '@localhost';
                    spyOn(this, 'emit');
                    runs(function () {
                        utils.openChatBoxFor(contact_jid);
                    });
                    waits(250);
                    runs(function () {
                        var chatview = converse.chatboxviews.get(contact_jid);
                        expect(chatview.model.get('minimized')).toBeFalsy();
                        chatview.$el.find('.toggle-chatbox-button').click();
                    });
                    waits(250);
                    runs($.proxy(function () {
                        var chatview = this.chatboxviews.get(contact_jid);
                        expect(chatview.model.get('minimized')).toBeTruthy();
                        var message = 'This message is sent to a minimized chatbox';
                        var sender_jid = mock.cur_names[0].replace(' ','.').toLowerCase() + '@localhost';
                        msg = $msg({
                            from: sender_jid,
                            to: this.connection.jid,
                            type: 'chat',
                            id: (new Date()).getTime()
                        }).c('body').t(message).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                        this.chatboxes.onMessage(msg);
                        expect(this.emit).toHaveBeenCalledWith('onMessage', msg);
                    }, converse));
                    waits(250);
                    runs($.proxy(function () {
                        var chatview = this.chatboxviews.get(contact_jid);
                        var $count = chatview.$el.find('.chat-head-message-count');
                        expect(chatview.model.get('minimized')).toBeTruthy();
                        expect($count.is(':visible')).toBeTruthy();
                        expect($count.data('count')).toBe(1);
                        expect($count.html()).toBe('1');
                        this.chatboxes.onMessage(
                            $msg({
                                from: mock.cur_names[0].replace(' ','.').toLowerCase() + '@localhost',
                                to: this.connection.jid,
                                type: 'chat',
                                id: (new Date()).getTime()
                            }).c('body').t('This message is also sent to a minimized chatbox').up()
                            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree()
                        );
                    }, converse));
                    waits(100);
                    runs($.proxy(function () {
                        var chatview = this.chatboxviews.get(contact_jid);
                        var $count = chatview.$el.find('.chat-head-message-count');
                        expect(chatview.model.get('minimized')).toBeTruthy();
                        expect($count.is(':visible')).toBeTruthy();
                        expect($count.data('count')).toBe(2);
                        expect($count.html()).toBe('2');
                        chatview.$el.find('.toggle-chatbox-button').click();
                    }, converse));
                    waits(250);
                    runs($.proxy(function () {
                        var chatview = this.chatboxviews.get(contact_jid);
                        var $count = chatview.$el.find('.chat-head-message-count');
                        expect(chatview.model.get('minimized')).toBeFalsy();
                        expect($count.is(':visible')).toBeFalsy();
                        expect($count.data('count')).toBe(0);
                        expect($count.html()).toBe('0');
                    }, converse));
                }, converse));

                it("will indicate when it has a time difference of more than a day between it and its predecessor", $.proxy(function () {
                    spyOn(converse, 'emit');
                    var contact_name = mock.cur_names[1];
                    var contact_jid = contact_name.replace(' ','.').toLowerCase() + '@localhost';
                    utils.openChatBoxFor(contact_jid);
                    utils.clearChatBoxMessages(contact_jid);
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
                    expect(converse.emit).toHaveBeenCalledWith('onMessage', msg);
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
                    expect(converse.emit).toHaveBeenCalledWith('onMessage', msg);
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
                    var contact_jid = mock.cur_names[0].replace(' ','.').toLowerCase() + '@localhost';
                    runs(function () {
                        utils.openChatBoxFor(contact_jid);
                    });
                    waits(250);
                    runs(function () {
                        expect(converse.emit).toHaveBeenCalledWith('onChatBoxFocused', jasmine.any(Object));
                        var view = this.chatboxviews.get(contact_jid);
                        var message = 'This message is sent from this chatbox';
                        spyOn(view, 'sendMessage').andCallThrough();
                        utils.sendMessage(view, message);
                        expect(view.sendMessage).toHaveBeenCalled();
                        expect(view.model.messages.length, 2);
                        expect(converse.emit.mostRecentCall.args, ['onMessageSend', message]);
                        expect(view.$el.find('.chat-content').find('.chat-message').last().find('.chat-message-content').text()).toEqual(message);
                    }.bind(converse));
                }, converse));

                it("is sanitized to prevent Javascript injection attacks", $.proxy(function () {
                    var contact_jid = mock.cur_names[0].replace(' ','.').toLowerCase() + '@localhost';
                    utils.openChatBoxFor(contact_jid);
                    var view = this.chatboxviews.get(contact_jid);
                    var message = '<p>This message contains <em>some</em> <b>markup</b></p>';
                    spyOn(view, 'sendMessage').andCallThrough();
                    utils.sendMessage(view, message);
                    expect(view.sendMessage).toHaveBeenCalled();
                    var msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-message-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('&lt;p&gt;This message contains &lt;em&gt;some&lt;/em&gt; &lt;b&gt;markup&lt;/b&gt;&lt;/p&gt;');
                }, converse));

                it("can contain hyperlinks, which will be clickable", $.proxy(function () {
                    var contact_jid = mock.cur_names[0].replace(' ','.').toLowerCase() + '@localhost';
                    utils.openChatBoxFor(contact_jid);
                    var view = this.chatboxviews.get(contact_jid);
                    var message = 'This message contains a hyperlink: www.opkode.com';
                    spyOn(view, 'sendMessage').andCallThrough();
                    utils.sendMessage(view, message);
                    expect(view.sendMessage).toHaveBeenCalled();
                    var msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-message-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('This message contains a hyperlink: <a target="_blank" href="http://www.opkode.com">www.opkode.com</a>');
                }, converse));

                it("will have properly escaped URLs", $.proxy(function () {
                    var contact_jid = mock.cur_names[0].replace(' ','.').toLowerCase() + '@localhost';
                    utils.openChatBoxFor(contact_jid);
                    var view = this.chatboxviews.get(contact_jid);
                    spyOn(view, 'sendMessage').andCallThrough();

                    var message = "http://www.opkode.com/'onmouseover='alert(1)'whatever";
                    utils.sendMessage(view, message);
                    expect(view.sendMessage).toHaveBeenCalled();
                    var msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-message-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('<a target="_blank" href="http://www.opkode.com/%27onmouseover=%27alert%281%29%27whatever">http://www.opkode.com/\'onmouseover=\'alert(1)\'whatever</a>');

                    message = 'http://www.opkode.com/"onmouseover="alert(1)"whatever';
                    utils.sendMessage(view, message);
                    expect(view.sendMessage).toHaveBeenCalled();
                    msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-message-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('<a target="_blank" href="http://www.opkode.com/%22onmouseover=%22alert%281%29%22whatever">http://www.opkode.com/"onmouseover="alert(1)"whatever</a>');

                    message = "https://en.wikipedia.org/wiki/Ender's_Game";
                    utils.sendMessage(view, message);
                    expect(view.sendMessage).toHaveBeenCalled();
                    msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-message-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('<a target="_blank" href="https://en.wikipedia.org/wiki/Ender%27s_Game">https://en.wikipedia.org/wiki/Ender\'s_Game</a>');

                    message = "https://en.wikipedia.org/wiki/Ender%27s_Game";
                    utils.sendMessage(view, message);
                    expect(view.sendMessage).toHaveBeenCalled();
                    msg = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-message-content');
                    expect(msg.text()).toEqual(message);
                    expect(msg.html()).toEqual('<a target="_blank" href="https://en.wikipedia.org/wiki/Ender%27s_Game">https://en.wikipedia.org/wiki/Ender%27s_Game</a>');
                }, converse));

            }, converse));
        }, converse));

        describe("Special Messages", $.proxy(function () {
            beforeEach(function () {
                utils.closeAllChatBoxes();
                utils.removeControlBox();
                converse.roster.localStorage._clear();
                utils.initConverse();
                utils.createCurrentContacts();
                utils.openControlBox();
                utils.openContactsPanel();
            });

            it("'/clear' can be used to clear messages in a conversation", $.proxy(function () {
                spyOn(converse, 'emit');
                var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                utils.openChatBoxFor(contact_jid);
                var view = this.chatboxviews.get(contact_jid);
                var message = 'This message is another sent from this chatbox';
                // Lets make sure there is at least one message already
                // (e.g for when this test is run on its own).
                utils.sendMessage(view, message);
                expect(view.model.messages.length > 0).toBeTruthy();
                expect(view.model.messages.localStorage.records.length > 0).toBeTruthy();
                expect(converse.emit).toHaveBeenCalledWith('onMessageSend', message);

                message = '/clear';
                var old_length = view.model.messages.length;
                spyOn(view, 'sendMessage').andCallThrough();
                spyOn(view, 'clearMessages').andCallThrough();
                spyOn(window, 'confirm').andCallFake(function () {
                    return true;
                });
                utils.sendMessage(view, message);
                expect(view.sendMessage).toHaveBeenCalled();
                expect(view.clearMessages).toHaveBeenCalled();
                expect(window.confirm).toHaveBeenCalled();
                expect(view.model.messages.length, 0); // The messages must be removed from the chatbox
                expect(view.model.messages.localStorage.records.length, 0); // And also from localStorage
                expect(converse.emit.callCount, 1);
                expect(converse.emit.mostRecentCall.args, ['onMessageSend', message]);
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
                var sender_jid = mock.cur_names[0].replace(' ','.').toLowerCase() + '@localhost';
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
                expect(converse.emit).toHaveBeenCalledWith('onMessage', msg);
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
                var sender_jid = mock.cur_names[0].replace(' ','.').toLowerCase() + '@localhost';
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
    }, converse, mock, utils));
}));
