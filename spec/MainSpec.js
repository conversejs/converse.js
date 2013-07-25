(function (root, factory) {
    define([
        "converse",
        "mock"
        ], function (converse, mock_connection) {
            return factory(converse, mock_connection);
        }
    );
} (this, function (converse, mock_connection) {
    return describe("Converse.js", $.proxy(function() {
        // Names from http://www.fakenamegenerator.com/
        var req_names = [
            'Louw Spekman', 'Mohamad Stet', 'Dominik Beyer'
        ];
        var pend_names = [
            'Suleyman van Beusichem', 'Nicole Diederich', 'Nanja van Yperen'
        ];
        var cur_names = [
            'Max Frankfurter', 'Candice van der Knijff', 'Irini Vlastuin', 'Rinse Sommer', 'Annegreet Gomez',
            'Robin Schook', 'Marcel Eberhardt', 'Simone Brauer', 'Asmaa Haakman', 'Felix Amsel',
            'Lena Grunewald', 'Laura Grunewald', 'Mandy Seiler', 'Sven Bosch', 'Nuriye Cuypers'
        ];
        var num_contacts = req_names.length + pend_names.length + cur_names.length;
        var open_controlbox;

        closeAllChatBoxes = function () {
            var i, chatbox, num_chatboxes = converse.chatboxes.models.length;
            for (i=num_chatboxes-1; i>-1; i--) {
                chatbox = converse.chatboxes.models[i];
                converse.chatboxesview.views[chatbox.get('id')].closeChat();
            }
        };

        openControlBox = function () {
            if (!$("div#controlbox").is(':visible')) {
                $('.toggle-online-users').click();
            }
        };

        describe("The Control Box", $.proxy(function () {
            it("is not shown by default", $.proxy(function () {
                expect(this.rosterview.$el.is(':visible')).toEqual(false);
            }, converse));

            open_controlbox = $.proxy(function () {
                // This spec will only pass if the controlbox is not currently
                // open yet.
                expect($("div#controlbox").is(':visible')).toBe(false);
                spyOn(this, 'toggleControlBox').andCallThrough();
                spyOn(this, 'showControlBox').andCallThrough();
                $('.toggle-online-users').click();
                expect(this.toggleControlBox).toHaveBeenCalled();
                expect(this.showControlBox).toHaveBeenCalled();
                expect($("div#controlbox").is(':visible')).toBe(true);
            }, converse);
            it("can be opened by clicking a DOM element with class 'toggle-online-users'", open_controlbox);

            describe("The Status Widget", $.proxy(function () {
                it("can be used to set the current user's chat status", $.proxy(function () {
                    var view = this.xmppstatusview;
                    spyOn(view, 'toggleOptions').andCallThrough();
                    spyOn(view, 'setStatus').andCallThrough();
                    view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                    runs(function () {
                        view.$el.find('a.choose-xmpp-status').click();
                        expect(view.toggleOptions).toHaveBeenCalled();
                        expect(view.$el.find('a.choose-xmpp-status').hasClass('online')).toBe(false);
                    });
                    waits(250);
                    runs(function () {
                        spyOn(view, 'updateStatusUI').andCallThrough();
                        view.initialize(); // Rebind events for spy
                        view.$el.find('.dropdown dd ul li a').first().click();
                        expect(view.setStatus).toHaveBeenCalled();
                    });
                    waits(250);
                    runs($.proxy(function () {
                        expect(view.updateStatusUI).toHaveBeenCalled();
                        expect(view.$el.find('a.choose-xmpp-status').hasClass('online')).toBe(true);
                        expect(view.$el.find('a.choose-xmpp-status').attr('data-value')).toBe('I am online');
                    }, converse));
                }, converse));

                it("can be used to set a custom status message", $.proxy(function () {
                    var view = this.xmppstatusview;
                    spyOn(view, 'setStatusMessage').andCallThrough();
                    spyOn(view, 'renderStatusChangeForm').andCallThrough();
                    view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                    view.$el.find('a.change-xmpp-status-message').click();
                    expect(view.renderStatusChangeForm).toHaveBeenCalled();
                    // The async testing here is used only to provide time for
                    // visual feedback
                    var msg = 'I am happy';
                    runs (function () {
                        view.$el.find('form input.custom-xmpp-status').val(msg);
                    });
                    waits(250);
                    runs (function () {
                        view.$el.find('form#set-custom-xmpp-status').submit();
                        expect(view.setStatusMessage).toHaveBeenCalled();
                        expect(view.$el.find('a.choose-xmpp-status').hasClass('online')).toBe(true);
                        expect(view.$el.find('a.choose-xmpp-status').attr('data-value')).toBe(msg);
                    });
                }, converse));
            }, converse));
        }, converse));

        describe("The Contacts Roster", $.proxy(function () {
            describe("Pending Contacts", $.proxy(function () {
                beforeEach(function () {
                    if (!$("div#controlbox").is(':visible')) {
                        $('.toggle-online-users').click();
                    }
                });

                it("do not have a heading if there aren't any", $.proxy(function () {
                    expect(this.rosterview.$el.find('dt#pending-xmpp-contacts').css('display')).toEqual('none');
                }, converse));

                it("can be added to the roster and they will be sorted alphabetically", $.proxy(function () {
                    var i, t, is_last;
                    spyOn(this.rosterview, 'render').andCallThrough();
                    for (i=0; i<pend_names.length; i++) {
                        is_last = i===(pend_names.length-1);
                        this.roster.create({
                            jid: pend_names[i].replace(' ','.').toLowerCase() + '@localhost',
                            subscription: 'none',
                            ask: 'subscribe',
                            fullname: pend_names[i],
                            is_last: is_last
                        });
                        // For performance reasons, the roster should only be shown once
                        // the last contact has been added.
                        if (is_last) {
                            expect(this.rosterview.$el.is(':visible')).toEqual(true);
                        } else {
                            expect(this.rosterview.$el.is(':visible')).toEqual(false);
                        }
                        expect(this.rosterview.render).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = this.rosterview.$el.find('dt#pending-xmpp-contacts').siblings('dd.pending-xmpp-contact').text();
                        expect(t).toEqual(pend_names.slice(0,i+1).sort().join(''));
                    }
                }, converse));

                it("will have their own heading once they have been added", $.proxy(function () {
                    expect(this.rosterview.$el.find('dt#pending-xmpp-contacts').css('display')).toEqual('block');
                }, converse));
            }, converse));

            describe("Existing Contacts", $.proxy(function () {
                it("do not have a heading if there aren't any", $.proxy(function () {
                    expect(this.rosterview.$el.find('dt#xmpp-contacts').css('display')).toEqual('none');
                }, converse));

                it("can be added to the roster and they will be sorted alphabetically", $.proxy(function () {
                    var i, t;
                    spyOn(this.rosterview, 'render').andCallThrough();
                    for (i=0; i<cur_names.length; i++) {
                        this.roster.create({
                            jid: cur_names[i].replace(' ','.').toLowerCase() + '@localhost',
                            subscription: 'both',
                            ask: null,
                            fullname: cur_names[i],
                            is_last: i===(cur_names.length-1)
                        });
                        expect(this.rosterview.render).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = this.rosterview.$el.find('dt#xmpp-contacts').siblings('dd.current-xmpp-contact.offline').find('a.open-chat').text();
                        expect(t).toEqual(cur_names.slice(0,i+1).sort().join(''));
                    }
                }, converse));

                it("will have their own heading once they have been added", $.proxy(function () {
                    expect(this.rosterview.$el.find('dt#xmpp-contacts').css('display')).toEqual('block');
                }, converse));

                it("can change their status to online and be sorted alphabetically", $.proxy(function () {
                    var item, view, jid, t;
                    spyOn(this.rosterview, 'render').andCallThrough();
                    for (i=0; i<3; i++) {
                        jid = cur_names[i].replace(' ','.').toLowerCase() + '@localhost';
                        view = this.rosterview.rosteritemviews[jid];
                        spyOn(view, 'render').andCallThrough();
                        item = view.model;
                        item.set('chat_status', 'online');
                        expect(view.render).toHaveBeenCalled();
                        expect(this.rosterview.render).toHaveBeenCalled();

                        // Check that they are sorted alphabetically
                        t = this.rosterview.$el.find('dt#xmpp-contacts').siblings('dd.current-xmpp-contact.online').find('a.open-chat').text();
                        expect(t).toEqual(cur_names.slice(0,i+1).sort().join(''));
                    }
                }, converse));

                it("can change their status to busy and be sorted alphabetically", $.proxy(function () {
                    var item, view, jid, t;
                    spyOn(this.rosterview, 'render').andCallThrough();
                    for (i=3; i<6; i++) {
                        jid = cur_names[i].replace(' ','.').toLowerCase() + '@localhost';
                        view = this.rosterview.rosteritemviews[jid];
                        spyOn(view, 'render').andCallThrough();
                        item = view.model;
                        item.set('chat_status', 'dnd');
                        expect(view.render).toHaveBeenCalled();
                        expect(this.rosterview.render).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = this.rosterview.$el.find('dt#xmpp-contacts').siblings('dd.current-xmpp-contact.dnd').find('a.open-chat').text();
                        expect(t).toEqual(cur_names.slice(3,i+1).sort().join(''));
                    }
                }, converse));

                it("can change their status to away and be sorted alphabetically", $.proxy(function () {
                    var item, view, jid, t;
                    spyOn(this.rosterview, 'render').andCallThrough();
                    for (i=6; i<9; i++) {
                        jid = cur_names[i].replace(' ','.').toLowerCase() + '@localhost';
                        view = this.rosterview.rosteritemviews[jid];
                        spyOn(view, 'render').andCallThrough();
                        item = view.model;
                        item.set('chat_status', 'away');
                        expect(view.render).toHaveBeenCalled();
                        expect(this.rosterview.render).toHaveBeenCalled();

                        // Check that they are sorted alphabetically
                        t = this.rosterview.$el.find('dt#xmpp-contacts').siblings('dd.current-xmpp-contact.away').find('a.open-chat').text();
                        expect(t).toEqual(cur_names.slice(6,i+1).sort().join(''));
                    }
                }, converse));

                it("can change their status to unavailable and be sorted alphabetically", $.proxy(function () {
                    var item, view, jid, t;
                    spyOn(this.rosterview, 'render').andCallThrough();
                    for (i=9; i<12; i++) {
                        jid = cur_names[i].replace(' ','.').toLowerCase() + '@localhost';
                        view = this.rosterview.rosteritemviews[jid];
                        spyOn(view, 'render').andCallThrough();
                        item = view.model;
                        item.set('chat_status', 'unavailable');
                        expect(view.render).toHaveBeenCalled();
                        expect(this.rosterview.render).toHaveBeenCalled();

                        // Check that they are sorted alphabetically
                        t = this.rosterview.$el.find('dt#xmpp-contacts').siblings('dd.current-xmpp-contact.unavailable').find('a.open-chat').text();
                        expect(t).toEqual(cur_names.slice(9, i+1).sort().join(''));
                    }
                }, converse));

                it("are ordered according to status: online, busy, away, unavailable, offline", $.proxy(function () {
                    var contacts = this.rosterview.$el.find('dd.current-xmpp-contact');
                    var i;
                    // The first five contacts are online.
                    for (i=0; i<3; i++) {
                        expect($(contacts[i]).attr('class').split(' ',1)[0]).toEqual('online');
                    }
                    // The next five are busy
                    for (i=3; i<6; i++) {
                        expect($(contacts[i]).attr('class').split(' ',1)[0]).toEqual('dnd');
                    }
                    // The next five are away
                    for (i=6; i<9; i++) {
                        expect($(contacts[i]).attr('class').split(' ',1)[0]).toEqual('away');
                    }
                    // The next five are unavailable
                    for (i=9; i<12; i++) {
                        expect($(contacts[i]).attr('class').split(' ',1)[0]).toEqual('unavailable');
                    }
                    // The next 20 are offline
                    for (i=12; i<cur_names.length; i++) {
                        expect($(contacts[i]).attr('class').split(' ',1)[0]).toEqual('offline');
                    }
                }, converse));


            }, converse));

            describe("Requesting Contacts", $.proxy(function () {
                // by default the dts are hidden from css class and only later they will be hidden
                // by jQuery therefore for the first check we will see if visible instead of none
                it("do not have a heading if there aren't any", $.proxy(function () {
                    expect(this.rosterview.$el.find('dt#xmpp-contact-requests').is(':visible')).toEqual(false);
                }, converse));

                it("can be added to the roster and they will be sorted alphabetically", $.proxy(function () {
                    var i, t;
                    spyOn(this.rosterview, 'render').andCallThrough();
                    spyOn(this, 'showControlBox').andCallThrough();
                    for (i=0; i<req_names.length; i++) {
                        this.roster.create({
                            jid: req_names[i].replace(' ','.').toLowerCase() + '@localhost',
                            subscription: 'none',
                            ask: 'request',
                            fullname: req_names[i],
                            is_last: i===(req_names.length-1)
                        });
                        expect(this.rosterview.render).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = this.rosterview.$el.find('dt#xmpp-contact-requests').siblings('dd.requesting-xmpp-contact').text().replace(/AcceptDecline/g, '');
                        expect(t).toEqual(req_names.slice(0,i+1).sort().join(''));
                        // When a requesting contact is added, the controlbox must
                        // be opened.
                        expect(this.showControlBox).toHaveBeenCalled();
                    }
                }, converse));

                it("will have their own heading once they have been added", $.proxy(function () {
                    expect(this.rosterview.$el.find('dt#xmpp-contact-requests').css('display')).toEqual('block');
                }, converse));

                it("can have their requests accepted by the user", $.proxy(function () {
                    // TODO: Testing can be more thorough here, the user is
                    // actually not accepted/authorized because of
                    // mock_connection.
                    var jid = req_names.sort()[0].replace(' ','.').toLowerCase() + '@localhost';
                    var view = this.rosterview.rosteritemviews[jid];
                    spyOn(this.connection.roster, 'authorize');
                    spyOn(view, 'acceptRequest').andCallThrough();
                    view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                    var accept_button = view.$el.find('.accept-xmpp-request');
                    accept_button.click();
                    expect(view.acceptRequest).toHaveBeenCalled();
                    expect(this.connection.roster.authorize).toHaveBeenCalled();
                }, converse));

                it("can have their requests denied by the user", $.proxy(function () {
                    var jid = req_names.sort()[1].replace(' ','.').toLowerCase() + '@localhost';
                    var view = this.rosterview.rosteritemviews[jid];
                    spyOn(this.connection.roster, 'unauthorize');
                    spyOn(this.rosterview, 'removeRosterItem').andCallThrough();
                    spyOn(view, 'declineRequest').andCallThrough();
                    view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                    var accept_button = view.$el.find('.decline-xmpp-request');
                    accept_button.click();
                    expect(view.declineRequest).toHaveBeenCalled();
                    expect(this.rosterview.removeRosterItem).toHaveBeenCalled();
                    expect(this.connection.roster.unauthorize).toHaveBeenCalled();
                    // There should now be one less contact
                    expect(this.roster.length).toEqual(num_contacts-1);
                }, converse));
            }, converse));

            describe("All Contacts", $.proxy(function () {
                it("are saved to, and can be retrieved from, localStorage", $.proxy(function () {
                    var new_attrs, old_attrs, attrs, old_roster;
                    var num_contacts = this.roster.length;
                    new_roster = new this.RosterItems();
                    // Roster items are yet to be fetched from localStorage
                    expect(new_roster.length).toEqual(0);

                    new_roster.localStorage = new Backbone.LocalStorage(
                        hex_sha1('converse.rosteritems-dummy@localhost'));

                    new_roster.fetch();
                    expect(this.roster.length).toEqual(num_contacts);
                    // Check that the roster items retrieved from localStorage
                    // have the same attributes values as the original ones.
                    attrs = ['jid', 'fullname', 'subscription', 'ask'];
                    for (i=0; i<attrs.length; i++) {
                        new_attrs = _.pluck(_.pluck(new_roster.models, 'attributes'), attrs[i]);
                        old_attrs = _.pluck(_.pluck(this.roster.models, 'attributes'), attrs[i]);
                        // Roster items in storage are not necessarily sorted,
                        // so we have to sort them here to do a proper
                        // comparison
                        expect(_.isEqual(new_attrs.sort(), old_attrs.sort())).toEqual(true);
                    }
                    this.rosterview.render();
                }, converse));

                afterEach($.proxy(function () {
                    // Contacts retrieved from localStorage have chat_status of
                    // "offline".
                    // In the next test suite, we need some online contacts, so
                    // we make some online now
                    for (i=0; i<5; i++) {
                        jid = cur_names[i].replace(' ','.').toLowerCase() + '@localhost';
                        view = this.rosterview.rosteritemviews[jid];
                        view.model.set('chat_status', 'online');
                    }
                }, converse));
            }, converse));
        }, converse));

        describe("The 'Add Contact' widget", $.proxy(function () {
            it("opens up an add form when you click on it", $.proxy(function () {
                var panel = this.chatboxesview.views.controlbox.contactspanel;
                spyOn(panel, 'toggleContactForm').andCallThrough();
                panel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                panel.$el.find('a.toggle-xmpp-contact-form').click();
                expect(panel.toggleContactForm).toHaveBeenCalled();
                // XXX: Awaiting more tests, close it again for now...
                panel.$el.find('a.toggle-xmpp-contact-form').click();
            }, converse));

        }, converse));

        describe("A Chatbox", $.proxy(function () {
            it("is created when you click on a roster item", $.proxy(function () {
                var i, $el, click, jid, view;
                // showControlBox was called earlier, so the controlbox is
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
                var newchatboxes = new this.ChatBoxes();
                expect(newchatboxes.length).toEqual(0);
                // onConnected will fetch chatboxes in localStorage, but
                // because there aren't any open chatboxes, there won't be any
                // in localStorage either.
                newchatboxes.onConnected();
                expect(newchatboxes.length).toEqual(0);

                // Lets open the controlbox again, purely for visual feedback
                open_controlbox();
            }, converse));

            describe("A Chat Message", $.proxy(function () {
                it("can be received which will open a chatbox and be displayed inside it", $.proxy(function () {
                    var message = 'This is a received message';
                    var sender_jid = cur_names[0].replace(' ','.').toLowerCase() + '@localhost';
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
                        expect(msg_obj.get('fullname')).toEqual(cur_names[0].split(' ')[0]);
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
                    var contact_jid = cur_names[0].replace(' ','.').toLowerCase() + '@localhost';
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

        describe("A Message Counter", $.proxy(function () {
            beforeEach($.proxy(function () {
                converse.clearMsgCounter();
            }, converse));

            it("is incremented when the message is received and the window is not focused", $.proxy(function () {
                expect(this.msg_counter).toBe(0);
                spyOn(converse, 'incrementMsgCounter').andCallThrough();
                $(window).trigger('blur');
                var message = 'This message will increment the message counter';
                var sender_jid = cur_names[0].replace(' ','.').toLowerCase() + '@localhost';
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
                var sender_jid = cur_names[0].replace(' ','.').toLowerCase() + '@localhost';
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

        describe("The Controlbox Tabs", $.proxy(function () {
            beforeEach($.proxy(function () {
                closeAllChatBoxes();
                openControlBox();
            }, converse));

            it("contains two tabs, 'Contacts' and 'ChatRooms'", $.proxy(function () {
                var cbview = this.chatboxesview.views.controlbox;
                var $panels = cbview.$el.find('#controlbox-panes');
                expect($panels.children().length).toBe(2);
                expect($panels.children().first().attr('id')).toBe('users');
                expect($panels.children().first().is(':visible')).toBe(true);
                expect($panels.children().last().attr('id')).toBe('chatrooms');
                expect($panels.children().last().is(':visible')).toBe(false);
            }, converse));

            describe("The Chatrooms Panel", $.proxy(function () {
                beforeEach($.proxy(function () {
                    closeAllChatBoxes();
                    openControlBox();
                }, converse));

                it("is opened by clicking the 'Chatrooms' tab", $.proxy(function () {
                    var cbview = this.chatboxesview.views.controlbox;
                    var $tabs = cbview.$el.find('#controlbox-tabs');
                    var $panels = cbview.$el.find('#controlbox-panes');
                    var $contacts = $panels.children().first();
                    var $chatrooms = $panels.children().last();
                    spyOn(cbview, 'switchTab').andCallThrough();
                    cbview.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                    runs(function () {
                        $tabs.find('li').last().find('a').click(); // Clicks the chatrooms tab
                    });
                    waits(250);
                    runs(function () {
                        expect($contacts.is(':visible')).toBe(false);
                        expect($chatrooms.is(':visible')).toBe(true);
                        expect(cbview.switchTab).toHaveBeenCalled();
                    });
                }, converse));

                it("contains a form through which a new chatroom can be created", $.proxy(function () {
                    var roomspanel = this.chatboxesview.views.controlbox.roomspanel;
                    var $input = roomspanel.$el.find('input.new-chatroom-name');
                    var $nick = roomspanel.$el.find('input.new-chatroom-nick');
                    var $server = roomspanel.$el.find('input.new-chatroom-server');
                    expect($input.length).toBe(1);
                    expect($server.length).toBe(1);
                    expect($('.chatroom:visible').length).toBe(0); // There shouldn't be any chatrooms open currently
                    spyOn(roomspanel, 'createChatRoom').andCallThrough();
                    roomspanel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                    runs(function () {
                        $input.val('Lounge');
                        $nick.val('dummy');
                        $server.val('muc.localhost');
                    });
                    waits('250');
                    runs(function () {
                        roomspanel.$el.find('form').submit();
                        expect(roomspanel.createChatRoom).toHaveBeenCalled();
                    });
                    waits('250');
                    runs($.proxy(function () {
                        expect($('.chatroom:visible').length).toBe(1); // There should now be an open chatroom
                    }, converse));
                }, converse));
            }, converse));
        }, converse));
    }, converse));
}));
