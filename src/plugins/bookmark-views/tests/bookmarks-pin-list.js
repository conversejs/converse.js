import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, u } = converse.env;

describe("The bookmarks pin list", function () {
    it("shows a list of pinned bookmarks", mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
        const { api } = _converse;
        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilBookmarksReturned(_converse);
        await mock.openControlBox(_converse);

        const bookmarks_pin_list = document.querySelector('converse-pinned-bookmarks');
        const main_list = document.querySelector('converse-rooms-list');

        let muc_jid = 'room@conference.shakespeare.lit';
        await api.bookmarks.set({
            jid: muc_jid,
            name: 'Romeo\'s room',
            autojoin: true,
            nick: 'romeo',
            extensions: [`<pinned xmlns="${Strophe.NS.BOOKMARKS_PINNING}"/>`],
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
            extensions: [`<pinned xmlns="${Strophe.NS.BOOKMARKS_PINNING}"/>`],
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

    it("shows a room opened manually after it was already a pinned bookmark",
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            await mock.openControlBox(_converse);

            const bookmarks_pin_list = document.querySelector('converse-pinned-bookmarks');
            const main_list = document.querySelector('converse-rooms-list');

            const muc_jid = 'lounge@montague.lit';
            // A pinned bookmark that is NOT auto-joined: no room is open yet,
            // so nothing should appear in either list.
            await api.bookmarks.set({
                jid: muc_jid,
                name: 'Lounge',
                autojoin: false,
                nick: 'romeo',
                extensions: [`<pinned xmlns="${Strophe.NS.BOOKMARKS_PINNING}"/>`],
            });
            expect(bookmarks_pin_list.querySelectorAll(".open-room").length).toBe(0);

            // Open the room manually, *after* the bookmark already exists.
            api.rooms.open(muc_jid, { nick: 'romeo' });
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);

            // It must show up in the pinned list, not the regular rooms list.
            await u.waitUntil(() => bookmarks_pin_list.querySelectorAll(".open-room").length === 1);
            expect(bookmarks_pin_list.querySelectorAll(".open-room").length).toBe(1);
            expect(main_list.querySelectorAll(".open-room").length).toBe(0);
        }));
});
