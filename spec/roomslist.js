(function (root, factory) {
    define(["mock", "converse-core", "converse-roomslist", "test-utils"], factory);
} (this, function (mock, converse, roomslist, test_utils) {
    var _ = converse.env._;

    describe("The converse-roomslist plugin", function () {

        it("is shown under a list of open rooms in the \"Rooms\" panel", mock.initConverse(
            { whitelisted_plugins: ['converse-roomslist'],
              allow_bookmarks: false // Makes testing easier, otherwise we
                                     // have to mock stanza traffic.
            },
            function (_converse) {
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
            }
        ));
    });

    describe("An open room shown in the rooms list", function () {

        it("can be closed", mock.initConverse(
            { whitelisted_plugins: ['converse-roomslist'],
              allow_bookmarks: false // Makes testing easier, otherwise we
                                     // have to mock stanza traffic.
            },
            function (_converse) {
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
                    'Are you sure you want to leave the room ""?');
                room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
                expect(room_els.length).toBe(0);
                expect(_converse.chatboxes.length).toBe(1);
            }
        ));
    });
}));
