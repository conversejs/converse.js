import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, sizzle, stx, u } = converse.env;

async function completeBookmarkOperation(_converse, start, selector) {
    const connection = _converse.api.connection.get();
    const stanza_count = connection.IQ_stanzas.length;
    const operation = start();
    const sent_stanza = await u.waitUntil(() =>
        connection.IQ_stanzas.slice(stanza_count).find((stanza) => sizzle(selector, stanza).length),
    );
    const result = stx`<iq xmlns="jabber:client"
        to="${connection.jid}"
        type="result"
        id="${sent_stanza.getAttribute('id')}"/>`;
    connection._dataRecv(mock.createRequest(_converse, result));
    await operation;
    return sent_stanza;
}

describe('The bookmarks pin list', function () {
    it(
        'shows a list of pinned bookmarks',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            await mock.openControlBox(_converse);

            const bookmarks_pin_list = document.querySelector('converse-pinned-bookmarks');
            const main_list = document.querySelector('converse-rooms-list');
            expect(bookmarks_pin_list.model.id).toBe('converse.bookmarks-pin-list-model-romeo@montague.lit');

            let muc_jid = 'room@conference.shakespeare.lit';
            await completeBookmarkOperation(
                _converse,
                () =>
                    api.bookmarks.set({
                        jid: muc_jid,
                        name: "Romeo's room",
                        autojoin: true,
                        nick: 'romeo',
                        extensions: [`<pinned xmlns="${Strophe.NS.BOOKMARKS_PINNING}"/>`],
                    }),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${muc_jid}"]`,
            );
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);

            await u.waitUntil(() => bookmarks_pin_list.querySelectorAll('.open-room').length);
            let room_els = bookmarks_pin_list.querySelectorAll('.open-room');
            expect(room_els.length).toBe(1);
            expect(main_list.querySelectorAll('.open-room').length).toBe(0);

            muc_jid = 'lounge@montague.lit';
            await completeBookmarkOperation(
                _converse,
                () =>
                    api.bookmarks.set({
                        jid: muc_jid,
                        name: 'Lounge',
                        autojoin: true,
                        nick: 'romeo',
                        extensions: [`<pinned xmlns="${Strophe.NS.BOOKMARKS_PINNING}"/>`],
                    }),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${muc_jid}"]`,
            );
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);

            await u.waitUntil(() => bookmarks_pin_list.querySelectorAll('.open-room').length > 1);
            room_els = bookmarks_pin_list.querySelectorAll('.open-room');
            expect(room_els.length).toBe(2);
            expect(main_list.querySelectorAll('.open-room').length).toBe(0);

            // Unpin a room
            const unpin_button = bookmarks_pin_list.querySelector('.unpin-room');
            const unpinned_jid = unpin_button.getAttribute('data-room-jid');
            await completeBookmarkOperation(
                _converse,
                () => unpin_button.click(),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${unpinned_jid}"]`,
            );
            await u.waitUntil(() => bookmarks_pin_list.querySelectorAll('.open-room').length === 1);
            expect(bookmarks_pin_list.querySelectorAll('.open-room').length).toBe(1);
            expect(main_list.querySelectorAll('.open-room').length).toBe(1);

            // pin it again
            await completeBookmarkOperation(
                _converse,
                () => main_list.querySelector('.pin-room').click(),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${unpinned_jid}"] extensions pinned`,
            );
            await u.waitUntil(() => bookmarks_pin_list.querySelectorAll('.open-room').length === 2);
            expect(bookmarks_pin_list.querySelectorAll('.open-room').length).toBe(2);
            expect(main_list.querySelectorAll('.open-room').length).toBe(0);
        }),
    );

    it(
        'shows a room opened manually after it was already a pinned bookmark',
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
            await completeBookmarkOperation(
                _converse,
                () =>
                    api.bookmarks.set({
                        jid: muc_jid,
                        name: 'Lounge',
                        autojoin: false,
                        nick: 'romeo',
                        extensions: [`<pinned xmlns="${Strophe.NS.BOOKMARKS_PINNING}"/>`],
                    }),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${muc_jid}"]`,
            );
            expect(bookmarks_pin_list.querySelectorAll('.open-room').length).toBe(0);

            // Open the room manually, *after* the bookmark already exists.
            api.rooms.open(muc_jid, { nick: 'romeo' });
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);

            // It must show up in the pinned list, not the regular rooms list.
            await u.waitUntil(() => bookmarks_pin_list.querySelectorAll('.open-room').length === 1);
            expect(bookmarks_pin_list.querySelectorAll('.open-room').length).toBe(1);
            expect(main_list.querySelectorAll('.open-room').length).toBe(0);
        }),
    );

    it(
        'bookmarks and pins a room that was not bookmarked yet',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            const { api, state } = _converse;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            await mock.openControlBox(_converse);

            const bookmarks_pin_list = document.querySelector('converse-pinned-bookmarks');
            const main_list = document.querySelector('converse-rooms-list');

            const muc_jid = 'lounge@montague.lit';
            // Open a room *without* bookmarking it.
            api.rooms.open(muc_jid, { nick: 'romeo' });
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);

            // It shows in the regular rooms list, not the pinned list, and has
            // no bookmark yet.
            await u.waitUntil(() => main_list.querySelectorAll('.open-room').length === 1);
            expect(bookmarks_pin_list.querySelectorAll('.open-room').length).toBe(0);
            expect(state.bookmarks.get(muc_jid)).toBeUndefined();

            const get_bookmarks = spyOn(main_list, 'getBookmarks').mockReturnValue(undefined);
            main_list.requestUpdate();
            await main_list.updateComplete;
            expect(main_list.querySelector('.pin-room')).toBeNull();
            get_bookmarks.mockRestore();
            main_list.requestUpdate();
            await main_list.updateComplete;

            // Pinning it should bookmark it first, then pin it.
            await completeBookmarkOperation(
                _converse,
                () => main_list.querySelector('.pin-room').click(),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${muc_jid}"] extensions pinned`,
            );

            await u.waitUntil(() => bookmarks_pin_list.querySelectorAll('.open-room').length === 1);
            expect(bookmarks_pin_list.querySelectorAll('.open-room').length).toBe(1);
            expect(main_list.querySelectorAll('.open-room').length).toBe(0);

            const bookmark = state.bookmarks.get(muc_jid);
            expect(bookmark).toBeTruthy();
            expect(bookmark.get('pinned')).toBe(true);
            expect(bookmark.get('autojoin')).toBe(true);
        }),
    );

    it(
        'keeps a pinned room in the pinned list when a retained room is reopened',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            const { api, state } = _converse;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            await mock.openControlBox(_converse);

            const bookmarks_pin_list = document.querySelector('converse-pinned-bookmarks');
            const main_list = document.querySelector('converse-rooms-list');
            const muc_jid = 'lounge@montague.lit';

            await completeBookmarkOperation(
                _converse,
                () =>
                    api.bookmarks.set({
                        jid: muc_jid,
                        name: 'Lounge',
                        autojoin: true,
                        nick: 'romeo',
                        extensions: [`<pinned xmlns="${Strophe.NS.BOOKMARKS_PINNING}"/>`],
                    }),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${muc_jid}"]`,
            );
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);
            await u.waitUntil(() => bookmarks_pin_list.querySelectorAll('.open-room').length === 1);

            const room = state.chatboxes.get(muc_jid);
            room.set('closed', true);
            await u.waitUntil(() => bookmarks_pin_list.querySelectorAll('.open-room').length === 0);

            room.set('closed', false);
            await u.waitUntil(
                () =>
                    bookmarks_pin_list.querySelectorAll('.open-room').length +
                        main_list.querySelectorAll('.open-room').length ===
                    1,
            );
            expect(bookmarks_pin_list.querySelectorAll('.open-room').length).toBe(1);
            expect(main_list.querySelectorAll('.open-room').length).toBe(0);
        }),
    );

    it(
        'does not offer pinning when the server only supports legacy bookmarks',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            const { api, state } = _converse;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(
                _converse,
                [],
                [
                    'http://jabber.org/protocol/pubsub#publish-options',
                    'http://jabber.org/protocol/pubsub#config-node-max',
                ],
                'storage:bookmarks',
            );
            await mock.openControlBox(_converse);

            const muc_jid = 'lounge@montague.lit';
            api.rooms.open(muc_jid, { nick: 'romeo' });
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);

            const main_list = document.querySelector('converse-rooms-list');
            await u.waitUntil(() => main_list.querySelectorAll('.open-room').length === 1);
            expect(main_list.querySelector('.pin-room')).toBeNull();
            await expect(state.bookmarks.pinRoom(muc_jid)).rejects.toThrow('Pinning requires native bookmarks');
            expect(state.bookmarks.get(muc_jid)).toBeUndefined();
        }),
    );
});
