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
        window.localStorage.clear();

        describe("A Chatbox", $.proxy(function () {
            beforeEach($.proxy(function () {
                //utils.initRoster();
                //utils.createCurrentContacts();
                //utils.closeAllChatBoxes();
                utils.openControlBox();
                utils.openContactsPanel();
            }, converse));

            it("is created when you click on a roster item", $.proxy(function () {
                var i, $el, click, jid, view;
                // showControlBox was called earlier, so the controlbox is
                // visible, but no other chat boxes have been created.
                expect(this.chatboxes.length).toEqual(2);

                var online_contacts = this.rosterview.$el.find('dt#xmpp-contacts').siblings('dd.current-xmpp-contact.online').find('a.open-chat');
                for (i=0; i<online_contacts.length; i++) {
                    $el = $(online_contacts[i]);
                    jid = $el.text().replace(' ','.').toLowerCase() + '@localhost';
                    view = this.rosterview.rosteritemviews[jid];
                    spyOn(view, 'openChat').andCallThrough();
                    view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                    $el.click();
                    expect(view.openChat).toHaveBeenCalled();
                    expect(this.chatboxes.length).toEqual(i+3);
                }
            }, converse));

            it("can be saved to, and retrieved from, localStorage", $.proxy(function () {
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
            }, converse));

            it("can be closed again by clicking a DOM element with class 'close-chatbox-button'", $.proxy(function () {
                var chatbox, view, $el,
                    num_open_chats = this.chatboxes.length;
                for (i=0; i<num_open_chats; i++) {
                    chatbox = this.chatboxes.models[0];
                    view = this.chatboxesview.views[chatbox.get('id')];
                    spyOn(view, 'closeChat').andCallThrough();
                    view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                    view.$el.find('.close-chatbox-button').click();
                    expect(view.closeChat).toHaveBeenCalled();
                }
            }, converse));

            it("will be removed from localStorage when closed", $.proxy(function () {
                this.chatboxes.localStorage._clear();
                var newchatboxes = new this.ChatBoxes();
                expect(newchatboxes.length).toEqual(0);
                // onConnected will fetch chatboxes in localStorage, but
                // because there aren't any open chatboxes, there won't be any
                // in localStorage either.
                newchatboxes.onConnected();
                expect(newchatboxes.length).toEqual(0);
            }, converse));

            describe("A Chat Message", $.proxy(function () {
                it("can be received which will open a chatbox and be displayed inside it", $.proxy(function () {
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
                    }, converse));
                    waits(500);
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

                it("can be sent from a chatbox, and will appear inside it", $.proxy(function () {
                    var contact_jid = mock.cur_names[0].replace(' ','.').toLowerCase() + '@localhost';
                    var view = this.chatboxesview.views[contact_jid];
                    var message = 'This message is sent from this chatbox';
                    spyOn(view, 'sendMessage').andCallThrough();
                    view.$el.find('.chat-textarea').text(message);
                    view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                    expect(view.sendMessage).toHaveBeenCalled();
                    expect(view.model.messages.length, 2);
                    var txt = view.$el.find('.chat-content').find('.chat-message').last().find('.chat-message-content').text();
                    expect(txt).toEqual(message);
                }, converse));
            }, converse));
        }, converse));

        describe("Special Messages", $.proxy(function () {
            it("'/clear' can be used to clear messages in a conversation", $.proxy(function () {
                var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                var view = this.chatboxesview.views[contact_jid];
                var message = 'This message is another sent from this chatbox';
                // Lets make sure there is at least one message already
                // (e.g for when this test is run on its own).
                view.$el.find('.chat-textarea').val(message).text(message);
                view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                expect(view.model.messages.length > 0).toBeTruthy(); 
                expect(view.model.messages.localStorage.records.length > 0).toBeTruthy();

                message = '/clear';
                var old_length = view.model.messages.length;
                spyOn(view, 'sendMessage').andCallThrough();
                view.$el.find('.chat-textarea').val(message).text(message);
                view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                expect(view.sendMessage).toHaveBeenCalled();
                expect(view.model.messages.length, 0); // The messages must be removed from the modal
                expect(view.model.messages.localStorage.records.length, 0); // And also from localStorage
            }, converse));
        }, converse));

        describe("A Message Counter", $.proxy(function () {
            beforeEach($.proxy(function () {
                converse.clearMsgCounter();
            }, converse));

            it("is incremented when the message is received and the window is not focused", $.proxy(function () {
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
