(function (root, factory) {
    define([
        "mock",
        "test_utils"
        ], function (mock, test_utils) {
            return factory(mock, test_utils);
        }
    );
} (this, function (mock, test_utils) {
    return describe("ChatRooms", $.proxy(function (mock, test_utils) {
        describe("A Chat Room", $.proxy(function () {
            beforeEach(function () {
                runs(function () {
                    test_utils.closeAllChatBoxes();
                    test_utils.openControlBox();
                });
                waits(150);
                runs(function () {
                    test_utils.openRoomsPanel();
                });
                waits(200);
                runs(function () {
                    // Open a new chatroom
                    var roomspanel = converse.chatboxviews.get('controlbox').roomspanel;
                    var $input = roomspanel.$el.find('input.new-chatroom-name');
                    var $nick = roomspanel.$el.find('input.new-chatroom-nick');
                    var $server = roomspanel.$el.find('input.new-chatroom-server');
                    $input.val('lounge');
                    $nick.val('dummy');
                    $server.val('muc.localhost');
                    roomspanel.$el.find('form').submit();
                });
                waits(250);
                runs(function () {
                    test_utils.closeControlBox();
                });
                runs(function () {});
            });

            it("shows users currently present in the room", $.proxy(function () {
                var chatroomview = this.chatboxviews.get('lounge@muc.localhost'),
                    $participant_list;
                var roster = {}, room = {}, i;
                for (i=0; i<mock.chatroom_names.length-1; i++) {
                    roster[mock.chatroom_names[i]] = {};
                    chatroomview.onChatRoomRoster(roster, room);
                    $participant_list = chatroomview.$el.find('.participant-list');
                    expect($participant_list.find('li').length).toBe(1+i);
                    expect($($participant_list.find('li')[i]).text()).toBe(mock.chatroom_names[i]);
                }
                roster[converse.bare_jid] = {};
                chatroomview.onChatRoomRoster(roster, room);
            }, converse));

            it("indicates moderators by means of a special css class and tooltip", $.proxy(function () {
                var chatroomview = this.chatboxviews.get('lounge@muc.localhost');
                var roster = {}, idx = mock.chatroom_names.length-1;
                roster[mock.chatroom_names[idx]] = {};
                roster[mock.chatroom_names[idx]].role = 'moderator';
                chatroomview.onChatRoomRoster(roster, {});
                var occupant = chatroomview.$el.find('.participant-list').find('li');
                expect(occupant.length).toBe(1);
                expect($(occupant).text()).toBe(mock.chatroom_names[idx]);
                expect($(occupant).attr('class')).toBe('moderator');
                expect($(occupant).attr('title')).toBe('This user is a moderator');
            }, converse));

            it("allows the user to invite their roster contacts to enter the chat room", $.proxy(function () {
                spyOn(converse, 'emit');
                spyOn(window, 'prompt').andCallFake(function () {
                    return null;
                });
                var roster = {}, $input;
                var view = this.chatboxviews.get('lounge@muc.localhost');
                view.$el.find('.chat-area').remove();
                view.renderChatArea(); // Will init the widget
                test_utils.createContacts('current'); // We need roster contacts, so that we have someone to invite
                $input = view.$el.find('input.invited-contact.tt-input');
                $hint = view.$el.find('input.invited-contact.tt-hint');
                runs (function () {
                    expect($input.length).toBe(1);
                    expect($input.attr('placeholder')).toBe('Invite...');
                    $input.val("Felix");
                    $input.trigger('input');
                });
                waits(350); // Needed, due to debounce
                runs (function () {
                    expect($input.val()).toBe('Felix');
                    expect($hint.val()).toBe('Felix Amsel');
                    var $sugg = view.$el.find('[data-jid="felix.amsel@localhost"]');
                    expect($sugg.length).toBe(1);
                    $sugg.trigger('click');
                    expect(window.prompt).toHaveBeenCalled();
                });
            }, converse));

            it("can be joined automatically, based upon a received invite", $.proxy(function () {
                spyOn(window, 'confirm').andCallFake(function () {
                    return true;
                });
                test_utils.createContacts('current'); // We need roster contacts, who can invite us
                var view = this.chatboxviews.get('lounge@muc.localhost');
                view.close();
                var name = mock.cur_names[0];
                var from_jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                var room_jid = 'lounge@localhost';
                var reason = "Please join this chat room";
                var message = $(
                    "<message from='"+from_jid+"' to='"+converse.bare_jid+"'>" +
                        "<x xmlns='jabber:x:conference'" +
                            "jid='"+room_jid+"'" +
                            "reason='"+reason+"'/>"+
                    "</message>"
                )[0];
                expect(converse.chatboxes.models.length).toBe(0);
                converse.chatboxes.onInvite(message);
                expect(window.confirm).toHaveBeenCalledWith( 
                    name + ' has invited you to join a chat room: '+ room_jid +
                    ', and left the following reason: "'+reason+'"');
                expect(converse.chatboxes.models.length).toBe(1);
                expect(converse.chatboxes.models[0].id).toBe(room_jid);
            }, converse));

            it("shows received groupchat messages", $.proxy(function () {
                spyOn(converse, 'emit');
                var view = this.chatboxviews.get('lounge@muc.localhost');
                if (!view.$el.find('.chat-area').length) { view.renderChatArea(); }
                var nick = mock.chatroom_names[0];
                var text = 'This is a received message';
                var message = $msg({
                    from: 'lounge@muc.localhost/'+nick,
                    id: '1',
                    to: 'dummy@localhost',
                    type: 'groupchat'
                }).c('body').t(text);
                view.onChatRoomMessage(message.nodeTree);
                var $chat_content = view.$el.find('.chat-content');
                expect($chat_content.find('.chat-message').length).toBe(1);
                expect($chat_content.find('.chat-message-content').text()).toBe(text);
                expect(converse.emit).toHaveBeenCalledWith('message', message.nodeTree);
            }, converse));

            it("shows sent groupchat messages", $.proxy(function () {
                spyOn(converse, 'emit');
                var view = this.chatboxviews.get('lounge@muc.localhost');
                if (!view.$el.find('.chat-area').length) { view.renderChatArea(); }
                var nick = mock.chatroom_names[0];
                var text = 'This is a sent message';
                view.$el.find('.chat-textarea').text(text);
                view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                expect(converse.emit).toHaveBeenCalledWith('messageSend', text);

                var message = $msg({
                    from: 'lounge@muc.localhost/dummy',
                    id: '2',
                    to: 'dummy@localhost.com',
                    type: 'groupchat'
                }).c('body').t(text);
                view.onChatRoomMessage(message.nodeTree);
                var $chat_content = view.$el.find('.chat-content');
                expect($chat_content.find('.chat-message').length).toBe(1);
                expect($chat_content.find('.chat-message-content').last().text()).toBe(text);
                // We don't emit an event if it's our own message
                expect(converse.emit.callCount, 1);
            }, converse));

            it("can be saved to, and retrieved from, browserStorage", $.proxy(function () {
                // We instantiate a new ChatBoxes collection, which by default
                // will be empty.
                spyOn(this.chatboxviews, 'trimChats');
                test_utils.openControlBox();
                var newchatboxes = new this.ChatBoxes();
                expect(newchatboxes.length).toEqual(0);
                // The chatboxes will then be fetched from browserStorage inside the
                // onConnected method
                newchatboxes.onConnected();
                expect(this.chatboxviews.trimChats).toHaveBeenCalled();
                expect(newchatboxes.length).toEqual(2); // XXX: Includes controlbox, is this a bug?
                // Check that the chatrooms retrieved from browserStorage
                // have the same attributes values as the original ones.
                attrs = ['id', 'box_id', 'visible'];
                for (i=0; i<attrs.length; i++) {
                    new_attrs = _.pluck(_.pluck(newchatboxes.models, 'attributes'), attrs[i]);
                    old_attrs = _.pluck(_.pluck(this.chatboxes.models, 'attributes'), attrs[i]);
                    // FIXME: should have have to sort here? Order must
                    // probably be the same...
                    // This should be fixed once the controlbox always opens
                    // only on the right.
                    expect(_.isEqual(new_attrs.sort(), old_attrs.sort())).toEqual(true);
                }
                this.rosterview.render();
            }, converse));

            it("can be minimized by clicking a DOM element with class 'toggle-chatbox-button'", function () {
                var view = this.chatboxviews.get('lounge@muc.localhost'),
                    trimmed_chatboxes = this.minimized_chats;
                spyOn(view, 'minimize').andCallThrough();
                spyOn(view, 'maximize').andCallThrough();
                spyOn(converse, 'emit');
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                runs(function () {
                    view.$el.find('.toggle-chatbox-button').click();
                });
                waits(50);
                runs(function () {
                    expect(view.minimize).toHaveBeenCalled();
                    expect(converse.emit).toHaveBeenCalledWith('chatBoxMinimized', jasmine.any(Object));
                    expect(converse.emit.callCount, 2);
                    expect(view.$el.is(':visible')).toBeFalsy();
                    expect(view.model.get('minimized')).toBeTruthy();
                    expect(view.minimize).toHaveBeenCalled();
                    trimmedview = trimmed_chatboxes.get(view.model.get('id'));
                    trimmedview.$("a.restore-chat").click();
                });
                waits(250);
                runs(function () {
                    expect(view.maximize).toHaveBeenCalled();
                    expect(converse.emit).toHaveBeenCalledWith('chatBoxMaximized', jasmine.any(Object));
                    expect(view.$el.is(':visible')).toBeTruthy();
                    expect(view.model.get('minimized')).toBeFalsy();
                    expect(converse.emit.callCount, 3);
                });
            }.bind(converse));


            it("can be closed again by clicking a DOM element with class 'close-chatbox-button'", $.proxy(function () {
                var view = this.chatboxviews.get('lounge@muc.localhost'), chatroom = view.model, $el;
                spyOn(view, 'close').andCallThrough();
                spyOn(converse, 'emit');
                spyOn(converse.connection.muc, 'leave');
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                runs(function () {
                    view.$el.find('.close-chatbox-button').click();
                });
                waits(50);
                runs(function () {
                    expect(view.close).toHaveBeenCalled();
                    expect(this.connection.muc.leave).toHaveBeenCalled();
                    expect(this.emit).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                }.bind(converse));
            }, converse));
        }, converse));

        describe("When attempting to enter a chatroom", $.proxy(function () {
            beforeEach($.proxy(function () {
                var roomspanel = this.chatboxviews.get('controlbox').roomspanel;
                var $input = roomspanel.$el.find('input.new-chatroom-name');
                var $nick = roomspanel.$el.find('input.new-chatroom-nick');
                var $server = roomspanel.$el.find('input.new-chatroom-server');
                $input.val('problematic');
                $nick.val('dummy');
                $server.val('muc.localhost');
                roomspanel.$el.find('form').submit();
            }, converse));

            afterEach($.proxy(function () {
                var view = this.chatboxviews.get('problematic@muc.localhost');
                view.close();
            }, converse));

            it("will show an error message if the room requires a password", $.proxy(function () {
                var presence = $pres().attrs({
                    from:'coven@chat.shakespeare.lit/thirdwitch',
                        id:'n13mt3l',
                        to:'hag66@shakespeare.lit/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'coven@chat.shakespeare.lit', type:'auth'})
                    .c('not-authorized').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                var view = this.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'renderPasswordForm').andCallThrough();
                runs(function () {
                    view.onChatRoomPresence(presence, {'nick': 'dummy'});
                });
                waits(250);
                runs(function () {
                    var $chat_body = view.$el.find('.chat-body');
                    expect(view.renderPasswordForm).toHaveBeenCalled();
                    expect($chat_body.find('form.chatroom-form').length).toBe(1);
                    expect($chat_body.find('legend').text()).toBe('This chatroom requires a password');
                });
            }, converse));

            it("will show an error message if the room is members-only and the user not included", $.proxy(function () {
                var presence = $pres().attrs({
                    from:'coven@chat.shakespeare.lit/thirdwitch',
                        id:'n13mt3l',
                        to:'hag66@shakespeare.lit/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'coven@chat.shakespeare.lit', type:'auth'})
                    .c('registration-required').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = this.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence, {'nick': 'dummy'});
                expect(view.$el.find('.chat-body p').text()).toBe('You are not on the member list of this room');
            }, converse));

            it("will show an error message if the user has been banned", $.proxy(function () {
                var presence = $pres().attrs({
                    from:'coven@chat.shakespeare.lit/thirdwitch',
                        id:'n13mt3l',
                        to:'hag66@shakespeare.lit/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'coven@chat.shakespeare.lit', type:'auth'})
                    .c('forbidden').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = this.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence, {'nick': 'dummy'});
                expect(view.$el.find('.chat-body p').text()).toBe('You have been banned from this room');
            }, converse));

            it("will show an error message if no nickname was specified for the user", $.proxy(function () {
                var presence = $pres().attrs({
                    from:'coven@chat.shakespeare.lit/thirdwitch',
                        id:'n13mt3l',
                        to:'hag66@shakespeare.lit/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'coven@chat.shakespeare.lit', type:'modify'})
                    .c('jid-malformed').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = this.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence, {'nick': 'dummy'});
                expect(view.$el.find('.chat-body p').text()).toBe('No nickname was specified');
            }, converse));

            it("will show an error message if the user is not allowed to have created the room", $.proxy(function () {
                var presence = $pres().attrs({
                    from:'coven@chat.shakespeare.lit/thirdwitch',
                        id:'n13mt3l',
                        to:'hag66@shakespeare.lit/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'coven@chat.shakespeare.lit', type:'cancel'})
                    .c('not-allowed').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = this.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence, {'nick': 'dummy'});
                expect(view.$el.find('.chat-body p').text()).toBe('You are not allowed to create new rooms');
            }, converse));

            it("will show an error message if the user's nickname doesn't conform to room policy", $.proxy(function () {
                var presence = $pres().attrs({
                    from:'coven@chat.shakespeare.lit/thirdwitch',
                        id:'n13mt3l',
                        to:'hag66@shakespeare.lit/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'coven@chat.shakespeare.lit', type:'cancel'})
                    .c('not-acceptable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = this.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence, {'nick': 'dummy'});
                expect(view.$el.find('.chat-body p').text()).toBe("Your nickname doesn't conform to this room's policies");
            }, converse));

            it("will show an error message if the user's nickname is already taken", $.proxy(function () {
                var presence = $pres().attrs({
                    from:'coven@chat.shakespeare.lit/thirdwitch',
                        id:'n13mt3l',
                        to:'hag66@shakespeare.lit/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'coven@chat.shakespeare.lit', type:'cancel'})
                    .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = this.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence, {'nick': 'dummy'});
                expect(view.$el.find('.chat-body p').text()).toBe("Your nickname is already taken");
            }, converse));

            it("will show an error message if the room doesn't yet exist", $.proxy(function () {
                var presence = $pres().attrs({
                    from:'coven@chat.shakespeare.lit/thirdwitch',
                        id:'n13mt3l',
                        to:'hag66@shakespeare.lit/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'coven@chat.shakespeare.lit', type:'cancel'})
                    .c('item-not-found').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = this.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence, {'nick': 'dummy'});
                expect(view.$el.find('.chat-body p').text()).toBe("This room does not (yet) exist");
            }, converse));

            it("will show an error message if the room has reached it's maximum number of occupants", $.proxy(function () {
                var presence = $pres().attrs({
                    from:'coven@chat.shakespeare.lit/thirdwitch',
                        id:'n13mt3l',
                        to:'hag66@shakespeare.lit/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'coven@chat.shakespeare.lit', type:'cancel'})
                    .c('service-unavailable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = this.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence, {'nick': 'dummy'});
                expect(view.$el.find('.chat-body p').text()).toBe("This room has reached it's maximum number of occupants");
            }, converse));
        }, converse));
    }, converse, mock, test_utils));
}));
