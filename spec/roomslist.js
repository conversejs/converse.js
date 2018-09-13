(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    var _ = converse.env._;
    var $msg = converse.env.$msg;
    var $iq = converse.env.$iq;
    var $pres = converse.env.$pres;
    var Promise = converse.env.Promise;
    var Strophe = converse.env.Strophe;
    var u = converse.env.utils;

    describe("A list of open rooms", function () {

        it("is shown in the \"Rooms\" panel", mock.initConverseWithPromises(
            null, ['rosterGroupsFetched', 'chatBoxesFetched'],
            { allow_bookmarks: false // Makes testing easier, otherwise we
                                     // have to mock stanza traffic.
            },
            function (done, _converse) {
                test_utils.openControlBox();
                const controlbox = _converse.chatboxviews.get('controlbox');
                let list = controlbox.el.querySelector('div.rooms-list-container');
                expect(_.includes(list.classList, 'hidden')).toBeTruthy();

                let room_els;

                test_utils.openChatRoom(_converse, 'room', 'conference.shakespeare.lit', 'JC')
                .then(() => {
                    expect(_.isUndefined(_converse.rooms_list_view)).toBeFalsy();
                    room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
                    expect(room_els.length).toBe(1);
                    expect(room_els[0].innerText).toBe('room@conference.shakespeare.lit');
                    return test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                }).then(() => {
                    room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
                    expect(room_els.length).toBe(2);

                    var view = _converse.chatboxviews.get('room@conference.shakespeare.lit');
                    view.close();
                    room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
                    expect(room_els.length).toBe(1);
                    expect(room_els[0].innerText).toBe('lounge@localhost');
                    list = controlbox.el.querySelector('div.rooms-list-container');
                    expect(_.includes(list.classList, 'hidden')).toBeFalsy();

                    view = _converse.chatboxviews.get('lounge@localhost');
                    view.close();
                    room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
                    expect(room_els.length).toBe(0);

                    list = controlbox.el.querySelector('div.rooms-list-container');
                    expect(_.includes(list.classList, 'hidden')).toBeTruthy();
                    done();
                }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
            }
        ));
    });

    describe("A groupchat shown in the groupchats list", function () {

        it("is highlighted if its currently open", mock.initConverseWithPromises(
            null, ['rosterGroupsFetched', 'chatBoxesFetched'],
            { whitelisted_plugins: ['converse-roomslist'],
              allow_bookmarks: false // Makes testing easier, otherwise we
                                     // have to mock stanza traffic.
            }, function (done, _converse) {

            spyOn(_converse, 'isSingleton').and.callFake(() => true);

            let room_els, item;
            test_utils.openControlBox();
            _converse.api.rooms.open('coven@chat.shakespeare.lit', {'nick': 'some1'})
            .then(() => {
                room_els = _converse.rooms_list_view.el.querySelectorAll(".available-chatroom");
                expect(room_els.length).toBe(1);

                item = room_els[0];
                expect(u.hasClass('open', item)).toBe(true);
                expect(item.textContent.trim()).toBe('coven@chat.shakespeare.lit');
                return _converse.api.rooms.open('balcony@chat.shakespeare.lit', {'nick': 'some1'});
            }).then(() => {
                room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
                expect(room_els.length).toBe(2);

                room_els = _converse.rooms_list_view.el.querySelectorAll(".available-chatroom.open");
                expect(room_els.length).toBe(1);
                item = room_els[0];
                expect(item.textContent.trim()).toBe('balcony@chat.shakespeare.lit');
                done();
            }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
        }));

        it("has an info icon which opens a details modal when clicked", mock.initConverseWithPromises(
            null, ['rosterGroupsFetched', 'chatBoxesFetched'],
            { whitelisted_plugins: ['converse-roomslist'],
              allow_bookmarks: false // Makes testing easier, otherwise we
                                     // have to mock stanza traffic.
            }, function (done, _converse) {

            let view;
            const IQ_stanzas = _converse.connection.IQ_stanzas;
            const room_jid = 'coven@chat.shakespeare.lit';
            test_utils.openControlBox();
            _converse.api.rooms.open(room_jid, {'nick': 'some1'})
            .then(() => {
                return test_utils.waitUntil(() => _.get(_.filter(
                    IQ_stanzas,
                    iq => iq.nodeTree.querySelector(
                        `iq[to="${room_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                    )).pop(), 'nodeTree'));
            }).then(last_stanza => {
                view = _converse.chatboxviews.get(room_jid);
                const IQ_id = last_stanza.getAttribute('id');
                const features_stanza = $iq({
                        'from': 'coven@chat.shakespeare.lit',
                        'id': IQ_id,
                        'to': 'dummy@localhost/desktop',
                        'type': 'result'
                    })
                    .c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                        .c('identity', {
                            'category': 'conference',
                            'name': 'A Dark Cave',
                            'type': 'text'
                        }).up()
                        .c('feature', {'var': 'http://jabber.org/protocol/muc'}).up()
                        .c('feature', {'var': 'muc_passwordprotected'}).up()
                        .c('feature', {'var': 'muc_hidden'}).up()
                        .c('feature', {'var': 'muc_temporary'}).up()
                        .c('feature', {'var': 'muc_open'}).up()
                        .c('feature', {'var': 'muc_unmoderated'}).up()
                        .c('feature', {'var': 'muc_nonanonymous'}).up()
                        .c('feature', {'var': 'urn:xmpp:mam:0'}).up()
                        .c('x', { 'xmlns':'jabber:x:data', 'type':'result'})
                            .c('field', {'var':'FORM_TYPE', 'type':'hidden'})
                                .c('value').t('http://jabber.org/protocol/muc#roominfo').up().up()
                            .c('field', {'type':'text-single', 'var':'muc#roominfo_description', 'label':'Description'})
                                .c('value').t('This is the description').up().up()
                            .c('field', {'type':'text-single', 'var':'muc#roominfo_occupants', 'label':'Number of occupants'})
                                .c('value').t(0);
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));
                return test_utils.waitUntil(() => view.model.get('connection_status') === converse.ROOMSTATUS.CONNECTING)
            }).then(function () {
                var presence = $pres({
                        to: _converse.connection.jid,
                        from: 'coven@chat.shakespeare.lit/some1',
                        id: 'DC352437-C019-40EC-B590-AF29E879AF97'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'member',
                        jid: _converse.bare_jid,
                        role: 'participant'
                    }).up()
                    .c('status').attrs({code:'110'});
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                const room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
                expect(room_els.length).toBe(1);
                const info_el = _converse.rooms_list_view.el.querySelector(".room-info");
                info_el.click();

                const modal = view.model.room_details_modal;
                return test_utils.waitUntil(() => u.isVisible(modal.el), 2000);
            }).then(() => {
                const modal = view.model.room_details_modal;
                let els = modal.el.querySelectorAll('p.room-info');
                expect(els[0].textContent).toBe("Name: A Dark Cave")
                expect(els[1].textContent).toBe("Groupchat address (JID): coven@chat.shakespeare.lit")
                expect(els[2].textContent).toBe("Description: This is the description")
                expect(els[3].textContent).toBe("Online users: 1")
                const features_list = modal.el.querySelector('.features-list');
                expect(features_list.textContent.replace(/(\n|\s{2,})/g, '')).toBe(
                    'Password protected - This groupchat requires a password before entry'+
                    'Hidden - This groupchat is not publicly searchable'+
                    'Open - Anyone can join this groupchat'+
                    'Temporary - This groupchat will disappear once the last person leaves'+
                    'Not anonymous - All other groupchat participants can see your XMPP username'+
                    'Not moderated - This groupchat is not being moderated'
                );
                const presence = $pres({
                        to: 'dummy@localhost/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/newguy'
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'newguy@localhost/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                els = modal.el.querySelectorAll('p.room-info');
                expect(els[3].textContent).toBe("Online users: 2")

                view.model.set({'subject': {'author': 'someone', 'text': 'Hatching dark plots'}});
                els = modal.el.querySelectorAll('p.room-info');
                expect(els[0].textContent).toBe("Name: A Dark Cave")
                expect(els[1].textContent).toBe("Groupchat address (JID): coven@chat.shakespeare.lit")
                expect(els[2].textContent).toBe("Description: This is the description")
                expect(els[3].textContent).toBe("Topic: Hatching dark plots")
                expect(els[4].textContent).toBe("Topic author: someone")
                expect(els[5].textContent).toBe("Online users: 2")
                done();
            }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
        }));

        it("can be closed", mock.initConverseWithPromises(
            null, ['rosterGroupsFetched'],
            { whitelisted_plugins: ['converse-roomslist'],
              allow_bookmarks: false // Makes testing easier, otherwise we
                                     // have to mock stanza traffic.
            },
            function (done, _converse) {

            spyOn(window, 'confirm').and.callFake(() => true);
            expect(_converse.chatboxes.length).toBe(1);
            test_utils.openChatRoom(_converse, 'lounge', 'conference.shakespeare.lit', 'JC')
            .then(() => {
                expect(_converse.chatboxes.length).toBe(2);
                var room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
                expect(room_els.length).toBe(1);
                var close_el = _converse.rooms_list_view.el.querySelector(".close-room");
                close_el.click();
                expect(window.confirm).toHaveBeenCalledWith(
                    'Are you sure you want to leave the groupchat lounge@conference.shakespeare.lit?');
                room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
                expect(room_els.length).toBe(0);
                expect(_converse.chatboxes.length).toBe(1);
                done();
            });
        }));

        it("shows unread messages directed at the user", mock.initConverseWithAsync(
                { whitelisted_plugins: ['converse-roomslist'],
                  allow_bookmarks: false // Makes testing easier, otherwise we
                                         // have to mock stanza traffic.
                }, function (done, _converse) {

            let view, nick;
            const room_jid = 'kitchen@conference.shakespeare.lit';

            test_utils.waitUntil(() => !_.isUndefined(_converse.rooms_list_view), 500)
            .then(() => test_utils.openAndEnterChatRoom(_converse, 'kitchen', 'conference.shakespeare.lit', 'romeo'))
            .then(() => {
                view = _converse.chatboxviews.get(room_jid);
                view.model.set({'minimized': true});
                const contact_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@localhost';
                nick = mock.chatroom_names[0];
                view.model.onMessage(
                    $msg({
                        from: room_jid+'/'+nick,
                        id: (new Date()).getTime(),
                        to: 'dummy@localhost',
                        type: 'groupchat'
                    }).c('body').t('foo').tree());

                // If the user isn't mentioned, the counter doesn't get incremented, but the text of the groupchat is bold
                var room_el = _converse.rooms_list_view.el.querySelector(
                    ".available-chatroom"
                );
                expect(_.includes(room_el.classList, 'unread-msgs'));

                // If the user is mentioned, the counter also gets updated
                view.model.onMessage(
                    $msg({
                        from: room_jid+'/'+nick,
                        id: (new Date()).getTime(),
                        to: 'dummy@localhost',
                        type: 'groupchat'
                    }).c('body').t('romeo: Your attention is required').tree()
                );
                return test_utils.waitUntil(() => _converse.rooms_list_view.el.querySelectorAll(".msgs-indicator").length);
            }).then(() => {
                spyOn(view.model, 'incrementUnreadMsgCounter').and.callThrough();
                const indicator_el = _converse.rooms_list_view.el.querySelector(".msgs-indicator");
                expect(indicator_el.textContent).toBe('1');
                view.model.onMessage(
                    $msg({
                        from: room_jid+'/'+nick,
                        id: (new Date()).getTime(),
                        to: 'dummy@localhost',
                        type: 'groupchat'
                    }).c('body').t('romeo: and another thing...').tree()
                );
                return test_utils.waitUntil(() => view.model.incrementUnreadMsgCounter.calls.count());
            }).then(() => {
                let indicator_el = _converse.rooms_list_view.el.querySelector(".msgs-indicator");
                expect(indicator_el.textContent).toBe('2');

                // When the chat gets maximized again, the unread indicators are removed
                view.model.set({'minimized': false});
                indicator_el = _converse.rooms_list_view.el.querySelector(".msgs-indicator");
                expect(_.isNull(indicator_el));
                const room_el = _converse.rooms_list_view.el.querySelector(".available-chatroom");
                expect(_.includes(room_el.classList, 'unread-msgs')).toBeFalsy();
                done();
            }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
        }));
    });
}));
