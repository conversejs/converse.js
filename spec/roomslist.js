(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    const { Strophe, $iq, $msg, $pres, sizzle, _ } = converse.env;
    const u = converse.env.utils;


    describe("A list of open groupchats", function () {

        it("is shown in controlbox", mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched', 'emojisInitialized'],
                { allow_bookmarks: false // Makes testing easier, otherwise we
                                         // have to mock stanza traffic.
                }, async function (done, _converse) {

            test_utils.openControlBox();
            const controlbox = _converse.chatboxviews.get('controlbox');
            let list = controlbox.el.querySelector('.list-container--openrooms');
            expect(_.includes(list.classList, 'hidden')).toBeTruthy();
            await test_utils.openChatRoom(_converse, 'room', 'conference.shakespeare.lit', 'JC');

            const lview = _converse.rooms_list_view
            await u.waitUntil(() => lview.el.querySelectorAll(".open-room").length);
            let room_els = lview.el.querySelectorAll(".open-room");
            expect(room_els.length).toBe(1);
            expect(room_els[0].innerText).toBe('room@conference.shakespeare.lit');

            await test_utils.openChatRoom(_converse, 'lounge', 'montague.lit', 'romeo');
            await u.waitUntil(() => lview.el.querySelectorAll(".open-room").length > 1);
            room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
            expect(room_els.length).toBe(2);

            let view = _converse.chatboxviews.get('room@conference.shakespeare.lit');
            view.close();
            room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
            expect(room_els.length).toBe(1);
            expect(room_els[0].innerText).toBe('lounge@montague.lit');
            list = controlbox.el.querySelector('.list-container--openrooms');
            u.waitUntil(() => _.includes(list.classList, 'hidden'));

            view = _converse.chatboxviews.get('lounge@montague.lit');
            view.close();
            room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
            expect(room_els.length).toBe(0);

            list = controlbox.el.querySelector('.list-container--openrooms');
            expect(_.includes(list.classList, 'hidden')).toBeTruthy();
            done();
        }));

        it("uses bookmarks to determine groupchat names",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched', 'emojisInitialized'],
                {'view_mode': 'fullscreen'},
                async function (done, _converse) {

            await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            spyOn(_converse.Bookmarks.prototype, 'fetchBookmarks').and.callThrough();

            await test_utils.waitUntilDiscoConfirmed(
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            await _converse.api.waitUntil('roomsListInitialized');
            const controlbox = _converse.chatboxviews.get('controlbox');
            const list = controlbox.el.querySelector('.list-container--openrooms');
            expect(_.includes(list.classList, 'hidden')).toBeFalsy();
            const items = list.querySelectorAll('.list-item');
            expect(items.length).toBe(1);
            expect(items[0].textContent.trim()).toBe('Bookmarked Lounge');
            expect(_converse.bookmarks.fetchBookmarks).toHaveBeenCalled();
            done();
        }));
    });

    describe("A groupchat shown in the groupchats list", function () {

        it("is highlighted if it's currently open", mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched', 'emojisInitialized'],
            { view_mode: 'fullscreen',
              allow_bookmarks: false // Makes testing easier, otherwise we have to mock stanza traffic.
            }, async function (done, _converse) {

            await _converse.api.rooms.open('coven@chat.shakespeare.lit', {'nick': 'some1'});
            const lview = _converse.rooms_list_view
            await u.waitUntil(() => lview.el.querySelectorAll(".open-room").length);
            let room_els = lview.el.querySelectorAll(".available-chatroom");
            expect(room_els.length).toBe(1);

            let item = room_els[0];
            expect(u.hasClass('open', item)).toBe(true);
            expect(item.textContent.trim()).toBe('coven@chat.shakespeare.lit');
            await _converse.api.rooms.open('balcony@chat.shakespeare.lit', {'nick': 'some1'});
            await u.waitUntil(() => lview.el.querySelectorAll(".open-room").length > 1);
            room_els = lview.el.querySelectorAll(".open-room");
            expect(room_els.length).toBe(2);

            room_els = lview.el.querySelectorAll(".available-chatroom.open");
            expect(room_els.length).toBe(1);
            item = room_els[0];
            expect(item.textContent.trim()).toBe('balcony@chat.shakespeare.lit');
            done();
        }));

        it("has an info icon which opens a details modal when clicked", mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched', 'emojisInitialized'],
            { whitelisted_plugins: ['converse-roomslist'],
              allow_bookmarks: false // Makes testing easier, otherwise we
                                     // have to mock stanza traffic.
            }, async function (done, _converse) {

            const IQ_stanzas = _converse.connection.IQ_stanzas;
            const room_jid = 'coven@chat.shakespeare.lit';
            test_utils.openControlBox();
            await _converse.api.rooms.open(room_jid, {'nick': 'some1'});
            const view = _converse.chatboxviews.get(room_jid);

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
            _converse.connection._dataRecv(test_utils.createRequest(features_stanza));
            await u.waitUntil(() => view.model.get('connection_status') === converse.ROOMSTATUS.CONNECTING)
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
            _converse.connection._dataRecv(test_utils.createRequest(presence));

            await u.waitUntil(() => _converse.rooms_list_view.el.querySelectorAll(".open-room").length, 500);
            const room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
            expect(room_els.length).toBe(1);
            const info_el = _converse.rooms_list_view.el.querySelector(".room-info");
            info_el.click();

            const  modal = view.model.room_details_modal;
            await u.waitUntil(() => u.isVisible(modal.el), 1000);
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
        }));

        it("can be closed", mock.initConverse(
            ['rosterGroupsFetched', 'emojisInitialized'],
            { whitelisted_plugins: ['converse-roomslist'],
              allow_bookmarks: false // Makes testing easier, otherwise we have to mock stanza traffic.
            },
            async function (done, _converse) {

            spyOn(window, 'confirm').and.callFake(() => true);
            expect(_converse.chatboxes.length).toBe(1);
            await test_utils.openChatRoom(_converse, 'lounge', 'conference.shakespeare.lit', 'JC');
            expect(_converse.chatboxes.length).toBe(2);
            const lview = _converse.rooms_list_view
            await u.waitUntil(() => lview.el.querySelectorAll(".open-room").length);
            let room_els = lview.el.querySelectorAll(".open-room");
            expect(room_els.length).toBe(1);
            const close_el = _converse.rooms_list_view.el.querySelector(".close-room");
            close_el.click();
            expect(window.confirm).toHaveBeenCalledWith(
                'Are you sure you want to leave the groupchat lounge@conference.shakespeare.lit?');
            room_els = _converse.rooms_list_view.el.querySelectorAll(".open-room");
            expect(room_els.length).toBe(0);
            expect(_converse.chatboxes.length).toBe(1);
            done();
        }));

        it("shows unread messages directed at the user", mock.initConverse(
                null,
                { whitelisted_plugins: ['converse-roomslist'],
                allow_bookmarks: false // Makes testing easier, otherwise we have to mock stanza traffic.
                }, async (done, _converse) => {

            test_utils.openControlBox();
            const room_jid = 'kitchen@conference.shakespeare.lit';
            await u.waitUntil(() => _converse.rooms_list_view !== undefined, 500);
            await test_utils.openAndEnterChatRoom(_converse, 'kitchen@conference.shakespeare.lit', 'romeo');
            const view = _converse.chatboxviews.get(room_jid);
            view.model.set({'minimized': true});
            const nick = mock.chatroom_names[0];
            await view.model.onMessage(
                $msg({
                    from: room_jid+'/'+nick,
                    id: (new Date()).getTime(),
                    to: 'romeo@montague.lit',
                    type: 'groupchat'
                }).c('body').t('foo').tree());

            const lview = _converse.rooms_list_view
            await u.waitUntil(() => lview.el.querySelectorAll(".available-chatroom").length, 500);

            // If the user isn't mentioned, the counter doesn't get incremented, but the text of the groupchat is bold
            let room_el = lview.el.querySelector(".available-chatroom");
            expect(_.includes(room_el.classList, 'unread-msgs')).toBeTruthy();

            // If the user is mentioned, the counter also gets updated
            await view.model.onMessage(
                $msg({
                    from: room_jid+'/'+nick,
                    id: (new Date()).getTime(),
                    to: 'romeo@montague.lit',
                    type: 'groupchat'
                }).c('body').t('romeo: Your attention is required').tree()
            );
            await u.waitUntil(() => _converse.rooms_list_view.el.querySelectorAll(".msgs-indicator").length);
            spyOn(view.model, 'incrementUnreadMsgCounter').and.callThrough();
            let indicator_el = _converse.rooms_list_view.el.querySelector(".msgs-indicator");
            expect(indicator_el.textContent).toBe('1');
            await view.model.onMessage(
                $msg({
                    from: room_jid+'/'+nick,
                    id: (new Date()).getTime(),
                    to: 'romeo@montague.lit',
                    type: 'groupchat'
                }).c('body').t('romeo: and another thing...').tree()
            );
            await u.waitUntil(() => view.model.incrementUnreadMsgCounter.calls.count());
            indicator_el = _converse.rooms_list_view.el.querySelector(".msgs-indicator");
            expect(indicator_el.textContent).toBe('2');

            // When the chat gets maximized again, the unread indicators are removed
            view.model.set({'minimized': false});
            indicator_el = _converse.rooms_list_view.el.querySelector(".msgs-indicator");
            expect(indicator_el === null);
            room_el = _converse.rooms_list_view.el.querySelector(".available-chatroom");
            expect(_.includes(room_el.classList, 'unread-msgs')).toBeFalsy();
            done();
        }));
    });
}));
