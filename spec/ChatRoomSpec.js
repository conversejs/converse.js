(function (root, factory) {
    define([
        "mock",
        "utils"
        ], function (mock, utils) {
            return factory(mock, utils);
        }
    );
} (this, function (mock, utils) {
    return describe("ChatRooms", $.proxy(function (mock, utils) {
        describe("A Chat Room", $.proxy(function () {
            beforeEach(function () {
                utils.closeAllChatBoxes();
                utils.createNewChatRoom('lounge', 'dummy');
            });

            it("shows users currently present in the room", $.proxy(function () {
                var chatroomview = this.chatboxesview.views['lounge@muc.localhost'],
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
                var chatroomview = this.chatboxesview.views['lounge@muc.localhost'];
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

            it("shows received groupchat messages", $.proxy(function () {
                spyOn(converse, 'emit');
                var view = this.chatboxesview.views['lounge@muc.localhost'];
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
                expect(converse.emit).toHaveBeenCalledWith('onMessage', message.nodeTree);
            }, converse));

            it("shows sent groupchat messages", $.proxy(function () {
                spyOn(converse, 'emit');
                var view = this.chatboxesview.views['lounge@muc.localhost'];
                if (!view.$el.find('.chat-area').length) { view.renderChatArea(); }
                var nick = mock.chatroom_names[0];
                var text = 'This is a sent message';
                view.$el.find('.chat-textarea').text(text);
                view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                expect(converse.emit).toHaveBeenCalledWith('onMessageSend', text);

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

            it("can be saved to, and retrieved from, localStorage", $.proxy(function () {
                // We instantiate a new ChatBoxes collection, which by default
                // will be empty.
                var newchatboxes = new this.ChatBoxes();
                expect(newchatboxes.length).toEqual(0);
                // The chatboxes will then be fetched from localStorage inside the
                // onConnected method
                newchatboxes.onConnected();
                expect(newchatboxes.length).toEqual(1);
                // Check that the chatrooms retrieved from localStorage
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
                var view = this.chatboxesview.views['lounge@muc.localhost'], chatroom = view.model, $el;
                spyOn(view, 'closeChat').andCallThrough();
                spyOn(converse, 'emit');
                spyOn(converse.connection.muc, 'leave');
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                view.$el.find('.close-chatbox-button').click();
                expect(view.closeChat).toHaveBeenCalled();
                expect(converse.connection.muc.leave).toHaveBeenCalled();
                expect(converse.emit).toHaveBeenCalledWith('onChatBoxClosed', jasmine.any(Object));
            }, converse));
        }, converse));

        describe("When attempting to enter a chatroom", $.proxy(function () {
            beforeEach($.proxy(function () {
                var roomspanel = this.chatboxesview.views.controlbox.roomspanel;
                var $input = roomspanel.$el.find('input.new-chatroom-name');
                var $nick = roomspanel.$el.find('input.new-chatroom-nick');
                var $server = roomspanel.$el.find('input.new-chatroom-server');
                $input.val('problematic');
                $nick.val('dummy');
                $server.val('muc.localhost');
                roomspanel.$el.find('form').submit();
            }, converse));

            afterEach($.proxy(function () {
                var view = this.chatboxesview.views['problematic@muc.localhost'];
                view.closeChat();
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

                var view = this.chatboxesview.views['problematic@muc.localhost'];
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
                var view = this.chatboxesview.views['problematic@muc.localhost'];
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
                var view = this.chatboxesview.views['problematic@muc.localhost'];
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
                var view = this.chatboxesview.views['problematic@muc.localhost'];
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
                var view = this.chatboxesview.views['problematic@muc.localhost'];
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
                var view = this.chatboxesview.views['problematic@muc.localhost'];
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
                var view = this.chatboxesview.views['problematic@muc.localhost'];
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
                var view = this.chatboxesview.views['problematic@muc.localhost'];
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
                var view = this.chatboxesview.views['problematic@muc.localhost'];
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence, {'nick': 'dummy'});
                expect(view.$el.find('.chat-body p').text()).toBe("This room has reached it's maximum number of occupants");
            }, converse));
        }, converse));
    }, converse, mock, utils));
}));
