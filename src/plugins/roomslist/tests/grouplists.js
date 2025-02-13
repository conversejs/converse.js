/* global mock, converse */

const { u } = converse.env;

describe("The list of MUC domains", function () {
    it("is shown in controlbox", mock.initConverse(
            ['chatBoxesFetched'],
            { muc_grouped_by_domain: true,
              allow_bookmarks: false // Makes testing easier, otherwise we
                                     // have to mock stanza traffic.
            }, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 0);
        await mock.openControlBox(_converse);
        const controlbox = _converse.chatboxviews.get('controlbox');
        let list = controlbox.querySelector('.list-container--openrooms');
        expect(u.hasClass('hidden', list)).toBeTruthy();

        let muc_jid = 'room@conference.shakespeare.lit';
        _converse.api.rooms.open(muc_jid, { nick: 'JC' });
        await mock.getRoomFeatures(_converse, muc_jid);

        const lview = controlbox.querySelector('converse-rooms-list');
        // Check that the group is shown
        await u.waitUntil(() => lview.querySelectorAll(".muc-domain-group").length);
        let group_els = lview.querySelectorAll(".muc-domain-group");
        expect(group_els.length).toBe(1);
        // .children[0] should give the a tag with the domain in it
        // there might be a more robust way to do this
        // (select for ".muc-domain-group-toggle"?)
        // .trim() because there is a space for the arrow/triangle icon first
        expect(group_els[0].children[0].innerText.trim()).toBe('conference.shakespeare.lit');
        // Check that the room is shown
        await u.waitUntil(() => lview.querySelectorAll(".open-room").length);
        let room_els = lview.querySelectorAll(".open-room");
        expect(room_els.length).toBe(1);
        expect(room_els[0].querySelector('span').innerText).toBe('Room');

        // Check that a second room in the same domain is shown in the same
        // domain group.
        muc_jid = 'secondroom@conference.shakespeare.lit';
        _converse.api.rooms.open(muc_jid, { nick: 'JC' });
        await mock.getRoomFeatures(_converse, muc_jid);

        await u.waitUntil(() => lview.querySelectorAll(".open-room").length > 1);
        group_els = lview.querySelectorAll(".muc-domain-group");
        expect(group_els.length).toBe(1); // still only one group
        expect(group_els[0].children[0].innerText.trim()).toBe('conference.shakespeare.lit');
        room_els = lview.querySelectorAll(".open-room");
        expect(room_els.length).toBe(2); // but two rooms inside it

        muc_jid = 'lounge@montague.lit';
        _converse.api.rooms.open(muc_jid, { nick: 'romeo' });
        await mock.getRoomFeatures(_converse, muc_jid);

        await u.waitUntil(() => lview.querySelectorAll(".open-room").length > 2);
        room_els = lview.querySelectorAll(".open-room");
        expect(room_els.length).toBe(3);
        group_els = lview.querySelectorAll(".muc-domain-group");
        expect(group_els.length).toBe(2);

        let view = _converse.chatboxviews.get('room@conference.shakespeare.lit');
        await view.close();
        room_els = lview.querySelectorAll(".open-room");
        expect(room_els.length).toBe(2);
        group_els = lview.querySelectorAll(".muc-domain-group");
        expect(group_els.length).toBe(2);
        view = _converse.chatboxviews.get('secondroom@conference.shakespeare.lit');
        await view.close();
        room_els = lview.querySelectorAll(".open-room");
        expect(room_els.length).toBe(1);
        group_els = lview.querySelectorAll(".muc-domain-group");
        expect(group_els.length).toBe(1);
        expect(room_els[0].querySelector('span').innerText).toBe('Lounge');
        expect(group_els[0].children[0].innerText.trim()).toBe('montague.lit');
        list = controlbox.querySelector('.list-container--openrooms');
        u.waitUntil(() => Array.from(list.classList).includes('hidden'));

        view = _converse.chatboxviews.get('lounge@montague.lit');
        await view.close();
        room_els = lview.querySelectorAll(".open-room");
        expect(room_els.length).toBe(0);
        group_els = lview.querySelectorAll(".muc-domain-group");
        expect(group_els.length).toBe(0);

        list = controlbox.querySelector('.list-container--openrooms');
        expect(Array.from(list.classList).includes('hidden')).toBeTruthy();
    }));
});

describe("A MUC domain group", function () {
    it("is collapsible", mock.initConverse(
            ['chatBoxesFetched'],
            { muc_grouped_by_domain: true,
              allow_bookmarks: false // Makes testing easier, otherwise we
                                     // have to mock stanza traffic.
            }, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 0);
        await mock.openControlBox(_converse);
        const controlbox = _converse.chatboxviews.get('controlbox');
        const list = controlbox.querySelector('.list-container--openrooms');
        const nick = 'JC';
        const muc_jid = 'room@conference.shakespeare.lit';
        _converse.api.rooms.open(muc_jid, { nick });
        await mock.getRoomFeatures(_converse, muc_jid);

        const lview = controlbox.querySelector('converse-rooms-list');
        await u.waitUntil(() => lview.querySelectorAll(".muc-domain-group").length);
        expect(u.hasClass('hidden', list)).toBeFalsy();
        const group_els = lview.querySelectorAll(".muc-domain-group");
        expect(group_els.length).toBe(1);
        expect(group_els[0].children[0].innerText.trim()).toBe('conference.shakespeare.lit');

        // I would have liked to use u.isVisible on the room (.open-room) here,
        // but it didn’t seem to work.
        expect(u.hasClass('collapsed', lview.querySelector(".muc-domain-group-rooms"))).toBe(false);
        lview.querySelector('.muc-domain-group-toggle').click();
        await u.waitUntil(() => u.hasClass('collapsed', lview.querySelector(".muc-domain-group-rooms")) === true);
        expect(u.hasClass('collapsed', lview.querySelector(".muc-domain-group-rooms"))).toBe(true);
        lview.querySelector('.muc-domain-group-toggle').click();
        await u.waitUntil(() => u.hasClass('collapsed', lview.querySelector(".muc-domain-group-rooms")) === false);
        expect(u.hasClass('collapsed', lview.querySelector(".muc-domain-group-rooms"))).toBe(false);
    }));
});
