(function (root, factory) {
    define([
        "jquery",
        "mock",
        "test_utils",
        "utils"
        ], function ($, mock, test_utils, utils) {
            return factory($, mock, test_utils, utils);
        }
    );
} (this, function ($, mock, test_utils, utils) {
    var $pres = converse_api.env.$pres;
    var $msg = converse_api.env.$msg;

    return describe("ChatRooms", $.proxy(function (mock, test_utils) {
        describe("A Chat Room", $.proxy(function () {
            beforeEach(function () {
                runs(function () {
                    test_utils.closeAllChatBoxes();
                    test_utils.clearBrowserStorage();
                });
            });

            it("shows users currently present in the room", $.proxy(function () {
                test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                var name;
                var view = this.chatboxviews.get('lounge@localhost'),
                    $participants = view.$('.participant-list');
                spyOn(view, 'onChatRoomPresence').andCallThrough();
                var presence, room = {}, i, role;
                for (i=0; i<mock.chatroom_names.length; i++) {
                    name = mock.chatroom_names[i];
                    role = mock.chatroom_roles[name].role;
                    // See example 21 http://xmpp.org/extensions/xep-0045.html#enter-pres
                    presence = $pres({
                            to:'dummy@localhost/pda',
                            from:'lounge@localhost/'+name
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: mock.chatroom_roles[name].affiliation,
                        jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                        role: role
                    }).up()
                    .c('status').attrs({code:'110'}).nodeTree;

                    this.connection._dataRecv(test_utils.createRequest(presence));
                    expect(view.onChatRoomPresence).toHaveBeenCalled();
                    expect($participants.find('li').length).toBe(1+i);
                    expect($($participants.find('li')[i]).text()).toBe(mock.chatroom_names[i]);
                    expect($($participants.find('li')[i]).hasClass('moderator')).toBe(role === "moderator");
                }

                // Test users leaving the room
                // http://xmpp.org/extensions/xep-0045.html#exit
                for (i=mock.chatroom_names.length-1; i>-1; i--) {
                    name = mock.chatroom_names[i];
                    console.log(name);
                    role = mock.chatroom_roles[name].role;
                    // See example 21 http://xmpp.org/extensions/xep-0045.html#enter-pres
                    presence = $pres({
                        to:'dummy@localhost/pda',
                        from:'lounge@localhost/'+name,
                        type: 'unavailable'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: mock.chatroom_roles[name].affiliation,
                        jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                        role: 'none'
                    }).nodeTree;
                    this.connection._dataRecv(test_utils.createRequest(presence));
                    expect(view.onChatRoomPresence).toHaveBeenCalled();
                    expect($participants.find('li').length).toBe(i);
                }
            }, converse));

            it("indicates moderators by means of a special css class and tooltip", $.proxy(function () {
                test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                var view = this.chatboxviews.get('lounge@localhost');

                var presence = $pres({
                        to:'dummy@localhost/pda',
                        from:'lounge@localhost/moderatorman'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    affiliation: 'admin',
                    jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                    role: 'moderator',
                }).up()
                .c('status').attrs({code:'110'}).nodeTree;

                this.connection._dataRecv(test_utils.createRequest(presence));
                var occupant = view.$el.find('.participant-list').find('li');
                expect(occupant.length).toBe(1);
                expect($(occupant).text()).toBe("moderatorman");
                expect($(occupant).attr('class')).toBe('moderator');
                expect($(occupant).attr('title')).toBe('This user is a moderator');
            }, converse));

            it("allows the user to invite their roster contacts to enter the chat room", $.proxy(function () {
                test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                spyOn(converse, 'emit');
                spyOn(window, 'prompt').andCallFake(function () {
                    return null;
                });
                var roster = {}, $input;
                var view = this.chatboxviews.get('lounge@localhost');
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
                test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                spyOn(window, 'confirm').andCallFake(function () {
                    return true;
                });
                test_utils.createContacts('current'); // We need roster contacts, who can invite us
                var view = this.chatboxviews.get('lounge@localhost');
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
                expect(converse.chatboxes.models.length).toBe(1);
                expect(converse.chatboxes.models[0].id).toBe("controlbox");
                converse.chatboxes.onInvite(message);
                expect(window.confirm).toHaveBeenCalledWith(
                    name + ' has invited you to join a chat room: '+ room_jid +
                    ', and left the following reason: "'+reason+'"');
                expect(converse.chatboxes.models.length).toBe(2);
                expect(converse.chatboxes.models[0].id).toBe('controlbox');
                expect(converse.chatboxes.models[1].id).toBe(room_jid);
            }, converse));

            it("shows received groupchat messages", $.proxy(function () {
                test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                spyOn(converse, 'emit');
                var view = this.chatboxviews.get('lounge@localhost');
                if (!view.$el.find('.chat-area').length) { view.renderChatArea(); }
                var nick = mock.chatroom_names[0];
                var text = 'This is a received message';
                var message = $msg({
                    from: 'lounge@localhost/'+nick,
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

            it("plays a sound when the current user is mentioned (if configured)", $.proxy(function () {
                test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                spyOn(converse, 'emit');
                converse.play_sounds = true;
                spyOn(converse, 'playNotification');
                var view = this.chatboxviews.get('lounge@localhost');
                if (!view.$el.find('.chat-area').length) { view.renderChatArea(); }
                var nick = mock.chatroom_names[0];
                var text = 'This message will play a sound because it mentions dummy';
                var message = $msg({
                    from: 'lounge@localhost/otheruser',
                    id: '1',
                    to: 'dummy@localhost',
                    type: 'groupchat'
                }).c('body').t(text);
                view.onChatRoomMessage(message.nodeTree);
                expect(converse.playNotification).toHaveBeenCalled();

                text = "This message won't play a sound";
                message = $msg({
                    from: 'lounge@localhost/otheruser',
                    id: '2',
                    to: 'dummy@localhost',
                    type: 'groupchat'
                }).c('body').t(text);
                view.onChatRoomMessage(message.nodeTree);
                expect(converse.playNotification, 1);
                converse.play_sounds = false;

                text = "This message won't play a sound because it is sent by dummy";
                message = $msg({
                    from: 'lounge@localhost/dummy',
                    id: '3',
                    to: 'dummy@localhost',
                    type: 'groupchat'
                }).c('body').t(text);
                view.onChatRoomMessage(message.nodeTree);
                expect(converse.playNotification, 1);
                converse.play_sounds = false;
            }, converse));

            it("shows sent groupchat messages", $.proxy(function () {
                test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                spyOn(converse, 'emit');
                var view = this.chatboxviews.get('lounge@localhost');
                if (!view.$el.find('.chat-area').length) { view.renderChatArea(); }
                var nick = mock.chatroom_names[0];
                var text = 'This is a sent message';
                view.$el.find('.chat-textarea').text(text);
                view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                expect(converse.emit).toHaveBeenCalledWith('messageSend', text);

                var message = $msg({
                    from: 'lounge@localhost/dummy',
                    to: 'dummy@localhost.com',
                    type: 'groupchat',
                    id: view.model.messages.at(0).get('msgid')
                }).c('body').t(text);
                view.onChatRoomMessage(message.nodeTree);
                var $chat_content = view.$el.find('.chat-content');
                expect($chat_content.find('.chat-message').length).toBe(1);
                expect($chat_content.find('.chat-message-content').last().text()).toBe(text);
                // We don't emit an event if it's our own message
                expect(converse.emit.callCount, 1);
            }, converse));

            it("informs users if their nicknames has been changed.", $.proxy(function () {
                /* The service then sends two presence stanzas to the full JID
                 * of each occupant (including the occupant who is changing his
                 * or her room nickname), one of type "unavailable" for the old
                 * nickname and one indicating availability for the new
                 * nickname.
                 *
                 * See: http://xmpp.org/extensions/xep-0045.html#changenick
                 *
                 *  <presence
                 *      from='coven@localhost/thirdwitch'
                 *      id='DC352437-C019-40EC-B590-AF29E879AF98'
                 *      to='hag66@shakespeare.lit/pda'
                 *      type='unavailable'>
                 *  <x xmlns='http://jabber.org/protocol/muc#user'>
                 *      <item affiliation='member'
                 *          jid='hag66@shakespeare.lit/pda'
                 *          nick='oldhag'
                 *          role='participant'/>
                 *      <status code='303'/>
                 *      <status code='110'/>
                 *  </x>
                 *  </presence>
                 *
                 *  <presence
                 *      from='coven@localhost/oldhag'
                 *      id='5B4F27A4-25ED-43F7-A699-382C6B4AFC67'
                 *      to='hag66@shakespeare.lit/pda'>
                 *  <x xmlns='http://jabber.org/protocol/muc#user'>
                 *      <item affiliation='member'
                 *          jid='hag66@shakespeare.lit/pda'
                 *          role='participant'/>
                 *      <status code='110'/>
                 *  </x>
                 *  </presence>
                 */
                var __ = $.proxy(utils.__, converse);
                test_utils.openChatRoom('lounge', 'localhost', 'oldnick');
                var view = this.chatboxviews.get('lounge@localhost');
                var $chat_content = view.$el.find('.chat-content');
                spyOn(view, 'onChatRoomPresence').andCallThrough();

                // The user has just entered the room and receives their own
                // presence from the server.
                // See example 24:
                // http://xmpp.org/extensions/xep-0045.html#enter-pres
                var presence = $pres({
                        to:'dummy@localhost/pda',
                        from:'lounge@localhost/oldnick',
                        id:'DC352437-C019-40EC-B590-AF29E879AF97'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                  .c('item').attrs({
                      affiliation: 'member',
                      jid: 'dummy@localhost/pda',
                      role: 'participant'
                  }).up()
                  .c('status').attrs({code:'110'}).up()
                  .c('status').attrs({code:'210'}).nodeTree;

                this.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.onChatRoomPresence).toHaveBeenCalled();
                $participants = view.$('.participant-list');
                expect($participants.children().length).toBe(1);
                expect($participants.children().first(0).text()).toBe("oldnick");
                expect($chat_content.find('div.chat-info').length).toBe(1);
                expect($chat_content.find('div.chat-info').html()).toBe(__(view.newNicknameMessages["210"], "oldnick"));

                presence = $pres().attrs({
                        from:'lounge@localhost/oldnick',
                        id:'DC352437-C019-40EC-B590-AF29E879AF98',
                        to:'dummy@localhost/pda',
                        type:'unavailable'
                    })
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'member',
                        jid: 'dummy@localhost/pda',
                        nick: 'newnick',
                        role: 'participant'
                    }).up()
                    .c('status').attrs({code:'303'}).up()
                    .c('status').attrs({code:'110'}).nodeTree;

                this.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.onChatRoomPresence).toHaveBeenCalled();
                expect($chat_content.find('div.chat-info').length).toBe(2);
                expect($chat_content.find('div.chat-info').last().html()).toBe(__(view.newNicknameMessages["303"], "newnick"));
                $participants = view.$('.participant-list');
                expect($participants.children().length).toBe(0);

                presence = $pres().attrs({
                        from:'lounge@localhost/newnick',
                        id:'5B4F27A4-25ED-43F7-A699-382C6B4AFC67',
                        to:'dummy@localhost/pda'
                    })
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'member',
                        jid: 'dummy@localhost/pda',
                        role: 'participant'
                    }).up()
                    .c('status').attrs({code:'110'}).nodeTree;

                this.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.onChatRoomPresence).toHaveBeenCalled();
                expect($chat_content.find('div.chat-info').length).toBe(2);
                expect($chat_content.find('div.chat-info').last().html()).toBe(__(view.newNicknameMessages["303"], "newnick"));
                $participants = view.$('.participant-list');
                expect($participants.children().length).toBe(1);
                expect($participants.children().first(0).text()).toBe("newnick");
            }, converse));

            it("informs users if they have been kicked out of the chat room", $.proxy(function () {
                /*  <presence
                 *      from='harfleur@chat.shakespeare.lit/pistol'
                 *      to='pistol@shakespeare.lit/harfleur'
                 *      type='unavailable'>
                 *  <x xmlns='http://jabber.org/protocol/muc#user'>
                 *      <item affiliation='none' role='none'>
                 *      <actor nick='Fluellen'/>
                 *      <reason>Avaunt, you cullion!</reason>
                 *      </item>
                 *      <status code='307'/>
                 *  </x>
                 *  </presence>
                 */
                test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                var presence = $pres().attrs({
                        from:'lounge@localhost/dummy',
                        to:'dummy@localhost/pda',
                        type:'unavailable'
                    })
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'none',
                        jid: 'dummy@localhost/pda',
                        role: 'none'
                    })
                    .c('actor').attrs({nick: 'Fluellen'}).up()
                    .c('reason').t('Avaunt, you cullion!').up()
                    .up()
                    .c('status').attrs({code:'307'}).nodeTree;

                var view = this.chatboxviews.get('lounge@localhost');
                view.onChatRoomPresence(presence, {nick: 'dummy', name: 'lounge@localhost'});
                expect(view.$('.chat-area').is(':visible')).toBeFalsy();
                expect(view.$('.participants').is(':visible')).toBeFalsy();
                var $chat_body = view.$('.chat-body');
                expect($chat_body.html().trim().indexOf('<p>You have been kicked from this room</p><p>The reason given is: "Avaunt, you cullion!"</p>')).not.toBe(-1);
            }, converse));

            it("can be saved to, and retrieved from, browserStorage", $.proxy(function () {
                test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                // We instantiate a new ChatBoxes collection, which by default
                // will be empty.
                test_utils.openControlBox();
                var newchatboxes = new this.ChatBoxes();
                expect(newchatboxes.length).toEqual(0);
                // The chatboxes will then be fetched from browserStorage inside the
                // onConnected method
                newchatboxes.onConnected();
                expect(newchatboxes.length).toEqual(2);
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
                test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                var view = this.chatboxviews.get('lounge@localhost'),
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
                test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                var view = this.chatboxviews.get('lounge@localhost'), chatroom = view.model, $el;
                spyOn(view, 'close').andCallThrough();
                spyOn(converse, 'emit');
                spyOn(view, 'leave');
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                runs(function () {
                    view.$el.find('.close-chatbox-button').click();
                });
                waits(50);
                runs(function () {
                    expect(view.close).toHaveBeenCalled();
                    expect(view.leave).toHaveBeenCalled();
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
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'auth'})
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
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'auth'})
                    .c('registration-required').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = this.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence, {'nick': 'dummy'});
                expect(view.$el.find('.chat-body p').text()).toBe('You are not on the member list of this room');
            }, converse));

            it("will show an error message if the user has been banned", $.proxy(function () {
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'auth'})
                    .c('forbidden').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = this.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence, {'nick': 'dummy'});
                expect(view.$el.find('.chat-body p').text()).toBe('You have been banned from this room');
            }, converse));

            it("will show an error message if no nickname was specified for the user", $.proxy(function () {
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'modify'})
                    .c('jid-malformed').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = this.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence, {'nick': 'dummy'});
                expect(view.$el.find('.chat-body p').text()).toBe('No nickname was specified');
            }, converse));

            it("will show an error message if the user is not allowed to have created the room", $.proxy(function () {
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('not-allowed').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = this.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence, {'nick': 'dummy'});
                expect(view.$el.find('.chat-body p').text()).toBe('You are not allowed to create new rooms');
            }, converse));

            it("will show an error message if the user's nickname doesn't conform to room policy", $.proxy(function () {
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('not-acceptable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = this.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence, {'nick': 'dummy'});
                expect(view.$el.find('.chat-body p').text()).toBe("Your nickname doesn't conform to this room's policies");
            }, converse));

            it("will show an error message if the user's nickname is already taken", $.proxy(function () {
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = this.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence, {'nick': 'dummy'});
                expect(view.$el.find('.chat-body p').text()).toBe("Your nickname is already taken");
            }, converse));

            it("will show an error message if the room doesn't yet exist", $.proxy(function () {
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('item-not-found').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = this.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence, {'nick': 'dummy'});
                expect(view.$el.find('.chat-body p').text()).toBe("This room does not (yet) exist");
            }, converse));

            it("will show an error message if the room has reached it's maximum number of occupants", $.proxy(function () {
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('service-unavailable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = this.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence, {'nick': 'dummy'});
                expect(view.$el.find('.chat-body p').text()).toBe("This room has reached it's maximum number of occupants");
            }, converse));
        }, converse));
    }, converse, mock, test_utils));
}));
