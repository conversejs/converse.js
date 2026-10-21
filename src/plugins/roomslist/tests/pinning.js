import { vi } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, sizzle, stx, u } = converse.env;

/**
 * Starts a bookmark operation, answers the bookmark publish it sends and
 * waits for the operation to complete.
 * @param {boolean} [succeed=true] - Whether the server accepts the publish
 */
async function completeBookmarkOperation(_converse, start, selector, succeed = true) {
    const connection = _converse.api.connection.get();
    const stanza_count = connection.IQ_stanzas.length;
    const operation = start();
    const sent_stanza = await u.waitUntil(() =>
        connection.IQ_stanzas.slice(stanza_count).find((stanza) => sizzle(selector, stanza).length),
    );
    const id = sent_stanza.getAttribute('id');
    const response = succeed
        ? stx`<iq xmlns="jabber:client" to="${connection.jid}" type="result" id="${id}"/>`
        : stx`<iq xmlns="jabber:client" to="${connection.jid}" type="error" id="${id}">
              <error type="cancel"><not-allowed xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error>
          </iq>`;
    connection._dataRecv(mock.createRequest(_converse, response));
    await operation;
    return sent_stanza;
}

/**
 * The bookmark attributes that pinning must leave alone.
 * @param {import('@converse/headless').Bookmark} bookmark
 */
function getRoomSettings(bookmark) {
    const { name, nick, password, autojoin } = bookmark.attributes;
    return { name, nick, password, autojoin };
}

/** Bookmarks, pins and (via autojoin) opens a groupchat. */
async function openPinnedRoom(_converse, muc_jid, name) {
    await completeBookmarkOperation(
        _converse,
        () =>
            _converse.api.bookmarks.set({
                jid: muc_jid,
                name,
                autojoin: true,
                nick: 'romeo',
                extensions: [`<pinned xmlns="${Strophe.NS.BOOKMARKS_PINNING}"/>`],
            }),
        `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${muc_jid}"]`,
    );
    await mock.waitForMUCDiscoInfo(_converse, muc_jid);
}

/** Opens a groupchat without bookmarking or pinning it. */
async function openRoom(_converse, muc_jid) {
    _converse.api.rooms.open(muc_jid, { nick: 'romeo' });
    await mock.waitForMUCDiscoInfo(_converse, muc_jid);
}

/** @param {Element} list */
function getRoomJIDs(list) {
    return Array.from(list.querySelectorAll('.open-room')).map((el) => el.getAttribute('data-room-jid'));
}

/** @param {Element} list */
function getPinnedLabels(list) {
    return Array.from(list.querySelectorAll('.rooms-list-subheading')).filter(
        (el) => el.textContent.trim() === 'Pinned',
    );
}

/** @param {Element} list */
function getRoomJIDsUnderPinnedLabel(list) {
    const label = getPinnedLabels(list)[0];
    const group = list.querySelector(`ul[aria-labelledby="${label.id}"]`);
    return getRoomJIDs(group);
}

/**
 * Returns the room's action, found by its role and accessible name.
 * @param {Element} list
 * @param {string} muc_jid
 * @param {string} name
 */
function getRoomAction(list, muc_jid, name) {
    const row = list.querySelector(`.available-chatroom[data-room-jid="${muc_jid}"]`);
    return page.elementLocator(row).getByRole('button', { name, exact: true, includeHidden: true }).query();
}

function getGroupchatHeadings() {
    return Array.from(document.querySelectorAll('#controlbox .controlbox-heading')).filter((el) =>
        (/groupchats/i).test(el.textContent),
    );
}

