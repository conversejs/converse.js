/* global mock, converse */

const { $msg, u } = converse.env;


describe("A list of open groupchats", function () {

    it("is shown in controlbox", mock.initConverse(
            ['chatBoxesFetched'],
            { allow_bookmarks: false // Makes testing easier, otherwise we
                                        // have to mock stanza traffic.
            }, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 0);
        await mock.openControlBox(_converse);
        const controlbox = _converse.chatboxviews.get('controlbox');
        let list = controlbox.querySelector('.list-container--openrooms');
        expect(u.hasClass('hidden', list)).toBeTruthy();
        await mock.openChatRoom(_converse, 'room', 'conference.shakespeare.lit', 'JC');

        const lview = controlbox.querySelector('converse-rooms-list');
        await u.waitUntil(() => lview.querySelectorAll(".open-room").length);
        let room_els = lview.querySelectorAll(".open-room");
        expect(room_els.length).toBe(1);
        expect(room_els[0].innerText).toBe('room@conference.shakespeare.lit');

        await mock.openChatRoom(_converse, 'lounge', 'montague.lit', 'romeo');
        await u.waitUntil(() => lview.querySelectorAll(".open-room").length > 1);
        room_els = lview.querySelectorAll(".open-room");
        expect(room_els.length).toBe(2);

        let view = _converse.chatboxviews.get('room@conference.shakespeare.lit');
        await view.close();
        room_els = lview.querySelectorAll(".open-room");
        expect(room_els.length).toBe(1);
        expect(room_els[0].innerText).toBe('lounge@montague.lit');
        list = controlbox.querySelector('.list-container--openrooms');
        u.waitUntil(() => Array.from(list.classList).includes('hidden'));

        view = _converse.chatboxviews.get('lounge@montague.lit');
        await view.close();
        room_els = lview.querySelectorAll(".open-room");
        expect(room_els.length).toBe(0);

        list = controlbox.querySelector('.list-container--openrooms');
        expect(Array.from(list.classList).includes('hidden')).toBeTruthy();
    }));

    it("shows the number of unread mentions received",
        mock.initConverse(
            [], {'allow_bookmarks': false},
            async function (_converse) {

        await mock.openControlBox(_converse);
        const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
        expect(roomspanel.querySelectorAll('.available-room').length).toBe(0);

        const muc_jid = 'kitchen@conference.shakespeare.lit';
        const message = 'fires: Your attention is required';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'fires');
        const view = _converse.chatboxviews.get(muc_jid);
        await u.waitUntil(() => roomspanel.querySelectorAll('.available-room').length);
        expect(roomspanel.querySelectorAll('.available-room').length).toBe(1);
        expect(roomspanel.querySelectorAll('.msgs-indicator').length).toBe(0);

        view.model.set({'minimized': true});

        const nick = mock.chatroom_names[0];
        await view.model.handleMessageStanza($msg({
                from: muc_jid+'/'+nick,
                id: u.getUniqueId(),
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t(message).tree());
        await u.waitUntil(() => view.model.messages.length);
        expect(roomspanel.querySelectorAll('.available-room').length).toBe(1);
        expect(roomspanel.querySelectorAll('.msgs-indicator').length).toBe(1);
        expect(roomspanel.querySelector('.msgs-indicator').textContent.trim()).toBe('1');

        await view.model.handleMessageStanza($msg({
            'from': muc_jid+'/'+nick,
            'id': u.getUniqueId(),
            'to': 'romeo@montague.lit',
            'type': 'groupchat'
        }).c('body').t(message).tree());
        await u.waitUntil(() => view.model.messages.length > 1);
        expect(roomspanel.querySelectorAll('.available-room').length).toBe(1);
        expect(roomspanel.querySelectorAll('.msgs-indicator').length).toBe(1);
        expect(roomspanel.querySelector('.msgs-indicator').textContent.trim()).toBe('2');
        view.model.set({'minimized': false});
        expect(roomspanel.querySelectorAll('.available-room').length).toBe(1);
        await u.waitUntil(() => roomspanel.querySelectorAll('.msgs-indicator').length === 0);
    }));

    it("uses bookmarks to determine groupchat names",
        mock.initConverse(
            ['chatBoxesFetched'],
            {'view_mode': 'fullscreen'},
            async function (_converse) {

        const { Strophe, $iq, $pres, sizzle } = converse.env;
        const u = converse.env.utils;

        await mock.waitForRoster(_converse, 'current', 0);
        await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
        let stanza = $pres({
                to: 'romeo@montague.lit/orchard',
                from: 'lounge@montague.lit/newguy'
            })
            .c('x', {xmlns: Strophe.NS.MUC_USER})
            .c('item', {
                'affiliation': 'none',
                'jid': 'newguy@montague.lit/_converse.js-290929789',
                'role': 'participant'
            }).tree();
        _converse.connection._dataRecv(mock.createRequest(stanza));

        spyOn(_converse.Bookmarks.prototype, 'fetchBookmarks').and.callThrough();

        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid,
            [{'category': 'pubsub', 'type':'pep'}],
            [`${Strophe.NS.PUBSUB}#publish-options`]
        );

        const IQ_stanzas = _converse.connection.IQ_stanzas;
        const sent_stanza = await u.waitUntil(() => IQ_stanzas.filter(s => sizzle('items[node="storage:bookmarks"]', s).length).pop());
        expect(Strophe.serialize(sent_stanza)).toBe(
            `<iq from="romeo@montague.lit/orchard" id="${sent_stanza.getAttribute('id')}" type="get" xmlns="jabber:client">`+
            '<pubsub xmlns="http://jabber.org/protocol/pubsub">'+
                '<items node="storage:bookmarks"/>'+
            '</pubsub>'+
            '</iq>');

        stanza = $iq({'to': _converse.connection.jid, 'type':'result', 'id':sent_stanza.getAttribute('id')})
            .c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                .c('items', {'node': 'storage:bookmarks'})
                    .c('item', {'id': 'current'})
                        .c('storage', {'xmlns': 'storage:bookmarks'})
                            .c('conference', {
                                'name': 'Bookmarked Lounge',
                                'jid': 'lounge@montague.lit'
                            });
        _converse.connection._dataRecv(mock.createRequest(stanza));

        await _converse.api.waitUntil('roomsListInitialized');
        const controlbox = _converse.chatboxviews.get('controlbox');
        const list = controlbox.querySelector('.list-container--openrooms');
        expect(Array.from(list.classList).includes('hidden')).toBeFalsy();
        const items = list.querySelectorAll('.list-item');
        expect(items.length).toBe(1);
        await u.waitUntil(() => list.querySelector('.list-item').textContent.trim() === 'Bookmarked Lounge');
        expect(_converse.bookmarks.fetchBookmarks).toHaveBeenCalled();
    }));
});

