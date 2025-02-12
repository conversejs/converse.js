/* global mock, converse */

const { $msg, u, Strophe, $iq, sizzle } = converse.env;


describe("A list of open groupchats", function () {

    beforeEach(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

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
        expect(room_els[0].querySelector('span').innerText).toBe('room@conference.shakespeare.lit');

        await mock.openChatRoom(_converse, 'lounge', 'montague.lit', 'romeo');
        await u.waitUntil(() => lview.querySelectorAll(".open-room").length > 1);
        room_els = lview.querySelectorAll(".open-room");
        expect(room_els.length).toBe(2);

        let view = _converse.chatboxviews.get('room@conference.shakespeare.lit');
        await view.close();
        room_els = lview.querySelectorAll(".open-room");
        expect(room_els.length).toBe(1);
        expect(room_els[0].querySelector('span').innerText).toBe('lounge@montague.lit');
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

        u.minimize(view.model);

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

        u.maximize(view.model);
        expect(roomspanel.querySelectorAll('.available-room').length).toBe(1);
        await u.waitUntil(() => roomspanel.querySelectorAll('.msgs-indicator').length === 0);
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
        expect(item.querySelector('.open-room span').textContent.trim()).toBe('coven@chat.shakespeare.lit');
        await _converse.api.rooms.open('balcony@chat.shakespeare.lit', {'nick': 'some1'}, true);
        await u.waitUntil(() => lview.querySelectorAll(".open-room").length > 1);
        room_els = lview.querySelectorAll(".open-room");
        expect(room_els.length).toBe(2);

        room_els = lview.querySelectorAll(".available-chatroom.open");
        expect(room_els.length).toBe(1);
        item = room_els[0];
        expect(item.querySelector('.open-room span').textContent.trim()).toBe('balcony@chat.shakespeare.lit');
    }));

    it("shows the MUC avatar", mock.initConverse(
            ['chatBoxesFetched'],
            { whitelisted_plugins: ['converse-roomslist'],
            allow_bookmarks: false // Makes testing easier, otherwise we
                                    // have to mock stanza traffic.
            }, async function (_converse) {

        const u = converse.env.utils;
        const muc_jid = 'coven@chat.shakespeare.lit';
        await mock.waitForRoster(_converse, 'current', 0);
        await mock.openControlBox(_converse);
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');

        const rooms_list = document.querySelector('converse-rooms-list');
        await u.waitUntil(() => rooms_list.querySelectorAll(".open-room").length, 500);
        const room_els = rooms_list.querySelectorAll(".open-room");
        expect(room_els.length).toBe(1);
        const avatar_el = rooms_list.querySelector("converse-avatar");
        expect(avatar_el).toBeDefined();

        let initials_el = rooms_list.querySelector('converse-avatar .avatar-initials');
        expect(initials_el.textContent).toBe('C');
        expect(getComputedStyle(initials_el).backgroundColor).toBe('rgb(75, 103, 255)');

        const muc_el = _converse.chatboxviews.get(muc_jid);
        let muc_initials_el = muc_el.querySelector('converse-muc-heading converse-avatar .avatar-initials');
        expect(muc_initials_el.textContent).toBe(initials_el.textContent);
        expect(getComputedStyle(muc_initials_el).backgroundColor).toBe(getComputedStyle(initials_el).backgroundColor);

        // Change MUC name
        // ---------------
        muc_el.querySelector('.configure-chatroom-button').click();
        const { IQ_stanzas } = _converse.api.connection.get();
        const sel = 'iq query[xmlns="http://jabber.org/protocol/muc#owner"]';
        let iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        // Check that an IQ is sent out, asking for the configuration form.
        expect(Strophe.serialize(iq)).toBe(
            `<iq id="${iq.getAttribute('id')}" to="${muc_jid}" type="get" xmlns="jabber:client">`+
                `<query xmlns="http://jabber.org/protocol/muc#owner"/>`+
            `</iq>`);

        const jid = _converse.session.get('jid');

        /* Server responds with the configuration form.
         * See: // https://xmpp.org/extensions/xep-0045.html#example-165
         */
        const config_stanza = $iq({from: 'coven@chat.shakespeare.lit',
            'id': iq.getAttribute('id'),
            'to': jid,
            'type': 'result'})
        .c('query', { 'xmlns': 'http://jabber.org/protocol/muc#owner'})
            .c('x', { 'xmlns': 'jabber:x:data', 'type': 'form'})
                .c('title').t('Configuration for "coven" Room').up()
                .c('instructions').t('Complete this form to modify the configuration of your room.').up()
                .c('field', {'type': 'hidden', 'var': 'FORM_TYPE'})
                    .c('value').t('http://jabber.org/protocol/muc#roomconfig').up().up()
                .c('field', {
                    'label': 'Natural-Language Room Name',
                    'type': 'text-single',
                    'var': 'muc#roomconfig_roomname'})
                    .c('value').t('Coven').up().up()
        _converse.api.connection.get()._dataRecv(mock.createRequest(config_stanza));

        const modal = _converse.api.modal.get('converse-muc-config-modal');
        const name_el = await u.waitUntil(() => modal.querySelector('input[name="muc#roomconfig_roomname"]'));
        name_el.value = 'New room name';
        modal.querySelector('.chatroom-form input[type="submit"]').click();

        iq = await u.waitUntil(() => IQ_stanzas.filter(iq => iq.matches(`iq[to="${muc_jid}"][type="set"]`)).pop());
        IQ_stanzas.length = 0; // Empty the array
        const result = $iq({
            "xmlns": "jabber:client",
            "type": "result",
            "to": jid,
            "from": muc_jid,
            "id": iq.getAttribute('id')
        });
        _converse.api.connection.get()._dataRecv(mock.createRequest(result));

        iq = await u.waitUntil(() => IQ_stanzas.filter(
            iq => iq.querySelector(
                `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
            )).pop());

        const features_stanza = $iq({
            'from': muc_jid,
            'id': iq.getAttribute('id'),
            'to': 'romeo@montague.lit/desktop',
            'type': 'result'
        }).c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
            .c('identity', {
                'category': 'conference',
                'name': 'New room name',
                'type': 'text'
            }).up();
        _converse.api.connection.get()._dataRecv(mock.createRequest(features_stanza));

        await u.waitUntil(() => new Promise(success => muc_el.model.features.on('change', success)));

        initials_el = rooms_list.querySelector('converse-avatar .avatar-initials');
        expect(initials_el.textContent).toBe('NN');
        expect(getComputedStyle(initials_el).backgroundColor).toBe('rgb(75, 103, 255)');

        muc_initials_el = muc_el.querySelector('converse-muc-heading converse-avatar .avatar-initials');
        expect(muc_initials_el.textContent).toBe(initials_el.textContent);
        expect(getComputedStyle(muc_initials_el).backgroundColor).toBe(getComputedStyle(initials_el).backgroundColor);

        // Change MUC avatar and check that it reflects
        muc_el.model.vcard.set({
            image: _converse.default_avatar_image,
            image_type: _converse.default_avatar_image_type,
            vcard_updated: (new Date()).toISOString()
        });

        const muc_heading_avatar = await u.waitUntil(() => muc_el.querySelector(
            `converse-muc-heading converse-avatar svg image`
        ));

        const { default_avatar_image, default_avatar_image_type } = _converse;
        expect(muc_heading_avatar.getAttribute('href'))
            .toBe(`data:${default_avatar_image_type};base64,${default_avatar_image}`);

        const list_el_image = rooms_list.querySelector('converse-avatar svg image');
        expect(list_el_image.getAttribute('href'))
            .toBe(`data:${default_avatar_image_type};base64,${default_avatar_image}`);
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

        const { $msg, u } = converse.env;
        await mock.openControlBox(_converse);
        const room_jid = 'kitchen@conference.shakespeare.lit';
        const rooms_list = document.querySelector('converse-rooms-list');
        await u.waitUntil(() => rooms_list !== undefined, 500);
        await mock.openAndEnterChatRoom(_converse, room_jid, 'romeo');
        const view = _converse.chatboxviews.get(room_jid);
        u.minimize(view.model);
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
        u.maximize(view.model);
        indicator_el = lview.querySelector(".msgs-indicator");
        expect(indicator_el === null);
        room_el = lview.querySelector(".available-chatroom");
        await u.waitUntil(() => Array.from(room_el.classList).includes('unread-msgs') === false);
    }));
});
