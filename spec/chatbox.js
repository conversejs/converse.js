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
                utils.closeAllChatBoxes();
                utils.removeControlBox();
                converse.roster.localStorage._clear();
                utils.initConverse();
                utils.createCurrentContacts();
                utils.openControlBox();
                utils.openContactsPanel();
            });

            it("is created when you click on a roster item", $.proxy(function () {
                var i, $el, click, jid, view;
                // openControlBox was called earlier, so the controlbox is
                // visible, but no other chat boxes have been created.
                expect(this.chatboxes.length).toEqual(1);

                var online_contacts = this.rosterview.$el.find('dt#xmpp-contacts').siblings('dd.current-xmpp-contact.online').find('a.open-chat');
                for (i=0; i<online_contacts.length; i++) {
                    $el = $(online_contacts[i]);
                    jid = $el.text().replace(' ','.').toLowerCase() + '@localhost';
                    view = this.rosterview.rosteritemviews[jid];
                    spyOn(view, 'openChat').andCallThrough();
                    view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                    $el.click();
                    expect(view.openChat).toHaveBeenCalled();
                    expect(this.chatboxes.length).toEqual(i+2);
                }
            }, converse));

            it("can be saved to, and retrieved from, localStorage", $.proxy(function () {
                spyOn(converse, 'emit');
                utils.closeControlBox();
                expect(converse.emit).toHaveBeenCalledWith('onChatBoxClosed', jasmine.any(Object));

                // First, we open 6 more chatboxes (controlbox is already open)
                utils.openChatBoxes(6);
                // We instantiate a new ChatBoxes collection, which by default
                // will be empty.
                var newchatboxes = new this.ChatBoxes();
                expect(newchatboxes.length).toEqual(0);
                // The chatboxes will then be fetched from localStorage inside the
                // onConnected method
                newchatboxes.onConnected();
                expect(newchatboxes.length).toEqual(6);
                // Check that the chatboxes items retrieved from localStorage
                // have the same attributes values as the original ones.
                attrs = ['id', 'box_id', 'visible'];
                for (i=0; i<attrs.length; i++) {
                    new_attrs = _.pluck(_.pluck(newchatboxes.models, 'attributes'), attrs[i]);
                    old_attrs = _.pluck(_.pluck(this.chatboxes.models, 'attributes'), attrs[i]);
                    expect(_.isEqual(new_attrs, old_attrs)).toEqual(true);
                }
                this.rosterview.render();
            }, converse));

            it("can be closed again by clicking a DOM element with class 'close-chatbox-button'", $.proxy(function () {
                spyOn(converse, 'emit');
                var chatbox, view, $el,
                    num_open_chats = this.chatboxes.length;
                for (i=0; i<num_open_chats; i++) {
                    chatbox = this.chatboxes.models[0];
                    view = this.chatboxesview.views[chatbox.get('id')];
                    spyOn(view, 'closeChat').andCallThrough();
                    view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                    view.$el.find('.close-chatbox-button').click();
                    expect(view.closeChat).toHaveBeenCalled();
                    expect(converse.emit).toHaveBeenCalledWith('onChatBoxClosed', jasmine.any(Object));
                }
            }, converse));

            it("will be removed from localStorage when closed", $.proxy(function () {
                spyOn(converse, 'emit');
                this.chatboxes.localStorage._clear();
                utils.closeControlBox();
                expect(converse.chatboxes.length).toEqual(0);
                utils.openChatBoxes(6);
                expect(converse.chatboxes.length).toEqual(6);
                expect(converse.emit).toHaveBeenCalledWith('onChatBoxOpened', jasmine.any(Object));
                utils.closeAllChatBoxes();
                expect(converse.chatboxes.length).toEqual(0);
                expect(converse.emit).toHaveBeenCalledWith('onChatBoxClosed', jasmine.any(Object));
                var newchatboxes = new this.ChatBoxes();
                expect(newchatboxes.length).toEqual(0);
                // onConnected will fetch chatboxes in localStorage, but
                // because there aren't any open chatboxes, there won't be any
                // in localStorage either.
                newchatboxes.onConnected();
                expect(newchatboxes.length).toEqual(0);
            }, converse));

            describe("A chat toolbar", $.proxy(function () {
                it("can be found on each chat box", $.proxy(function () {
                    var contact_jid = mock.cur_names[2].replace(' ','.').toLowerCase() + '@localhost';
                    utils.openChatBoxFor(contact_jid);
                    var chatbox = this.chatboxes.get(contact_jid);
                    var view = this.chatboxesview.views[contact_jid];
                    expect(chatbox).toBeDefined();
                    expect(view).toBeDefined();
                    var $toolbar = view.$el.find('ul.chat-toolbar');
                    expect($toolbar.length).toBe(1);
                    expect($toolbar.children('li').length).toBe(3);
                }, converse));

                it("contains a button for inserting emoticons", $.proxy(function () {
                    var contact_jid = mock.cur_names[2].replace(' ','.').toLowerCase() + '@localhost';
                    utils.openChatBoxFor(contact_jid);
                    var chatbox = this.chatboxes.get(contact_jid);
                    var view = this.chatboxesview.views[contact_jid];
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
                        $items[0].click();
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
                    var chatbox = this.chatboxes.get(contact_jid);
                    var view = this.chatboxesview.views[contact_jid];
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

                it("contains a button for starting a call", $.proxy(function () {
                    spyOn(converse, 'emit');

                    var contact_jid = mock.cur_names[2].replace(' ','.').toLowerCase() + '@localhost';
                    utils.openChatBoxFor(contact_jid);
                    var chatbox = this.chatboxes.get(contact_jid);
                    var view = this.chatboxesview.views[contact_jid];
                    var $toolbar = view.$el.find('ul.chat-toolbar');
                    var callButton = $toolbar.find('.toggle-call');

                    expect(callButton.length).toBe(1);

                    runs(function () {
                        callButton.click();
                        expect(converse.emit).toHaveBeenCalledWith('onCallButtonClicked', jasmine.any(Object));
                    });
                }, converse));
            }, converse));

            describe("A Chat Message", $.proxy(function () {
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
                        // messageReceived is a handler for received XMPP
                        // messages
                        this.chatboxes.messageReceived(msg);
                        expect(converse.emit).toHaveBeenCalledWith('onMessage', msg);
                    }, converse));
                    waits(300);
                    runs($.proxy(function () {
                        // Check that the chatbox and its view now exist
                        var chatbox = this.chatboxes.get(sender_jid);
                        var chatboxview = this.chatboxesview.views[sender_jid];
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

                it("will indate when it has a time difference of more than a day between it and it's predecessor", $.proxy(function () {
                    spyOn(converse, 'emit');
                    var contact_name = mock.cur_names[1];
                    var contact_jid = contact_name.replace(' ','.').toLowerCase() + '@localhost';
                    utils.openChatBoxFor(contact_jid);
                    utils.clearChatBoxMessages(contact_jid);

                    var one_day_ago = new Date(new Date().setDate(new Date().getDate()-1));
                    var message = 'This is a day old message';
                    var chatbox = this.chatboxes.get(contact_jid);
                    var chatboxview = this.chatboxesview.views[contact_jid];
                    var $chat_content = chatboxview.$el.find('.chat-content');
                    var msg_obj;
                    var msg_txt;
                    var sender_txt;

                    var msg = $msg({
                        from: contact_jid,
                        to: this.connection.jid,
                        type: 'chat',
                        id: one_day_ago.getTime()
                    }).c('body').t(message).up()
                      .c('delay', { xmlns:'urn:xmpp:delay', from: 'localhost', stamp: converse.toISOString(one_day_ago) })
                      .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                    this.chatboxes.messageReceived(msg);
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
                    this.chatboxes.messageReceived(msg);
                    expect(converse.emit).toHaveBeenCalledWith('onMessage', msg);
                    // Check that there is a <time> element, with the required
                    // props.
                    var $time = $chat_content.find('time');
                    var message_date = new Date();
                    message_date.setUTCHours(0,0,0,0);
                    expect($time.length).toEqual(1);
                    expect($time.attr('class')).toEqual('chat-date');
                    expect($time.attr('datetime')).toEqual(converse.toISOString(message_date));
                    expect($time.text()).toEqual(message_date.toString().substring(0,15));

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
                    utils.openChatBoxFor(contact_jid);
                    expect(converse.emit).toHaveBeenCalledWith('onChatBoxOpened', jasmine.any(Object));
                    var view = this.chatboxesview.views[contact_jid];
                    var message = 'This message is sent from this chatbox';
                    spyOn(view, 'sendMessage').andCallThrough();
                    view.$el.find('.chat-textarea').text(message);
                    view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                    expect(view.sendMessage).toHaveBeenCalled();
                    expect(view.model.messages.length, 2);
                    expect(converse.emit.callCount).toEqual(2);
                    expect(converse.emit.mostRecentCall.args, ['onMessageSend', message]);
                    var txt = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-message-content').text();
                    expect(txt).toEqual(message);
                }, converse));

                it("are sanitized to prevent Javascript injection attacks", $.proxy(function () {
                    var contact_jid = mock.cur_names[0].replace(' ','.').toLowerCase() + '@localhost';
                    utils.openChatBoxFor(contact_jid);
                    var view = this.chatboxesview.views[contact_jid];
                    var message = 'This message contains <b>markup</b>';
                    spyOn(view, 'sendMessage').andCallThrough();
                    view.$el.find('.chat-textarea').text(message);
                    view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                    expect(view.sendMessage).toHaveBeenCalled();
                    var txt = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-message-content').text();
                    expect(txt).toEqual(message);
                }, converse));

            }, converse));
        }, converse));

        describe("Special Messages", $.proxy(function () {
            it("'/clear' can be used to clear messages in a conversation", $.proxy(function () {
                spyOn(converse, 'emit');
                var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                var view = this.chatboxesview.views[contact_jid];
                var message = 'This message is another sent from this chatbox';
                // Lets make sure there is at least one message already
                // (e.g for when this test is run on its own).
                view.$el.find('.chat-textarea').val(message).text(message);
                view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                expect(view.model.messages.length > 0).toBeTruthy();
                expect(view.model.messages.localStorage.records.length > 0).toBeTruthy();
                expect(converse.emit).toHaveBeenCalledWith('onMessageSend', message);

                message = '/clear';
                var old_length = view.model.messages.length;
                spyOn(view, 'sendMessage').andCallThrough();
                view.$el.find('.chat-textarea').val(message).text(message);
                view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                expect(view.sendMessage).toHaveBeenCalled();
                expect(view.model.messages.length, 0); // The messages must be removed from the modal
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
                this.chatboxes.messageReceived(msg);
                expect(converse.incrementMsgCounter).toHaveBeenCalled();
                expect(this.msg_counter).toBe(1);
                expect(converse.emit).toHaveBeenCalledWith('onMessage', msg);
            }, converse));

            it("is cleared when the window is focused", $.proxy(function () {
                spyOn(converse, 'clearMsgCounter').andCallThrough();
                runs(function () {
                    $(window).trigger('focus');
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
                this.chatboxes.messageReceived(msg);
                expect(converse.incrementMsgCounter).not.toHaveBeenCalled();
                expect(this.msg_counter).toBe(0);
            }, converse));
        }, converse));
    }, converse, mock, utils));
}));
