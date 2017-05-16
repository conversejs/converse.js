(function (root, factory) {
    define(["mock", "converse-core", "converse-roomslist", "test-utils"], factory);
} (this, function (mock, converse, roomslist, test_utils) {
    var _ = converse.env._;

    describe("The converse-roomslist plugin", function () {

        it("shows a list of open rooms in the \"Rooms\" panel", mock.initConverse(
            { whitelisted_plugins: ['converse-roomslist'],
              allow_bookmarks: false // Makes testing easier, otherwise we
                                     // have to mock stanza traffic.
            },
            function (_converse) {
                test_utils.openChatRoom(
                    _converse, 'theplay', 'conference.shakespeare.lit', 'JC');

                expect(_.isUndefined(_converse.rooms_list_view)).toBeFalsy();
                var room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
                expect(room_els.length).toBe(1);

                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
                expect(room_els.length).toBe(2);
            }
        ));
    });
}));
