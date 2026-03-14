/* global mock, converse */
const { u } = converse.env;

describe("The bookmarks pin list", function () {
    it("shows a list of pinned bookmarks", mock.initConverse(['connected', 'chatboxesFetched'], {}, async function (_converse) {
        const { api } = _converse;
        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilBookmarksReturned(_converse);
        await mock.openControlBox(_converse);

        const bookmarks_pin_list = document.querySelector('converse-bookmarks-pin');
        const main_list = document.querySelector('converse-rooms-list');

        let muc_jid = 'room@conference.shakespeare.lit';
        await api.bookmarks.set({
            jid: muc_jid,
            name: 'Romeo\'s room',
            autojoin: true,
            nick: 'romeo',
            extensions: ['<pinned xmlns="urn:xmpp:bookmarks-pinning:0"/>'],
        })
        await mock.waitForMUCDiscoInfo(_converse, muc_jid);

        await u.waitUntil(() => bookmarks_pin_list.querySelectorAll(".open-room").length);
        let room_els = bookmarks_pin_list.querySelectorAll(".open-room");
        expect(room_els.length).toBe(1);
        expect(main_list.querySelectorAll(".open-room").length).toBe(0);

        muc_jid = 'lounge@montague.lit';
        await api.bookmarks.set({
            jid: muc_jid,
            name: 'Lounge',
            autojoin: true,
            nick: 'romeo',
            extensions: ['<pinned xmlns="urn:xmpp:bookmarks-pinning:0"/>'],
        });
        await mock.waitForMUCDiscoInfo(_converse, muc_jid);

        await u.waitUntil(() => bookmarks_pin_list.querySelectorAll(".open-room").length > 1);
        room_els = bookmarks_pin_list.querySelectorAll(".open-room");
        expect(room_els.length).toBe(2);
        expect(main_list.querySelectorAll(".open-room").length).toBe(0);

        // Unpin a room
        bookmarks_pin_list.querySelector('.unpin-room').click();
        await u.waitUntil(() => bookmarks_pin_list.querySelectorAll(".open-room").length === 1);
        expect(bookmarks_pin_list.querySelectorAll(".open-room").length).toBe(1);
        expect(main_list.querySelectorAll(".open-room").length).toBe(1);

        // pin it again
        main_list.querySelector('.pin-room').click();
        await u.waitUntil(() => bookmarks_pin_list.querySelectorAll(".open-room").length === 2);
        expect(bookmarks_pin_list.querySelectorAll(".open-room").length).toBe(2);
        expect(main_list.querySelectorAll(".open-room").length).toBe(0);
    }));
});