describe("A groupchat shown in the groupchats list", function () {

    it("is highlighted if it's currently open", mock.initConverse(
            ['chatBoxesFetched'],
            { view_mode: 'fullscreen',
            allow_bookmarks: false // Makes testing easier, otherwise we have to mock stanza traffic.
            }, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 0);
        const controlbox = _converse.chatboxviews.get('controlbox');
        const u = converse.env.utils;
        const muc_jid = 'coven@chat.shakespeare.lit';
        await _converse.api.rooms.open(muc_jid, {'nick': 'some1'}, true);
        const lview = controlbox.querySelector('converse-rooms-list');
        await u.waitUntil(() => lview.querySelectorAll(".open-room").length);
        let room_els = lview.querySelectorAll(".available-chatroom");
        expect(room_els.length).toBe(1);

        let item = room_els[0];
        await u.waitUntil(() => _converse.chatboxes.get(muc_jid).get('hidden') === false);
        await u.waitUntil(() => u.hasClass('open', item), 1000);
        expect(item.textContent.trim()).toBe('coven@chat.shakespeare.lit');
        await _converse.api.rooms.open('balcony@chat.shakespeare.lit', {'nick': 'some1'}, true);
        await u.waitUntil(() => lview.querySelectorAll(".open-room").length > 1);
        room_els = lview.querySelectorAll(".open-room");
        expect(room_els.length).toBe(2);

        room_els = lview.querySelectorAll(".available-chatroom.open");
        expect(room_els.length).toBe(1);
        item = room_els[0];
        expect(item.textContent.trim()).toBe('balcony@chat.shakespeare.lit');
    }));

    it("has an info icon which opens a details modal when clicked", mock.initConverse(
            ['chatBoxesFetched'],
            { whitelisted_plugins: ['converse-roomslist'],
            allow_bookmarks: false // Makes testing easier, otherwise we
                                    // have to mock stanza traffic.
            }, async function (_converse) {

        const { Strophe, $iq, $pres } = converse.env;
        const u = converse.env.utils;
        const IQ_stanzas = _converse.connection.IQ_stanzas;
        const room_jid = 'coven@chat.shakespeare.lit';
        await mock.waitForRoster(_converse, 'current', 0);
        await mock.openControlBox(_converse);
        await _converse.api.rooms.open(room_jid, {'nick': 'some1'});

        const selector = `iq[to="${room_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`;
        const features_query = await u.waitUntil(() => IQ_stanzas.filter(iq => iq.querySelector(selector)).pop());
        const features_stanza = $iq({
                'from': 'coven@chat.shakespeare.lit',
                'id': features_query.getAttribute('id'),
                'to': 'romeo@montague.lit/desktop',
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
        _converse.connection._dataRecv(mock.createRequest(features_stanza));

        const view = _converse.chatboxviews.get(room_jid);
        await u.waitUntil(() => view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING)
        let presence = $pres({
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
        _converse.connection._dataRecv(mock.createRequest(presence));

        const rooms_list = document.querySelector('converse-rooms-list');
        await u.waitUntil(() => rooms_list.querySelectorAll(".open-room").length, 500);
        const room_els = rooms_list.querySelectorAll(".open-room");
        expect(room_els.length).toBe(1);
        const info_el = rooms_list.querySelector(".room-info");
        info_el.click();

        const modal = _converse.api.modal.get('converse-muc-details-modal');
        await u.waitUntil(() => u.isVisible(modal), 1000);
        let els = modal.querySelectorAll('p.room-info');
        expect(els[0].textContent).toBe("Name: A Dark Cave")

        expect(els[1].querySelector('strong').textContent).toBe("XMPP address");
        expect(els[1].querySelector('converse-rich-text').textContent.trim()).toBe("xmpp:coven@chat.shakespeare.lit?join");
        expect(els[2].querySelector('strong').textContent).toBe("Description");
        expect(els[2].querySelector('converse-rich-text').textContent).toBe("This is the description");

        expect(els[3].textContent).toBe("Online users: 1")
        const features_list = modal.querySelector('.features-list');
        expect(features_list.textContent.replace(/(\n|\s{2,})/g, '')).toBe(
            'Password protected - This groupchat requires a password before entry'+
            'Hidden - This groupchat is not publicly searchable'+
            'Open - Anyone can join this groupchat'+
            'Temporary - This groupchat will disappear once the last person leaves'+
            'Not anonymous - All other groupchat participants can see your XMPP address'+
            'Not moderated - Participants entering this groupchat can write right away'
        );
        presence = $pres({
                to: 'romeo@montague.lit/_converse.js-29092160',
                from: 'coven@chat.shakespeare.lit/newguy'
            })
            .c('x', {xmlns: Strophe.NS.MUC_USER})
            .c('item', {
                'affiliation': 'none',
                'jid': 'newguy@montague.lit/_converse.js-290929789',
                'role': 'participant'
            });
        _converse.connection._dataRecv(mock.createRequest(presence));

        els = modal.querySelectorAll('p.room-info');
        expect(els[3].textContent).toBe("Online users: 2")

        view.model.set({'subject': {'author': 'someone', 'text': 'Hatching dark plots'}});
        els = modal.querySelectorAll('p.room-info');
        expect(els[0].textContent).toBe("Name: A Dark Cave")

        expect(els[1].querySelector('strong').textContent).toBe("XMPP address");
        expect(els[1].querySelector('converse-rich-text').textContent.trim()).toBe("xmpp:coven@chat.shakespeare.lit?join");
        expect(els[2].querySelector('strong').textContent).toBe("Description");
        expect(els[2].querySelector('converse-rich-text').textContent).toBe("This is the description");
        expect(els[3].querySelector('strong').textContent).toBe("Topic");
        await u.waitUntil(() => els[3].querySelector('converse-rich-text').textContent === "Hatching dark plots");

        expect(els[4].textContent).toBe("Topic author: someone")
        expect(els[5].textContent).toBe("Online users: 2")
    }));

    it("can be closed", mock.initConverse(
            [],
            { whitelisted_plugins: ['converse-roomslist'],
            allow_bookmarks: false // Makes testing easier, otherwise we have to mock stanza traffic.
            },
            async function (_converse) {

        const u = converse.env.utils;
        spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(true));
        expect(_converse.chatboxes.length).toBe(1);
        await mock.waitForRoster(_converse, 'current', 0);
        await mock.openChatRoom(_converse, 'lounge', 'conference.shakespeare.lit', 'JC');
        expect(_converse.chatboxes.length).toBe(2);

        await mock.openControlBox(_converse);
        const controlbox = _converse.chatboxviews.get('controlbox');
        const lview = controlbox.querySelector('converse-rooms-list');
        await u.waitUntil(() => lview.querySelectorAll(".open-room").length);
        const room_els = lview.querySelectorAll(".open-room");
        expect(room_els.length).toBe(1);
        const rooms_list = document.querySelector('converse-rooms-list');
        const close_el = rooms_list.querySelector(".close-room");
        close_el.click();
        expect(_converse.api.confirm).toHaveBeenCalledWith(
            'Are you sure you want to leave the groupchat lounge@conference.shakespeare.lit?');

        await u.waitUntil(() => rooms_list.querySelectorAll(".open-room").length === 0);
        expect(_converse.chatboxes.length).toBe(1);
    }));

    it("shows unread messages directed at the user", mock.initConverse(
            null,
            { whitelisted_plugins: ['converse-roomslist'],
            allow_bookmarks: false // Makes testing easier, otherwise we have to mock stanza traffic.
            }, async (_converse) => {

        const { $msg } = converse.env;
        const u = converse.env.utils;
        await mock.openControlBox(_converse);
        const room_jid = 'kitchen@conference.shakespeare.lit';
        const rooms_list = document.querySelector('converse-rooms-list');
        await u.waitUntil(() => rooms_list !== undefined, 500);
        await mock.openAndEnterChatRoom(_converse, room_jid, 'romeo');
        const view = _converse.chatboxviews.get(room_jid);
        view.model.set({'minimized': true});
        const nick = mock.chatroom_names[0];
        await view.model.handleMessageStanza(
            $msg({
                from: room_jid+'/'+nick,
                id: u.getUniqueId(),
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t('foo').tree());

        // If the user isn't mentioned, the counter doesn't get incremented, but the text of the groupchat is bold
        const controlbox = _converse.chatboxviews.get('controlbox');
        const lview = controlbox.querySelector('converse-rooms-list');
        let room_el = await u.waitUntil(() => lview.querySelector(".available-chatroom"));
        expect(Array.from(room_el.classList).includes('unread-msgs')).toBeTruthy();

        // If the user is mentioned, the counter also gets updated
        await view.model.handleMessageStanza(
            $msg({
                from: room_jid+'/'+nick,
                id: u.getUniqueId(),
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t('romeo: Your attention is required').tree()
        );

        let indicator_el = await u.waitUntil(() => lview.querySelector(".msgs-indicator"));
        expect(indicator_el.textContent).toBe('1');

        spyOn(view.model, 'handleUnreadMessage').and.callThrough();
        await view.model.handleMessageStanza(
            $msg({
                from: room_jid+'/'+nick,
                id: u.getUniqueId(),
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t('romeo: and another thing...').tree()
        );
        await u.waitUntil(() => view.model.handleUnreadMessage.calls.count());
        await u.waitUntil(() => lview.querySelector(".msgs-indicator").textContent === '2', 1000);

        // When the chat gets maximized again, the unread indicators are removed
        view.model.set({'minimized': false});
        indicator_el = lview.querySelector(".msgs-indicator");
        expect(indicator_el === null);
        room_el = lview.querySelector(".available-chatroom");
        await u.waitUntil(() => Array.from(room_el.classList).includes('unread-msgs') === false);
    }));
});
