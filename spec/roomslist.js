(function (root, factory) {
    define(["jasmine", "mock", "converse-core", "converse-roomslist", "test-utils"], factory);
} (this, function (jasmine, mock, converse, roomslist, test_utils) {
    var _ = converse.env._;
    var $msg = converse.env.$msg;
    var Promise = converse.env.Promise;

    describe("The converse-roomslist plugin", function () {

        it("is shown under a list of open rooms in the \"Rooms\" panel", mock.initConverseWithPromises(
            null, ['rosterGroupsFetched'],
            { whitelisted_plugins: ['converse-roomslist'],
              allow_bookmarks: false // Makes testing easier, otherwise we
                                     // have to mock stanza traffic.
            },
            function (done, _converse) {
                test_utils.openControlBox().openRoomsPanel(_converse);
                var controlbox = _converse.chatboxviews.get('controlbox');

                var list = controlbox.el.querySelector('div.rooms-list-container');
                expect(_.includes(list.classList, 'hidden')).toBeTruthy();

                test_utils.openChatRoom(
                    _converse, 'room', 'conference.shakespeare.lit', 'JC');

                expect(_.isUndefined(_converse.rooms_list_view)).toBeFalsy();
                var room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
                expect(room_els.length).toBe(1);
                expect(room_els[0].innerText).toBe('room');

                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
                expect(room_els.length).toBe(2);

                var view = _converse.chatboxviews.get('room@conference.shakespeare.lit');
                view.close();
                room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
                expect(room_els.length).toBe(1);
                expect(room_els[0].innerText).toBe('lounge');
                list = controlbox.el.querySelector('div.rooms-list-container');
                expect(_.includes(list.classList, 'hidden')).toBeFalsy();

                view = _converse.chatboxviews.get('lounge@localhost');
                view.close();
                room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
                expect(room_els.length).toBe(0);

                list = controlbox.el.querySelector('div.rooms-list-container');
                expect(_.includes(list.classList, 'hidden')).toBeTruthy();
                done();
            }
        ));
    });

    describe("An room shown in the rooms list", function () {

        it("can be closed", mock.initConverseWithPromises(
            null, ['rosterGroupsFetched'],
            { whitelisted_plugins: ['converse-roomslist'],
              allow_bookmarks: false // Makes testing easier, otherwise we
                                     // have to mock stanza traffic.
            },
            function (done, _converse) {

            spyOn(window, 'confirm').and.callFake(function () {
                return true;
            });
            expect(_converse.chatboxes.length).toBe(1);
            test_utils.openChatRoom(
                _converse, 'lounge', 'conference.shakespeare.lit', 'JC');
            expect(_converse.chatboxes.length).toBe(2);
            test_utils.openControlBox().openRoomsPanel(_converse);
            var room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
            expect(room_els.length).toBe(1);
            var close_el = _converse.rooms_list_view.el.querySelector(".close-room");
            close_el.click();
            expect(window.confirm).toHaveBeenCalledWith(
                'Are you sure you want to leave the room "lounge"?');
            room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
            expect(room_els.length).toBe(0);
            expect(_converse.chatboxes.length).toBe(1);
            done();
        }));

        it("shows unread messages directed at the user", mock.initConverseWithAsync(
            { whitelisted_plugins: ['converse-roomslist'],
              allow_bookmarks: false // Makes testing easier, otherwise we
                                     // have to mock stanza traffic.
            }, function (done, _converse) {

            test_utils.waitUntil(function () {
                    return !_.isUndefined(_converse.rooms_list_view)
                }, 500)
            .then(function () {
                var room_jid = 'kitchen@conference.shakespeare.lit';
                test_utils.openAndEnterChatRoom(
                    _converse, 'kitchen', 'conference.shakespeare.lit', 'romeo').then(function () {

                    var view = _converse.chatboxviews.get(room_jid);
                    view.model.set({'minimized': true});
                    var contact_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@localhost';
                    var nick = mock.chatroom_names[0];
                    view.handleMUCMessage(
                        $msg({
                            from: room_jid+'/'+nick,
                            id: (new Date()).getTime(),
                            to: 'dummy@localhost',
                            type: 'groupchat'
                        }).c('body').t('foo').tree());

                    // If the user isn't mentioned, the counter doesn't get incremented, but the text of the room is bold
                    var room_el = _converse.rooms_list_view.el.querySelector(
                        ".available-chatroom"
                    );
                    expect(_.includes(room_el.classList, 'unread-msgs'));

                    // If the user is mentioned, the counter also gets updated
                    view.handleMUCMessage(
                        $msg({
                            from: room_jid+'/'+nick,
                            id: (new Date()).getTime(),
                            to: 'dummy@localhost',
                            type: 'groupchat'
                        }).c('body').t('romeo: Your attention is required').tree()
                    );
                    var indicator_el = _converse.rooms_list_view.el.querySelector(".msgs-indicator");
                    expect(indicator_el.textContent).toBe('1');

                    view.handleMUCMessage(
                        $msg({
                            from: room_jid+'/'+nick,
                            id: (new Date()).getTime(),
                            to: 'dummy@localhost',
                            type: 'groupchat'
                        }).c('body').t('romeo: and another thing...').tree()
                    );
                    indicator_el = _converse.rooms_list_view.el.querySelector(".msgs-indicator");
                    expect(indicator_el.textContent).toBe('2');

                    // When the chat gets maximized again, the unread indicators are removed
                    view.model.set({'minimized': false});
                    indicator_el = _converse.rooms_list_view.el.querySelector(".msgs-indicator");
                    expect(_.isNull(indicator_el));
                    room_el = _converse.rooms_list_view.el.querySelector(".available-chatroom");
                    expect(_.includes(room_el.classList, 'unread-msgs')).toBeFalsy();
                    done();
                });
            });
        }));
    });
}));