describe('Pinned groupchats in the list of open groupchats', function () {
    it(
        'are shown first under the same Groupchats heading, with a Pinned label',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            await mock.openControlBox(_converse);
            const list = document.querySelector('converse-rooms-list');

            await openRoom(_converse, 'aardvark@montague.lit');
            await openPinnedRoom(_converse, 'zebra@montague.lit', 'Zebra');
            await openPinnedRoom(_converse, 'lounge@montague.lit', 'Lounge');

            await u.waitUntil(() => getPinnedLabels(list).length === 1);
            await u.waitUntil(() => getRoomJIDs(list).length === 3);

            expect(getGroupchatHeadings().length).toBe(1);
            expect(getGroupchatHeadings()[0].textContent.trim()).toBe('Groupchats');
            expect(getPinnedLabels(list).length).toBe(1);

            // Pinned rooms come first (sorted by name), then the other rooms,
            // and every room appears exactly once.
            expect(getRoomJIDs(list)).toEqual(['lounge@montague.lit', 'zebra@montague.lit', 'aardvark@montague.lit']);
            expect(getRoomJIDsUnderPinnedLabel(list)).toEqual(['lounge@montague.lit', 'zebra@montague.lit']);

            // The groupchat-level controls stay with the single heading.
            expect(document.querySelectorAll('#controlbox .show-add-muc-modal').length).toBe(1);
            expect(list.querySelector('.show-add-muc-modal')).not.toBeNull();
            expect(list.querySelector('.show-list-muc-modal')).not.toBeNull();
            expect(list.querySelector('.show-bookmark-list-modal')).not.toBeNull();
        }),
    );

    it(
        'are not labelled when no groupchat is pinned',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            await mock.openControlBox(_converse);
            const list = document.querySelector('converse-rooms-list');

            await openRoom(_converse, 'lounge@montague.lit');
            await openRoom(_converse, 'kitchen@montague.lit');
            await u.waitUntil(() => getRoomJIDs(list).length === 2);

            expect(getGroupchatHeadings().length).toBe(1);
            expect(getPinnedLabels(list).length).toBe(0);
            expect(getRoomJIDs(list)).toEqual(['kitchen@montague.lit', 'lounge@montague.lit']);
            // Pinning is available, so the absent label isn't due to gating.
            expect(list.querySelectorAll('.pin-room').length).toBe(2);
        }),
    );

    it(
        'are shown without a label or an empty second section when all groupchats are pinned',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            await mock.openControlBox(_converse);
            const list = document.querySelector('converse-rooms-list');

            await openPinnedRoom(_converse, 'zebra@montague.lit', 'Zebra');
            await openPinnedRoom(_converse, 'lounge@montague.lit', 'Lounge');
            await u.waitUntil(() => getRoomJIDs(list).length === 2);

            expect(getGroupchatHeadings().length).toBe(1);
            expect(document.querySelectorAll('#controlbox .list-container--openrooms').length).toBe(1);
            expect(getPinnedLabels(list).length).toBe(0);
            expect(getRoomJIDs(list)).toEqual(['lounge@montague.lit', 'zebra@montague.lit']);
            expect(list.querySelectorAll('.unpin-room').length).toBe(2);
        }),
    );

    it(
        'are shown before the domain groups when groupchats are grouped by domain',
        mock.initConverse(
            converse,
            ['connected', 'chatBoxesFetched'],
            { muc_grouped_by_domain: true },
            async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);
                await mock.waitUntilBookmarksReturned(_converse);
                await mock.openControlBox(_converse);
                const list = document.querySelector('converse-rooms-list');

                await openRoom(_converse, 'aardvark@conference.shakespeare.lit');
                await openRoom(_converse, 'kitchen@montague.lit');
                await openPinnedRoom(_converse, 'lounge@montague.lit', 'Lounge');
                await u.waitUntil(() => getRoomJIDs(list).length === 3 && getPinnedLabels(list).length === 1);

                expect(getRoomJIDs(list)).toEqual([
                    'lounge@montague.lit',
                    'aardvark@conference.shakespeare.lit',
                    'kitchen@montague.lit',
                ]);
                expect(getRoomJIDsUnderPinnedLabel(list)).toEqual(['lounge@montague.lit']);
                const groups = Array.from(list.querySelectorAll('.muc-domain-group'));
                expect(groups.map((g) => g.getAttribute('data-domain'))).toEqual([
                    'conference.shakespeare.lit',
                    'montague.lit',
                ]);
                expect(groups.flatMap((g) => getRoomJIDs(g))).not.toContain('lounge@montague.lit');
            },
        ),
    );

    it(
        'move between the pinned and unpinned rooms when pinned and unpinned',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            await mock.openControlBox(_converse);
            const list = document.querySelector('converse-rooms-list');

            await openRoom(_converse, 'aardvark@montague.lit');
            await openPinnedRoom(_converse, 'room@conference.shakespeare.lit', "Romeo's room");
            await openPinnedRoom(_converse, 'lounge@montague.lit', 'Lounge');
            await u.waitUntil(() => getRoomJIDs(list).length === 3);
            expect(getRoomJIDsUnderPinnedLabel(list)).toEqual([
                'lounge@montague.lit',
                'room@conference.shakespeare.lit',
            ]);

            const { bookmarks, chatboxes } = _converse.state;
            const bookmark = bookmarks.get('lounge@montague.lit');
            const settings = getRoomSettings(bookmark);

            const unpin_button = list.querySelector('.unpin-room[data-room-jid="lounge@montague.lit"]');
            await completeBookmarkOperation(
                _converse,
                () => unpin_button.click(),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="lounge@montague.lit"]`,
            );
            await u.waitUntil(() => getRoomJIDsUnderPinnedLabel(list).length === 1);
            expect(getRoomJIDs(list)).toEqual([
                'room@conference.shakespeare.lit',
                'aardvark@montague.lit',
                'lounge@montague.lit',
            ]);

            // Unpinning changes only the order: the room stays open and keeps
            // its bookmark and settings.
            expect(chatboxes.get('lounge@montague.lit').get('closed')).toBeFalsy();
            expect(bookmarks.get('lounge@montague.lit')).toBe(bookmark);
            expect(getRoomSettings(bookmark)).toEqual(settings);

            await completeBookmarkOperation(
                _converse,
                () => list.querySelector('.pin-room[data-room-jid="lounge@montague.lit"]').click(),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="lounge@montague.lit"] extensions pinned`,
            );
            await u.waitUntil(() => getRoomJIDsUnderPinnedLabel(list).length === 2);
            expect(getRoomJIDs(list)).toEqual([
                'lounge@montague.lit',
                'room@conference.shakespeare.lit',
                'aardvark@montague.lit',
            ]);
            expect(getRoomSettings(bookmark)).toEqual(settings);
        }),
    );

    it(
        'keep their pinned position after being left and opened again',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            const { api, state } = _converse;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            await mock.openControlBox(_converse);
            const list = document.querySelector('converse-rooms-list');

            await openRoom(_converse, 'aardvark@montague.lit');
            const muc_jid = 'lounge@montague.lit';
            await openPinnedRoom(_converse, muc_jid, 'Lounge');
            await u.waitUntil(() => getPinnedLabels(list).length === 1);

            // Leave the room from its menu.
            vi.spyOn(api, 'confirm').mockResolvedValue(true);
            await completeBookmarkOperation(
                _converse,
                () => list.querySelector(`.close-room[data-room-jid="${muc_jid}"]`).click(),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${muc_jid}"] conference[autojoin="false"]`,
            );
            await u.waitUntil(() => getRoomJIDs(list).length === 1);
            expect(getRoomJIDs(list)).toEqual(['aardvark@montague.lit']);
            expect(getPinnedLabels(list).length).toBe(0);

            // Leaving turns off autojoin, but the pin is kept for next time.
            const bookmark = state.bookmarks.get(muc_jid);
            expect(bookmark.get('autojoin')).toBe(false);
            expect(bookmark.get('pinned')).toBe(true);

            // Forget the first visit's disco query, so that the mock answers
            // the one sent when the room is opened again.
            const sent_IQs = api.connection.get().IQ_stanzas;
            while (sent_IQs.length) sent_IQs.pop();

            await openRoom(_converse, muc_jid);
            await u.waitUntil(() => getRoomJIDs(list).length === 2);
            expect(getRoomJIDs(list)).toEqual([muc_jid, 'aardvark@montague.lit']);
            expect(getRoomJIDsUnderPinnedLabel(list)).toEqual([muc_jid]);
        }),
    );

    it(
        'are restored when they are joined automatically at login',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            const pinned = `<pinned xmlns="${Strophe.NS.BOOKMARKS_PINNING}"/>`;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse, [
                { jid: 'lounge@montague.lit', name: 'Lounge', nick: 'romeo', autojoin: true, extensions: [pinned] },
                { jid: 'aardvark@montague.lit', name: 'Aardvark', nick: 'romeo', autojoin: true },
                // A pinned room that was left: it isn't joined, so it isn't shown.
                { jid: 'kitchen@montague.lit', name: 'Kitchen', nick: 'romeo', autojoin: false, extensions: [pinned] },
            ]);
            await mock.waitForMUCDiscoInfo(_converse, 'lounge@montague.lit');
            await mock.waitForMUCDiscoInfo(_converse, 'aardvark@montague.lit');
            await mock.openControlBox(_converse);
            const list = document.querySelector('converse-rooms-list');

            await u.waitUntil(() => getRoomJIDs(list).length === 2 && getPinnedLabels(list).length === 1);
            expect(getRoomJIDs(list)).toEqual(['lounge@montague.lit', 'aardvark@montague.lit']);
            expect(getRoomJIDsUnderPinnedLabel(list)).toEqual(['lounge@montague.lit']);
            expect(_converse.state.bookmarks.get('kitchen@montague.lit').get('pinned')).toBe(true);
        }),
    );

    it(
        'stay pinned after a reconnection',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            await mock.openControlBox(_converse);
            const list = document.querySelector('converse-rooms-list');

            await openRoom(_converse, 'aardvark@montague.lit');
            await openPinnedRoom(_converse, 'lounge@montague.lit', 'Lounge');
            await u.waitUntil(() => getPinnedLabels(list).length === 1);

            await _converse.api.connection.reconnect();
            await mock.waitForMUCDiscoInfo(_converse, 'lounge@montague.lit');
            await mock.waitForMUCDiscoInfo(_converse, 'aardvark@montague.lit');

            await u.waitUntil(() => getRoomJIDs(list).length === 2 && getPinnedLabels(list).length === 1);
            expect(getRoomJIDs(list)).toEqual(['lounge@montague.lit', 'aardvark@montague.lit']);
            expect(getRoomJIDsUnderPinnedLabel(list)).toEqual(['lounge@montague.lit']);
        }),
    );

    it(
        'stay where they were when the server refuses a pin',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            await mock.openControlBox(_converse);
            const list = document.querySelector('converse-rooms-list');

            const muc_jid = 'lounge@montague.lit';
            await openRoom(_converse, 'aardvark@montague.lit');
            await openRoom(_converse, muc_jid);
            await u.waitUntil(() => getRoomJIDs(list).length === 2);

            // The click handler handles the rejected operation, so this must
            // not surface as an unhandled rejection.
            await completeBookmarkOperation(
                _converse,
                () => list.querySelector(`.pin-room[data-room-jid="${muc_jid}"]`).click(),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${muc_jid}"] extensions pinned`,
                false,
            );
            await u.waitUntil(() => !_converse.state.bookmarks.get(muc_jid));
            await list.updateComplete;

            // The room isn't shown as pinned, since the server doesn't have
            // the pin, and it stays open.
            expect(getRoomJIDs(list)).toEqual(['aardvark@montague.lit', muc_jid]);
            expect(getPinnedLabels(list).length).toBe(0);
            expect(getRoomAction(list, muc_jid, 'Pin to top')).not.toBeNull();
            expect(_converse.state.chatboxes.get(muc_jid).get('closed')).toBeFalsy();
        }),
    );

    it(
        'can be pinned and unpinned with "Pin to top" and "Unpin from top"',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            await mock.openControlBox(_converse);
            const list = document.querySelector('converse-rooms-list');

            await openRoom(_converse, 'aardvark@montague.lit');
            await openPinnedRoom(_converse, 'lounge@montague.lit', 'Lounge');
            await u.waitUntil(() => getPinnedLabels(list).length === 1);

            const pin = getRoomAction(list, 'aardvark@montague.lit', 'Pin to top');
            const unpin = getRoomAction(list, 'lounge@montague.lit', 'Unpin from top');
            expect(pin).not.toBeNull();
            expect(unpin).not.toBeNull();
            expect(getRoomAction(list, 'aardvark@montague.lit', 'Unpin from top')).toBeNull();
            expect(getRoomAction(list, 'lounge@montague.lit', 'Pin to top')).toBeNull();

            // Both actions use the pin icon, hidden from assistive technology
            // since the visible text names the action.
            for (const action of [pin, unpin]) {
                const icon = action.querySelector('converse-icon');
                expect(icon.classList.contains('fa-thumbtack')).toBe(true);
                expect(icon.getAttribute('aria-hidden')).toBe('true');
            }
            expect(list.querySelector('.available-chatroom .fa-bookmark, .available-chatroom .fa-bookmark-empty')).toBeNull();

            await completeBookmarkOperation(
                _converse,
                () => pin.click(),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="aardvark@montague.lit"] extensions pinned`,
            );
            await u.waitUntil(() => getPinnedLabels(list).length === 0);
            expect(getRoomJIDs(list)).toEqual(['aardvark@montague.lit', 'lounge@montague.lit']);
            expect(getRoomAction(list, 'aardvark@montague.lit', 'Unpin from top')).not.toBeNull();

            await completeBookmarkOperation(
                _converse,
                () => getRoomAction(list, 'lounge@montague.lit', 'Unpin from top').click(),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="lounge@montague.lit"]`,
            );
            await u.waitUntil(() => getPinnedLabels(list).length === 1);
            expect(getRoomJIDs(list)).toEqual(['aardvark@montague.lit', 'lounge@montague.lit']);
            expect(getRoomJIDsUnderPinnedLabel(list)).toEqual(['aardvark@montague.lit']);
            expect(getRoomAction(list, 'lounge@montague.lit', 'Pin to top')).not.toBeNull();
        }),
    );

    it(
        'can be pinned with the keyboard from the room\'s menu',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            await mock.openControlBox(_converse);
            const list = document.querySelector('converse-rooms-list');

            await openRoom(_converse, 'aardvark@montague.lit');
            const muc_jid = 'lounge@montague.lit';
            await openRoom(_converse, muc_jid);
            await u.waitUntil(() => getRoomJIDs(list).length === 2);

            const row = list.querySelector(`.available-chatroom[data-room-jid="${muc_jid}"]`);
            const toggle = row.querySelector('converse-dropdown .dropdown-toggle');
            const pin = getRoomAction(list, muc_jid, 'Pin to top');
            toggle.focus();

            await completeBookmarkOperation(
                _converse,
                async () => {
                    // Space opens the menu, the arrow keys mark the active item
                    // as selected, and Enter activates it.
                    const leave = row.querySelector('.close-room');
                    await userEvent.keyboard(' ');
                    await u.waitUntil(() => row.querySelector('.dropdown-menu').classList.contains('show'));
                    await userEvent.keyboard('{ArrowDown}');
                    await u.waitUntil(() => leave.closest('li').classList.contains('selected'));
                    await userEvent.keyboard('{ArrowDown}');
                    await u.waitUntil(() => pin.closest('li').classList.contains('selected'));
                    await userEvent.keyboard('{Enter}');
                },
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${muc_jid}"] extensions pinned`,
            );
            await u.waitUntil(() => getPinnedLabels(list).length === 1);
            expect(getRoomJIDsUnderPinnedLabel(list)).toEqual([muc_jid]);
        }),
    );

    it(
        'include a room opened manually after it was already a pinned bookmark',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            await mock.openControlBox(_converse);
            const list = document.querySelector('converse-rooms-list');

            await openRoom(_converse, 'aardvark@montague.lit');

            const muc_jid = 'lounge@montague.lit';
            // A pinned bookmark that is NOT auto-joined: the room isn't open
            // yet, so it isn't shown.
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
            expect(getRoomJIDs(list)).toEqual(['aardvark@montague.lit']);
            expect(getPinnedLabels(list).length).toBe(0);

            // Open the room manually, *after* the bookmark already exists.
            await openRoom(_converse, muc_jid);
            await u.waitUntil(() => getRoomJIDs(list).length === 2);
            expect(getRoomJIDs(list)).toEqual([muc_jid, 'aardvark@montague.lit']);
            expect(getRoomJIDsUnderPinnedLabel(list)).toEqual([muc_jid]);
        }),
    );

    it(
        'can include a room that was not bookmarked yet',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            const { state } = _converse;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            await mock.openControlBox(_converse);
            const list = document.querySelector('converse-rooms-list');

            await openRoom(_converse, 'aardvark@montague.lit');
            const muc_jid = 'lounge@montague.lit';
            await openRoom(_converse, muc_jid);
            await u.waitUntil(() => getRoomJIDs(list).length === 2);
            expect(getRoomJIDs(list)).toEqual(['aardvark@montague.lit', muc_jid]);
            expect(state.bookmarks.get(muc_jid)).toBeUndefined();

            // Pinning it bookmarks it and pins it in one action.
            await completeBookmarkOperation(
                _converse,
                () => list.querySelector(`.pin-room[data-room-jid="${muc_jid}"]`).click(),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${muc_jid}"] extensions pinned`,
            );

            await u.waitUntil(() => getPinnedLabels(list).length === 1);
            expect(getRoomJIDs(list)).toEqual([muc_jid, 'aardvark@montague.lit']);
            expect(getRoomJIDsUnderPinnedLabel(list)).toEqual([muc_jid]);

            const bookmark = state.bookmarks.get(muc_jid);
            expect(bookmark).toBeTruthy();
            expect(bookmark.get('pinned')).toBe(true);
            expect(bookmark.get('autojoin')).toBe(true);
        }),
    );

    it(
        'are shown in the pinned position again when a retained room is reopened',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            const { state } = _converse;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            await mock.openControlBox(_converse);
            const list = document.querySelector('converse-rooms-list');

            await openRoom(_converse, 'aardvark@montague.lit');
            const muc_jid = 'lounge@montague.lit';
            await openPinnedRoom(_converse, muc_jid, 'Lounge');
            await u.waitUntil(() => getRoomJIDs(list).length === 2);

            const room = state.chatboxes.get(muc_jid);
            room.set('closed', true);
            await u.waitUntil(() => getRoomJIDs(list).length === 1);
            expect(getRoomJIDs(list)).toEqual(['aardvark@montague.lit']);
            expect(getPinnedLabels(list).length).toBe(0);

            room.set('closed', false);
            await u.waitUntil(() => getRoomJIDs(list).length === 2);
            expect(getRoomJIDs(list)).toEqual([muc_jid, 'aardvark@montague.lit']);
            expect(getRoomJIDsUnderPinnedLabel(list)).toEqual([muc_jid]);
        }),
    );

    it(
        'show unread messages like other groupchats',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            await mock.openControlBox(_converse);
            const list = document.querySelector('converse-rooms-list');

            await openRoom(_converse, 'aardvark@montague.lit');
            const muc_jid = 'kitchen@conference.shakespeare.lit';
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => getRoomJIDs(list).length === 2);

            await completeBookmarkOperation(
                _converse,
                () => list.querySelector(`.pin-room[data-room-jid="${muc_jid}"]`).click(),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${muc_jid}"] extensions pinned`,
            );
            await u.waitUntil(() => getPinnedLabels(list).length === 1);

            u.minimize(view.model);
            await view.model.handleMessageStanza(
                stx`<message from="${muc_jid}/${mock.chatroom_names[0]}"
                        id="${u.getUniqueId()}"
                        to="romeo@montague.lit"
                        type="groupchat"
                        xmlns="jabber:client">
                    <body>romeo: Your attention is required</body>
                </message>`,
            );
            await u.waitUntil(() => list.querySelectorAll('.msgs-indicator').length === 1);
            const row = list.querySelector(`.available-chatroom[data-room-jid="${muc_jid}"]`);
            expect(row.querySelector('.msgs-indicator').textContent.trim()).toBe('1');
            expect(row.classList.contains('unread-msgs')).toBe(true);
            expect(getRoomJIDsUnderPinnedLabel(list)).toEqual([muc_jid]);
        }),
    );

    it(
        'are not offered when the server only supports legacy bookmarks',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            const { state } = _converse;
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
            const list = document.querySelector('converse-rooms-list');

            await openRoom(_converse, 'aardvark@montague.lit');
            const muc_jid = 'lounge@montague.lit';
            await openRoom(_converse, muc_jid);
            await u.waitUntil(() => getRoomJIDs(list).length === 2);

            expect(list.querySelector('.pin-room')).toBeNull();
            expect(list.querySelector('.unpin-room')).toBeNull();
            expect(getRoomAction(list, muc_jid, 'Pin to top')).toBeNull();
            expect(getRoomAction(list, muc_jid, 'Unpin from top')).toBeNull();
            expect(list.querySelector('.fa-thumbtack')).toBeNull();
            expect(getPinnedLabels(list).length).toBe(0);
            await expect(state.bookmarks.pinRoom(muc_jid)).rejects.toThrow('Pinning requires native bookmarks');
            expect(state.bookmarks.get(muc_jid)).toBeUndefined();
        }),
    );
});
