/*global converse */
(function (root, factory) {
    define([
        "jquery",
        "underscore",
        "mock",
        "test_utils",
        "utils"
        ], function ($, _, mock, test_utils, utils) {
            return factory($, _, mock, test_utils, utils);
        }
    );
} (this, function ($, _, mock, test_utils, utils) {
    var $pres = converse_api.env.$pres;
    var $iq = converse_api.env.$iq;
    var $msg = converse_api.env.$msg;
    var Strophe = converse_api.env.Strophe;

    return describe("ChatRooms", function (mock, test_utils) {
        beforeEach(function () {
            runs(function () {
                test_utils.closeAllChatBoxes();
                test_utils.clearBrowserStorage();
            });
        });

        describe("The \"rooms\" API", function () {
            beforeEach(function () {
                test_utils.closeAllChatBoxes();
                test_utils.clearBrowserStorage();
                converse.rosterview.model.reset();
                test_utils.createContacts('current');
            });

            it("has a method 'close' which closes rooms by JID or all rooms when called with no arguments", function () {
                runs(function () {
                    test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                    test_utils.openChatRoom('leisure', 'localhost', 'dummy');
                    test_utils.openChatRoom('news', 'localhost', 'dummy');
                    expect(converse.chatboxviews.get('lounge@localhost').$el.is(':visible')).toBeTruthy();
                    expect(converse.chatboxviews.get('leisure@localhost').$el.is(':visible')).toBeTruthy();
                    expect(converse.chatboxviews.get('news@localhost').$el.is(':visible')).toBeTruthy();
                });
                waits('100');
                runs(function () {
                    converse_api.rooms.close('lounge@localhost');
                    expect(converse.chatboxviews.get('lounge@localhost')).toBeUndefined();
                    expect(converse.chatboxviews.get('leisure@localhost').$el.is(':visible')).toBeTruthy();
                    expect(converse.chatboxviews.get('news@localhost').$el.is(':visible')).toBeTruthy();
                    converse_api.rooms.close(['leisure@localhost', 'news@localhost']);
                    expect(converse.chatboxviews.get('lounge@localhost')).toBeUndefined();
                    expect(converse.chatboxviews.get('leisure@localhost')).toBeUndefined();
                    expect(converse.chatboxviews.get('news@localhost')).toBeUndefined();

                    test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                    test_utils.openChatRoom('leisure', 'localhost', 'dummy');
                    expect(converse.chatboxviews.get('lounge@localhost').$el.is(':visible')).toBeTruthy();
                    expect(converse.chatboxviews.get('leisure@localhost').$el.is(':visible')).toBeTruthy();
                });
                waits('100');
                runs(function () {
                    converse_api.rooms.close();
                    expect(converse.chatboxviews.get('lounge@localhost')).toBeUndefined();
                    expect(converse.chatboxviews.get('leisure@localhost')).toBeUndefined();
                });
            });

            it("has a method 'get' which returns a wrapped chat room (if it exists)", function () {
                waits('300'); // ChatBox.show() is debounced for 250ms
                runs(function () {
                    test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                    var jid = 'lounge@localhost';
                    var room = converse_api.rooms.get(jid);
                    expect(room instanceof Object).toBeTruthy();
                    expect(room.is_chatroom).toBeTruthy();
                    var chatroomview = converse.chatboxviews.get(jid);
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();
                    chatroomview.close();
                });
                waits('300'); // ChatBox.show() is debounced for 250ms
                runs(function () {
                    // Test with mixed case
                    test_utils.openChatRoom('Leisure', 'localhost', 'dummy');
                    var jid = 'Leisure@localhost';
                    var room = converse_api.rooms.get(jid);
                    expect(room instanceof Object).toBeTruthy();
                    var chatroomview = converse.chatboxviews.get(jid.toLowerCase());
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();
                });
                waits('300'); // ChatBox.show() is debounced for 250ms
                runs(function () {
                    var jid = 'leisure@localhost';
                    var room = converse_api.rooms.get(jid);
                    expect(room instanceof Object).toBeTruthy();
                    var chatroomview = converse.chatboxviews.get(jid.toLowerCase());
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();

                    jid = 'leiSure@localhost';
                    room = converse_api.rooms.get(jid);
                    expect(room instanceof Object).toBeTruthy();
                    chatroomview = converse.chatboxviews.get(jid.toLowerCase());
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();
                    chatroomview.close();

                    // Non-existing room
                    jid = 'lounge2@localhost';
                    room = converse_api.rooms.get(jid);
                    expect(typeof room === 'undefined').toBeTruthy();
                });
            });

           it("has a method 'open' which opens and returns a wrapped chat box", function () {
                var chatroomview;
                var jid = 'lounge@localhost';
                var room = converse_api.rooms.open(jid);
                runs(function () {
                    // Test on chat room that doesn't exist.
                    expect(room instanceof Object).toBeTruthy();
                    expect(room.is_chatroom).toBeTruthy();
                    chatroomview = converse.chatboxviews.get(jid);
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();
                });
                waits('300'); // ChatBox.show() is debounced for 250ms
                runs(function () {
                    // Test again, now that the room exists.
                    room = converse_api.rooms.open(jid);
                    expect(room instanceof Object).toBeTruthy();
                    expect(room.is_chatroom).toBeTruthy();
                    chatroomview = converse.chatboxviews.get(jid);
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();
                });
                waits('300'); // ChatBox.show() is debounced for 250ms
                runs(function () {
                    // Test with mixed case in JID
                    jid = 'Leisure@localhost';
                    room = converse_api.rooms.open(jid);
                    expect(room instanceof Object).toBeTruthy();
                    chatroomview = converse.chatboxviews.get(jid.toLowerCase());
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();

                    jid = 'leisure@localhost';
                    room = converse_api.rooms.open(jid);
                    expect(room instanceof Object).toBeTruthy();
                    chatroomview = converse.chatboxviews.get(jid.toLowerCase());
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();

                    jid = 'leiSure@localhost';
                    room = converse_api.rooms.open(jid);
                    expect(room instanceof Object).toBeTruthy();
                    chatroomview = converse.chatboxviews.get(jid.toLowerCase());
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();
                    chatroomview.close();
                });
            });
        });


        describe("A Chat Room", function () {
            beforeEach(function () {
                runs(function () {
                    test_utils.closeAllChatBoxes();
                    test_utils.clearBrowserStorage();
                });
            });

            it("can have spaces and special characters in its name", function () {
                test_utils.openChatRoom('lounge & leisure', 'localhost', 'dummy');
                var view = converse.chatboxviews.get(
                        Strophe.escapeNode('lounge & leisure')+'@localhost');
                expect(view instanceof converse.ChatRoomView).toBe(true);
            });

            it("shows users currently present in the room", function () {
                test_utils.openAndEnterChatRoom('lounge', 'localhost', 'dummy');
                var name;
                var view = this.chatboxviews.get('lounge@localhost'),
                    $occupants = view.$('.occupant-list');
                spyOn(view, 'onChatRoomPresence').andCallThrough();
                var presence, role;
                for (var i=0; i<mock.chatroom_names.length; i++) {
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

                    converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(view.onChatRoomPresence).toHaveBeenCalled();
                    expect($occupants.find('li').length).toBe(2+i);
                    expect($($occupants.find('li')[i+1]).text()).toBe(mock.chatroom_names[i]);
                    expect($($occupants.find('li')[i+1]).hasClass('moderator')).toBe(role === "moderator");
                }

                // Test users leaving the room
                // http://xmpp.org/extensions/xep-0045.html#exit
                for (i=mock.chatroom_names.length-1; i>-1; i--) {
                    name = mock.chatroom_names[i];
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
                    converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(view.onChatRoomPresence).toHaveBeenCalled();
                    expect($occupants.find('li').length).toBe(i+1);
                }
            }.bind(converse));

            it("indicates moderators by means of a special css class and tooltip", function () {
                test_utils.openAndEnterChatRoom('lounge', 'localhost', 'dummy');
                var view = converse.chatboxviews.get('lounge@localhost');

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

                converse.connection._dataRecv(test_utils.createRequest(presence));
                var occupant = view.$el.find('.occupant-list').find('li');
                expect(occupant.length).toBe(2);
                expect($(occupant).first().text()).toBe("dummy");
                expect($(occupant).last().text()).toBe("moderatorman");
                expect($(occupant).last().attr('class').indexOf('moderator')).not.toBe(-1);
                expect($(occupant).last().attr('title')).toBe('This user is a moderator. Click to mention this user in your message.');
            });

            it("will use the user's reserved nickname, if it exists", function () {
                var sent_IQ, IQ_id;
                var sendIQ = converse.connection.sendIQ;
                spyOn(converse.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                var view = converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'join').andCallThrough();

                /* <iq from='hag66@shakespeare.lit/pda'
                 *     id='getnick1'
                 *     to='coven@chat.shakespeare.lit'
                 *     type='get'>
                 * <query xmlns='http://jabber.org/protocol/disco#info'
                 *         node='x-roomuser-item'/>
                 * </iq>
                 */
                expect(sent_IQ.toLocaleString()).toBe(
                    "<iq to='lounge@localhost' from='dummy@localhost/resource' "+
                        "type='get' xmlns='jabber:client' id='"+IQ_id+"'>"+
                            "<query xmlns='http://jabber.org/protocol/disco#info' node='x-roomuser-item'/></iq>"
                );
                /* <iq from='coven@chat.shakespeare.lit'
                 *     id='getnick1'
                 *     to='hag66@shakespeare.lit/pda'
                 *     type='result'>
                 *     <query xmlns='http://jabber.org/protocol/disco#info'
                 *             node='x-roomuser-item'>
                 *         <identity
                 *             category='conference'
                 *             name='thirdwitch'
                 *             type='text'/>
                 *     </query>
                 * </iq>
                 */
                var stanza = $iq({
                    'type': 'result',
                    'id': IQ_id,
                    'from': view.model.get('jid'),
                    'to': converse.connection.jid 
                }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#info', 'node': 'x-roomuser-item'})
                  .c('identity', {'category': 'conference', 'name': 'thirdwitch', 'type': 'text'});
                converse.connection._dataRecv(test_utils.createRequest(stanza));

                expect(view.join).toHaveBeenCalled();

                // The user has just entered the room (because join was called)
                // and receives their own presence from the server.
                // See example 24:
                // http://xmpp.org/extensions/xep-0045.html#enter-pres
                var presence = $pres({
                        to:'dummy@localhost/resource',
                        from:'lounge@localhost/thirdwitch',
                        id:'DC352437-C019-40EC-B590-AF29E879AF97'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                  .c('item').attrs({
                      affiliation: 'member',
                      jid: 'dummy@localhost/resource',
                      role: 'occupant'
                  }).up()
                  .c('status').attrs({code:'110'}).up()
                  .c('status').attrs({code:'210'}).nodeTree;

                converse.connection._dataRecv(test_utils.createRequest(presence));
                var info_text = view.$el.find('.chat-content .chat-info').text();
                expect(info_text).toBe('Your nickname has been automatically set to: thirdwitch');
            });

            it("allows the user to invite their roster contacts to enter the chat room", function () {
                test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                spyOn(converse, 'emit');
                spyOn(window, 'prompt').andCallFake(function () {
                    return null;
                });
                var $input;
                var view = this.chatboxviews.get('lounge@localhost');
                view.$el.find('.chat-area').remove();
                view.renderChatArea(); // Will init the widget
                test_utils.createContacts('current'); // We need roster contacts, so that we have someone to invite
                $input = view.$el.find('input.invited-contact.tt-input');
                var $hint = view.$el.find('input.invited-contact.tt-hint');
                runs (function () {
                    expect($input.length).toBe(1);
                    expect($input.attr('placeholder')).toBe('Invite');
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
            }.bind(converse));

            it("can be joined automatically, based upon a received invite", function () {
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
                converse.onDirectMUCInvitation(message);
                expect(window.confirm).toHaveBeenCalledWith(
                    name + ' has invited you to join a chat room: '+ room_jid +
                    ', and left the following reason: "'+reason+'"');
                expect(converse.chatboxes.models.length).toBe(2);
                expect(converse.chatboxes.models[0].id).toBe('controlbox');
                expect(converse.chatboxes.models[1].id).toBe(room_jid);
            }.bind(converse));

            it("shows received groupchat messages", function () {
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
                expect($chat_content.find('.chat-msg-content').text()).toBe(text);
                expect(converse.emit).toHaveBeenCalledWith('message', message.nodeTree);
            }.bind(converse));

            it("shows sent groupchat messages", function () {
                test_utils.openAndEnterChatRoom('lounge', 'localhost', 'dummy');
                spyOn(converse, 'emit');
                var view = converse.chatboxviews.get('lounge@localhost');
                if (!view.$el.find('.chat-area').length) { view.renderChatArea(); }
                var text = 'This is a sent message';
                view.$el.find('.chat-textarea').text(text);
                view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                expect(converse.emit).toHaveBeenCalledWith('messageSend', text);
                var $chat_content = view.$el.find('.chat-content');
                expect($chat_content.find('.chat-message').length).toBe(1);

                // Let's check that if we receive the same message again, it's
                // not shown.
                var message = $msg({
                    from: 'lounge@localhost/dummy',
                    to: 'dummy@localhost.com',
                    type: 'groupchat',
                    id: view.model.messages.at(0).get('msgid')
                }).c('body').t(text);
                view.onChatRoomMessage(message.nodeTree);
                expect($chat_content.find('.chat-message').length).toBe(1);
                expect($chat_content.find('.chat-msg-content').last().text()).toBe(text);
                // We don't emit an event if it's our own message
                expect(converse.emit.callCount, 1);
            });

            it("will cause the chat area to be scrolled down only if it was at the bottom already", function () {
                var message = 'This message is received while the chat area is scrolled up';
                test_utils.openAndEnterChatRoom('lounge', 'localhost', 'dummy');
                var view = converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'scrollDown').andCallThrough();
                runs(function () {
                    /* Create enough messages so that there's a
                        * scrollbar.
                        */
                    for (var i=0; i<20; i++) {
                        converse.chatboxes.onMessage(
                            $msg({
                                from: 'lounge@localhost/someone',
                                to: 'dummy@localhost.com',
                                type: 'groupchat',
                                id: (new Date()).getTime(),
                            }).c('body').t('Message: '+i).tree());
                    }
                });
                waits(50);
                runs(function () {
                    view.$content.scrollTop(0);
                });
                waits(250);
                runs(function () {
                    expect(view.model.get('scrolled')).toBeTruthy();
                    converse.chatboxes.onMessage(
                        $msg({
                            from: 'lounge@localhost/someone',
                            to: 'dummy@localhost.com',
                            type: 'groupchat',
                            id: (new Date()).getTime(),
                        }).c('body').t(message).tree());
                });
                waits(150);
                runs(function () {
                    // Now check that the message appears inside the chatbox in the DOM
                    var $chat_content = view.$el.find('.chat-content');
                    var msg_txt = $chat_content.find('.chat-message:last').find('.chat-msg-content').text();
                    expect(msg_txt).toEqual(message);
                    expect(view.$content.scrollTop()).toBe(0);
                });
            });

            it("shows received chatroom subject messages", function () {
                test_utils.openAndEnterChatRoom('jdev', 'conference.jabber.org', 'jc');

                var text = 'Jabber/XMPP Development | RFCs and Extensions: http://xmpp.org/ | Protocol and XSF discussions: xsf@muc.xmpp.org';
                var stanza = Strophe.xmlHtmlNode(
                    '<message xmlns="jabber:client" to="jc@opkode.com/converse.js-60429116" type="groupchat" from="jdev@conference.jabber.org/ralphm">'+
                    '    <subject>'+text+'</subject>'+
                    '    <delay xmlns="urn:xmpp:delay" stamp="2014-02-04T09:35:39Z" from="jdev@conference.jabber.org"/>'+
                    '    <x xmlns="jabber:x:delay" stamp="20140204T09:35:39" from="jdev@conference.jabber.org"/>'+
                    '</message>').firstChild;
                converse.connection._dataRecv(test_utils.createRequest(stanza));
                var view = converse.chatboxviews.get('jdev@conference.jabber.org');
                var $chat_content = view.$el.find('.chat-content');
                expect($chat_content.find('.chat-info').length).toBe(1);
                expect($chat_content.find('.chat-info').text()).toBe('Topic set by ralphm to: '+text);
            });

            it("informs users if their nicknames has been changed.", function () {
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
                 *          role='occupant'/>
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
                 *          role='occupant'/>
                 *      <status code='110'/>
                 *  </x>
                 *  </presence>
                 */
                var __ = utils.__.bind(converse);
                test_utils.openAndEnterChatRoom('lounge', 'localhost', 'oldnick');
                var view = converse.chatboxviews.get('lounge@localhost');
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
                      role: 'occupant'
                  }).up()
                  .c('status').attrs({code:'110'}).up()
                  .c('status').attrs({code:'210'}).nodeTree;

                converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.onChatRoomPresence).toHaveBeenCalled();
                var $occupants = view.$('.occupant-list');
                expect($occupants.children().length).toBe(1);
                expect($occupants.children().first(0).text()).toBe("oldnick");

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
                        role: 'occupant'
                    }).up()
                    .c('status').attrs({code:'303'}).up()
                    .c('status').attrs({code:'110'}).nodeTree;

                converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.onChatRoomPresence).toHaveBeenCalled();
                expect($chat_content.find('div.chat-info').length).toBe(2);
                expect($chat_content.find('div.chat-info').last().html()).toBe(__(view.newNicknameMessages["303"], "newnick"));

                $occupants = view.$('.occupant-list');
                expect($occupants.children().length).toBe(0);

                presence = $pres().attrs({
                        from:'lounge@localhost/newnick',
                        id:'5B4F27A4-25ED-43F7-A699-382C6B4AFC67',
                        to:'dummy@localhost/pda'
                    })
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'member',
                        jid: 'dummy@localhost/pda',
                        role: 'occupant'
                    }).up()
                    .c('status').attrs({code:'110'}).nodeTree;

                converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.onChatRoomPresence).toHaveBeenCalled();
                expect($chat_content.find('div.chat-info').length).toBe(2);
                expect($chat_content.find('div.chat-info').last().html()).toBe(__(view.newNicknameMessages["303"], "newnick"));
                $occupants = view.$('.occupant-list');
                expect($occupants.children().length).toBe(1);
                expect($occupants.children().first(0).text()).toBe("newnick");
            });

            it("informs users if they have been kicked out of the chat room", function () {
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
                test_utils.openAndEnterChatRoom('lounge', 'localhost', 'dummy');
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
                view.onChatRoomPresence(presence);
                expect(view.$('.chat-area').is(':visible')).toBeFalsy();
                expect(view.$('.occupants').is(':visible')).toBeFalsy();
                var $chat_body = view.$('.chatroom-body');
                expect($chat_body.html().trim().indexOf('<p>You have been kicked from this room</p><p>The reason given is: "Avaunt, you cullion!"</p>')).not.toBe(-1);
            }.bind(converse));

            it("can be saved to, and retrieved from, browserStorage", function () {
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
                var attrs = ['id', 'box_id', 'visible'];
                var new_attrs, old_attrs;
                for (var i=0; i<attrs.length; i++) {
                    new_attrs = _.pluck(_.pluck(newchatboxes.models, 'attributes'), attrs[i]);
                    old_attrs = _.pluck(_.pluck(this.chatboxes.models, 'attributes'), attrs[i]);
                    // FIXME: should have have to sort here? Order must
                    // probably be the same...
                    // This should be fixed once the controlbox always opens
                    // only on the right.
                    expect(_.isEqual(new_attrs.sort(), old_attrs.sort())).toEqual(true);
                }
                this.rosterview.render();
            }.bind(converse));

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
                    var trimmedview = trimmed_chatboxes.get(view.model.get('id'));
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


            it("can be closed again by clicking a DOM element with class 'close-chatbox-button'", function () {
                test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                var view = this.chatboxviews.get('lounge@localhost');
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
            }.bind(converse));
        }.bind(converse));


        describe("Each chat room can take special commands", function () {
            beforeEach(function () {
                runs(function () {
                    test_utils.closeAllChatBoxes();
                    test_utils.clearBrowserStorage();
                });
            });

            it("to clear messages", function () {
                test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                var view = converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'onMessageSubmitted').andCallThrough();
                spyOn(view, 'clearChatRoomMessages');
                view.$el.find('.chat-textarea').text('/clear');
                view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                expect(view.onMessageSubmitted).toHaveBeenCalled();
                expect(view.clearChatRoomMessages).toHaveBeenCalled();

            });

            it("to ban a user", function () {
                test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                var view = converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'onMessageSubmitted').andCallThrough();
                spyOn(view, 'setAffiliation').andCallThrough();
                spyOn(view, 'showStatusNotification').andCallThrough();
                spyOn(view, 'validateRoleChangeCommand').andCallThrough();
                view.$el.find('.chat-textarea').text('/ban');
                view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                expect(view.onMessageSubmitted).toHaveBeenCalled();
                expect(view.validateRoleChangeCommand).toHaveBeenCalled();
                expect(view.showStatusNotification).toHaveBeenCalledWith(
                    "Error: the \"ban\" command takes two arguments, the user's nickname and optionally a reason.",
                    true
                );
                expect(view.setAffiliation).not.toHaveBeenCalled();

                // Call now with the correct amount of arguments.
                // XXX: Calling onMessageSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                view.onMessageSubmitted('/ban jid This is the reason');
                expect(view.validateRoleChangeCommand.callCount).toBe(2);
                expect(view.showStatusNotification.callCount).toBe(1);
                expect(view.setAffiliation).toHaveBeenCalled();
            });

        }.bind(converse));

        describe("When attempting to enter a chatroom", function () {
            beforeEach(function () {
                var roomspanel = this.chatboxviews.get('controlbox').roomspanel;
                var $input = roomspanel.$el.find('input.new-chatroom-name');
                var $nick = roomspanel.$el.find('input.new-chatroom-nick');
                var $server = roomspanel.$el.find('input.new-chatroom-server');
                $input.val('problematic');
                $nick.val('dummy');
                $server.val('muc.localhost');
                roomspanel.$el.find('form').submit();
            }.bind(converse));

            afterEach(function () {
                var view = this.chatboxviews.get('problematic@muc.localhost');
                view.close();
            }.bind(converse));

            it("will show an error message if the room requires a password", function () {
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
                    view.onChatRoomPresence(presence);
                });
                waits(250);
                runs(function () {
                    var $chat_body = view.$el.find('.chatroom-body');
                    expect(view.renderPasswordForm).toHaveBeenCalled();
                    expect($chat_body.find('form.chatroom-form').length).toBe(1);
                    expect($chat_body.find('legend').text()).toBe('This chatroom requires a password');
                });
            }.bind(converse));

            it("will show an error message if the room is members-only and the user not included", function () {
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'auth'})
                    .c('registration-required').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body p:last').text()).toBe('You are not on the member list of this room');
            });

            it("will show an error message if the user has been banned", function () {
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'auth'})
                    .c('forbidden').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body p:last').text()).toBe('You have been banned from this room');
            });

            it("will render a nickname form if a nickname conflict happens and muc_nickname_from_jid=false", function () {
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body form.chatroom-form label:first').text()).toBe('Please choose your nickname');
            });

            it("will automatically choose a new nickname if a nickname conflict happens and muc_nickname_from_jid=true", function () {
                /*
                    <presence
                        from='coven@chat.shakespeare.lit/thirdwitch'
                        id='n13mt3l'
                        to='hag66@shakespeare.lit/pda'
                        type='error'>
                    <x xmlns='http://jabber.org/protocol/muc'/>
                    <error by='coven@chat.shakespeare.lit' type='cancel'>
                        <conflict xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                    </error>
                    </presence>
                */
                converse.muc_nickname_from_jid = true;

                var attrs = {
                    from:'lounge@localhost/dummy',
                    id:'n13mt3l',
                    to:'dummy@localhost/pda',
                    type:'error'
                };
                var presence = $pres().attrs(attrs)
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                        .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                var view = converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                spyOn(view, 'join').andCallThrough();

                // Simulate repeatedly that there's already someone in the room
                // with that nickname
                view.onChatRoomPresence(presence);
                expect(view.join).toHaveBeenCalledWith('dummy-2');

                attrs.from = 'lounge@localhost/dummy-2';
                presence = $pres().attrs(attrs)
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                        .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                view.onChatRoomPresence(presence);

                expect(view.join).toHaveBeenCalledWith('dummy-3');

                attrs.from = 'lounge@localhost/dummy-3';
                presence = $pres().attrs(attrs)
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                        .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                view.onChatRoomPresence(presence);
                expect(view.join).toHaveBeenCalledWith('dummy-4');
            });

            it("will show an error message if the user is not allowed to have created the room", function () {
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
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body p:last').text()).toBe('You are not allowed to create new rooms');
            }.bind(converse));

            it("will show an error message if the user's nickname doesn't conform to room policy", function () {
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('not-acceptable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body p:last').text()).toBe("Your nickname doesn't conform to this room's policies");
            });

            it("will show an error message if the room doesn't yet exist", function () {
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('item-not-found').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body p:last').text()).toBe("This room does not (yet) exist");
            });

            it("will show an error message if the room has reached its maximum number of occupants", function () {
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('service-unavailable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body p:last').text()).toBe("This room has reached its maximum number of occupants");
            });
        }.bind(converse));
    }.bind(converse, mock, test_utils));
}));
