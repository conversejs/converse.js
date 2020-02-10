(function (root, factory) {
    define(["jasmine", "mock", "test-utils" ], factory);
} (this, function (jasmine, mock, test_utils) {
    const _ = converse.env._,
          $pres = converse.env.$pres,
          $iq = converse.env.$iq,
          $msg = converse.env.$msg,
          Model = converse.env.Model,
          Strophe = converse.env.Strophe,
          Promise = converse.env.Promise,
          dayjs = converse.env.dayjs,
          sizzle = converse.env.sizzle,
          u = converse.env.utils;

    describe("Groupchats", function () {

        describe("The \"rooms\" API", function () {

            it("has a method 'close' which closes rooms by JID or all rooms when called with no arguments",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');

                _converse.connection.IQ_stanzas = [];
                await test_utils.openAndEnterChatRoom(_converse, 'leisure@montague.lit', 'romeo');

                _converse.connection.IQ_stanzas = [];
                await test_utils.openAndEnterChatRoom(_converse, 'news@montague.lit', 'romeo');
                expect(u.isVisible(_converse.chatboxviews.get('lounge@montague.lit').el)).toBeTruthy();
                expect(u.isVisible(_converse.chatboxviews.get('leisure@montague.lit').el)).toBeTruthy();
                expect(u.isVisible(_converse.chatboxviews.get('news@montague.lit').el)).toBeTruthy();

                await _converse.api.roomviews.close('lounge@montague.lit');
                expect(_converse.chatboxviews.get('lounge@montague.lit')).toBeUndefined();
                expect(u.isVisible(_converse.chatboxviews.get('leisure@montague.lit').el)).toBeTruthy();
                expect(u.isVisible(_converse.chatboxviews.get('news@montague.lit').el)).toBeTruthy();

                await _converse.api.roomviews.close(['leisure@montague.lit', 'news@montague.lit']);
                expect(_converse.chatboxviews.get('lounge@montague.lit')).toBeUndefined();
                expect(_converse.chatboxviews.get('leisure@montague.lit')).toBeUndefined();
                expect(_converse.chatboxviews.get('news@montague.lit')).toBeUndefined();
                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                await test_utils.openAndEnterChatRoom(_converse, 'leisure@montague.lit', 'romeo');
                expect(u.isVisible(_converse.chatboxviews.get('lounge@montague.lit').el)).toBeTruthy();
                expect(u.isVisible(_converse.chatboxviews.get('leisure@montague.lit').el)).toBeTruthy();
                await _converse.api.roomviews.close();
                expect(_converse.chatboxviews.get('lounge@montague.lit')).toBeUndefined();
                expect(_converse.chatboxviews.get('leisure@montague.lit')).toBeUndefined();
                done();
            }));

            it("has a method 'get' which returns a wrapped groupchat (if it exists)",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');
                await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group .group-toggle').length, 300);
                let muc_jid = 'chillout@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
                let room = await _converse.api.rooms.get(muc_jid);
                expect(room instanceof Object).toBeTruthy();

                let chatroomview = _converse.chatboxviews.get(muc_jid);
                expect(chatroomview.is_chatroom).toBeTruthy();

                expect(u.isVisible(chatroomview.el)).toBeTruthy();
                await chatroomview.close();

                // Test with mixed case
                muc_jid = 'Leisure@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
                room = await _converse.api.rooms.get(muc_jid);
                expect(room instanceof Object).toBeTruthy();
                chatroomview = _converse.chatboxviews.get(muc_jid.toLowerCase());
                expect(u.isVisible(chatroomview.el)).toBeTruthy();

                muc_jid = 'leisure@montague.lit';
                room = await _converse.api.rooms.get(muc_jid);
                expect(room instanceof Object).toBeTruthy();
                chatroomview = _converse.chatboxviews.get(muc_jid.toLowerCase());
                expect(u.isVisible(chatroomview.el)).toBeTruthy();

                muc_jid = 'leiSure@montague.lit';
                room = await _converse.api.rooms.get(muc_jid);
                expect(room instanceof Object).toBeTruthy();
                chatroomview = _converse.chatboxviews.get(muc_jid.toLowerCase());
                expect(u.isVisible(chatroomview.el)).toBeTruthy();
                chatroomview.close();

                // Non-existing room
                muc_jid = 'chillout2@montague.lit';
                room = await _converse.api.rooms.get(muc_jid);
                expect(room).toBe(null);
                done();
            }));

            it("has a method 'open' which opens (optionally configures) and returns a wrapped chat box",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                // Mock 'getDiscoInfo', otherwise the room won't be
                // displayed as it waits first for the features to be returned
                // (when it's a new room being created).
                spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());

                let jid = 'lounge@montague.lit';
                let chatroomview, IQ_id;
                await test_utils.openControlBox(_converse);
                await test_utils.waitForRoster(_converse, 'current');
                await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group .group-toggle').length);

                let room = await _converse.api.rooms.open(jid);
                // Test on groupchat that's not yet open
                expect(room instanceof Model).toBeTruthy();
                chatroomview = _converse.chatboxviews.get(jid);
                expect(chatroomview.is_chatroom).toBeTruthy();
                await u.waitUntil(() => u.isVisible(chatroomview.el));

                // Test again, now that the room exists.
                room = await _converse.api.rooms.open(jid);
                expect(room instanceof Model).toBeTruthy();
                chatroomview = _converse.chatboxviews.get(jid);
                expect(chatroomview.is_chatroom).toBeTruthy();
                expect(u.isVisible(chatroomview.el)).toBeTruthy();
                await chatroomview.close();

                // Test with mixed case in JID
                jid = 'Leisure@montague.lit';
                room = await _converse.api.rooms.open(jid);
                expect(room instanceof Model).toBeTruthy();
                chatroomview = _converse.chatboxviews.get(jid.toLowerCase());
                await u.waitUntil(() => u.isVisible(chatroomview.el));

                jid = 'leisure@montague.lit';
                room = await _converse.api.rooms.open(jid);
                expect(room instanceof Model).toBeTruthy();
                chatroomview = _converse.chatboxviews.get(jid.toLowerCase());
                await u.waitUntil(() => u.isVisible(chatroomview.el));

                jid = 'leiSure@montague.lit';
                room = await _converse.api.rooms.open(jid);
                expect(room instanceof Model).toBeTruthy();
                chatroomview = _converse.chatboxviews.get(jid.toLowerCase());
                await u.waitUntil(() => u.isVisible(chatroomview.el));
                chatroomview.close();

                _converse.muc_instant_rooms = false;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                // Test with configuration
                room = await _converse.api.rooms.open('room@conference.example.org', {
                    'nick': 'some1',
                    'auto_configure': true,
                    'roomconfig': {
                        'getmemberlist': ['moderator', 'participant'],
                        'changesubject': false,
                        'membersonly': true,
                        'persistentroom': true,
                        'publicroom': true,
                        'roomdesc': 'Welcome to this groupchat',
                        'whois': 'anyone'
                    }
                });
                expect(room instanceof Model).toBeTruthy();
                chatroomview = _converse.chatboxviews.get('room@conference.example.org');

                // We pretend this is a new room, so no disco info is returned.
                const features_stanza = $iq({
                        from: 'room@conference.example.org',
                        'id': IQ_id,
                        'to': 'romeo@montague.lit/desktop',
                        'type': 'error'
                    }).c('error', {'type': 'cancel'})
                        .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                /* <presence xmlns="jabber:client" to="romeo@montague.lit/pda" from="room@conference.example.org/yo">
                 *  <x xmlns="http://jabber.org/protocol/muc#user">
                 *      <item affiliation="owner" jid="romeo@montague.lit/pda" role="moderator"/>
                 *      <status code="110"/>
                 *      <status code="201"/>
                 *  </x>
                 * </presence>
                 */
                const presence = $pres({
                        from:'room@conference.example.org/some1',
                        to:'romeo@montague.lit/pda'
                    })
                    .c('x', {xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        affiliation: 'owner',
                        jid: 'romeo@montague.lit/pda',
                        role: 'moderator'
                    }).up()
                    .c('status', {code:'110'}).up()
                    .c('status', {code:'201'});
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(_converse.connection.sendIQ).toHaveBeenCalled();

                const IQ_stanzas = _converse.connection.IQ_stanzas;
                const iq = IQ_stanzas.filter(s => s.querySelector(`query[xmlns="${Strophe.NS.MUC_OWNER}"]`)).pop();
                expect(Strophe.serialize(iq)).toBe(
                    `<iq id="${iq.getAttribute('id')}" to="room@conference.example.org" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#owner"/></iq>`);

                const node = u.toStanza(`
                   <iq xmlns="jabber:client"
                        type="result"
                        to="romeo@montague.lit/pda"
                        from="room@conference.example.org" id="${iq.getAttribute('id')}">
                    <query xmlns="http://jabber.org/protocol/muc#owner">
                        <x xmlns="jabber:x:data" type="form">
                        <title>Configuration for room@conference.example.org</title>
                        <instructions>Complete and submit this form to configure the room.</instructions>
                        <field var="FORM_TYPE" type="hidden">
                            <value>http://jabber.org/protocol/muc#roomconfig</value>
                        </field>
                        <field type="text-single" var="muc#roomconfig_roomname" label="Name">
                            <value>Room</value>
                        </field>
                        <field type="text-single" var="muc#roomconfig_roomdesc" label="Description"><value/></field>
                        <field type="boolean" var="muc#roomconfig_persistentroom" label="Make Room Persistent?"/>
                        <field type="boolean" var="muc#roomconfig_publicroom" label="Make Room Publicly Searchable?"><value>1</value></field>
                        <field type="boolean" var="muc#roomconfig_changesubject" label="Allow Occupants to Change Subject?"/>
                        <field type="list-single" var="muc#roomconfig_whois" label="Who May Discover Real JIDs?"><option label="Moderators Only">
                           <value>moderators</value></option><option label="Anyone"><value>anyone</value></option>
                        </field>
                        <field label="Roles and Affiliations that May Retrieve Member List"
                               type="list-multi"
                               var="muc#roomconfig_getmemberlist">
                            <value>moderator</value>
                            <value>participant</value>
                            <value>visitor</value>
                        </field>
                        <field type="text-private" var="muc#roomconfig_roomsecret" label="Password"><value/></field>
                        <field type="boolean" var="muc#roomconfig_moderatedroom" label="Make Room Moderated?"/>
                        <field type="boolean" var="muc#roomconfig_membersonly" label="Make Room Members-Only?"/>
                        <field type="text-single" var="muc#roomconfig_historylength" label="Maximum Number of History Messages Returned by Room">
                           <value>20</value></field>
                        </x>
                    </query>
                    </iq>`);

                spyOn(chatroomview.model, 'sendConfiguration').and.callThrough();
                _converse.connection._dataRecv(test_utils.createRequest(node));
                await u.waitUntil(() => chatroomview.model.sendConfiguration.calls.count() === 1);

                const sent_stanza = IQ_stanzas.filter(s => s.getAttribute('type') === 'set').pop();
                expect(sizzle('field[var="muc#roomconfig_roomname"] value', sent_stanza).pop().textContent.trim()).toBe('Room');
                expect(sizzle('field[var="muc#roomconfig_roomdesc"] value', sent_stanza).pop().textContent.trim()).toBe('Welcome to this groupchat');
                expect(sizzle('field[var="muc#roomconfig_persistentroom"] value', sent_stanza).pop().textContent.trim()).toBe('1');
                expect(sizzle('field[var="muc#roomconfig_getmemberlist"] value', sent_stanza).map(e => e.textContent.trim()).join(' ')).toBe('moderator participant');
                expect(sizzle('field[var="muc#roomconfig_publicroom"] value ', sent_stanza).pop().textContent.trim()).toBe('1');
                expect(sizzle('field[var="muc#roomconfig_changesubject"] value', sent_stanza).pop().textContent.trim()).toBe('0');
                expect(sizzle('field[var="muc#roomconfig_whois"] value ', sent_stanza).pop().textContent.trim()).toBe('anyone');
                expect(sizzle('field[var="muc#roomconfig_membersonly"] value', sent_stanza).pop().textContent.trim()).toBe('1');
                expect(sizzle('field[var="muc#roomconfig_historylength"] value', sent_stanza).pop().textContent.trim()).toBe('20');
                done();
            }));
        });

        describe("An instant groupchat", function () {

            it("will be created when muc_instant_rooms is set to true",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                let IQ_stanzas = _converse.connection.IQ_stanzas;
                const muc_jid = 'lounge@montague.lit';
                await test_utils.openChatRoom(_converse, 'lounge', 'montague.lit', 'romeo');

                const disco_selector = `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`;
                const stanza = await u.waitUntil(() => IQ_stanzas.filter(iq => iq.querySelector(disco_selector)).pop());
                // We pretend this is a new room, so no disco info is returned.
                const features_stanza = $iq({
                        'from': 'lounge@montague.lit',
                        'id': stanza.getAttribute('id'),
                        'to': 'romeo@montague.lit/desktop',
                        'type': 'error'
                    }).c('error', {'type': 'cancel'})
                        .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                const view = _converse.chatboxviews.get('lounge@montague.lit');
                spyOn(view.model, 'join').and.callThrough();
                await test_utils.waitForReservedNick(_converse, muc_jid, '');
                const input = await u.waitUntil(() => view.el.querySelector('input[name="nick"]'), 1000);
                expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.NICKNAME_REQUIRED);
                input.value = 'nicky';
                view.el.querySelector('input[type=submit]').click();
                expect(view.model.join).toHaveBeenCalled();
                _converse.connection.IQ_stanzas = [];
                await test_utils.getRoomFeatures(_converse, muc_jid);
                await u.waitUntil(() => view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING);

                // The user has just entered the room (because join was called)
                // and receives their own presence from the server.
                // See example 24:
                // https://xmpp.org/extensions/xep-0045.html#enter-pres
                //
                /* <presence xmlns="jabber:client" to="jordie.langen@chat.example.org/converse.js-11659299" from="myroom@conference.chat.example.org/jc">
                 *    <x xmlns="http://jabber.org/protocol/muc#user">
                 *        <item jid="jordie.langen@chat.example.org/converse.js-11659299" affiliation="owner" role="moderator"/>
                 *        <status code="110"/>
                 *        <status code="201"/>
                 *    </x>
                 *  </presence>
                 */
                const presence = $pres({
                        to:'romeo@montague.lit/orchard',
                        from:'lounge@montague.lit/nicky',
                        id:'5025e055-036c-4bc5-a227-706e7e352053'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    affiliation: 'owner',
                    jid: 'romeo@montague.lit/orchard',
                    role: 'moderator'
                }).up()
                .c('status').attrs({code:'110'}).up()
                .c('status').attrs({code:'201'}).nodeTree;
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                await u.waitUntil(() => view.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED);
                await test_utils.returnMemberLists(_converse, muc_jid);
                // await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-info').length === 2);

                const info_texts = Array.from(view.el.querySelectorAll('.chat-content .chat-info')).map(e => e.textContent.trim());
                expect(info_texts[0]).toBe('A new groupchat has been created');
                expect(info_texts[1]).toBe('nicky has entered the groupchat');

                // An instant room is created by saving the default configuratoin.
                //
                /* <iq to="myroom@conference.chat.example.org" type="set" xmlns="jabber:client" id="5025e055-036c-4bc5-a227-706e7e352053:sendIQ">
                 *   <query xmlns="http://jabber.org/protocol/muc#owner"><x xmlns="jabber:x:data" type="submit"/></query>
                 * </iq>
                 */
                const selector = `query[xmlns="${Strophe.NS.MUC_OWNER}"]`;
                IQ_stanzas = _converse.connection.IQ_stanzas;
                const iq = await u.waitUntil(() => IQ_stanzas.filter(s => s.querySelector(selector)).pop());
                expect(Strophe.serialize(iq)).toBe(
                    `<iq id="${iq.getAttribute('id')}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#owner"><x type="submit" xmlns="jabber:x:data"/>`+
                    `</query></iq>`);

                done();
            }));
        });

        describe("A Groupchat", function () {

            describe("upon being entered", function () {

                it("will fetch the member list if muc_fetch_members is true",
                    mock.initConverse(
                        ['rosterGroupsFetched'], {'muc_fetch_members': true},
                        async function (done, _converse) {

                    const sent_IQs = _converse.connection.IQ_stanzas;
                    const muc_jid = 'lounge@montague.lit';
                    spyOn(_converse.ChatRoomOccupants.prototype, 'fetchMembers').and.callThrough();
                    await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
                    let view = _converse.chatboxviews.get(muc_jid);
                    expect(view.model.occupants.fetchMembers).toHaveBeenCalled();

                    // Check in reverse order that we requested all three lists
                    const owner_iq = sent_IQs.pop();
                    expect(Strophe.serialize(owner_iq)).toBe(
                        `<iq id="${owner_iq.getAttribute('id')}" to="${muc_jid}" type="get" xmlns="jabber:client">`+
                            `<query xmlns="http://jabber.org/protocol/muc#admin"><item affiliation="owner"/></query>`+
                        `</iq>`);

                    const admin_iq = sent_IQs.pop();
                    expect(Strophe.serialize(admin_iq)).toBe(
                        `<iq id="${admin_iq.getAttribute('id')}" to="${muc_jid}" type="get" xmlns="jabber:client">`+
                            `<query xmlns="http://jabber.org/protocol/muc#admin"><item affiliation="admin"/></query>`+
                        `</iq>`);

                    const member_iq = sent_IQs.pop();
                    expect(Strophe.serialize(member_iq)).toBe(
                        `<iq id="${member_iq.getAttribute('id')}" to="${muc_jid}" type="get" xmlns="jabber:client">`+
                            `<query xmlns="http://jabber.org/protocol/muc#admin"><item affiliation="member"/></query>`+
                        `</iq>`);

                    _converse.muc_fetch_members = false;
                    await test_utils.openAndEnterChatRoom(_converse, 'orchard@montague.lit', 'romeo');
                    view = _converse.chatboxviews.get('orchard@montague.lit');
                    expect(view.model.occupants.fetchMembers.calls.count()).toBe(1);
                    done();
                }));

                describe("when fetching the member lists", function () {

                    it("gracefully handles being forbidden from fetching the lists for certain affiliations",
                        mock.initConverse(
                            ['rosterGroupsFetched'], {'muc_fetch_members': true},
                            async function (done, _converse) {

                        const sent_IQs = _converse.connection.IQ_stanzas;
                        const muc_jid = 'lounge@montague.lit';
                        const features = [
                            'http://jabber.org/protocol/muc',
                            'jabber:iq:register',
                            'muc_hidden',
                            'muc_membersonly',
                            'muc_passwordprotected',
                            Strophe.NS.MAM,
                            Strophe.NS.SID
                        ];
                        const nick = 'romeo';
                        await _converse.api.rooms.open(muc_jid);
                        await test_utils.getRoomFeatures(_converse, muc_jid, features);
                        await test_utils.waitForReservedNick(_converse, muc_jid, nick);
                        test_utils.receiveOwnMUCPresence(_converse, muc_jid, nick);
                        const view = _converse.chatboxviews.get(muc_jid);
                        await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));

                        // Check in reverse order that we requested all three lists
                        const owner_iq = sent_IQs.pop();
                        expect(Strophe.serialize(owner_iq)).toBe(
                            `<iq id="${owner_iq.getAttribute('id')}" to="${muc_jid}" type="get" xmlns="jabber:client">`+
                                `<query xmlns="http://jabber.org/protocol/muc#admin"><item affiliation="owner"/></query>`+
                            `</iq>`);
                        const admin_iq = sent_IQs.pop();
                        expect(Strophe.serialize(admin_iq)).toBe(
                            `<iq id="${admin_iq.getAttribute('id')}" to="${muc_jid}" type="get" xmlns="jabber:client">`+
                                `<query xmlns="http://jabber.org/protocol/muc#admin"><item affiliation="admin"/></query>`+
                            `</iq>`);
                        const member_iq = sent_IQs.pop();
                        expect(Strophe.serialize(member_iq)).toBe(
                            `<iq id="${member_iq.getAttribute('id')}" to="${muc_jid}" type="get" xmlns="jabber:client">`+
                                `<query xmlns="http://jabber.org/protocol/muc#admin"><item affiliation="member"/></query>`+
                            `</iq>`);

                        // It might be that the user is not allowed to fetch certain lists.
                        let err_stanza = u.toStanza(
                            `<iq xmlns="jabber:client" type="error" to="${_converse.jid}" from="${muc_jid}" id="${admin_iq.getAttribute('id')}">
                                <error type="auth"><forbidden xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error>
                            </iq>`);
                        _converse.connection._dataRecv(test_utils.createRequest(err_stanza));

                        err_stanza = u.toStanza(
                            `<iq xmlns="jabber:client" type="error" to="${_converse.jid}" from="${muc_jid}" id="${owner_iq.getAttribute('id')}">
                                <error type="auth"><forbidden xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error>
                            </iq>`);
                        _converse.connection._dataRecv(test_utils.createRequest(err_stanza));

                        // Now the service sends the member lists to the user
                        const member_list_stanza = $iq({
                                'from': muc_jid,
                                'id': member_iq.getAttribute('id'),
                                'to': 'romeo@montague.lit/orchard',
                                'type': 'result'
                            }).c('query', {'xmlns': Strophe.NS.MUC_ADMIN})
                                .c('item', {
                                    'affiliation': 'member',
                                    'jid': 'hag66@shakespeare.lit',
                                    'nick': 'thirdwitch',
                                    'role': 'participant'
                                });
                        _converse.connection._dataRecv(test_utils.createRequest(member_list_stanza));

                        await u.waitUntil(() => view.model.occupants.length > 1);
                        expect(view.model.occupants.length).toBe(2);
                        // The existing owner occupant should not have their
                        // affiliation removed due to the owner list
                        // not being returned (forbidden err).
                        expect(view.model.occupants.findWhere({'jid': _converse.bare_jid}).get('affiliation')).toBe('owner');
                        expect(view.model.occupants.findWhere({'jid': 'hag66@shakespeare.lit'}).get('affiliation')).toBe('member');
                        done();
                    }));
                });
            });

            it("clears cached messages when it gets closed and clear_messages_on_reconnection is true",
                mock.initConverse(
                    ['rosterGroupsFetched'], {'clear_messages_on_reconnection': true},
                    async function (done, _converse) {

                const muc_jid = 'lounge@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid , 'romeo');
                const view = _converse.chatboxviews.get(muc_jid);
                const message = 'Hello world',
                        nick = mock.chatroom_names[0],
                        msg = $msg({
                        'from': 'lounge@montague.lit/'+nick,
                        'id': u.getUniqueId(),
                        'to': 'romeo@montague.lit',
                        'type': 'groupchat'
                    }).c('body').t(message).tree();

                await view.model.onMessage(msg);

                spyOn(view.model, 'clearMessages').and.callThrough();
                await view.model.close();
                await u.waitUntil(() => view.model.clearMessages.calls.count());
                expect(view.model.messages.length).toBe(0);
                expect(view.content.innerHTML).toBe('');
                done()
            }));

            it("is opened when an xmpp: URI is clicked inside another groupchat",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');
                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                if (!view.el.querySelectorAll('.chat-area').length) {
                    view.renderChatArea();
                }
                expect(_converse.chatboxes.length).toEqual(2);
                const message = 'Please go to xmpp:coven@chat.shakespeare.lit?join',
                        nick = mock.chatroom_names[0],
                        msg = $msg({
                        'from': 'lounge@montague.lit/'+nick,
                        'id': u.getUniqueId(),
                        'to': 'romeo@montague.lit',
                        'type': 'groupchat'
                    }).c('body').t(message).tree();

                await view.model.onMessage(msg);
                await u.waitUntil(()  => view.el.querySelector('.chat-msg__text a'));
                view.el.querySelector('.chat-msg__text a').click();
                await u.waitUntil(() => _converse.chatboxes.length === 3)
                expect(_.includes(_converse.chatboxes.pluck('id'), 'coven@chat.shakespeare.lit')).toBe(true);
                done()
            }));

            it("shows a notification if it's not anonymous",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'coven@chat.shakespeare.lit';
                const nick = 'romeo';
                await _converse.api.rooms.open(muc_jid);
                await test_utils.getRoomFeatures(_converse, muc_jid);
                await test_utils.waitForReservedNick(_converse, muc_jid, nick);

                const view = _converse.chatboxviews.get(muc_jid);
                const chat_content = view.el.querySelector('.chat-content');
                /* <presence to="romeo@montague.lit/_converse.js-29092160"
                 *           from="coven@chat.shakespeare.lit/some1">
                 *      <x xmlns="http://jabber.org/protocol/muc#user">
                 *          <item affiliation="owner" jid="romeo@montague.lit/_converse.js-29092160" role="moderator"/>
                 *          <status code="110"/>
                 *          <status code="100"/>
                 *      </x>
                 *  </presence></body>
                 */
                const presence = $pres({
                        to: 'romeo@montague.lit/orchard',
                        from: 'coven@chat.shakespeare.lit/some1'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'owner',
                        'jid': 'romeo@montague.lit/_converse.js-29092160',
                        'role': 'moderator'
                    }).up()
                    .c('status', {code: '110'}).up()
                    .c('status', {code: '100'});
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                await u.waitUntil(() => chat_content.querySelectorAll('.chat-info').length === 2);
                expect(sizzle('div.chat-info:first', chat_content).pop().textContent.trim())
                    .toBe("This groupchat is not anonymous");
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim())
                    .toBe("some1 has entered the groupchat");
                done();
            }));


            it("shows join/leave messages when users enter or exit a groupchat",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'coven@chat.shakespeare.lit';
                await test_utils.openChatRoom(_converse, "coven", 'chat.shakespeare.lit', 'some1');
                await test_utils.getRoomFeatures(_converse, muc_jid);

                const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                const chat_content = view.el.querySelector('.chat-content');
                /* We don't show join/leave messages for existing occupants. We
                 * know about them because we receive their presences before we
                 * receive our own.
                 */
                let presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/oldguy'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'oldguy@montague.lit/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(0);

                /* <presence to="romeo@montague.lit/_converse.js-29092160"
                 *           from="coven@chat.shakespeare.lit/some1">
                 *      <x xmlns="http://jabber.org/protocol/muc#user">
                 *          <item affiliation="owner" jid="romeo@montague.lit/_converse.js-29092160" role="moderator"/>
                 *          <status code="110"/>
                 *      </x>
                 *  </presence></body>
                 */
                presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/some1'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'owner',
                        'jid': 'romeo@montague.lit/_converse.js-29092160',
                        'role': 'moderator'
                    }).up()
                    .c('status', {code: '110'});
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info:first', chat_content).pop().textContent.trim())
                    .toBe("some1 has entered the groupchat");

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
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(2);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim())
                    .toBe("newguy has entered the groupchat");

                const msg = $msg({
                    'from': 'coven@chat.shakespeare.lit/some1',
                    'id': u.getUniqueId(),
                    'to': 'romeo@montague.lit',
                    'type': 'groupchat'
                }).c('body').t('hello world').tree();
                _converse.connection._dataRecv(test_utils.createRequest(msg));
                await new Promise(resolve => view.once('messageInserted', resolve));

                // Add another entrant, otherwise the above message will be
                // collapsed if "newguy" leaves immediately again
                presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/newgirl'
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'newgirl@montague.lit/_converse.js-213098781',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(3);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim())
                    .toBe("newgirl has entered the groupchat");

                // Don't show duplicate join messages
                presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-290918392',
                        from: 'coven@chat.shakespeare.lit/newguy'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'newguy@montague.lit/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(3);

                /*  <presence
                 *      from='coven@chat.shakespeare.lit/thirdwitch'
                 *      to='crone1@shakespeare.lit/desktop'
                 *      type='unavailable'>
                 *  <status>Disconnected: Replaced by new connection</status>
                 *  <x xmlns='http://jabber.org/protocol/muc#user'>
                 *      <item affiliation='member'
                 *          jid='hag66@shakespeare.lit/pda'
                 *          role='none'/>
                 *  </x>
                 *  </presence>
                 */
                presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        type: 'unavailable',
                        from: 'coven@chat.shakespeare.lit/newguy'
                    })
                    .c('status', 'Disconnected: Replaced by new connection').up()
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'none',
                            'jid': 'newguy@montague.lit/_converse.js-290929789',
                            'role': 'none'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(4);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe(
                    'newguy has left the groupchat. '+
                    '"Disconnected: Replaced by new connection"');

                // When the user immediately joins again, we collapse the
                // multiple join/leave messages.
                presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/newguy'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'newguy@montague.lit/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(4);
                let msg_el = sizzle('div.chat-info:last', chat_content).pop();
                expect(msg_el.textContent.trim()).toBe("newguy has left and re-entered the groupchat");
                expect(msg_el.getAttribute('data-leavejoin')).toBe('newguy');

                presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        type: 'unavailable',
                        from: 'coven@chat.shakespeare.lit/newguy'
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'none',
                            'jid': 'newguy@montague.lit/_converse.js-290929789',
                            'role': 'none'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(4);
                msg_el = sizzle('div.chat-info', chat_content).pop();
                expect(msg_el.textContent.trim()).toBe('newguy has left the groupchat');
                expect(msg_el.getAttribute('data-leave')).toBe('newguy');

                presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/nomorenicks'
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'nomorenicks@montague.lit/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(5);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim())
                    .toBe("nomorenicks has entered the groupchat");

                presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-290918392',
                        type: 'unavailable',
                        from: 'coven@chat.shakespeare.lit/nomorenicks'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'nomorenicks@montague.lit/_converse.js-290929789',
                        'role': 'none'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(5);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim())
                    .toBe("nomorenicks has entered and left the groupchat");

                presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/nomorenicks'
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'nomorenicks@montague.lit/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(5);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim())
                    .toBe("nomorenicks has entered the groupchat");

                // Test a member joining and leaving
                presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-290918392',
                        from: 'coven@chat.shakespeare.lit/insider'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'member',
                        'jid': 'insider@montague.lit/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(6);

                /*  <presence
                 *      from='coven@chat.shakespeare.lit/thirdwitch'
                 *      to='crone1@shakespeare.lit/desktop'
                 *      type='unavailable'>
                 *  <status>Disconnected: Replaced by new connection</status>
                 *  <x xmlns='http://jabber.org/protocol/muc#user'>
                 *      <item affiliation='member'
                 *          jid='hag66@shakespeare.lit/pda'
                 *          role='none'/>
                 *  </x>
                 *  </presence>
                 */
                presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        type: 'unavailable',
                        from: 'coven@chat.shakespeare.lit/insider'
                    })
                    .c('status', 'Disconnected: Replaced by new connection').up()
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'member',
                            'jid': 'insider@montague.lit/_converse.js-290929789',
                            'role': 'none'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(6);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe(
                    'insider has entered and left the groupchat. '+
                    '"Disconnected: Replaced by new connection"');

                expect(view.model.occupants.length).toBe(5);
                expect(view.model.occupants.findWhere({'jid': 'insider@montague.lit'}).get('show')).toBe('offline');

                // New girl leaves
                presence = $pres({
                        'to': 'romeo@montague.lit/_converse.js-29092160',
                        'type': 'unavailable',
                        'from': 'coven@chat.shakespeare.lit/newgirl'
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'newgirl@montague.lit/_converse.js-213098781',
                        'role': 'none'
                    });

                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(6);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe("newgirl has entered and left the groupchat");
                expect(view.model.occupants.length).toBe(4);
                done();
            }));

            it("combines subsequent join/leave messages when users enter or exit a groupchat",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'coven@chat.shakespeare.lit', 'romeo')
                const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                const chat_content = view.el.querySelector('.chat-content');

                expect(sizzle('div.chat-info', chat_content).length).toBe(1);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe("romeo has entered the groupchat");

                let presence = u.toStanza(
                    `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/fabio">
                        <c xmlns="http://jabber.org/protocol/caps" node="http://conversations.im" ver="INI3xjRUioclBTP/aACfWi5m9UY=" hash="sha-1"/>
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="participant"/>
                        </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(2);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe("fabio has entered the groupchat");

                presence = u.toStanza(
                    `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/Dele Olajide">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="deleo@traderlynk.4ng.net/converse.js-39320524" role="participant"/>
                        </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(3);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe("Dele Olajide has entered the groupchat");

                presence = u.toStanza(
                    `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/jcbrand">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="owner" jid="jc@opkode.com/converse.js-30645022" role="moderator"/>
                            <status code="110"/>
                        </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                await u.waitUntil(() => sizzle('div.chat-info', chat_content).length > 3);

                expect(sizzle('div.chat-info', chat_content).length).toBe(4);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe("jcbrand has entered the groupchat");

                presence = u.toStanza(
                    `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="coven@chat.shakespeare.lit/Dele Olajide">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="deleo@traderlynk.4ng.net/converse.js-39320524" role="none"/>
                        </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(4);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe("Dele Olajide has entered and left the groupchat");

                presence = u.toStanza(
                    `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/Dele Olajide">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="deleo@traderlynk.4ng.net/converse.js-74567907" role="participant"/>
                        </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(4);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe("Dele Olajide has entered the groupchat");

                presence = u.toStanza(
                    `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/fuvuv" xml:lang="en">
                        <c xmlns="http://jabber.org/protocol/caps" node="http://jabber.pix-art.de" ver="5tOurnuFnp2h50hKafeUyeN4Yl8=" hash="sha-1"/>
                        <x xmlns="vcard-temp:x:update"/>
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="fuvuv@blabber.im/Pix-Art Messenger.8zoB" role="participant"/>
                        </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(5);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe("fuvuv has entered the groupchat");

                presence = u.toStanza(
                    `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="coven@chat.shakespeare.lit/fuvuv">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="fuvuv@blabber.im/Pix-Art Messenger.8zoB" role="none"/>
                        </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(5);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe("fuvuv has entered and left the groupchat");

                presence = u.toStanza(
                    `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="coven@chat.shakespeare.lit/fabio">
                        <status>Disconnected: Replaced by new connection</status>
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="none"/>
                        </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(5);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe(
                    `fabio has entered and left the groupchat. "Disconnected: Replaced by new connection"`);

                presence = u.toStanza(
                    `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/fabio">
                        <c xmlns="http://jabber.org/protocol/caps" node="http://conversations.im" ver="INI3xjRUioclBTP/aACfWi5m9UY=" hash="sha-1"/>
                        <status>Ready for a new day</status>
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="participant"/>
                        </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(5);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe(
                    `fabio has entered the groupchat. "Ready for a new day"`);

                // XXX: hack so that we can test leave/enter of occupants
                // who were already in the room when we joined.
                chat_content.innerHTML = '';

                presence = u.toStanza(
                    `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="coven@chat.shakespeare.lit/fabio">
                        <status>Disconnected: closed</status>
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="none"/>
                        </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(1);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe(
                    `fabio has left the groupchat. "Disconnected: closed"`);

                presence = u.toStanza(
                    `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="coven@chat.shakespeare.lit/Dele Olajide">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="deleo@traderlynk.4ng.net/converse.js-74567907" role="none"/>
                        </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(2);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe(
                    `Dele Olajide has left the groupchat`);

                presence = u.toStanza(
                    `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/fabio">
                        <c xmlns="http://jabber.org/protocol/caps" node="http://conversations.im" ver="INI3xjRUioclBTP/aACfWi5m9UY=" hash="sha-1"/>
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="participant"/>
                        </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(2);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe(
                    `fabio has left and re-entered the groupchat`);
                done();
            }));

            it("doesn't show the disconnection status when muc_show_join_leave_status is false",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {'muc_show_join_leave_status': false},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'coven@chat.shakespeare.lit', 'some1');
                const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                const chat_content = view.el.querySelector('.chat-content');
                expect(sizzle('div.chat-info', chat_content).pop().textContent.trim()).toBe('some1 has entered the groupchat');

                let presence = $pres({
                        to: 'romeo@montague.lit/orchard',
                        from: 'coven@chat.shakespeare.lit/newguy'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'newguy@montague.lit/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(2);
                expect(sizzle('div.chat-info', chat_content).pop().textContent.trim()).toBe('newguy has entered the groupchat');

                presence = $pres({
                    to: 'romeo@montague.lit/orchard',
                    type: 'unavailable',
                    from: 'coven@chat.shakespeare.lit/newguy'
                    })
                    .c('status', 'Disconnected: Replaced by new connection').up()
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'none',
                            'jid': 'newguy@montague.lit/_converse.js-290929789',
                            'role': 'none'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(2);
                expect(sizzle('div.chat-info', chat_content).pop().textContent.trim()).toBe('newguy has entered and left the groupchat');

                presence = u.toStanza(
                    `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/fabio">
                        <c xmlns="http://jabber.org/protocol/caps" node="http://conversations.im" ver="INI3xjRUioclBTP/aACfWi5m9UY=" hash="sha-1"/>
                        <status>Ready for a new day</status>
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="participant"/>
                        </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe(`fabio has entered the groupchat`);

                presence = u.toStanza(
                    `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/Dele Olajide">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="deleo@traderlynk.4ng.net/converse.js-39320524" role="participant"/>
                        </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(4);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe("Dele Olajide has entered the groupchat");
                await test_utils.sendMessage(view, 'hello world');

                presence = u.toStanza(
                    `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="coven@chat.shakespeare.lit/Dele Olajide">
                        <status>Gotta go!</status>
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="deleo@traderlynk.4ng.net/converse.js-74567907" role="none"/>
                        </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(5);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe(`Dele Olajide has left the groupchat`);
                done();
            }));

            it("role-change messages that follow a MUC leave are left out",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                // See https://github.com/conversejs/converse.js/issues/1259

                await test_utils.openAndEnterChatRoom(_converse, 'conversations@conference.siacs.eu', 'romeo');

                const presence = $pres({
                        to: 'romeo@montague.lit/orchard',
                        from: 'conversations@conference.siacs.eu/Guus'
                    }).c('x', {
                        'xmlns': Strophe.NS.MUC_USER
                    }).c('item', {
                        'affiliation': 'none',
                        'jid': 'Guus@montague.lit/xxx',
                        'role': 'visitor'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                const view = _converse.chatboxviews.get('conversations@conference.siacs.eu');
                const msg = $msg({
                        'from': 'conversations@conference.siacs.eu/romeo',
                        'id': u.getUniqueId(),
                        'to': 'romeo@montague.lit',
                        'type': 'groupchat'
                    }).c('body').t('Some message').tree();

                await view.model.onMessage(msg);

                let stanza = u.toStanza(
                    `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="conversations@conference.siacs.eu/Guus">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" role="none"/>
                        </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                stanza = u.toStanza(
                    `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="conversations@conference.siacs.eu/Guus">
                        <c xmlns="http://jabber.org/protocol/caps" node="http://conversations.im" ver="ISg6+9AoK1/cwhbNEDviSvjdPzI=" hash="sha-1"/>
                        <x xmlns="vcard-temp:x:update">
                            <photo>bf987c486c51fbc05a6a4a9f20dd19b5efba3758</photo>
                        </x>
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" role="visitor"/>
                        </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                const chat_content = view.el.querySelector('.chat-content');
                const messages = chat_content.querySelectorAll('div.chat-info');
                expect(messages.length).toBe(3);
                expect(messages[0].textContent.trim()).toBe('romeo has entered the groupchat');
                expect(messages[1].textContent.trim()).toBe('Guus has entered the groupchat');
                expect(messages[2].textContent.trim()).toBe('Guus has left and re-entered the groupchat');
                done();
            }));


            it("shows a new day indicator if a join/leave message is received on a new day",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'coven@chat.shakespeare.lit', 'romeo');
                const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                const chat_content = view.el.querySelector('.chat-content');
                let indicator = chat_content.querySelector('.date-separator');
                expect(indicator).not.toBe(null);
                expect(indicator.getAttribute('class')).toEqual('message date-separator');
                expect(indicator.getAttribute('data-isodate')).toEqual(dayjs().startOf('day').toISOString());
                expect(indicator.querySelector('time').textContent.trim()).toEqual(dayjs().startOf('day').format("dddd MMM Do YYYY"));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(1);
                expect(chat_content.querySelector('div.chat-info').textContent.trim()).toBe("romeo has entered the groupchat");

                const baseTime = new Date();
                jasmine.clock().install();
                jasmine.clock().mockDate(baseTime);
                var ONE_DAY_LATER = 86400000;
                jasmine.clock().tick(ONE_DAY_LATER);

                /* <presence to="romeo@montague.lit/_converse.js-29092160"
                 *           from="coven@chat.shakespeare.lit/some1">
                 *      <x xmlns="http://jabber.org/protocol/muc#user">
                 *          <item affiliation="owner" jid="romeo@montague.lit/_converse.js-29092160" role="moderator"/>
                 *          <status code="110"/>
                 *      </x>
                 *  </presence></body>
                 */
                var presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/some1'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'owner',
                        'jid': 'some1@montague.lit/_converse.js-290929789',
                        'role': 'moderator'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                indicator = chat_content.querySelector('.date-separator[data-isodate="'+dayjs().startOf('day').toISOString()+'"]');
                expect(indicator).not.toBe(null);

                expect(indicator.getAttribute('class')).toEqual('message date-separator');
                expect(indicator.getAttribute('data-isodate')).toEqual(dayjs().startOf('day').toISOString());
                expect(indicator.querySelector('time').getAttribute('class')).toEqual('separator-text');
                expect(indicator.querySelector('time').textContent.trim()).toEqual(dayjs().startOf('day').format("dddd MMM Do YYYY"));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(2);
                expect(chat_content.querySelector('div.chat-info:last-child').textContent.trim()).toBe(
                    "some1 has entered the groupchat"
                );

                jasmine.clock().tick(ONE_DAY_LATER);

                // Test a user leaving a groupchat
                presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        type: 'unavailable',
                        from: 'coven@chat.shakespeare.lit/some1'
                    })
                    .c('status', 'Disconnected: Replaced by new connection').up()
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'owner',
                            'jid': 'some1@montague.lit/_converse.js-290929789',
                            'role': 'moderator'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                indicator = chat_content.querySelector('.date-separator[data-isodate="'+dayjs().startOf('day').toISOString()+'"]');

                expect(indicator).not.toBe(null);
                expect(indicator.getAttribute('class')).toEqual('message date-separator');
                expect(indicator.getAttribute('data-isodate')).toEqual(dayjs().startOf('day').toISOString());

                expect(indicator.querySelector('time').textContent.trim()).toEqual(dayjs().startOf('day').format("dddd MMM Do YYYY"));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(3);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe(
                    'some1 has left the groupchat. '+
                    '"Disconnected: Replaced by new connection"');

                jasmine.clock().tick(ONE_DAY_LATER);

                let stanza = u.toStanza(`
                     <message xmlns="jabber:client"
                        to="romeo@montague.lit/_converse.js-290929789"
                        type="groupchat"
                        from="coven@chat.shakespeare.lit/some1">
                            <body>hello world</body>
                            <delay xmlns="urn:xmpp:delay" stamp="${(new Date()).toISOString()}" from="some1@montague.lit"/>
                     </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await new Promise(resolve => view.once('messageInserted', resolve));

                presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/newguy'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'newguy@montague.lit/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                let time = chat_content.querySelectorAll('time.separator-text');
                expect(time.length).toEqual(4);

                indicator = sizzle('.date-separator:eq(3)', chat_content).pop();
                expect(indicator.getAttribute('class')).toEqual('message date-separator');
                expect(indicator.getAttribute('data-isodate')).toEqual(dayjs().startOf('day').toISOString());
                expect(indicator.querySelector('time').textContent.trim()).toEqual(dayjs().startOf('day').format("dddd MMM Do YYYY"));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(4);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim())
                    .toBe("newguy has entered the groupchat");

                jasmine.clock().tick(ONE_DAY_LATER);

                stanza = u.toStanza(`
                    <message xmlns="jabber:client"
                       to="romeo@montague.lit/_converse.js-290929789"
                       type="groupchat"
                       from="coven@chat.shakespeare.lit/some1">"+
                           <body>hello world</body>"+
                           <delay xmlns="urn:xmpp:delay" stamp="${(new Date()).toISOString()}" from="some1@montague.lit"/>"+
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await new Promise(resolve => view.once('messageInserted', resolve));

                jasmine.clock().tick(ONE_DAY_LATER);
                // Test a user leaving a groupchat
                presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        type: 'unavailable',
                        from: 'coven@chat.shakespeare.lit/newguy'
                    })
                    .c('status', 'Disconnected: Replaced by new connection').up()
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'none',
                            'jid': 'newguy@montague.lit/_converse.js-290929789',
                            'role': 'none'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                time = chat_content.querySelectorAll('time.separator-text');
                expect(time.length).toEqual(6);

                indicator = sizzle('.date-separator:eq(5)', chat_content).pop();
                expect(indicator.getAttribute('class')).toEqual('message date-separator');
                expect(indicator.getAttribute('data-isodate')).toEqual(dayjs().startOf('day').toISOString());
                expect(indicator.querySelector('time').textContent.trim()).toEqual(dayjs().startOf('day').format("dddd MMM Do YYYY"));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(5);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim()).toBe(
                    'newguy has left the groupchat. '+
                    '"Disconnected: Replaced by new connection"');
                jasmine.clock().uninstall();
                done();
            }));


            it("supports the /me command",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitUntilDiscoConfirmed(_converse, 'montague.lit', [], ['vcard-temp']);
                await u.waitUntil(() => _converse.xmppstatus.vcard.get('fullname'));
                await test_utils.waitForRoster(_converse, 'current');
                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                if (!view.el.querySelectorAll('.chat-area').length) {
                    view.renderChatArea();
                }
                let message = '/me is tired';
                const nick = mock.chatroom_names[0];
                let msg = $msg({
                        'from': 'lounge@montague.lit/'+nick,
                        'id': u.getUniqueId(),
                        'to': 'romeo@montague.lit',
                        'type': 'groupchat'
                    }).c('body').t(message).tree();
                await view.model.onMessage(msg);
                expect(_.includes(view.el.querySelector('.chat-msg__author').textContent, '**Dyon van de Wege')).toBeTruthy();
                expect(view.el.querySelector('.chat-msg__text').textContent.trim()).toBe('is tired');

                message = '/me is as well';
                msg = $msg({
                    from: 'lounge@montague.lit/Romeo Montague',
                    id: u.getUniqueId(),
                    to: 'romeo@montague.lit',
                    type: 'groupchat'
                }).c('body').t(message).tree();
                await view.model.onMessage(msg);
                expect(_.includes(sizzle('.chat-msg__author:last', view.el).pop().textContent, '**Romeo Montague')).toBeTruthy();
                expect(sizzle('.chat-msg__text:last', view.el).pop().textContent.trim()).toBe('is as well');
                done();
            }));

            it("can be configured if you're its owner",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                let sent_IQ, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                await _converse.api.rooms.open('coven@chat.shakespeare.lit', {'nick': 'some1'});
                const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                await u.waitUntil(() => u.isVisible(view.el));
                // We pretend this is a new room, so no disco info is returned.
                const features_stanza = $iq({
                        from: 'coven@chat.shakespeare.lit',
                        'id': IQ_id,
                        'to': 'romeo@montague.lit/desktop',
                        'type': 'error'
                    }).c('error', {'type': 'cancel'})
                        .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                /* <presence to="romeo@montague.lit/_converse.js-29092160"
                 *           from="coven@chat.shakespeare.lit/some1">
                 *      <x xmlns="http://jabber.org/protocol/muc#user">
                 *          <item affiliation="owner" jid="romeo@montague.lit/_converse.js-29092160" role="moderator"/>
                 *          <status code="110"/>
                 *      </x>
                 *  </presence></body>
                 */
                const presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/some1'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'owner',
                        'jid': 'romeo@montague.lit/_converse.js-29092160',
                        'role': 'moderator'
                    }).up()
                    .c('status', {code: '110'});
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                await u.waitUntil(() => view.el.querySelector('.configure-chatroom-button') !== null);
                view.el.querySelector('.configure-chatroom-button').click();

                /* Check that an IQ is sent out, asking for the
                 * configuration form.
                 * See: // https://xmpp.org/extensions/xep-0045.html#example-163
                 *
                 *  <iq from='crone1@shakespeare.lit/desktop'
                 *      id='config1'
                 *      to='coven@chat.shakespeare.lit'
                 *      type='get'>
                 *  <query xmlns='http://jabber.org/protocol/muc#owner'/>
                 *  </iq>
                 */
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="`+IQ_id+`" to="coven@chat.shakespeare.lit" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#owner"/>`+
                    `</iq>`);

                /* Server responds with the configuration form.
                 * See: // https://xmpp.org/extensions/xep-0045.html#example-165
                 */
                const config_stanza = $iq({from: 'coven@chat.shakespeare.lit',
                    'id': IQ_id,
                    'to': 'romeo@montague.lit/desktop',
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
                            .c('value').t('A Dark Cave').up().up()
                        .c('field', {
                            'label': 'Short Description of Room',
                            'type': 'text-single',
                            'var': 'muc#roomconfig_roomdesc'})
                            .c('value').t('The place for all good witches!').up().up()
                        .c('field', {
                            'label': 'Enable Public Logging?',
                            'type': 'boolean',
                            'var': 'muc#roomconfig_enablelogging'})
                            .c('value').t(0).up().up()
                        .c('field', {
                            'label': 'Allow Occupants to Change Subject?',
                            'type': 'boolean',
                            'var': 'muc#roomconfig_changesubject'})
                            .c('value').t(0).up().up()
                        .c('field', {
                            'label': 'Allow Occupants to Invite Others?',
                            'type': 'boolean',
                            'var': 'muc#roomconfig_allowinvites'})
                            .c('value').t(0).up().up()
                        .c('field', {
                            'label': 'Who Can Send Private Messages?',
                            'type': 'list-single',
                            'var': 'muc#roomconfig_allowpm'})
                            .c('value').t('anyone').up()
                            .c('option', {'label': 'Anyone'})
                                .c('value').t('anyone').up().up()
                            .c('option', {'label': 'Anyone with Voice'})
                                .c('value').t('participants').up().up()
                            .c('option', {'label': 'Moderators Only'})
                                .c('value').t('moderators').up().up()
                            .c('option', {'label': 'Nobody'})
                                .c('value').t('none').up().up().up()
                        .c('field', {
                            'label': 'Roles for which Presence is Broadcasted',
                            'type': 'list-multi',
                            'var': 'muc#roomconfig_presencebroadcast'})
                            .c('value').t('moderator').up()
                            .c('value').t('participant').up()
                            .c('value').t('visitor').up()
                            .c('option', {'label': 'Moderator'})
                                .c('value').t('moderator').up().up()
                            .c('option', {'label': 'Participant'})
                                .c('value').t('participant').up().up()
                            .c('option', {'label': 'Visitor'})
                                .c('value').t('visitor').up().up().up()
                        .c('field', {
                            'label': 'Roles and Affiliations that May Retrieve Member List',
                            'type': 'list-multi',
                            'var': 'muc#roomconfig_getmemberlist'})
                            .c('value').t('moderator').up()
                            .c('value').t('participant').up()
                            .c('value').t('visitor').up()
                            .c('option', {'label': 'Moderator'})
                                .c('value').t('moderator').up().up()
                            .c('option', {'label': 'Participant'})
                                .c('value').t('participant').up().up()
                            .c('option', {'label': 'Visitor'})
                                .c('value').t('visitor').up().up().up()
                        .c('field', {
                            'label': 'Make Room Publicly Searchable?',
                            'type': 'boolean',
                            'var': 'muc#roomconfig_publicroom'})
                            .c('value').t(0).up().up()
                        .c('field', {
                            'label': 'Make Room Publicly Searchable?',
                            'type': 'boolean',
                            'var': 'muc#roomconfig_publicroom'})
                            .c('value').t(0).up().up()
                        .c('field', {
                            'label': 'Make Room Persistent?',
                            'type': 'boolean',
                            'var': 'muc#roomconfig_persistentroom'})
                            .c('value').t(0).up().up()
                        .c('field', {
                            'label': 'Make Room Moderated?',
                            'type': 'boolean',
                            'var': 'muc#roomconfig_moderatedroom'})
                            .c('value').t(0).up().up()
                        .c('field', {
                            'label': 'Make Room Members Only?',
                            'type': 'boolean',
                            'var': 'muc#roomconfig_membersonly'})
                            .c('value').t(0).up().up()
                        .c('field', {
                            'label': 'Password Required for Entry?',
                            'type': 'boolean',
                            'var': 'muc#roomconfig_passwordprotectedroom'})
                            .c('value').t(1).up().up()
                        .c('field', {'type': 'fixed'})
                            .c('value').t(
                                'If a password is required to enter this groupchat, you must specify the password below.'
                            ).up().up()
                        .c('field', {
                            'label': 'Password',
                            'type': 'text-private',
                            'var': 'muc#roomconfig_roomsecret'})
                            .c('value').t('cauldronburn');
                _converse.connection._dataRecv(test_utils.createRequest(config_stanza));

                const form = await u.waitUntil(() => view.el.querySelector('.muc-config-form'));
                expect(form.querySelectorAll('fieldset').length).toBe(2);
                const membersonly = view.el.querySelectorAll('input[name="muc#roomconfig_membersonly"]');
                expect(membersonly.length).toBe(1);
                expect(membersonly[0].getAttribute('type')).toBe('checkbox');
                membersonly[0].checked = true;

                const moderated = view.el.querySelectorAll('input[name="muc#roomconfig_moderatedroom"]');
                expect(moderated.length).toBe(1);
                expect(moderated[0].getAttribute('type')).toBe('checkbox');
                moderated[0].checked = true;

                const password = view.el.querySelectorAll('input[name="muc#roomconfig_roomsecret"]');
                expect(password.length).toBe(1);
                expect(password[0].getAttribute('type')).toBe('password');

                const allowpm = view.el.querySelectorAll('select[name="muc#roomconfig_allowpm"]');
                expect(allowpm.length).toBe(1);
                allowpm[0].value = 'moderators';

                const presencebroadcast = view.el.querySelectorAll('select[name="muc#roomconfig_presencebroadcast"]');
                expect(presencebroadcast.length).toBe(1);
                presencebroadcast[0].value = ['moderator'];

                view.el.querySelector('.chatroom-form input[type="submit"]').click();

                const sent_stanza = sent_IQ.nodeTree;
                expect(sent_stanza.querySelector('field[var="muc#roomconfig_membersonly"] value').textContent.trim()).toBe('1');
                expect(sent_stanza.querySelector('field[var="muc#roomconfig_moderatedroom"] value').textContent.trim()).toBe('1');
                expect(sent_stanza.querySelector('field[var="muc#roomconfig_allowpm"] value').textContent.trim()).toBe('moderators');
                expect(sent_stanza.querySelector('field[var="muc#roomconfig_presencebroadcast"] value').textContent.trim()).toBe('moderator');
                done();
            }));

            it("shows all members even if they're not currently present in the groupchat",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'lounge@montague.lit'

                const members = [{
                    'nick': 'juliet',
                    'jid': 'juliet@capulet.lit',
                    'affiliation': 'member'
                }];
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo', [], members);
                const view = _converse.chatboxviews.get(muc_jid);
                await u.waitUntil(() => view.model.occupants.length === 2);

                const occupants = view.el.querySelector('.occupant-list');
                for (let i=0; i<mock.chatroom_names.length; i++) {
                    const name = mock.chatroom_names[i];
                    const role = mock.chatroom_roles[name].role;
                    // See example 21 https://xmpp.org/extensions/xep-0045.html#enter-pres
                    const presence = $pres({
                            to:'romeo@montague.lit/pda',
                            from:'lounge@montague.lit/'+name
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: mock.chatroom_roles[name].affiliation,
                        jid: name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
                        role: role
                    });
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                }

                await u.waitUntil(() => occupants.querySelectorAll('li').length > 2, 500);
                expect(occupants.querySelectorAll('li').length).toBe(2+mock.chatroom_names.length);
                expect(view.model.occupants.length).toBe(2+mock.chatroom_names.length);

                mock.chatroom_names.forEach(name => {
                    const model = view.model.occupants.findWhere({'nick': name});
                    const index = view.model.occupants.indexOf(model);
                    expect(occupants.querySelectorAll('li .occupant-nick')[index].textContent.trim()).toBe(name);
                });

                // Test users leaving the groupchat
                // https://xmpp.org/extensions/xep-0045.html#exit
                for (let i=mock.chatroom_names.length-1; i>-1; i--) {
                    const name = mock.chatroom_names[i];
                    // See example 21 https://xmpp.org/extensions/xep-0045.html#enter-pres
                    const presence = $pres({
                        to:'romeo@montague.lit/pda',
                        from:'lounge@montague.lit/'+name,
                        type: 'unavailable'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: mock.chatroom_roles[name].affiliation,
                        jid: name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
                        role: 'none'
                    }).nodeTree;
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(occupants.querySelectorAll('li').length).toBe(8);
                }
                const presence = $pres({
                        to: 'romeo@montague.lit/pda',
                        from: 'lounge@montague.lit/nonmember'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    affiliation: null,
                    jid: 'servant@montague.lit',
                    role: 'visitor'
                });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                await u.waitUntil(() => occupants.querySelectorAll('li').length > 8, 500);
                expect(occupants.querySelectorAll('li').length).toBe(9);
                expect(view.model.occupants.length).toBe(9);
                expect(view.model.occupants.filter(o => o.isMember()).length).toBe(8);

                view.model.rejoin();
                // Test that members aren't removed when we reconnect
                expect(view.model.occupants.length).toBe(8);
                expect(occupants.querySelectorAll('li').length).toBe(8);
                done();
            }));

            it("shows users currently present in the groupchat",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                var view = _converse.chatboxviews.get('lounge@montague.lit'),
                    occupants = view.el.querySelector('.occupant-list');
                var presence;
                for (var i=0; i<mock.chatroom_names.length; i++) {
                    const name = mock.chatroom_names[i];
                    const role = mock.chatroom_roles[name].role;
                    // See example 21 https://xmpp.org/extensions/xep-0045.html#enter-pres
                    presence = $pres({
                            to:'romeo@montague.lit/pda',
                            from:'lounge@montague.lit/'+name
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'none',
                        jid: name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
                        role: role
                    }).up()
                    .c('status').attrs({code:'110'}).nodeTree;
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                }

                await u.waitUntil(() => occupants.querySelectorAll('li').length > 1, 500);
                expect(occupants.querySelectorAll('li').length).toBe(1+mock.chatroom_names.length);

                mock.chatroom_names.forEach(name => {
                    const model = view.model.occupants.findWhere({'nick': name});
                    const index = view.model.occupants.indexOf(model);
                    expect(occupants.querySelectorAll('li .occupant-nick')[index].textContent.trim()).toBe(name);
                });

                // Test users leaving the groupchat
                // https://xmpp.org/extensions/xep-0045.html#exit
                for (i=mock.chatroom_names.length-1; i>-1; i--) {
                    const name = mock.chatroom_names[i];
                    // See example 21 https://xmpp.org/extensions/xep-0045.html#enter-pres
                    presence = $pres({
                        to:'romeo@montague.lit/pda',
                        from:'lounge@montague.lit/'+name,
                        type: 'unavailable'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: mock.chatroom_roles[name].affiliation,
                        jid: name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
                        role: 'none'
                    }).nodeTree;
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(occupants.querySelectorAll('li').length).toBe(i+1);
                }
                done();
            }));

            it("escapes occupant nicknames when rendering them, to avoid JS-injection attacks",
                mock.initConverse(['rosterGroupsFetched'], {},
                async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                /* <presence xmlns="jabber:client" to="jc@chat.example.org/converse.js-17184538"
                 *      from="oo@conference.chat.example.org/&lt;img src=&quot;x&quot; onerror=&quot;alert(123)&quot;/&gt;">
                 *   <x xmlns="http://jabber.org/protocol/muc#user">
                 *    <item jid="jc@chat.example.org/converse.js-17184538" affiliation="owner" role="moderator"/>
                 *    <status code="110"/>
                 *   </x>
                 * </presence>"
                 */
                const presence = $pres({
                        to:'romeo@montague.lit/pda',
                        from:"lounge@montague.lit/&lt;img src=&quot;x&quot; onerror=&quot;alert(123)&quot;/&gt;"
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        jid: 'someone@montague.lit',
                        role: 'moderator',
                    }).up()
                    .c('status').attrs({code:'110'}).nodeTree;

                _converse.connection._dataRecv(test_utils.createRequest(presence));
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                await u.waitUntil(() => view.el.querySelectorAll('li .occupant-nick').length, 500);
                const occupants = view.el.querySelector('.occupant-list').querySelectorAll('li .occupant-nick');
                expect(occupants.length).toBe(2);
                expect(occupants[0].textContent.trim()).toBe("&lt;img src=&quot;x&quot; onerror=&quot;alert(123)&quot;/&gt;");
                done();
            }));

            it("indicates moderators and visitors by means of a special css class and tooltip",
                mock.initConverse(
                    ['rosterGroupsFetched'], {'view_mode': 'fullscreen'},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                let contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';

                await u.waitUntil(() => view.el.querySelectorAll('.occupant-list li').length, 500);
                let occupants = view.el.querySelectorAll('.occupant-list li');
                expect(occupants.length).toBe(1);
                expect(occupants[0].querySelector('.occupant-nick').textContent.trim()).toBe("romeo");
                expect(occupants[0].querySelectorAll('.badge').length).toBe(2);
                expect(occupants[0].querySelectorAll('.badge')[0].textContent.trim()).toBe('Owner');
                expect(sizzle('.badge:last', occupants[0]).pop().textContent.trim()).toBe('Moderator');

                var presence = $pres({
                        to:'romeo@montague.lit/pda',
                        from:'lounge@montague.lit/moderatorman'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    affiliation: 'admin',
                    jid: contact_jid,
                    role: 'moderator',
                }).up()
                .c('status').attrs({code:'110'}).nodeTree;

                _converse.connection._dataRecv(test_utils.createRequest(presence));
                await u.waitUntil(() => view.el.querySelectorAll('.occupant-list li').length > 1, 500);
                occupants = view.el.querySelectorAll('.occupant-list li');
                expect(occupants.length).toBe(2);
                expect(occupants[0].querySelector('.occupant-nick').textContent.trim()).toBe("moderatorman");
                expect(occupants[1].querySelector('.occupant-nick').textContent.trim()).toBe("romeo");
                expect(occupants[0].querySelectorAll('.badge').length).toBe(2);
                expect(occupants[0].querySelectorAll('.badge')[0].textContent.trim()).toBe('Admin');
                expect(occupants[0].querySelectorAll('.badge')[1].textContent.trim()).toBe('Moderator');

                expect(occupants[0].getAttribute('title')).toBe(
                    contact_jid + ' This user is a moderator. Click to mention moderatorman in your message.'
                );

                contact_jid = mock.cur_names[3].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                presence = $pres({
                    to:'romeo@montague.lit/pda',
                    from:'lounge@montague.lit/visitorwoman'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    jid: contact_jid,
                    role: 'visitor',
                }).up()
                .c('status').attrs({code:'110'}).nodeTree;
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                await u.waitUntil(() => view.el.querySelectorAll('.occupant-list li').length > 2, 500);
                occupants = view.el.querySelector('.occupant-list').querySelectorAll('li');
                expect(occupants.length).toBe(3);
                expect(occupants[2].querySelector('.occupant-nick').textContent.trim()).toBe("visitorwoman");
                expect(occupants[2].querySelectorAll('.badge').length).toBe(1);
                expect(sizzle('.badge', occupants[2]).pop().textContent.trim()).toBe('Visitor');
                expect(occupants[2].getAttribute('title')).toBe(
                    contact_jid + ' This user can NOT send messages in this groupchat. Click to mention visitorwoman in your message.'
                );
                done();
            }));

            it("properly handles notification that a room has been destroyed",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openChatRoomViaModal(_converse, 'problematic@muc.montague.lit', 'romeo')
                const presence = $pres().attrs({
                    from:'problematic@muc.montague.lit',
                    id:'n13mt3l',
                    to:'romeo@montague.lit/pda',
                    type:'error'})
                .c('error').attrs({'type':'cancel'})
                    .c('gone').attrs({'xmlns':'urn:ietf:params:xml:ns:xmpp-stanzas'})
                        .t('xmpp:other-room@chat.jabberfr.org?join').up()
                    .c('text').attrs({'xmlns':'urn:ietf:params:xml:ns:xmpp-stanzas'})
                        .t("We didn't like the name").nodeTree;

                const view = _converse.chatboxviews.get('problematic@muc.montague.lit');
                spyOn(view, 'showErrorMessage').and.callThrough();
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.el.querySelector('.chatroom-body .disconnect-msg').textContent.trim())
                    .toBe('This groupchat no longer exists');
                expect(view.el.querySelector('.chatroom-body .destroyed-reason').textContent.trim())
                    .toBe(`"We didn't like the name"`);
                expect(view.el.querySelector('.chatroom-body .moved-label').textContent.trim())
                    .toBe('The conversation has moved. Click below to enter.');
                expect(view.el.querySelector('.chatroom-body .moved-link').textContent.trim())
                    .toBe(`other-room@chat.jabberfr.org`);
                done();
            }));

            it("will use the user's reserved nickname, if it exists",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                const IQ_stanzas = _converse.connection.IQ_stanzas;
                const muc_jid = 'lounge@montague.lit';

                await test_utils.openChatRoom(_converse, 'lounge', 'montague.lit', 'romeo');

                let stanza = await u.waitUntil(() => _.filter(
                    IQ_stanzas,
                    iq => iq.querySelector(
                        `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                    )).pop()
                );
                // We pretend this is a new room, so no disco info is returned.
                const features_stanza = $iq({
                        from: 'lounge@montague.lit',
                        'id': stanza.getAttribute('id'),
                        'to': 'romeo@montague.lit/desktop',
                        'type': 'error'
                    }).c('error', {'type': 'cancel'})
                        .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));


                /* <iq from='hag66@shakespeare.lit/pda'
                 *     id='getnick1'
                 *     to='coven@chat.shakespeare.lit'
                 *     type='get'>
                 * <query xmlns='http://jabber.org/protocol/disco#info'
                 *         node='x-roomuser-item'/>
                 * </iq>
                 */
                const iq = await u.waitUntil(() => _.filter(
                        IQ_stanzas,
                        s => sizzle(`iq[to="${muc_jid}"] query[node="x-roomuser-item"]`, s).length
                    ).pop()
                );
                expect(Strophe.serialize(iq)).toBe(
                    `<iq from="romeo@montague.lit/orchard" id="${iq.getAttribute('id')}" to="lounge@montague.lit" `+
                        `type="get" xmlns="jabber:client">`+
                            `<query node="x-roomuser-item" xmlns="http://jabber.org/protocol/disco#info"/></iq>`);

                /* <iq from='coven@chat.shakespeare.lit'
                 *     id='getnick1'
                 *     to='hag66@shakespeare.lit/pda'
                 *     type='result'>
                 *     <query xmlns='http://jabber.org/protocol/disco#info'
                 *             node='x-roomuser-item'>
                 *         <identity
                 *             category='conference'
                 *             name='thirdwitch'
                 *             type='text'/>
                 *     </query>
                 * </iq>
                 */
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                stanza = $iq({
                    'type': 'result',
                    'id': iq.getAttribute('id'),
                    'from': view.model.get('jid'),
                    'to': _converse.connection.jid
                }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#info', 'node': 'x-roomuser-item'})
                .c('identity', {'category': 'conference', 'name': 'thirdwitch', 'type': 'text'});
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                // The user has just entered the groupchat (because join was called)
                // and receives their own presence from the server.
                // See example 24:
                // https://xmpp.org/extensions/xep-0045.html#enter-pres
                const presence = $pres({
                        to:'romeo@montague.lit/orchard',
                        from:'lounge@montague.lit/thirdwitch',
                        id:'DC352437-C019-40EC-B590-AF29E879AF97'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'member',
                        jid: 'romeo@montague.lit/orchard',
                        role: 'participant'
                    }).up()
                    .c('status').attrs({code:'110'}).up()
                    .c('status').attrs({code:'210'}).nodeTree;

                _converse.connection._dataRecv(test_utils.createRequest(presence));
                await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-info').length === 2);
                const info_text = sizzle('.chat-content .chat-info:first', view.el).pop().textContent.trim();
                expect(info_text).toBe('Your nickname has been automatically set to thirdwitch');
                done();
            }));

            it("allows the user to invite their roster contacts to enter the groupchat",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {'view_mode': 'fullscreen'},
                    async function (done, _converse) {

                // We need roster contacts, so that we have someone to invite
                await test_utils.waitForRoster(_converse, 'current');
                const features = [
                    'http://jabber.org/protocol/muc',
                    'jabber:iq:register',
                    'muc_passwordprotected',
                    'muc_hidden',
                    'muc_temporary',
                    'muc_membersonly',
                    'muc_unmoderated',
                    'muc_anonymous'
                ]
                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo', features);
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                expect(view.model.getOwnAffiliation()).toBe('owner');
                expect(view.model.features.get('open')).toBe(false);

                expect(view.el.querySelector('.open-invite-modal')).not.toBe(null);

                // Members can't invite if the room isn't open
                view.model.getOwnOccupant().set('affiliation', 'member');

                await u.waitUntil(() => view.el.querySelector('.open-invite-modal') === null);

                view.model.features.set('open', 'true');
                await u.waitUntil(() => view.el.querySelector('.open-invite-modal'));

                view.el.querySelector('.open-invite-modal').click();
                const modal = view.muc_invite_modal;
                await u.waitUntil(() => u.isVisible(modal.el), 1000)

                expect(modal.el.querySelectorAll('#invitee_jids').length).toBe(1);
                expect(modal.el.querySelectorAll('textarea').length).toBe(1);

                spyOn(view.model, 'directInvite').and.callThrough();

                const input = modal.el.querySelector('#invitee_jids');
                input.value = "Balt";
                modal.el.querySelector('button[type="submit"]').click();

                await u.waitUntil(() => modal.el.querySelector('.error'));

                const error = modal.el.querySelector('.error');
                expect(error.textContent).toBe('Please enter a valid XMPP address');

                let evt = new Event('input');
                input.dispatchEvent(evt);

                let sent_stanza;
                spyOn(_converse.connection, 'send').and.callFake(stanza => (sent_stanza = stanza));
                const hint = await u.waitUntil(() => modal.el.querySelector('.suggestion-box__results li'));
                expect(input.value).toBe('Balt');
                expect(hint.textContent.trim()).toBe('Balthasar');

                evt = new Event('mousedown', {'bubbles': true});
                evt.button = 0;
                hint.dispatchEvent(evt);

                const textarea = modal.el.querySelector('textarea');
                textarea.value = "Please join!";
                modal.el.querySelector('button[type="submit"]').click();

                expect(view.model.directInvite).toHaveBeenCalled();
                expect(sent_stanza.toLocaleString()).toBe(
                    `<message from="romeo@montague.lit/orchard" `+
                            `id="${sent_stanza.nodeTree.getAttribute("id")}" `+
                            `to="balthasar@montague.lit" `+
                            `xmlns="jabber:client">`+
                        `<x jid="lounge@montague.lit" reason="Please join!" xmlns="jabber:x:conference"/>`+
                    `</message>`
                );
                done();
            }));

            it("can be joined automatically, based upon a received invite",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current'); // We need roster contacts, who can invite us
                const name = mock.cur_names[0];
                const from_jid = name.replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await u.waitUntil(() => _converse.roster.get(from_jid).vcard.get('fullname'));

                spyOn(window, 'confirm').and.callFake(() => true);
                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                await view.close(); // Hack, otherwise we have to mock stanzas.

                const muc_jid = 'lounge@montague.lit';
                const reason = "Please join this groupchat";

                expect(_converse.chatboxes.models.length).toBe(1);
                expect(_converse.chatboxes.models[0].id).toBe("controlbox");

                const stanza = u.toStanza(`
                    <message xmlns="jabber:client" to="${_converse.bare_jid}" from="${from_jid}" id="9bceb415-f34b-4fa4-80d5-c0d076a24231">
                       <x xmlns="jabber:x:conference" jid="${muc_jid}" reason="${reason}"/>
                    </message>`);
                await _converse.onDirectMUCInvitation(stanza);

                expect(window.confirm).toHaveBeenCalledWith(
                    name + ' has invited you to join a groupchat: '+ muc_jid +
                    ', and left the following reason: "'+reason+'"');
                expect(_converse.chatboxes.models.length).toBe(2);
                expect(_converse.chatboxes.models[0].id).toBe('controlbox');
                expect(_converse.chatboxes.models[1].id).toBe(muc_jid);
                done();
            }));

            it("shows received groupchat messages",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const text = 'This is a received message';
                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                spyOn(_converse.api, "trigger").and.callThrough();
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                if (!view.el.querySelectorAll('.chat-area').length) {
                    view.renderChatArea();
                }
                var nick = mock.chatroom_names[0];
                view.model.occupants.create({
                    'nick': nick,
                    'muc_jid': `${view.model.get('jid')}/${nick}`
                });

                const message = $msg({
                    from: 'lounge@montague.lit/'+nick,
                    id: '1',
                    to: 'romeo@montague.lit',
                    type: 'groupchat'
                }).c('body').t(text);
                await view.model.onMessage(message.nodeTree);
                const chat_content = view.el.querySelector('.chat-content');
                expect(chat_content.querySelectorAll('.chat-msg').length).toBe(1);
                expect(chat_content.querySelector('.chat-msg__text').textContent.trim()).toBe(text);
                expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));
                done();
            }));

            it("shows sent groupchat messages",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                spyOn(_converse.api, "trigger").and.callThrough();
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                if (!view.el.querySelectorAll('.chat-area').length) {
                    view.renderChatArea();
                }
                const text = 'This is a sent message';
                const textarea = view.el.querySelector('.chat-textarea');
                textarea.value = text;
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13
                });
                await new Promise(resolve => view.once('messageInserted', resolve));

                expect(_converse.api.trigger).toHaveBeenCalledWith('messageSend', jasmine.any(_converse.Message));
                const chat_content = view.el.querySelector('.chat-content');
                expect(chat_content.querySelectorAll('.chat-msg').length).toBe(1);

                // Let's check that if we receive the same message again, it's
                // not shown.
                const stanza = u.toStanza(`
                    <message xmlns="jabber:client"
                            from="lounge@montague.lit/romeo"
                            to="${_converse.connection.jid}"
                            type="groupchat">
                        <body>${text}</body>
                        <stanza-id xmlns="urn:xmpp:sid:0"
                                id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad"
                                by="lounge@montague.lit"/>
                        <origin-id xmlns="urn:xmpp:sid:0" id="${view.model.messages.at(0).get('origin_id')}"/>
                    </message>`);
                await view.model.onMessage(stanza);
                expect(chat_content.querySelectorAll('.chat-msg').length).toBe(1);
                expect(sizzle('.chat-msg__text:last').pop().textContent.trim()).toBe(text);
                expect(view.model.messages.length).toBe(1);
                // We don't emit an event if it's our own message
                expect(_converse.api.trigger.calls.count(), 1);
                done();
            }));

            it("will cause the chat area to be scrolled down only if it was at the bottom already",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const message = 'This message is received while the chat area is scrolled up';
                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                spyOn(view, 'scrollDown').and.callThrough();
                // Create enough messages so that there's a scrollbar.
                const promises = [];
                for (let i=0; i<20; i++) {
                    promises.push(
                        view.model.onMessage(
                            $msg({
                                from: 'lounge@montague.lit/someone',
                                to: 'romeo@montague.lit.com',
                                type: 'groupchat',
                                id: u.getUniqueId(),
                            }).c('body').t('Message: '+i).tree())
                    );
                }
                await Promise.all(promises);
                // Give enough time for `markScrolled` to have been called
                setTimeout(async () => {
                    view.content.scrollTop = 0;
                    await view.model.onMessage(
                        $msg({
                            from: 'lounge@montague.lit/someone',
                            to: 'romeo@montague.lit.com',
                            type: 'groupchat',
                            id: u.getUniqueId(),
                        }).c('body').t(message).tree());
                    // Now check that the message appears inside the chatbox in the DOM
                    const chat_content = view.el.querySelector('.chat-content');
                    const msg_txt = sizzle('.chat-msg:last .chat-msg__text', chat_content).pop().textContent;
                    expect(msg_txt).toEqual(message);
                    expect(view.content.scrollTop).toBe(0);
                    done();
                }, 500);
            }));

            it("shows the room topic in the header",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'jdev@conference.jabber.org', 'jc');
                const text = 'Jabber/XMPP Development | RFCs and Extensions: https://xmpp.org/ | Protocol and XSF discussions: xsf@muc.xmpp.org';
                let stanza = u.toStanza(`
                    <message xmlns="jabber:client" to="jc@opkode.com/_converse.js-60429116" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>${text}</subject>
                        <delay xmlns="urn:xmpp:delay" stamp="2014-02-04T09:35:39Z" from="jdev@conference.jabber.org"/>
                        <x xmlns="jabber:x:delay" stamp="20140204T09:35:39" from="jdev@conference.jabber.org"/>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                const view = _converse.chatboxviews.get('jdev@conference.jabber.org');
                await new Promise(resolve => view.model.once('change:subject', resolve));

                expect(sizzle('.chat-event:last', view.el).pop().textContent.trim()).toBe('Topic set by ralphm');
                expect(view.el.querySelector('.chat-head__desc').textContent.trim()).toBe(text);

                stanza = u.toStanza(
                    `<message xmlns="jabber:client" to="jc@opkode.com/_converse.js-60429116" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                         <subject>This is a message subject</subject>
                         <body>This is a message</body>
                     </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await new Promise(resolve => view.once('messageInserted', resolve));
                expect(sizzle('.chat-msg__subject', view.el).length).toBe(1);
                expect(sizzle('.chat-msg__subject', view.el).pop().textContent.trim()).toBe('This is a message subject');
                expect(sizzle('.chat-msg__text').length).toBe(1);
                expect(sizzle('.chat-msg__text').pop().textContent.trim()).toBe('This is a message');
                expect(view.el.querySelector('.chat-head__desc').textContent.trim()).toBe(text);

                // Removes current topic
                stanza = u.toStanza(
                    `<message xmlns="jabber:client" to="jc@opkode.com/_converse.js-60429116" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                         <subject/>
                     </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await new Promise(resolve => view.model.once('change:subject', resolve));
                expect(view.el.querySelector('.chat-head__desc')).toBe(null);
                expect(view.el.querySelector('.chat-info:last-child').textContent.trim()).toBe("Topic cleared by ralphm");
                done();
            }));

            it("escapes the subject before rendering it, to avoid JS-injection attacks",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'jdev@conference.jabber.org', 'jc');
                spyOn(window, 'alert');
                const subject = '<img src="x" onerror="alert(\'XSS\');"/>';
                const view = _converse.chatboxviews.get('jdev@conference.jabber.org');
                view.model.set({'subject': {
                    'text': subject,
                    'author': 'ralphm'
                }});
                expect(sizzle('.chat-event:last').pop().textContent.trim()).toBe('Topic set by ralphm');
                expect(view.el.querySelector('.chat-head__desc').textContent.trim()).toBe(subject);
                done();
            }));


            it("reconnects when no-acceptable error is returned when sending a message",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'coven@chat.shakespeare.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
                const view = _converse.chatboxviews.get(muc_jid);
                expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.ENTERED);
                await test_utils.sendMessage(view, 'hello world');

                const stanza = u.toStanza(`
                    <message xmlns='jabber:client'
                             from='${muc_jid}'
                             type='error'
                             to='${_converse.bare_jid}'>
                        <error type='cancel'>
                            <not-acceptable xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                        </error>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                let sent_stanzas = _converse.connection.sent_stanzas;
                const iq = await u.waitUntil(() => sent_stanzas.filter(s => sizzle(`[xmlns="${Strophe.NS.PING}"]`, s).length).pop());
                expect(Strophe.serialize(iq)).toBe(
                    `<iq id="${iq.getAttribute('id')}" to="coven@chat.shakespeare.lit/romeo" type="get" xmlns="jabber:client">`+
                        `<ping xmlns="urn:xmpp:ping"/>`+
                    `</iq>`);

                const result = u.toStanza(`
                    <iq from='${muc_jid}'
                        id='${iq.getAttribute('id')}'
                        to='${_converse.bare_jid}'
                        type='error'>
                    <error type='cancel'>
                        <not-acceptable xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                    </error>
                    </iq>`);
                sent_stanzas = _converse.connection.sent_stanzas;
                const index = sent_stanzas.length -1;

                _converse.connection.IQ_stanzas = [];
                _converse.connection._dataRecv(test_utils.createRequest(result));
                await test_utils.getRoomFeatures(_converse, muc_jid);

                const pres = await u.waitUntil(
                    () => sent_stanzas.slice(index).filter(s => s.nodeName === 'presence').pop());
                expect(Strophe.serialize(pres)).toBe(
                    `<presence from="${_converse.jid}" to="coven@chat.shakespeare.lit/romeo" xmlns="jabber:client">`+
                        `<x xmlns="http://jabber.org/protocol/muc"><history maxstanzas="0"/></x>`+
                    `</presence>`);
                done();
            }));


            it("informs users if the room configuration has changed",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'coven@chat.shakespeare.lit';
                await test_utils.openAndEnterChatRoom(_converse, 'coven@chat.shakespeare.lit', 'romeo');
                const view = _converse.chatboxviews.get(muc_jid);
                expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.ENTERED);

                const stanza = u.toStanza(`
                    <message from='${muc_jid}'
                            id='80349046-F26A-44F3-A7A6-54825064DD9E'
                            to='${_converse.jid}'
                            type='groupchat'>
                    <x xmlns='http://jabber.org/protocol/muc#user'>
                        <status code='170'/>
                    </x>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-info').length === 2);
                const info_messages = view.el.querySelectorAll('.chat-content .chat-info');
                expect(info_messages[0].textContent.trim()).toBe('romeo has entered the groupchat');
                expect(info_messages[1].textContent.trim()).toBe('Groupchat logging is now enabled');
                done();
            }));


            it("informs users if their nicknames have been changed.",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                /* The service then sends two presence stanzas to the full JID
                 * of each occupant (including the occupant who is changing his
                 * or her room nickname), one of type "unavailable" for the old
                 * nickname and one indicating availability for the new
                 * nickname.
                 *
                 * See: https://xmpp.org/extensions/xep-0045.html#changenick
                 *
                 *  <presence
                 *      from='coven@montague.lit/thirdwitch'
                 *      id='DC352437-C019-40EC-B590-AF29E879AF98'
                 *      to='hag66@shakespeare.lit/pda'
                 *      type='unavailable'>
                 *  <x xmlns='http://jabber.org/protocol/muc#user'>
                 *      <item affiliation='member'
                 *          jid='hag66@shakespeare.lit/pda'
                 *          nick='oldhag'
                 *          role='participant'/>
                 *      <status code='303'/>
                 *      <status code='110'/>
                 *  </x>
                 *  </presence>
                 *
                 *  <presence
                 *      from='coven@montague.lit/oldhag'
                 *      id='5B4F27A4-25ED-43F7-A699-382C6B4AFC67'
                 *      to='hag66@shakespeare.lit/pda'>
                 *  <x xmlns='http://jabber.org/protocol/muc#user'>
                 *      <item affiliation='member'
                 *          jid='hag66@shakespeare.lit/pda'
                 *          role='participant'/>
                 *      <status code='110'/>
                 *  </x>
                 *  </presence>
                 */
                const __ = _converse.__;
                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'oldnick');
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.ENTERED);
                const chat_content = view.el.querySelector('.chat-content');

                await u.waitUntil(() => view.el.querySelectorAll('li .occupant-nick').length, 500);
                let occupants = view.el.querySelector('.occupant-list');
                expect(occupants.childElementCount).toBe(1);
                expect(occupants.firstElementChild.querySelector('.occupant-nick').textContent.trim()).toBe("oldnick");

                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(1);
                expect(sizzle('div.chat-info:first', chat_content).pop().textContent.trim())
                    .toBe("oldnick has entered the groupchat");

                let presence = $pres().attrs({
                        from:'lounge@montague.lit/oldnick',
                        id:'DC352437-C019-40EC-B590-AF29E879AF98',
                        to:'romeo@montague.lit/pda',
                        type:'unavailable'
                    })
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'owner',
                        jid: 'romeo@montague.lit/pda',
                        nick: 'newnick',
                        role: 'moderator'
                    }).up()
                    .c('status').attrs({code:'303'}).up()
                    .c('status').attrs({code:'110'}).nodeTree;

                _converse.connection._dataRecv(test_utils.createRequest(presence));
                await u.waitUntil(() => view.el.querySelectorAll('.chat-info').length === 2);

                expect(sizzle('div.chat-info:last').pop().textContent.trim()).toBe(
                    __(_converse.muc.new_nickname_messages["303"], "newnick")
                );
                expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.ENTERED);

                occupants = view.el.querySelector('.occupant-list');
                expect(occupants.childElementCount).toBe(1);

                presence = $pres().attrs({
                        from:'lounge@montague.lit/newnick',
                        id:'5B4F27A4-25ED-43F7-A699-382C6B4AFC67',
                        to:'romeo@montague.lit/pda'
                    })
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'owner',
                        jid: 'romeo@montague.lit/pda',
                        role: 'moderator'
                    }).up()
                    .c('status').attrs({code:'110'}).nodeTree;

                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.ENTERED);
                // XXX: currently we still have an additional "has entered the groupchat"
                // notification for the new nickname. Ideally we'd not have
                // that, but that's probably not possible without some
                // significant refactoring.
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(3);
                expect(sizzle('div.chat-info', chat_content)[1].textContent.trim()).toBe(
                    __(_converse.muc.new_nickname_messages["303"], "newnick")
                );
                occupants = view.el.querySelector('.occupant-list');
                expect(occupants.childElementCount).toBe(1);
                expect(sizzle('.occupant-nick:first', occupants).pop().textContent.trim()).toBe("newnick");
                done();
            }));

            it("queries for the groupchat information before attempting to join the user",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                const IQ_stanzas = _converse.connection.IQ_stanzas;
                const muc_jid = 'coven@chat.shakespeare.lit';

                await _converse.api.rooms.open(muc_jid, {'nick': 'some1'});
                const stanza = await u.waitUntil(() => _.filter(
                    IQ_stanzas,
                    iq => iq.querySelector(
                        `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                    )).pop());

                // Check that the groupchat queried for the feautures.
                expect(Strophe.serialize(stanza)).toBe(
                    `<iq from="romeo@montague.lit/orchard" id="${stanza.getAttribute("id")}" to="${muc_jid}" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/disco#info"/>`+
                    `</iq>`);

                /* <iq from='coven@chat.shakespeare.lit'
                 *      id='ik3vs715'
                 *      to='hag66@shakespeare.lit/pda'
                 *      type='result'>
                 *  <query xmlns='http://jabber.org/protocol/disco#info'>
                 *      <identity
                 *          category='conference'
                 *          name='A Dark Cave'
                 *          type='text'/>
                 *      <feature var='http://jabber.org/protocol/muc'/>
                 *      <feature var='muc_passwordprotected'/>
                 *      <feature var='muc_hidden'/>
                 *      <feature var='muc_temporary'/>
                 *      <feature var='muc_open'/>
                 *      <feature var='muc_unmoderated'/>
                 *      <feature var='muc_nonanonymous'/>
                 *  </query>
                 *  </iq>
                 */
                const features_stanza = $iq({
                        'from': muc_jid,
                        'id': stanza.getAttribute('id'),
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
                        .c('feature', {'var': 'muc_nonanonymous'});
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));
                let view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING));
                view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                expect(view.model.features.get('fetched')).toBeTruthy();
                expect(view.model.features.get('passwordprotected')).toBe(true);
                expect(view.model.features.get('hidden')).toBe(true);
                expect(view.model.features.get('temporary')).toBe(true);
                expect(view.model.features.get('open')).toBe(true);
                expect(view.model.features.get('unmoderated')).toBe(true);
                expect(view.model.features.get('nonanonymous')).toBe(true);
                done();
            }));

            it("updates the shown features when the groupchat configuration has changed",
                mock.initConverse(
                    ['rosterGroupsFetched'], {'view_mode': 'fullscreen'},
                    async function (done, _converse) {

                let features = [
                    'http://jabber.org/protocol/muc',
                    'jabber:iq:register',
                    'muc_passwordprotected',
                    'muc_publicroom',
                    'muc_temporary',
                    'muc_open',
                    'muc_unmoderated',
                    'muc_nonanonymous'
                ];
                await test_utils.openAndEnterChatRoom(_converse, 'room@conference.example.org', 'romeo', features);
                const jid = 'room@conference.example.org';
                const view = _converse.chatboxviews.get(jid);

                const info_el = view.el.querySelector(".show-room-details-modal");
                info_el.click();
                const  modal = view.model.room_details_modal;
                await u.waitUntil(() => u.isVisible(modal.el), 1000);

                let features_list = modal.el.querySelector('.features-list');
                let features_shown = features_list.textContent.split('\n').map(s => s.trim()).filter(s => s);

                expect(features_shown.join(' ')).toBe(
                    'Password protected - This groupchat requires a password before entry '+
                    'Open - Anyone can join this groupchat '+
                    'Temporary - This groupchat will disappear once the last person leaves '+
                    'Not anonymous - All other groupchat participants can see your XMPP address '+
                    'Not moderated - Participants entering this groupchat can write right away');
                expect(view.model.features.get('hidden')).toBe(false);
                expect(view.model.features.get('mam_enabled')).toBe(false);
                expect(view.model.features.get('membersonly')).toBe(false);
                expect(view.model.features.get('moderated')).toBe(false);
                expect(view.model.features.get('nonanonymous')).toBe(true);
                expect(view.model.features.get('open')).toBe(true);
                expect(view.model.features.get('passwordprotected')).toBe(true);
                expect(view.model.features.get('persistent')).toBe(false);
                expect(view.model.features.get('publicroom')).toBe(true);
                expect(view.model.features.get('semianonymous')).toBe(false);
                expect(view.model.features.get('temporary')).toBe(true);
                expect(view.model.features.get('unmoderated')).toBe(true);
                expect(view.model.features.get('unsecured')).toBe(false);
                expect(view.el.querySelector('.chatbox-title__text').textContent.trim()).toBe('Room');

                view.el.querySelector('.configure-chatroom-button').click();

                const IQs = _converse.connection.IQ_stanzas;
                let iq = await u.waitUntil(() => _.filter(
                    IQs,
                    iq => iq.querySelector(
                        `iq[to="${jid}"] query[xmlns="${Strophe.NS.MUC_OWNER}"]`
                    )).pop());

                const response_el = u.toStanza(
                   `<iq xmlns="jabber:client"
                         type="result"
                         to="romeo@montague.lit/pda"
                         from="room@conference.example.org" id="${iq.getAttribute('id')}">
                     <query xmlns="http://jabber.org/protocol/muc#owner">
                         <x xmlns="jabber:x:data" type="form">
                         <title>Configuration for room@conference.example.org</title>
                         <instructions>Complete and submit this form to configure the room.</instructions>
                         <field var="FORM_TYPE" type="hidden">
                            <value>http://jabber.org/protocol/muc#roomconfig</value>
                        </field>
                        <field type="fixed">
                            <value>Room information</value>
                        </field>
                        <field var="muc#roomconfig_roomname" type="text-single" label="Title">
                            <value>Room</value>
                        </field>
                        <field var="muc#roomconfig_roomdesc" type="text-single" label="Description">
                            <desc>A brief description of the room</desc>
                            <value>This room is used in tests</value>
                        </field>
                        <field var="muc#roomconfig_lang" type="text-single" label="Language tag for room (e.g. 'en', 'de', 'fr' etc.)">
                            <desc>Indicate the primary language spoken in this room</desc>
                            <value>en</value>
                        </field>
                        <field var="muc#roomconfig_persistentroom" type="boolean" label="Persistent (room should remain even when it is empty)">
                            <desc>Rooms are automatically deleted when they are empty, unless this option is enabled</desc>
                            <value>1</value>
                        </field>
                        <field var="muc#roomconfig_publicroom" type="boolean" label="Include room information in public lists">
                            <desc>Enable this to allow people to find the room</desc>
                            <value>1</value>
                        </field>
                        <field type="fixed"><value>Access to the room</value></field>
                        <field var="muc#roomconfig_roomsecret" type="text-private" label="Password"><value/></field>
                        <field var="muc#roomconfig_membersonly" type="boolean" label="Only allow members to join">
                            <desc>Enable this to only allow access for room owners, admins and members</desc>
                        </field>
                        <field var="{http://prosody.im/protocol/muc}roomconfig_allowmemberinvites" type="boolean" label="Allow members to invite new members"/>
                            <field type="fixed"><value>Permissions in the room</value>
                        </field>
                        <field var="muc#roomconfig_changesubject" type="boolean" label="Allow anyone to set the room's subject">
                            <desc>Choose whether anyone, or only moderators, may set the room's subject</desc>
                        </field>
                        <field var="muc#roomconfig_moderatedroom" type="boolean" label="Moderated (require permission to speak)">
                            <desc>In moderated rooms occupants must be given permission to speak by a room moderator</desc>
                        </field>
                        <field var="muc#roomconfig_whois" type="list-single" label="Addresses (JIDs) of room occupants may be viewed by:">
                            <option label="Moderators only"><value>moderators</value></option>
                            <option label="Anyone"><value>anyone</value></option>
                            <value>anyone</value>
                        </field>
                        <field type="fixed"><value>Other options</value></field>
                        <field var="muc#roomconfig_historylength" type="text-single" label="Maximum number of history messages returned by room">
                            <desc>Specify the maximum number of previous messages that should be sent to users when they join the room</desc>
                            <value>50</value>
                        </field>
                        <field var="muc#roomconfig_defaulthistorymessages" type="text-single" label="Default number of history messages returned by room">
                            <desc>Specify the number of previous messages sent to new users when they join the room</desc>
                            <value>20</value>
                        </field>
                     </x>
                     </query>
                     </iq>`);
                _converse.connection._dataRecv(test_utils.createRequest(response_el));
                const el = await u.waitUntil(() => document.querySelector('.chatroom-form legend'));
                expect(el.textContent.trim()).toBe("Configuration for room@conference.example.org");
                sizzle('[name="muc#roomconfig_membersonly"]', view.el).pop().click();
                sizzle('[name="muc#roomconfig_roomname"]', view.el).pop().value = "New room name"
                view.el.querySelector('.chatroom-form input[type="submit"]').click();

                iq = await u.waitUntil(() => _.filter(IQs, iq => u.matchesSelector(iq, `iq[to="${jid}"][type="set"]`)).pop());
                const result = $iq({
                    "xmlns": "jabber:client",
                    "type": "result",
                    "to": "romeo@montague.lit/orchard",
                    "from": "lounge@muc.montague.lit",
                    "id": iq.getAttribute('id')
                });

                IQs.length = 0; // Empty the array
                _converse.connection._dataRecv(test_utils.createRequest(result));

                iq = await u.waitUntil(() => _.filter(
                    IQs,
                    iq => iq.querySelector(
                        `iq[to="${jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                    )).pop());

                const features_stanza = $iq({
                    'from': jid,
                    'id': iq.getAttribute('id'),
                    'to': 'romeo@montague.lit/desktop',
                    'type': 'result'
                }).c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                    .c('identity', {
                        'category': 'conference',
                        'name': 'New room name',
                        'type': 'text'
                    }).up();
                features = [
                    'http://jabber.org/protocol/muc',
                    'jabber:iq:register',
                    'muc_passwordprotected',
                    'muc_hidden',
                    'muc_temporary',
                    'muc_membersonly',
                    'muc_unmoderated',
                    'muc_nonanonymous'
                ];
                features.forEach(f => features_stanza.c('feature', {'var': f}).up());
                features_stanza.c('x', { 'xmlns':'jabber:x:data', 'type':'result'})
                    .c('field', {'var':'FORM_TYPE', 'type':'hidden'})
                        .c('value').t('http://jabber.org/protocol/muc#roominfo').up().up()
                    .c('field', {'type':'text-single', 'var':'muc#roominfo_description', 'label':'Description'})
                        .c('value').t('This is the description').up().up()
                    .c('field', {'type':'text-single', 'var':'muc#roominfo_occupants', 'label':'Number of occupants'})
                        .c('value').t(0);

                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                await u.waitUntil(() => new Promise(success => view.model.features.on('change', success)));
                features_list = modal.el.querySelector('.features-list');
                features_shown = features_list.textContent.split('\n').map(s => s.trim()).filter(s => s);
                expect(features_shown.join(' ')).toBe(
                    'Password protected - This groupchat requires a password before entry '+
                    'Hidden - This groupchat is not publicly searchable '+
                    'Members only - This groupchat is restricted to members only '+
                    'Temporary - This groupchat will disappear once the last person leaves '+
                    'Not anonymous - All other groupchat participants can see your XMPP address '+
                    'Not moderated - Participants entering this groupchat can write right away');
                expect(view.model.features.get('hidden')).toBe(true);
                expect(view.model.features.get('mam_enabled')).toBe(false);
                expect(view.model.features.get('membersonly')).toBe(true);
                expect(view.model.features.get('moderated')).toBe(false);
                expect(view.model.features.get('nonanonymous')).toBe(true);
                expect(view.model.features.get('open')).toBe(false);
                expect(view.model.features.get('passwordprotected')).toBe(true);
                expect(view.model.features.get('persistent')).toBe(false);
                expect(view.model.features.get('publicroom')).toBe(false);
                expect(view.model.features.get('semianonymous')).toBe(false);
                expect(view.model.features.get('temporary')).toBe(true);
                expect(view.model.features.get('unmoderated')).toBe(true);
                expect(view.model.features.get('unsecured')).toBe(false);
                expect(view.el.querySelector('.chatbox-title__text').textContent.trim()).toBe('New room name');
                done();
            }));

            it("indicates when a room is no longer anonymous",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                let IQ_id;
                const sendIQ = _converse.connection.sendIQ;

                await test_utils.openAndEnterChatRoom(_converse, 'coven@chat.shakespeare.lit', 'some1');
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                // We pretend this is a new room, so no disco info is returned.
                const features_stanza = $iq({
                        from: 'coven@chat.shakespeare.lit',
                        'id': IQ_id,
                        'to': 'romeo@montague.lit/desktop',
                        'type': 'error'
                    }).c('error', {'type': 'cancel'})
                        .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                /* <message xmlns="jabber:client"
                *              type="groupchat"
                *              to="romeo@montague.lit/_converse.js-27854181"
                *              from="coven@chat.shakespeare.lit">
                *      <x xmlns="http://jabber.org/protocol/muc#user">
                *          <status code="104"/>
                *          <status code="172"/>
                *      </x>
                *  </message>
                */
                const message = $msg({
                        type:'groupchat',
                        to: 'romeo@montague.lit/_converse.js-27854181',
                        from: 'coven@chat.shakespeare.lit'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('status', {code: '104'}).up()
                    .c('status', {code: '172'});
                _converse.connection._dataRecv(test_utils.createRequest(message));
                await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-info').length === 3);
                const chat_body = view.el.querySelector('.chatroom-body');
                expect(sizzle('.message:last', chat_body).pop().textContent.trim())
                    .toBe('This groupchat is now no longer anonymous');
                done();
            }));

            it("informs users if they have been kicked out of the groupchat",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                /*  <presence
                 *      from='harfleur@chat.shakespeare.lit/pistol'
                 *      to='pistol@shakespeare.lit/harfleur'
                 *      type='unavailable'>
                 *  <x xmlns='http://jabber.org/protocol/muc#user'>
                 *      <item affiliation='none' role='none'>
                 *          <actor nick='Fluellen'/>
                 *          <reason>Avaunt, you cullion!</reason>
                 *      </item>
                 *      <status code='110'/>
                 *      <status code='307'/>
                 *  </x>
                 *  </presence>
                 */
                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                var presence = $pres().attrs({
                        from:'lounge@montague.lit/romeo',
                        to:'romeo@montague.lit/pda',
                        type:'unavailable'
                    })
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'none',
                        jid: 'romeo@montague.lit/pda',
                        role: 'none'
                    })
                    .c('actor').attrs({nick: 'Fluellen'}).up()
                    .c('reason').t('Avaunt, you cullion!').up()
                    .up()
                    .c('status').attrs({code:'110'}).up()
                    .c('status').attrs({code:'307'}).nodeTree;

                _converse.connection._dataRecv(test_utils.createRequest(presence));

                const view = _converse.chatboxviews.get('lounge@montague.lit');
                expect(u.isVisible(view.el.querySelector('.chat-area'))).toBeFalsy();
                expect(u.isVisible(view.el.querySelector('.occupants'))).toBeFalsy();
                const chat_body = view.el.querySelector('.chatroom-body');
                expect(chat_body.querySelectorAll('.disconnect-msg').length).toBe(3);
                expect(chat_body.querySelector('.disconnect-msg:first-child').textContent.trim()).toBe(
                    'You have been kicked from this groupchat');
                expect(chat_body.querySelector('.disconnect-msg:nth-child(2)').textContent.trim()).toBe(
                    'This action was done by Fluellen.');
                expect(chat_body.querySelector('.disconnect-msg:nth-child(3)').textContent.trim()).toBe(
                    'The reason given is: "Avaunt, you cullion!".');
                done();
            }));


            it("can be saved to, and retrieved from, browserStorage",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.openChatRoom(_converse, 'lounge', 'montague.lit', 'romeo');
                // We instantiate a new ChatBoxes collection, which by default
                // will be empty.
                await test_utils.openControlBox(_converse);
                const newchatboxes = new _converse.ChatBoxes();
                expect(newchatboxes.length).toEqual(0);
                // The chatboxes will then be fetched from browserStorage inside the
                // onConnected method
                newchatboxes.onConnected();
                await new Promise(resolve => _converse.api.listen.once('chatBoxesFetched', resolve));

                expect(newchatboxes.length).toEqual(2);
                // Check that the chatrooms retrieved from browserStorage
                // have the same attributes values as the original ones.
                const attrs = ['id', 'box_id', 'visible'];
                let new_attrs, old_attrs;
                for (var i=0; i<attrs.length; i++) {
                    new_attrs = _.map(_.map(newchatboxes.models, 'attributes'), attrs[i]);
                    old_attrs = _.map(_.map(_converse.chatboxes.models, 'attributes'), attrs[i]);
                    // FIXME: should have have to sort here? Order must
                    // probably be the same...
                    // This should be fixed once the controlbox always opens
                    // only on the right.
                    expect(_.isEqual(new_attrs.sort(), old_attrs.sort())).toEqual(true);
                }
                _converse.rosterview.render();
                done();
            }));

            it("can be minimized by clicking a DOM element with class 'toggle-chatbox-button'",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.openChatRoom(_converse, 'lounge', 'montague.lit', 'romeo');
                const view = _converse.chatboxviews.get('lounge@montague.lit'),
                      trimmed_chatboxes = _converse.minimized_chats;

                spyOn(view, 'onMinimized').and.callThrough();
                spyOn(view, 'onMaximized').and.callThrough();
                spyOn(_converse.api, "trigger").and.callThrough();
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                view.el.querySelector('.toggle-chatbox-button').click();

                expect(view.onMinimized).toHaveBeenCalled();
                expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxMinimized', jasmine.any(Object));
                expect(u.isVisible(view.el)).toBeFalsy();
                expect(view.model.get('minimized')).toBeTruthy();
                expect(view.onMinimized).toHaveBeenCalled();
                await u.waitUntil(() => trimmed_chatboxes.get(view.model.get('id')));
                const trimmedview = trimmed_chatboxes.get(view.model.get('id'));
                trimmedview.el.querySelector("a.restore-chat").click();
                expect(view.onMaximized).toHaveBeenCalled();
                expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxMaximized', jasmine.any(Object));
                expect(view.model.get('minimized')).toBeFalsy();
                expect(_converse.api.trigger.calls.count(), 3);
                done();

            }));

            it("can be closed again by clicking a DOM element with class 'close-chatbox-button'",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.openChatRoom(_converse, 'lounge', 'montague.lit', 'romeo');
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                spyOn(view, 'close').and.callThrough();
                spyOn(_converse.api, "trigger").and.callThrough();
                spyOn(view.model, 'leave');
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(true));
                view.el.querySelector('.close-chatbox-button').click();
                await u.waitUntil(() => view.close.calls.count());
                expect(view.model.leave).toHaveBeenCalled();
                await u.waitUntil(() => _converse.api.trigger.calls.count());
                expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                done();
            }));

            it("informs users of role and affiliation changes",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'lounge@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
                const view = _converse.api.chatviews.get(muc_jid);
                let presence = $pres({
                        'from': 'lounge@montague.lit/annoyingGuy',
                        'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                        'to': 'romeo@montague.lit/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@montague.lit',
                            'affiliation': 'member',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                let info_msgs = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info'), 0);
                expect(info_msgs.pop().textContent.trim()).toBe("annoyingGuy has entered the groupchat");

                presence = $pres({
                        'from': 'lounge@montague.lit/annoyingGuy',
                        'to': 'romeo@montague.lit/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@montague.lit',
                            'affiliation': 'member',
                            'role': 'visitor'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                info_msgs = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info'), 0);
                expect(info_msgs.pop().textContent.trim()).toBe("annoyingGuy has been muted");

                presence = $pres({
                        'from': 'lounge@montague.lit/annoyingGuy',
                        'to': 'romeo@montague.lit/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@montague.lit',
                            'affiliation': 'member',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                info_msgs = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info'), 0);
                expect(info_msgs.pop().textContent.trim()).toBe("annoyingGuy has been given a voice");

                // Check that we don't see an info message concerning the role,
                // if the affiliation has changed.
                presence = $pres({
                        'from': 'lounge@montague.lit/annoyingGuy',
                        'to': 'romeo@montague.lit/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@montague.lit',
                            'affiliation': 'none',
                            'role': 'visitor'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                info_msgs = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info'), 0);
                expect(info_msgs.pop().textContent.trim()).toBe("annoyingGuy is no longer a member of this groupchat");
                done();
            }));

            it("notifies users of role and affiliation changes for members not currently in the groupchat",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'lounge@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
                const view = _converse.api.chatviews.get(muc_jid);

                let message = $msg({
                    from: 'lounge@montague.lit',
                    id: '2CF9013B-E8A8-42A1-9633-85AD7CA12F40',
                    to: 'romeo@montague.lit'
                })
                .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                .c('item', {
                    'jid': 'absentguy@montague.lit',
                    'affiliation': 'member',
                    'role': 'none'
                });
                _converse.connection._dataRecv(test_utils.createRequest(message));
                await u.waitUntil(() => view.model.occupants.length > 1);
                expect(view.model.occupants.length).toBe(2);
                expect(view.model.occupants.findWhere({'jid': 'absentguy@montague.lit'}).get('affiliation')).toBe('member');

                message = $msg({
                    from: 'lounge@montague.lit',
                    id: '2CF9013B-E8A8-42A1-9633-85AD7CA12F41',
                    to: 'romeo@montague.lit'
                })
                .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                .c('item', {
                    'jid': 'absentguy@montague.lit',
                    'affiliation': 'none',
                    'role': 'none'
                });
                _converse.connection._dataRecv(test_utils.createRequest(message));
                expect(view.model.occupants.length).toBe(2);
                expect(view.model.occupants.findWhere({'jid': 'absentguy@montague.lit'}).get('affiliation')).toBe('none');

                done();
            }));
        });


        describe("Each chat groupchat can take special commands", function () {

            it("takes /help to show the available commands",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                spyOn(window, 'confirm').and.callFake(() => true);
                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                let textarea = view.el.querySelector('.chat-textarea');
                const enter = { 'target': textarea, 'preventDefault': function preventDefault () {}, 'keyCode': 13 };
                textarea.value = '/help';
                view.onKeyDown(enter);

                let info_messages = sizzle('.chat-info:not(.chat-event)', view.el);
                expect(info_messages.length).toBe(20);
                expect(info_messages.pop().textContent.trim()).toBe('/voice: Allow muted user to post messages');
                expect(info_messages.pop().textContent.trim()).toBe('/topic: Set groupchat subject (alias for /subject)');
                expect(info_messages.pop().textContent.trim()).toBe('/subject: Set groupchat subject');
                expect(info_messages.pop().textContent.trim()).toBe('/revoke: Revoke the user\'s current affiliation');
                expect(info_messages.pop().textContent.trim()).toBe('/register: Register your nickname');
                expect(info_messages.pop().textContent.trim()).toBe('/owner: Grant ownership of this groupchat');
                expect(info_messages.pop().textContent.trim()).toBe('/op: Grant moderator role to user');
                expect(info_messages.pop().textContent.trim()).toBe('/nick: Change your nickname');
                expect(info_messages.pop().textContent.trim()).toBe('/mute: Remove user\'s ability to post messages');
                expect(info_messages.pop().textContent.trim()).toBe('/modtools: Opens up the moderator tools GUI');
                expect(info_messages.pop().textContent.trim()).toBe('/member: Grant membership to a user');
                expect(info_messages.pop().textContent.trim()).toBe('/me: Write in 3rd person');
                expect(info_messages.pop().textContent.trim()).toBe('/kick: Kick user from groupchat');
                expect(info_messages.pop().textContent.trim()).toBe('/help: Show this menu');
                expect(info_messages.pop().textContent.trim()).toBe('/destroy: Remove this groupchat');
                expect(info_messages.pop().textContent.trim()).toBe('/deop: Change user role to participant');
                expect(info_messages.pop().textContent.trim()).toBe('/clear: Clear the chat area');
                expect(info_messages.pop().textContent.trim()).toBe('/ban: Ban user by changing their affiliation to outcast');
                expect(info_messages.pop().textContent.trim()).toBe('/admin: Change user\'s affiliation to admin');
                expect(info_messages.pop().textContent.trim()).toBe('You can run the following commands');

                const occupant = view.model.occupants.findWhere({'jid': _converse.bare_jid});
                occupant.set('affiliation', 'admin');
                textarea = view.el.querySelector('.chat-textarea');
                textarea.value = '/clear';
                view.onKeyDown(enter);
                await u.waitUntil(() => sizzle('.chat-info:not(.chat-event)', view.el).length === 0);

                textarea.value = '/help';
                view.onKeyDown(enter);
                info_messages = sizzle('.chat-info:not(.chat-event)', view.el);
                expect(info_messages.length).toBe(19);
                let commands = info_messages.map(m => m.textContent.replace(/:.*$/, ''));
                expect(commands).toEqual([
                    "You can run the following commands",
                    "/admin", "/ban", "/clear", "/deop", "/destroy",
                    "/help", "/kick", "/me", "/member", "/modtools", "/mute", "/nick",
                    "/op", "/register", "/revoke", "/subject", "/topic", "/voice"
                ]);
                occupant.set('affiliation', 'member');
                textarea.value = '/clear';
                view.onKeyDown(enter);
                await u.waitUntil(() => sizzle('.chat-info:not(.chat-event)', view.el).length === 0);

                textarea.value = '/help';
                view.onKeyDown(enter);
                info_messages = sizzle('.chat-info', view.el).slice(1);
                expect(info_messages.length).toBe(9);
                commands = info_messages.map(m => m.textContent.replace(/:.*$/, ''));
                expect(commands).toEqual(["/clear", "/help", "/kick", "/me", "/modtools", "/mute", "/nick", "/register", "/voice"]);

                occupant.set('role', 'participant');
                textarea = view.el.querySelector('.chat-textarea');
                textarea.value = '/clear';
                view.onKeyDown(enter);
                await u.waitUntil(() => sizzle('.chat-info:not(.chat-event)', view.el).length === 0);

                textarea.value = '/help';
                view.onKeyDown(enter);
                info_messages = sizzle('.chat-info', view.el).slice(1);
                expect(info_messages.length).toBe(5);
                commands = info_messages.map(m => m.textContent.replace(/:.*$/, ''));
                expect(commands).toEqual(["/clear", "/help", "/me", "/nick", "/register"]);

                // Test that /topic is available if all users may change the subject
                // Note: we're making a shortcut here, this value should never be set manually
                view.model.config.set('changesubject', true);
                textarea.value = '/clear';
                view.onKeyDown(enter);
                await u.waitUntil(() => sizzle('.chat-info:not(.chat-event)', view.el).length === 0);

                textarea.value = '/help';
                view.onKeyDown(enter);
                info_messages = sizzle('.chat-info', view.el).slice(1);
                expect(info_messages.length).toBe(7);
                commands = info_messages.map(m => m.textContent.replace(/:.*$/, ''));
                expect(commands).toEqual(["/clear", "/help", "/me", "/nick", "/register", "/subject", "/topic"]);
                done();
            }));

            it("takes /help to show the available commands and commands can be disabled by config",
                mock.initConverse(
                    ['rosterGroupsFetched'], {muc_disable_slash_commands: ['mute', 'voice']},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                var textarea = view.el.querySelector('.chat-textarea');
                const enter = { 'target': textarea, 'preventDefault': function () {}, 'keyCode': 13 };
                spyOn(window, 'confirm').and.callFake(() => true);
                textarea.value = '/clear';
                view.onKeyDown(enter);
                textarea.value = '/help';
                view.onKeyDown(enter);

                const info_messages = sizzle('.chat-info:not(.chat-event)', view.el);
                expect(info_messages.length).toBe(18);
                expect(info_messages.pop().textContent.trim()).toBe('/topic: Set groupchat subject (alias for /subject)');
                expect(info_messages.pop().textContent.trim()).toBe('/subject: Set groupchat subject');
                expect(info_messages.pop().textContent.trim()).toBe('/revoke: Revoke the user\'s current affiliation');
                expect(info_messages.pop().textContent.trim()).toBe('/register: Register your nickname');
                expect(info_messages.pop().textContent.trim()).toBe('/owner: Grant ownership of this groupchat');
                expect(info_messages.pop().textContent.trim()).toBe('/op: Grant moderator role to user');
                expect(info_messages.pop().textContent.trim()).toBe('/nick: Change your nickname');
                expect(info_messages.pop().textContent.trim()).toBe('/modtools: Opens up the moderator tools GUI');
                expect(info_messages.pop().textContent.trim()).toBe('/member: Grant membership to a user');
                expect(info_messages.pop().textContent.trim()).toBe('/me: Write in 3rd person');
                expect(info_messages.pop().textContent.trim()).toBe('/kick: Kick user from groupchat');
                expect(info_messages.pop().textContent.trim()).toBe('/help: Show this menu');
                expect(info_messages.pop().textContent.trim()).toBe('/destroy: Remove this groupchat');
                expect(info_messages.pop().textContent.trim()).toBe('/deop: Change user role to participant');
                expect(info_messages.pop().textContent.trim()).toBe('/clear: Clear the chat area');
                expect(info_messages.pop().textContent.trim()).toBe('/ban: Ban user by changing their affiliation to outcast');
                expect(info_messages.pop().textContent.trim()).toBe('/admin: Change user\'s affiliation to admin');
                expect(info_messages.pop().textContent.trim()).toBe('You can run the following commands');
                done();
            }));

            it("takes /member to make an occupant a member",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                let iq_stanza;
                await test_utils.openAndEnterChatRoom(_converse, 'lounge@muc.montague.lit', 'romeo');
                const view = _converse.chatboxviews.get('lounge@muc.montague.lit');
                /* We don't show join/leave messages for existing occupants. We
                 * know about them because we receive their presences before we
                 * receive our own.
                 */
                const presence = $pres({
                        to: 'romeo@montague.lit/orchard',
                        from: 'lounge@muc.montague.lit/marc'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'marc@montague.lit/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.model.occupants.length).toBe(2);

                const textarea = view.el.querySelector('.chat-textarea');
                let sent_stanza;
                spyOn(_converse.connection, 'send').and.callFake((stanza) => {
                    sent_stanza = stanza;
                });

                // First check that an error message appears when a
                // non-existent nick is used.
                textarea.value = '/member chris Welcome to the club!';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13
                });
                expect(_converse.connection.send).not.toHaveBeenCalled();
                expect(view.el.querySelectorAll('.chat-error').length).toBe(1);
                expect(view.el.querySelector('.chat-error').textContent.trim())
                    .toBe('Error: couldn\'t find a groupchat participant based on your arguments');

                // Now test with an existing nick
                textarea.value = '/member marc Welcome to the club!';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13
                });
                expect(_converse.connection.send).toHaveBeenCalled();
                expect(Strophe.serialize(sent_stanza)).toBe(
                    `<iq id="${sent_stanza.getAttribute('id')}" to="lounge@muc.montague.lit" type="set" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item affiliation="member" jid="marc@montague.lit">`+
                                `<reason>Welcome to the club!</reason>`+
                            `</item>`+
                        `</query>`+
                    `</iq>`);

                let result = $iq({
                    "xmlns": "jabber:client",
                    "type": "result",
                    "to": "romeo@montague.lit/orchard",
                    "from": "lounge@muc.montague.lit",
                    "id": sent_stanza.getAttribute('id')
                });
                _converse.connection.IQ_stanzas = [];
                _converse.connection._dataRecv(test_utils.createRequest(result));
                iq_stanza = await u.waitUntil(() => _.filter(
                    _converse.connection.IQ_stanzas,
                    iq => iq.querySelector('iq[to="lounge@muc.montague.lit"][type="get"] item[affiliation="member"]')).pop()
                );

                expect(Strophe.serialize(iq_stanza)).toBe(
                    `<iq id="${iq_stanza.getAttribute('id')}" to="lounge@muc.montague.lit" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item affiliation="member"/>`+
                        `</query>`+
                    `</iq>`)
                expect(view.model.occupants.length).toBe(2);

                result = $iq({
                    "xmlns": "jabber:client",
                    "type": "result",
                    "to": "romeo@montague.lit/orchard",
                    "from": "lounge@muc.montague.lit",
                    "id": iq_stanza.getAttribute("id")
                }).c("query", {"xmlns": "http://jabber.org/protocol/muc#admin"})
                    .c("item", {"jid": "marc", "affiliation": "member"});
                _converse.connection._dataRecv(test_utils.createRequest(result));

                expect(view.model.occupants.length).toBe(2);
                iq_stanza = await u.waitUntil(() => _.filter(
                    _converse.connection.IQ_stanzas,
                    iq => iq.querySelector('iq[to="lounge@muc.montague.lit"][type="get"] item[affiliation="owner"]')).pop()
                );

                expect(Strophe.serialize(iq_stanza)).toBe(
                    `<iq id="${iq_stanza.getAttribute('id')}" to="lounge@muc.montague.lit" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item affiliation="owner"/>`+
                        `</query>`+
                    `</iq>`)
                expect(view.model.occupants.length).toBe(2);

                result = $iq({
                    "xmlns": "jabber:client",
                    "type": "result",
                    "to": "romeo@montague.lit/orchard",
                    "from": "lounge@muc.montague.lit",
                    "id": iq_stanza.getAttribute("id")
                }).c("query", {"xmlns": "http://jabber.org/protocol/muc#admin"})
                    .c("item", {"jid": "romeo@montague.lit", "affiliation": "owner"});
                _converse.connection._dataRecv(test_utils.createRequest(result));

                expect(view.model.occupants.length).toBe(2);
                iq_stanza = await u.waitUntil(() => _.filter(
                    _converse.connection.IQ_stanzas,
                    iq => iq.querySelector('iq[to="lounge@muc.montague.lit"][type="get"] item[affiliation="admin"]')).pop()
                );

                expect(Strophe.serialize(iq_stanza)).toBe(
                    `<iq id="${iq_stanza.getAttribute('id')}" to="lounge@muc.montague.lit" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item affiliation="admin"/>`+
                        `</query>`+
                    `</iq>`)
                expect(view.model.occupants.length).toBe(2);

                result = $iq({
                    "xmlns": "jabber:client",
                    "type": "result",
                    "to": "romeo@montague.lit/orchard",
                    "from": "lounge@muc.montague.lit",
                    "id": iq_stanza.getAttribute("id")
                }).c("query", {"xmlns": "http://jabber.org/protocol/muc#admin"})
                _converse.connection._dataRecv(test_utils.createRequest(result));
                await u.waitUntil(() => view.el.querySelectorAll('.occupant').length, 500);
                await u.waitUntil(() => view.el.querySelectorAll('.badge').length > 1);
                expect(view.model.occupants.length).toBe(2);
                expect(view.el.querySelectorAll('.occupant').length).toBe(2);
                done();
            }));

            it("takes /topic to set the groupchat topic",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                spyOn(view, 'clearMessages');
                let sent_stanza;
                spyOn(_converse.connection, 'send').and.callFake(function (stanza) {
                    sent_stanza = stanza;
                });
                // Check the alias /topic
                const textarea = view.el.querySelector('.chat-textarea');
                textarea.value = '/topic This is the groupchat subject';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13
                });
                expect(_converse.connection.send).toHaveBeenCalled();
                expect(sent_stanza.textContent.trim()).toBe('This is the groupchat subject');

                // Check /subject
                textarea.value = '/subject This is a new subject';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13
                });

                expect(sent_stanza.textContent.trim()).toBe('This is a new subject');
                expect(Strophe.serialize(sent_stanza).toLocaleString()).toBe(
                    '<message from="romeo@montague.lit/orchard" to="lounge@montague.lit" type="groupchat" xmlns="jabber:client">'+
                        '<subject xmlns="jabber:client">This is a new subject</subject>'+
                    '</message>');

                // Check case insensitivity
                textarea.value = '/Subject This is yet another subject';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13
                });
                expect(sent_stanza.textContent.trim()).toBe('This is yet another subject');
                expect(Strophe.serialize(sent_stanza).toLocaleString()).toBe(
                    '<message from="romeo@montague.lit/orchard" to="lounge@montague.lit" type="groupchat" xmlns="jabber:client">'+
                        '<subject xmlns="jabber:client">This is yet another subject</subject>'+
                    '</message>');

                // Check unsetting the topic
                textarea.value = '/topic';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13
                });
                expect(Strophe.serialize(sent_stanza).toLocaleString()).toBe(
                    '<message from="romeo@montague.lit/orchard" to="lounge@montague.lit" type="groupchat" xmlns="jabber:client">'+
                        '<subject xmlns="jabber:client"></subject>'+
                    '</message>');
                done();
            }));

            it("takes /clear to clear messages",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                spyOn(view, 'clearMessages');
                const textarea = view.el.querySelector('.chat-textarea')
                textarea.value = '/clear';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13
                });
                expect(view.clearMessages).toHaveBeenCalled();
                done();
            }));

            it("takes /owner to make a user an owner",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                let sent_IQ, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                spyOn(view.model, 'setAffiliation').and.callThrough();
                spyOn(view, 'showErrorMessage').and.callThrough();
                spyOn(view, 'validateRoleOrAffiliationChangeArgs').and.callThrough();

                let presence = $pres({
                        'from': 'lounge@montague.lit/annoyingGuy',
                        'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                        'to': 'romeo@montague.lit/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@montague.lit',
                            'affiliation': 'member',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                var textarea = view.el.querySelector('.chat-textarea')
                textarea.value = '/owner';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13
                });
                expect(view.validateRoleOrAffiliationChangeArgs).toHaveBeenCalled();
                expect(view.showErrorMessage).toHaveBeenCalledWith(
                    "Error: the \"owner\" command takes two arguments, the user's nickname and optionally a reason.");
                expect(view.model.setAffiliation).not.toHaveBeenCalled();
                // XXX: Calling onFormSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                textarea.value = '/owner nobody You\'re responsible';
                view.onFormSubmitted(new Event('submit'));

                expect(view.showErrorMessage).toHaveBeenCalledWith(
                    "Error: couldn't find a groupchat participant based on your arguments");
                expect(view.model.setAffiliation).not.toHaveBeenCalled();

                // Call now with the correct of arguments.
                // XXX: Calling onFormSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                textarea.value = '/owner annoyingGuy You\'re responsible';
                view.onFormSubmitted(new Event('submit'));

                expect(view.validateRoleOrAffiliationChangeArgs.calls.count()).toBe(3);
                expect(view.model.setAffiliation).toHaveBeenCalled();
                expect(view.showErrorMessage.calls.count()).toBe(2);
                // Check that the member list now gets updated
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item affiliation="owner" jid="annoyingguy@montague.lit">`+
                                `<reason>You&apos;re responsible</reason>`+
                            `</item>`+
                        `</query>`+
                    `</iq>`);

                presence = $pres({
                        'from': 'lounge@montague.lit/annoyingGuy',
                        'id':'27C55F89-1C6A-459A-9EB5-77690145D628',
                        'to': 'romeo@montague.lit/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@montague.lit',
                            'affiliation': 'owner',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.el.querySelectorAll('.chat-info')[4].textContent.trim()).toBe("annoyingGuy is now an owner of this groupchat");
                done();
            }));

            it("takes /ban to ban a user",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                let sent_IQ, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                spyOn(view.model, 'setAffiliation').and.callThrough();
                spyOn(view, 'showErrorMessage').and.callThrough();
                spyOn(view, 'validateRoleOrAffiliationChangeArgs').and.callThrough();

                let presence = $pres({
                        'from': 'lounge@montague.lit/annoyingGuy',
                        'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                        'to': 'romeo@montague.lit/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@montague.lit',
                            'affiliation': 'member',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                const textarea = view.el.querySelector('.chat-textarea')
                textarea.value = '/ban';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13
                });
                expect(view.validateRoleOrAffiliationChangeArgs).toHaveBeenCalled();
                expect(view.showErrorMessage).toHaveBeenCalled();
                expect(view.el.querySelector('.message:last-child').textContent.trim()).toBe(
                    "Error: the \"ban\" command takes two arguments, the user's nickname and optionally a reason.");

                expect(view.model.setAffiliation).not.toHaveBeenCalled();
                // Call now with the correct amount of arguments.
                // XXX: Calling onFormSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                textarea.value = '/ban annoyingGuy You\'re annoying';
                view.onFormSubmitted(new Event('submit'));

                expect(view.validateRoleOrAffiliationChangeArgs.calls.count()).toBe(2);
                expect(view.showErrorMessage.calls.count()).toBe(1);
                expect(view.model.setAffiliation).toHaveBeenCalled();
                // Check that the member list now gets updated
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item affiliation="outcast" jid="annoyingguy@montague.lit">`+
                                `<reason>You&apos;re annoying</reason>`+
                            `</item>`+
                        `</query>`+
                    `</iq>`);

                presence = $pres({
                        'from': 'lounge@montague.lit/annoyingGuy',
                        'id':'27C55F89-1C6A-459A-9EB5-77690145D628',
                        'to': 'romeo@montague.lit/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@montague.lit',
                            'affiliation': 'outcast',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.el.querySelectorAll('.chat-info')[3].textContent.trim()).toBe(
                    "annoyingGuy has been banned from this groupchat");

                presence = $pres({
                        'from': 'lounge@montague.lit/joe2',
                        'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                        'to': 'romeo@montague.lit/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'joe2@montague.lit',
                            'affiliation': 'member',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                textarea.value = '/ban joe22';
                view.onFormSubmitted(new Event('submit'));
                expect(view.el.querySelector('.message:last-child').textContent.trim()).toBe(
                    "Error: couldn't find a groupchat participant based on your arguments");
                done();
            }));


            it("takes a /kick command to kick a user",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                let sent_IQ, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                const muc_jid = 'lounge@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
                const view = _converse.api.chatviews.get(muc_jid);
                spyOn(view.model, 'setRole').and.callThrough();
                spyOn(view, 'showErrorMessage').and.callThrough();
                spyOn(view, 'validateRoleOrAffiliationChangeArgs').and.callThrough();

                let presence = $pres({
                        'from': 'lounge@montague.lit/annoying guy',
                        'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                        'to': 'romeo@montague.lit/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@montague.lit',
                            'affiliation': 'none',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                const textarea = view.el.querySelector('.chat-textarea')
                textarea.value = '/kick';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13
                });
                expect(view.validateRoleOrAffiliationChangeArgs).toHaveBeenCalled();
                expect(view.showErrorMessage).toHaveBeenCalledWith(
                    "Error: the \"kick\" command takes two arguments, the user's nickname and optionally a reason.");
                expect(view.model.setRole).not.toHaveBeenCalled();
                // Call now with the correct amount of arguments.
                // XXX: Calling onFormSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                textarea.value = '/kick @annoying guy You\'re annoying';
                view.onFormSubmitted(new Event('submit'));

                expect(view.validateRoleOrAffiliationChangeArgs.calls.count()).toBe(2);
                expect(view.showErrorMessage.calls.count()).toBe(1);
                expect(view.model.setRole).toHaveBeenCalled();
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item nick="annoying guy" role="none">`+
                                `<reason>You&apos;re annoying</reason>`+
                            `</item>`+
                        `</query>`+
                    `</iq>`);

                /* <presence
                 *     from='harfleur@chat.shakespeare.lit/pistol'
                 *     to='gower@shakespeare.lit/cell'
                 *     type='unavailable'>
                 *       <x xmlns='http://jabber.org/protocol/muc#user'>
                 *         <item affiliation='none' role='none'/>
                 *         <status code='307'/>
                 *       </x>
                 *     </presence>
                 */
                presence = $pres({
                        'from': 'lounge@montague.lit/annoying guy',
                        'to': 'romeo@montague.lit/desktop',
                        'type': 'unavailable'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'affiliation': 'none',
                            'role': 'none'
                        }).up()
                        .c('status', {'code': '307'});
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                await u.waitUntil(() => view.el.querySelectorAll('.chat-info').length === 4);
                expect(view.el.querySelectorAll('.chat-info')[3].textContent.trim()).toBe("annoying guy has been kicked out");
                expect(view.el.querySelectorAll('.chat-info').length).toBe(4);
                done();
            }));


            it("takes /op and /deop to make a user a moderator or not",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'lounge@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
                const view = _converse.api.chatviews.get(muc_jid);
                var sent_IQ, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                spyOn(view.model, 'setRole').and.callThrough();
                spyOn(view, 'showErrorMessage').and.callThrough();
                spyOn(view, 'showChatEvent').and.callThrough();
                spyOn(view, 'validateRoleOrAffiliationChangeArgs').and.callThrough();

                // New user enters the groupchat
                /* <presence
                 *     from='coven@chat.shakespeare.lit/thirdwitch'
                 *     id='27C55F89-1C6A-459A-9EB5-77690145D624'
                 *     to='crone1@shakespeare.lit/desktop'>
                 * <x xmlns='http://jabber.org/protocol/muc#user'>
                 *     <item affiliation='member' role='moderator'/>
                 * </x>
                 * </presence>
                 */
                let presence = $pres({
                        'from': 'lounge@montague.lit/trustworthyguy',
                        'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                        'to': 'romeo@montague.lit/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'trustworthyguy@montague.lit',
                            'affiliation': 'member',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                var info_msgs = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info'), 0);
                expect(info_msgs.pop().textContent.trim()).toBe("trustworthyguy has entered the groupchat");

                var textarea = view.el.querySelector('.chat-textarea')
                textarea.value = '/op';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13
                });

                expect(view.validateRoleOrAffiliationChangeArgs).toHaveBeenCalled();
                expect(view.showErrorMessage).toHaveBeenCalledWith(
                    "Error: the \"op\" command takes two arguments, the user's nickname and optionally a reason.");

                expect(view.model.setRole).not.toHaveBeenCalled();
                // Call now with the correct amount of arguments.
                // XXX: Calling onFormSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                textarea.value = '/op trustworthyguy You\'re trustworthy';
                view.onFormSubmitted(new Event('submit'));

                expect(view.validateRoleOrAffiliationChangeArgs.calls.count()).toBe(2);
                expect(view.showErrorMessage.calls.count()).toBe(1);
                expect(view.model.setRole).toHaveBeenCalled();
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item nick="trustworthyguy" role="moderator">`+
                                `<reason>You&apos;re trustworthy</reason>`+
                            `</item>`+
                        `</query>`+
                    `</iq>`);

                /* <presence
                 *     from='coven@chat.shakespeare.lit/thirdwitch'
                 *     to='crone1@shakespeare.lit/desktop'>
                 * <x xmlns='http://jabber.org/protocol/muc#user'>
                 *     <item affiliation='member'
                 *         jid='hag66@shakespeare.lit/pda'
                 *         role='moderator'/>
                 * </x>
                 * </presence>
                 */
                presence = $pres({
                        'from': 'lounge@montague.lit/trustworthyguy',
                        'to': 'romeo@montague.lit/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'trustworthyguy@montague.lit',
                            'affiliation': 'member',
                            'role': 'moderator'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                info_msgs = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info'), 0);
                expect(info_msgs.pop().textContent.trim()).toBe("trustworthyguy is now a moderator");
                // Call now with the correct amount of arguments.
                // XXX: Calling onFormSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                textarea.value = '/deop trustworthyguy Perhaps not';
                view.onFormSubmitted(new Event('submit'));

                expect(view.validateRoleOrAffiliationChangeArgs.calls.count()).toBe(3);
                expect(view.showChatEvent.calls.count()).toBe(1);
                expect(view.model.setRole).toHaveBeenCalled();
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item nick="trustworthyguy" role="participant">`+
                                `<reason>Perhaps not</reason>`+
                            `</item>`+
                        `</query>`+
                    `</iq>`);

                /* <presence
                 *     from='coven@chat.shakespeare.lit/thirdwitch'
                 *     to='crone1@shakespeare.lit/desktop'>
                 * <x xmlns='http://jabber.org/protocol/muc#user'>
                 *     <item affiliation='member'
                 *         jid='hag66@shakespeare.lit/pda'
                 *         role='participant'/>
                 * </x>
                 * </presence>
                 */
                presence = $pres({
                        'from': 'lounge@montague.lit/trustworthyguy',
                        'to': 'romeo@montague.lit/desktop'
                    }).c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'trustworthyguy@montague.lit',
                            'affiliation': 'member',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                info_msgs = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info'), 0);
                expect(info_msgs.pop().textContent.trim()).toBe("trustworthyguy is no longer a moderator");
                done();
            }));

            it("takes /mute and /voice to mute and unmute a user",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'lounge@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
                const view = _converse.api.chatviews.get(muc_jid);
                var sent_IQ, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                spyOn(view.model, 'setRole').and.callThrough();
                spyOn(view, 'showErrorMessage').and.callThrough();
                spyOn(view, 'showChatEvent').and.callThrough();
                spyOn(view, 'validateRoleOrAffiliationChangeArgs').and.callThrough();

                // New user enters the groupchat
                /* <presence
                 *     from='coven@chat.shakespeare.lit/thirdwitch'
                 *     id='27C55F89-1C6A-459A-9EB5-77690145D624'
                 *     to='crone1@shakespeare.lit/desktop'>
                 * <x xmlns='http://jabber.org/protocol/muc#user'>
                 *     <item affiliation='member' role='participant'/>
                 * </x>
                 * </presence>
                 */
                var presence = $pres({
                        'from': 'lounge@montague.lit/annoyingGuy',
                        'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                        'to': 'romeo@montague.lit/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@montague.lit',
                            'affiliation': 'member',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                var info_msgs = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info'), 0);
                expect(info_msgs.pop().textContent.trim()).toBe("annoyingGuy has entered the groupchat");

                const textarea = view.el.querySelector('.chat-textarea')
                textarea.value = '/mute';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13
                });

                expect(view.validateRoleOrAffiliationChangeArgs).toHaveBeenCalled();
                expect(view.showErrorMessage).toHaveBeenCalledWith(
                    "Error: the \"mute\" command takes two arguments, the user's nickname and optionally a reason.");
                expect(view.model.setRole).not.toHaveBeenCalled();
                // Call now with the correct amount of arguments.
                // XXX: Calling onFormSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                textarea.value = '/mute annoyingGuy You\'re annoying';
                view.onFormSubmitted(new Event('submit'));

                expect(view.validateRoleOrAffiliationChangeArgs.calls.count()).toBe(2);
                expect(view.showErrorMessage.calls.count()).toBe(1);
                expect(view.model.setRole).toHaveBeenCalled();
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item nick="annoyingGuy" role="visitor">`+
                                `<reason>You&apos;re annoying</reason>`+
                            `</item>`+
                        `</query>`+
                    `</iq>`);

                /* <presence
                 *     from='coven@chat.shakespeare.lit/thirdwitch'
                 *     to='crone1@shakespeare.lit/desktop'>
                 * <x xmlns='http://jabber.org/protocol/muc#user'>
                 *     <item affiliation='member'
                 *         jid='hag66@shakespeare.lit/pda'
                 *         role='visitor'/>
                 * </x>
                 * </presence>
                 */
                presence = $pres({
                        'from': 'lounge@montague.lit/annoyingGuy',
                        'to': 'romeo@montague.lit/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@montague.lit',
                            'affiliation': 'member',
                            'role': 'visitor'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                info_msgs = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info'), 0);
                expect(info_msgs.pop().textContent.trim()).toBe("annoyingGuy has been muted");

                // Call now with the correct of arguments.
                // XXX: Calling onFormSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                textarea.value = '/voice annoyingGuy Now you can talk again';
                view.onFormSubmitted(new Event('submit'));

                expect(view.validateRoleOrAffiliationChangeArgs.calls.count()).toBe(3);
                expect(view.showChatEvent.calls.count()).toBe(1);
                expect(view.model.setRole).toHaveBeenCalled();
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item nick="annoyingGuy" role="participant">`+
                                `<reason>Now you can talk again</reason>`+
                            `</item>`+
                        `</query>`+
                    `</iq>`);

                /* <presence
                 *     from='coven@chat.shakespeare.lit/thirdwitch'
                 *     to='crone1@shakespeare.lit/desktop'>
                 * <x xmlns='http://jabber.org/protocol/muc#user'>
                 *     <item affiliation='member'
                 *         jid='hag66@shakespeare.lit/pda'
                 *         role='visitor'/>
                 * </x>
                 * </presence>
                 */
                presence = $pres({
                        'from': 'lounge@montague.lit/annoyingGuy',
                        'to': 'romeo@montague.lit/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@montague.lit',
                            'affiliation': 'member',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                info_msgs = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info'), 0);
                expect(info_msgs.pop().textContent.trim()).toBe("annoyingGuy has been given a voice");
                done();
            }));

            it("takes /destroy to destroy a muc",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'lounge@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
                const view = _converse.api.chatviews.get(muc_jid);
                let sent_IQ, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                const textarea = view.el.querySelector('.chat-textarea');
                textarea.value = '/destroy bored';
                view.onFormSubmitted(new Event('submit'));
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#owner">`+
                            `<destroy>`+
                                `<reason>`+
                                    `bored`+
                                `</reason>`+
                            `</destroy>`+
                        `</query>`+
                    `</iq>`);

                /* <iq from="lounge@montague.lit"
                 *  id="${IQ_id}"
                 *  to="romeo@montague.lit/orchard"
                 *  type="result"
                 *  xmlns="jabber:client"/>
                */
                const result_stanza = $iq({
                    'type': 'result',
                    'id': IQ_id,
                    'from': view.model.get('jid'),
                    'to': _converse.connection.jid
                });
                spyOn(_converse.api, "trigger").and.callThrough();
                expect(_converse.chatboxes.length).toBe(2);
                _converse.connection._dataRecv(test_utils.createRequest(result_stanza));
                await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.DISCONNECTED));
                await u.waitUntil(() => _converse.chatboxes.length === 1);
                expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                done();
            }));
        });

        describe("When attempting to enter a groupchat", function () {

            it("will use the nickname set in the global settings if the user doesn't have a VCard nickname",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {'nickname': 'Benedict-Cucumberpatch'},
                    async function (done, _converse) {

                await test_utils.openChatRoomViaModal(_converse, 'roomy@muc.montague.lit');
                const view = _converse.chatboxviews.get('roomy@muc.montague.lit');
                expect(view.model.get('nick')).toBe('Benedict-Cucumberpatch');
                done();
            }));

            it("will show an error message if the groupchat requires a password",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'protected';
                await test_utils.openChatRoomViaModal(_converse, muc_jid, 'romeo');
                const view = _converse.chatboxviews.get(muc_jid);
                spyOn(view, 'renderPasswordForm').and.callThrough();

                const presence = $pres().attrs({
                        'from': `${muc_jid}/romeo`,
                        'id': u.getUniqueId(),
                        'to': 'romeo@montague.lit/pda',
                        'type': 'error'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                      .c('error').attrs({by:'lounge@montague.lit', type:'auth'})
                          .c('not-authorized').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'});

                _converse.connection._dataRecv(test_utils.createRequest(presence));

                const chat_body = view.el.querySelector('.chatroom-body');
                expect(view.renderPasswordForm).toHaveBeenCalled();
                expect(chat_body.querySelectorAll('form.chatroom-form').length).toBe(1);
                expect(chat_body.querySelector('.chatroom-form label').textContent.trim())
                    .toBe('This groupchat requires a password');

                // Let's submit the form
                spyOn(view.model, 'join');
                const input_el = view.el.querySelector('[name="password"]');
                input_el.value = 'secret';
                view.el.querySelector('input[type=submit]').click();
                expect(view.model.join).toHaveBeenCalledWith('romeo', 'secret');
                done();
            }));

            it("will show an error message if the groupchat is members-only and the user not included",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'members-only@muc.montague.lit'
                await test_utils.openChatRoomViaModal(_converse, muc_jid, 'romeo');
                const view = _converse.chatboxviews.get(muc_jid);
                const iq = await u.waitUntil(() => _.filter(
                    _converse.connection.IQ_stanzas,
                    iq => iq.querySelector(
                        `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                    )).pop());

                // State that the chat is members-only via the features IQ
                const features_stanza = $iq({
                        'from': muc_jid,
                        'id': iq.getAttribute('id'),
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
                        .c('feature', {'var': 'muc_hidden'}).up()
                        .c('feature', {'var': 'muc_temporary'}).up()
                        .c('feature', {'var': 'muc_membersonly'}).up();
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));
                await u.waitUntil(() => view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING);

                const presence = $pres().attrs({
                        from: `${muc_jid}/romeo`,
                        id: u.getUniqueId(),
                        to: 'romeo@montague.lit/pda',
                        type: 'error'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                      .c('error').attrs({by:'lounge@montague.lit', type:'auth'})
                          .c('registration-required').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.el.querySelector('.chatroom-body .disconnect-container .disconnect-msg:last-child').textContent.trim())
                    .toBe('You are not on the member list of this groupchat.');
                done();
            }));

            it("will show an error message if the user has been banned",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'off-limits@muc.montague.lit'
                await test_utils.openChatRoomViaModal(_converse, muc_jid, 'romeo');

                const iq = await u.waitUntil(() => _.filter(
                    _converse.connection.IQ_stanzas,
                    iq => iq.querySelector(
                        `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                    )).pop());

                const features_stanza = $iq({
                        'from': muc_jid,
                        'id': iq.getAttribute('id'),
                        'to': 'romeo@montague.lit/desktop',
                        'type': 'result'
                    })
                    .c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                        .c('identity', {'category': 'conference', 'name': 'A Dark Cave', 'type': 'text'}).up()
                        .c('feature', {'var': 'http://jabber.org/protocol/muc'}).up()
                        .c('feature', {'var': 'muc_hidden'}).up()
                        .c('feature', {'var': 'muc_temporary'}).up()
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                const view = _converse.chatboxviews.get(muc_jid);
                await u.waitUntil(() => view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING);

                const presence = $pres().attrs({
                        from: `${muc_jid}/romeo`,
                        id: u.getUniqueId(),
                        to: 'romeo@montague.lit/pda',
                        type: 'error'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                      .c('error').attrs({by:'lounge@montague.lit', type:'auth'})
                          .c('forbidden').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                spyOn(view, 'showErrorMessage').and.callThrough();
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.el.querySelector('.chatroom-body .disconnect-container .disconnect-msg:last-child').textContent.trim())
                    .toBe('You have been banned from this groupchat.');
                done();
            }));

            it("will render a nickname form if a nickname conflict happens and muc_nickname_from_jid=false",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'conflicted@muc.montague.lit';
                await test_utils.openChatRoomViaModal(_converse, muc_jid, 'romeo');
                var presence = $pres().attrs({
                        from: `${muc_jid}/romeo`,
                        id: u.getUniqueId(),
                        to: 'romeo@montague.lit/pda',
                        type: 'error'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                      .c('error').attrs({by:'lounge@montague.lit', type:'cancel'})
                          .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                const view = _converse.chatboxviews.get(muc_jid);
                spyOn(view, 'showErrorMessage').and.callThrough();
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('.chatroom-body form.chatroom-form label:first', view.el).pop().textContent.trim())
                    .toBe('Please choose your nickname');

                const input = sizzle('.chatroom-body form.chatroom-form input:first', view.el).pop();
                input.value = 'nicky';
                view.el.querySelector('input[type=submit]').click();
                done();
            }));


            it("will automatically choose a new nickname if a nickname conflict happens and muc_nickname_from_jid=true",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'conflicting@muc.montague.lit'
                await test_utils.openChatRoomViaModal(_converse, muc_jid, 'romeo');
                /* <presence
                 *      from='coven@chat.shakespeare.lit/thirdwitch'
                 *      id='n13mt3l'
                 *      to='hag66@shakespeare.lit/pda'
                 *      type='error'>
                 *  <x xmlns='http://jabber.org/protocol/muc'/>
                 *  <error by='coven@chat.shakespeare.lit' type='cancel'>
                 *      <conflict xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                 *  </error>
                 *  </presence>
                 */
                _converse.muc_nickname_from_jid = true;

                const attrs = {
                    'from': `${muc_jid}/romeo`,
                    'id': u.getUniqueId(),
                    'to': 'romeo@montague.lit/pda',
                    'type': 'error'
                };
                let presence = $pres().attrs(attrs)
                    .c('x').attrs({'xmlns':'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({'by': muc_jid, 'type':'cancel'})
                        .c('conflict').attrs({'xmlns':'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                const view = _converse.chatboxviews.get(muc_jid);
                spyOn(view, 'showErrorMessage').and.callThrough();
                spyOn(view.model, 'join').and.callThrough();

                // Simulate repeatedly that there's already someone in the groupchat
                // with that nickname
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.model.join).toHaveBeenCalledWith('romeo-2');

                attrs.from = `${muc_jid}/romeo-2`;
                attrs.id = u.getUniqueId();
                presence = $pres().attrs(attrs)
                    .c('x').attrs({'xmlns':'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({'by': muc_jid, type:'cancel'})
                        .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                expect(view.model.join).toHaveBeenCalledWith('romeo-3');

                attrs.from = `${muc_jid}/romeo-3`;
                attrs.id = new Date().getTime();
                presence = $pres().attrs(attrs)
                    .c('x').attrs({'xmlns': 'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({'by': muc_jid, 'type': 'cancel'})
                        .c('conflict').attrs({'xmlns':'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.model.join).toHaveBeenCalledWith('romeo-4');
                done();
            }));

            it("will show an error message if the user is not allowed to have created the groupchat",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'impermissable@muc.montague.lit'
                await test_utils.openChatRoomViaModal(_converse, muc_jid, 'romeo')

                // We pretend this is a new room, so no disco info is returned.
                const iq = await u.waitUntil(() => _.filter(
                    _converse.connection.IQ_stanzas,
                    iq => iq.querySelector(
                        `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                    )).pop());
                const features_stanza = $iq({
                        'from': 'room@conference.example.org',
                        'id': iq.getAttribute('id'),
                        'to': 'romeo@montague.lit/desktop',
                        'type': 'error'
                    }).c('error', {'type': 'cancel'})
                        .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                const view = _converse.chatboxviews.get(muc_jid);
                await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING));

                const presence = $pres().attrs({
                        from: `${muc_jid}/romeo`,
                        id: u.getUniqueId(),
                        to:'romeo@montague.lit/pda',
                        type:'error'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                      .c('error').attrs({by:'lounge@montague.lit', type:'cancel'})
                          .c('not-allowed').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                spyOn(view, 'showErrorMessage').and.callThrough();
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.el.querySelector('.chatroom-body .disconnect-container .disconnect-msg:last-child').textContent.trim())
                    .toBe('You are not allowed to create new groupchats.');
                done();
            }));

            it("will show an error message if the user's nickname doesn't conform to groupchat policy",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'conformist@muc.montague.lit'
                await test_utils.openChatRoomViaModal(_converse, muc_jid, 'romeo');

                const iq = await u.waitUntil(() => _.filter(
                    _converse.connection.IQ_stanzas,
                    iq => iq.querySelector(
                        `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                    )).pop());
                const features_stanza = $iq({
                        'from': muc_jid,
                        'id': iq.getAttribute('id'),
                        'to': 'romeo@montague.lit/desktop',
                        'type': 'result'
                    }).c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                        .c('identity', {'category': 'conference', 'name': 'A Dark Cave', 'type': 'text'}).up()
                        .c('feature', {'var': 'http://jabber.org/protocol/muc'}).up()
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                const view = _converse.chatboxviews.get(muc_jid);
                await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING));

                const presence = $pres().attrs({
                        from: `${muc_jid}/romeo`,
                        id: u.getUniqueId(),
                        to:'romeo@montague.lit/pda',
                        type:'error'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                      .c('error').attrs({by:'lounge@montague.lit', type:'cancel'})
                          .c('not-acceptable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                spyOn(view, 'showErrorMessage').and.callThrough();
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.el.querySelector('.chatroom-body .disconnect-container .disconnect-msg:last-child').textContent.trim())
                    .toBe("Your nickname doesn't conform to this groupchat's policies.");
                done();
            }));

            it("will show an error message if the groupchat doesn't yet exist",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'nonexistent@muc.montague.lit'
                await test_utils.openChatRoomViaModal(_converse, muc_jid, 'romeo');

                const iq = await u.waitUntil(() => _.filter(
                    _converse.connection.IQ_stanzas,
                    iq => iq.querySelector(
                        `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                    )).pop());
                const features_stanza = $iq({
                        'from': muc_jid,
                        'id': iq.getAttribute('id'),
                        'to': 'romeo@montague.lit/desktop',
                        'type': 'result'
                    }).c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                        .c('identity', {'category': 'conference', 'name': 'A Dark Cave', 'type': 'text'}).up()
                        .c('feature', {'var': 'http://jabber.org/protocol/muc'}).up()
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                const view = _converse.chatboxviews.get(muc_jid);
                await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING));

                const presence = $pres().attrs({
                        from: `${muc_jid}/romeo`,
                        id: u.getUniqueId(),
                        to: 'romeo@montague.lit/pda',
                        type:'error'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                      .c('error').attrs({by:'lounge@montague.lit', type:'cancel'})
                          .c('item-not-found').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                spyOn(view, 'showErrorMessage').and.callThrough();
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.el.querySelector('.chatroom-body .disconnect-container .disconnect-msg:last-child').textContent.trim())
                    .toBe("This groupchat does not (yet) exist.");
                done();
            }));

            it("will show an error message if the groupchat has reached its maximum number of participants",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'maxed-out@muc.montague.lit'
                await test_utils.openChatRoomViaModal(_converse, muc_jid, 'romeo')

                const iq = await u.waitUntil(() => _.filter(
                    _converse.connection.IQ_stanzas,
                    iq => iq.querySelector(
                        `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                    )).pop());
                const features_stanza = $iq({
                        'from': muc_jid,
                        'id': iq.getAttribute('id'),
                        'to': 'romeo@montague.lit/desktop',
                        'type': 'result'
                    }).c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                        .c('identity', {'category': 'conference', 'name': 'A Dark Cave', 'type': 'text'}).up()
                        .c('feature', {'var': 'http://jabber.org/protocol/muc'}).up()
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                const view = _converse.chatboxviews.get(muc_jid);
                await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING));

                const presence = $pres().attrs({
                        from: `${muc_jid}/romeo`,
                        id: u.getUniqueId(),
                        to:'romeo@montague.lit/pda',
                        type:'error'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                      .c('error').attrs({by:'lounge@montague.lit', type:'cancel'})
                          .c('service-unavailable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                spyOn(view, 'showErrorMessage').and.callThrough();
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.el.querySelector('.chatroom-body .disconnect-container .disconnect-msg:last-child').textContent.trim())
                    .toBe("This groupchat has reached its maximum number of participants.");
                done();
            }));
        });

        describe("Someone being invited to a groupchat", function () {

            it("will first be added to the member list if the groupchat is members only",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 0);
                spyOn(_converse.ChatRoomOccupants.prototype, 'fetchMembers').and.callThrough();
                const sent_IQs = _converse.connection.IQ_stanzas;
                const muc_jid = 'coven@chat.shakespeare.lit';

                const room_creation_promise = _converse.api.rooms.open(muc_jid, {'nick': 'romeo'});

                // Check that the groupchat queried for the features.
                let stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`)).pop());
                expect(Strophe.serialize(stanza)).toBe(
                    `<iq from="romeo@montague.lit/orchard" id="${stanza.getAttribute("id")}" to="${muc_jid}" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/disco#info"/>`+
                    `</iq>`);

                // State that the chat is members-only via the features IQ
                const view = _converse.chatboxviews.get(muc_jid);
                const features_stanza = $iq({
                        from: 'coven@chat.shakespeare.lit',
                        'id': stanza.getAttribute('id'),
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
                        .c('feature', {'var': 'muc_hidden'}).up()
                        .c('feature', {'var': 'muc_temporary'}).up()
                        .c('feature', {'var': 'muc_membersonly'}).up();
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));
                await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING));
                expect(view.model.features.get('membersonly')).toBeTruthy();

                await room_creation_promise;

                await test_utils.createContacts(_converse, 'current');

                let sent_stanza, sent_id;
                spyOn(_converse.connection, 'send').and.callFake(function (stanza) {
                    if (stanza.nodeTree && stanza.nodeTree.nodeName === 'message') {
                        sent_id = stanza.nodeTree.getAttribute('id');
                        sent_stanza = stanza;
                    }
                });
                const invitee_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                const reason = "Please join this groupchat";
                view.model.directInvite(invitee_jid, reason);

                // Check in reverse order that we requested all three lists
                const owner_iq = sent_IQs.pop();
                expect(Strophe.serialize(owner_iq)).toBe(
                    `<iq id="${owner_iq.getAttribute('id')}" to="coven@chat.shakespeare.lit" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin"><item affiliation="owner"/></query>`+
                    `</iq>`);

                const admin_iq = sent_IQs.pop();
                expect(Strophe.serialize(admin_iq)).toBe(
                    `<iq id="${admin_iq.getAttribute('id')}" to="coven@chat.shakespeare.lit" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin"><item affiliation="admin"/></query>`+
                    `</iq>`);

                const member_iq = sent_IQs.pop();
                expect(Strophe.serialize(member_iq)).toBe(
                    `<iq id="${member_iq.getAttribute('id')}" to="coven@chat.shakespeare.lit" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin"><item affiliation="member"/></query>`+
                    `</iq>`);

                // Now the service sends the member lists to the user
                const member_list_stanza = $iq({
                        'from': 'coven@chat.shakespeare.lit',
                        'id': member_iq.getAttribute('id'),
                        'to': 'romeo@montague.lit/orchard',
                        'type': 'result'
                    }).c('query', {'xmlns': Strophe.NS.MUC_ADMIN})
                        .c('item', {
                            'affiliation': 'member',
                            'jid': 'hag66@shakespeare.lit',
                            'nick': 'thirdwitch',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(member_list_stanza));

                const admin_list_stanza = $iq({
                        'from': 'coven@chat.shakespeare.lit',
                        'id': admin_iq.getAttribute('id'),
                        'to': 'romeo@montague.lit/orchard',
                        'type': 'result'
                    }).c('query', {'xmlns': Strophe.NS.MUC_ADMIN})
                        .c('item', {
                            'affiliation': 'admin',
                            'jid': 'wiccarocks@shakespeare.lit',
                            'nick': 'secondwitch'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(admin_list_stanza));

                const owner_list_stanza = $iq({
                        'from': 'coven@chat.shakespeare.lit',
                        'id': owner_iq.getAttribute('id'),
                        'to': 'romeo@montague.lit/orchard',
                        'type': 'result'
                    }).c('query', {'xmlns': Strophe.NS.MUC_ADMIN})
                        .c('item', {
                            'affiliation': 'owner',
                            'jid': 'crone1@shakespeare.lit',
                        });
                _converse.connection._dataRecv(test_utils.createRequest(owner_list_stanza));

                // Converse puts the user on the member list
                stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/muc#admin"]`)).pop());
                expect(stanza.outerHTML,
                    `<iq id="${stanza.getAttribute('id')}" to="coven@chat.shakespeare.lit" type="set" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item affiliation="member" jid="${invitee_jid}">`+
                                `<reason>Please join this groupchat</reason>`+
                            `</item>`+
                        `</query>`+
                    `</iq>`);

                const result = $iq({
                        'from': 'coven@chat.shakespeare.lit',
                        'id': stanza.getAttribute('id'),
                        'to': 'romeo@montague.lit/orchard',
                        'type': 'result'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(result));

                await u.waitUntil(() => view.model.occupants.fetchMembers.calls.count());

                // Finally check that the user gets invited.
                expect(sent_stanza.toLocaleString()).toBe( // Strophe adds the xmlns attr (although not in spec)
                    `<message from="romeo@montague.lit/orchard" id="${sent_id}" to="${invitee_jid}" xmlns="jabber:client">`+
                        `<x jid="coven@chat.shakespeare.lit" reason="Please join this groupchat" xmlns="jabber:x:conference"/>`+
                    `</message>`
                );
                done();
            }));
        });

        describe("The affiliations delta", function () {

            it("can be computed in various ways",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openChatRoom(_converse, 'coven', 'chat.shakespeare.lit', 'romeo');
                var exclude_existing = false;
                var remove_absentees = false;
                var new_list = [];
                var old_list = [];
                const muc_utils = converse.env.muc_utils;
                var delta = muc_utils.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(0);

                new_list = [{'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'member'}];
                old_list = [{'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'member'}];
                delta = muc_utils.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(0);

                // When remove_absentees is false, then affiliations in the old
                // list which are not in the new one won't be removed.
                old_list = [{'jid': 'oldhag666@shakespeare.lit', 'affiliation': 'owner'},
                            {'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'member'}];
                delta = muc_utils.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(0);

                // With exclude_existing set to false, any changed affiliations
                // will be included in the delta (i.e. existing affiliations are included in the comparison).
                old_list = [{'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'owner'}];
                delta = muc_utils.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(1);
                expect(delta[0].jid).toBe('wiccarocks@shakespeare.lit');
                expect(delta[0].affiliation).toBe('member');

                // To also remove affiliations from the old list which are not
                // in the new list, we set remove_absentees to true
                remove_absentees = true;
                old_list = [{'jid': 'oldhag666@shakespeare.lit', 'affiliation': 'owner'},
                            {'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'member'}];
                delta = muc_utils.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(1);
                expect(delta[0].jid).toBe('oldhag666@shakespeare.lit');
                expect(delta[0].affiliation).toBe('none');

                delta = muc_utils.computeAffiliationsDelta(exclude_existing, remove_absentees, [], old_list);
                expect(delta.length).toBe(2);
                expect(delta[0].jid).toBe('oldhag666@shakespeare.lit');
                expect(delta[0].affiliation).toBe('none');
                expect(delta[1].jid).toBe('wiccarocks@shakespeare.lit');
                expect(delta[1].affiliation).toBe('none');

                // To only add a user if they don't already have an
                // affiliation, we set 'exclude_existing' to true
                exclude_existing = true;
                old_list = [{'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'owner'}];
                delta = muc_utils.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(0);

                old_list = [{'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'admin'}];
                delta = muc_utils.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(0);
                done();
            }));
        });

        describe("The \"Groupchats\" Add modal", function () {

            it("can be opened from a link in the \"Groupchats\" section of the controlbox",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.openControlBox(_converse);
                await test_utils.waitForRoster(_converse, 'current', 0);

                const roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                roomspanel.el.querySelector('.show-add-muc-modal').click();
                test_utils.closeControlBox(_converse);
                const modal = roomspanel.add_room_modal;
                await u.waitUntil(() => u.isVisible(modal.el), 1000)

                let label_name = modal.el.querySelector('label[for="chatroom"]');
                expect(label_name.textContent.trim()).toBe('Groupchat address:');
                let name_input = modal.el.querySelector('input[name="chatroom"]');
                expect(name_input.placeholder).toBe('name@conference.example.org');

                const label_nick = modal.el.querySelector('label[for="nickname"]');
                expect(label_nick.textContent.trim()).toBe('Nickname:');
                const nick_input = modal.el.querySelector('input[name="nickname"]');
                expect(nick_input.value).toBe('');
                nick_input.value = 'romeo';

                expect(modal.el.querySelector('.modal-title').textContent.trim()).toBe('Enter a new Groupchat');
                spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());
                roomspanel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                modal.el.querySelector('input[name="chatroom"]').value = 'lounce@muc.montague.lit';
                modal.el.querySelector('form input[type="submit"]').click();
                await u.waitUntil(() => _converse.chatboxes.length);
                await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 1);

                roomspanel.model.set('muc_domain', 'muc.example.org');
                roomspanel.el.querySelector('.show-add-muc-modal').click();
                label_name = modal.el.querySelector('label[for="chatroom"]');
                expect(label_name.textContent.trim()).toBe('Groupchat address:');
                name_input = modal.el.querySelector('input[name="chatroom"]');
                expect(name_input.placeholder).toBe('name@muc.example.org');
                done();
            }));

            it("doesn't show the nickname field if locked_muc_nickname is true",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {'locked_muc_nickname': true, 'muc_nickname_from_jid': true},
                    async function (done, _converse) {

                await test_utils.openControlBox(_converse);
                await test_utils.waitForRoster(_converse, 'current', 0);
                const roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                roomspanel.el.querySelector('.show-add-muc-modal').click();
                test_utils.closeControlBox(_converse);
                const modal = roomspanel.add_room_modal;
                await u.waitUntil(() => u.isVisible(modal.el), 1000)
                const name_input = modal.el.querySelector('input[name="chatroom"]');
                name_input.value = 'lounge@montague.lit';
                expect(modal.el.querySelector('label[for="nickname"]')).toBe(null);
                expect(modal.el.querySelector('input[name="nickname"]')).toBe(null);
                modal.el.querySelector('form input[type="submit"]').click();
                await u.waitUntil(() => _converse.chatboxes.length > 1);
                const chatroom = _converse.chatboxes.get('lounge@montague.lit');
                expect(chatroom.get('nick')).toBe('romeo');
                done();
            }));

            it("uses the JID node if muc_nickname_from_jid is set to true",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {'muc_nickname_from_jid': true},
                    async function (done, _converse) {

                await test_utils.openControlBox(_converse);
                await test_utils.waitForRoster(_converse, 'current', 0);
                const roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                roomspanel.el.querySelector('.show-add-muc-modal').click();
                test_utils.closeControlBox(_converse);
                const modal = roomspanel.add_room_modal;
                await u.waitUntil(() => u.isVisible(modal.el), 1000)
                const label_nick = modal.el.querySelector('label[for="nickname"]');
                expect(label_nick.textContent.trim()).toBe('Nickname:');
                const nick_input = modal.el.querySelector('input[name="nickname"]');
                expect(nick_input.value).toBe('romeo');
                done();
            }));

            it("uses the nickname passed in to converse.initialize",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {'nickname': 'st.nick'},
                    async function (done, _converse) {

                await test_utils.openControlBox(_converse);
                await test_utils.waitForRoster(_converse, 'current', 0);
                const roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                roomspanel.el.querySelector('.show-add-muc-modal').click();
                test_utils.closeControlBox(_converse);
                const modal = roomspanel.add_room_modal;
                await u.waitUntil(() => u.isVisible(modal.el), 1000)
                const label_nick = modal.el.querySelector('label[for="nickname"]');
                expect(label_nick.textContent.trim()).toBe('Nickname:');
                const nick_input = modal.el.querySelector('input[name="nickname"]');
                expect(nick_input.value).toBe('st.nick');
                done();
            }));

            it("doesn't require the domain when muc_domain is set",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {'muc_domain': 'muc.example.org'},
                    async function (done, _converse) {

                await test_utils.openControlBox(_converse);
                const roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                roomspanel.el.querySelector('.show-add-muc-modal').click();
                const modal = roomspanel.add_room_modal;
                await u.waitUntil(() => u.isVisible(modal.el), 1000)
                expect(modal.el.querySelector('.modal-title').textContent.trim()).toBe('Enter a new Groupchat');
                spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());
                roomspanel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                const label_name = modal.el.querySelector('label[for="chatroom"]');
                expect(label_name.textContent.trim()).toBe('Groupchat name:');
                let name_input = modal.el.querySelector('input[name="chatroom"]');
                expect(name_input.placeholder).toBe('name@muc.example.org');
                name_input.value = 'lounge';
                let nick_input = modal.el.querySelector('input[name="nickname"]');
                nick_input.value = 'max';

                modal.el.querySelector('form input[type="submit"]').click();
                await u.waitUntil(() => _converse.chatboxes.length);
                await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 1);
                expect(_.includes(_converse.chatboxes.models.map(m => m.get('id')), 'lounge@muc.example.org')).toBe(true);

                // However, you can still open MUCs with different domains
                roomspanel.el.querySelector('.show-add-muc-modal').click();
                await u.waitUntil(() => u.isVisible(modal.el), 1000);
                name_input = modal.el.querySelector('input[name="chatroom"]');
                name_input.value = 'lounge@conference.example.org';
                nick_input = modal.el.querySelector('input[name="nickname"]');
                nick_input.value = 'max';
                modal.el.querySelector('form input[type="submit"]').click();
                await u.waitUntil(() => _converse.chatboxes.models.filter(c => c.get('type') === 'chatroom').length === 2);
                await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 2);
                expect(_.includes(_converse.chatboxes.models.map(m => m.get('id')), 'lounge@conference.example.org')).toBe(true);
                done();
            }));

            it("only uses the muc_domain is locked_muc_domain is true",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {'muc_domain': 'muc.example.org', 'locked_muc_domain': true},
                    async function (done, _converse) {

                await test_utils.openControlBox(_converse);
                const roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                roomspanel.el.querySelector('.show-add-muc-modal').click();
                const modal = roomspanel.add_room_modal;
                await u.waitUntil(() => u.isVisible(modal.el), 1000)
                expect(modal.el.querySelector('.modal-title').textContent.trim()).toBe('Enter a new Groupchat');
                spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());
                roomspanel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                const label_name = modal.el.querySelector('label[for="chatroom"]');
                expect(label_name.textContent.trim()).toBe('Groupchat name:');
                let name_input = modal.el.querySelector('input[name="chatroom"]');
                expect(name_input.placeholder).toBe('');
                name_input.value = 'lounge';
                let nick_input = modal.el.querySelector('input[name="nickname"]');
                nick_input.value = 'max';
                modal.el.querySelector('form input[type="submit"]').click();
                await u.waitUntil(() => _converse.chatboxes.length);
                await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 1);
                expect(_.includes(_converse.chatboxes.models.map(m => m.get('id')), 'lounge@muc.example.org')).toBe(true);

                // However, you can still open MUCs with different domains
                roomspanel.el.querySelector('.show-add-muc-modal').click();
                await u.waitUntil(() => u.isVisible(modal.el), 1000);
                name_input = modal.el.querySelector('input[name="chatroom"]');
                name_input.value = 'lounge@conference';
                nick_input = modal.el.querySelector('input[name="nickname"]');
                nick_input.value = 'max';
                modal.el.querySelector('form input[type="submit"]').click();
                await u.waitUntil(() => _converse.chatboxes.models.filter(c => c.get('type') === 'chatroom').length === 2);
                await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 2);
                expect(_.includes(_converse.chatboxes.models.map(m => m.get('id')), 'lounge\\40conference@muc.example.org')).toBe(true);
                done();
            }));
        });

        describe("The \"Groupchats\" List modal", function () {

            it("can be opened from a link in the \"Groupchats\" section of the controlbox",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.openControlBox(_converse);
                const roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                roomspanel.el.querySelector('.show-list-muc-modal').click();
                test_utils.closeControlBox(_converse);
                const modal = roomspanel.list_rooms_modal;
                await u.waitUntil(() => u.isVisible(modal.el), 1000);
                spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());
                roomspanel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called

                // See: https://xmpp.org/extensions/xep-0045.html#disco-rooms
                expect(modal.el.querySelectorAll('.available-chatrooms li').length).toBe(0);

                const server_input = modal.el.querySelector('input[name="server"]');
                expect(server_input.placeholder).toBe('conference.example.org');
                server_input.value = 'chat.shakespeare.lit';
                modal.el.querySelector('input[type="submit"]').click();
                await u.waitUntil(() => _converse.chatboxes.length);

                const IQ_stanzas = _converse.connection.IQ_stanzas;
                const sent_stanza = await u.waitUntil(
                    () => IQ_stanzas.filter(s => sizzle(`query[xmlns="${Strophe.NS.DISCO_ITEMS}"]`, s).length).pop()
                );
                const id = sent_stanza.getAttribute('id');
                expect(Strophe.serialize(sent_stanza)).toBe(
                    `<iq from="romeo@montague.lit/orchard" id="${id}" `+
                        `to="chat.shakespeare.lit" `+
                        `type="get" `+
                        `xmlns="jabber:client">`+
                            `<query xmlns="http://jabber.org/protocol/disco#items"/>`+
                    `</iq>`
                );
                const iq = $iq({
                    'from':'muc.montague.lit',
                    'to':'romeo@montague.lit/pda',
                    'id': id,
                    'type':'result'
                }).c('query')
                .c('item', { jid:'heath@chat.shakespeare.lit', name:'A Lonely Heath'}).up()
                .c('item', { jid:'coven@chat.shakespeare.lit', name:'A Dark Cave'}).up()
                .c('item', { jid:'forres@chat.shakespeare.lit', name:'The Palace'}).up()
                .c('item', { jid:'inverness@chat.shakespeare.lit', name:'Macbeth&apos;s Castle'}).up()
                .c('item', { jid:'orchard@chat.shakespeare.lit', name:'Capulet\'s Orchard'}).up()
                .c('item', { jid:'friar@chat.shakespeare.lit', name:'Friar Laurence\'s cell'}).up()
                .c('item', { jid:'hall@chat.shakespeare.lit', name:'Hall in Capulet\'s house'}).up()
                .c('item', { jid:'chamber@chat.shakespeare.lit', name:'Juliet\'s chamber'}).up()
                .c('item', { jid:'public@chat.shakespeare.lit', name:'A public place'}).up()
                .c('item', { jid:'street@chat.shakespeare.lit', name:'A street'}).nodeTree;
                _converse.connection._dataRecv(test_utils.createRequest(iq));

                await u.waitUntil(() => modal.el.querySelectorAll('.available-chatrooms li').length === 11);
                const rooms = modal.el.querySelectorAll('.available-chatrooms li');
                expect(rooms[0].textContent.trim()).toBe("Groupchats found:");
                expect(rooms[1].textContent.trim()).toBe("A Lonely Heath");
                expect(rooms[2].textContent.trim()).toBe("A Dark Cave");
                expect(rooms[3].textContent.trim()).toBe("The Palace");
                expect(rooms[4].textContent.trim()).toBe("Macbeth's Castle");
                expect(rooms[5].textContent.trim()).toBe('Capulet\'s Orchard');
                expect(rooms[6].textContent.trim()).toBe('Friar Laurence\'s cell');
                expect(rooms[7].textContent.trim()).toBe('Hall in Capulet\'s house');
                expect(rooms[8].textContent.trim()).toBe('Juliet\'s chamber');
                expect(rooms[9].textContent.trim()).toBe('A public place');
                expect(rooms[10].textContent.trim()).toBe('A street');

                rooms[4].querySelector('.open-room').click();
                await u.waitUntil(() => _converse.chatboxes.length > 1);
                expect(sizzle('.chatroom', _converse.el).filter(u.isVisible).length).toBe(1); // There should now be an open chatroom
                var view = _converse.chatboxviews.get('inverness@chat.shakespeare.lit');
                expect(view.el.querySelector('.chatbox-title__text').textContent.trim()).toBe("Macbeth's Castle");
                done();
            }));

            it("is pre-filled with the muc_domain",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'],
                    {'muc_domain': 'muc.example.org'},
                    async function (done, _converse) {

                await test_utils.openControlBox(_converse);
                const roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                roomspanel.el.querySelector('.show-list-muc-modal').click();
                test_utils.closeControlBox(_converse);
                const modal = roomspanel.list_rooms_modal;
                await u.waitUntil(() => u.isVisible(modal.el), 1000);
                const server_input = modal.el.querySelector('input[name="server"]');
                expect(server_input.value).toBe('muc.example.org');
                done();
            }));

            it("doesn't let you set the MUC domain if it's locked",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'],
                    {'muc_domain': 'chat.shakespeare.lit', 'locked_muc_domain': true},
                    async function (done, _converse) {

                await test_utils.openControlBox(_converse);
                const roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                roomspanel.el.querySelector('.show-list-muc-modal').click();
                test_utils.closeControlBox(_converse);
                const modal = roomspanel.list_rooms_modal;
                await u.waitUntil(() => u.isVisible(modal.el), 1000);
                spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());
                roomspanel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called

                expect(modal.el.querySelector('input[name="server"]')).toBe(null);
                expect(modal.el.querySelector('input[type="submit"]')).toBe(null);
                await u.waitUntil(() => _converse.chatboxes.length);
                const sent_stanza = await u.waitUntil(() =>
                    _converse.connection.sent_stanzas.filter(
                        s => sizzle(`query[xmlns="http://jabber.org/protocol/disco#items"]`, s).length).pop()
                );
                expect(Strophe.serialize(sent_stanza)).toBe(
                    `<iq from="romeo@montague.lit/orchard" id="${sent_stanza.getAttribute('id')}" `+
                            `to="chat.shakespeare.lit" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/disco#items"/>`+
                    `</iq>`
                );
                const iq = $iq({
                    from:'muc.montague.lit',
                    to:'romeo@montague.lit/pda',
                    id: sent_stanza.getAttribute('id'),
                    type:'result'
                }).c('query')
                .c('item', { jid:'heath@chat.shakespeare.lit', name:'A Lonely Heath'}).up()
                .c('item', { jid:'coven@chat.shakespeare.lit', name:'A Dark Cave'}).up()
                .c('item', { jid:'forres@chat.shakespeare.lit', name:'The Palace'}).up()
                _converse.connection._dataRecv(test_utils.createRequest(iq));

                await u.waitUntil(() => modal.el.querySelectorAll('.available-chatrooms li').length === 4);
                const rooms = modal.el.querySelectorAll('.available-chatrooms li');
                expect(rooms[0].textContent.trim()).toBe("Groupchats found:");
                expect(rooms[1].textContent.trim()).toBe("A Lonely Heath");
                expect(rooms[2].textContent.trim()).toBe("A Dark Cave");
                expect(rooms[3].textContent.trim()).toBe("The Palace");
                done();
            }));
        });

        describe("The \"Groupchats\" section", function () {

            it("shows the number of unread mentions received",
                mock.initConverse(
                    ['rosterGroupsFetched'], {'allow_bookmarks': false},
                    async function (done, _converse) {

                await test_utils.openControlBox(_converse);
                const roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                expect(roomspanel.el.querySelectorAll('.available-room').length).toBe(0);

                const muc_jid = 'kitchen@conference.shakespeare.lit';
                const message = 'fires: Your attention is required';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'fires');
                const view = _converse.api.chatviews.get(muc_jid);
                await u.waitUntil(() => roomspanel.el.querySelectorAll('.available-room').length);
                expect(roomspanel.el.querySelectorAll('.available-room').length).toBe(1);
                expect(roomspanel.el.querySelectorAll('.msgs-indicator').length).toBe(0);

                view.model.set({'minimized': true});

                const nick = mock.chatroom_names[0];

                await view.model.onMessage($msg({
                        from: muc_jid+'/'+nick,
                        id: u.getUniqueId(),
                        to: 'romeo@montague.lit',
                        type: 'groupchat'
                    }).c('body').t(message).tree());
                await u.waitUntil(() => view.model.messages.length);
                expect(roomspanel.el.querySelectorAll('.available-room').length).toBe(1);
                expect(roomspanel.el.querySelectorAll('.msgs-indicator').length).toBe(1);
                expect(roomspanel.el.querySelector('.msgs-indicator').textContent.trim()).toBe('1');

                await view.model.onMessage($msg({
                    'from': muc_jid+'/'+nick,
                    'id': u.getUniqueId(),
                    'to': 'romeo@montague.lit',
                    'type': 'groupchat'
                }).c('body').t(message).tree());
                await u.waitUntil(() => view.model.messages.length > 1);
                expect(roomspanel.el.querySelectorAll('.available-room').length).toBe(1);
                expect(roomspanel.el.querySelectorAll('.msgs-indicator').length).toBe(1);
                expect(roomspanel.el.querySelector('.msgs-indicator').textContent.trim()).toBe('2');
                view.model.set({'minimized': false});
                expect(roomspanel.el.querySelectorAll('.available-room').length).toBe(1);
                expect(roomspanel.el.querySelectorAll('.msgs-indicator').length).toBe(0);
                done();
            }));
        });

        describe("A XEP-0085 Chat Status Notification", function () {

            it("is is not sent out to a MUC if the user is a visitor in a moderated room",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                spyOn(_converse.ChatRoom.prototype, 'sendChatState').and.callThrough();

                const muc_jid = 'lounge@montague.lit';
                const features = [
                    'http://jabber.org/protocol/muc',
                    'jabber:iq:register',
                    'muc_passwordprotected',
                    'muc_hidden',
                    'muc_temporary',
                    'muc_membersonly',
                    'muc_moderated',
                    'muc_anonymous'
                ]
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo', features);

                const view = _converse.api.chatviews.get(muc_jid);
                view.model.setChatState(_converse.ACTIVE);

                expect(view.model.sendChatState).toHaveBeenCalled();
                const last_stanza = _converse.connection.sent_stanzas.pop();
                expect(Strophe.serialize(last_stanza)).toBe(
                    `<message to="lounge@montague.lit" type="groupchat" xmlns="jabber:client">`+
                        `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                        `<no-store xmlns="urn:xmpp:hints"/>`+
                        `<no-permanent-store xmlns="urn:xmpp:hints"/>`+
                    `</message>`);

                // Romeo loses his voice
                const presence = $pres({
                        to: 'romeo@montague.lit/orchard',
                        from: `${muc_jid}/romeo`
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {'affiliation': 'none', 'role': 'visitor'}).up()
                    .c('status', {code: '110'});
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                const occupant = view.model.occupants.findWhere({'jid': _converse.bare_jid});
                expect(occupant.get('role')).toBe('visitor');

                spyOn(_converse.connection, 'send');
                view.model.setChatState(_converse.INACTIVE);
                expect(view.model.sendChatState.calls.count()).toBe(2);
                expect(_converse.connection.send).not.toHaveBeenCalled();
                done();
            }));


            describe("A composing notification", function () {

                it("will be shown if received",
                    mock.initConverse(
                        ['rosterGroupsFetched'], {},
                        async function (done, _converse) {

                    const muc_jid = 'coven@chat.shakespeare.lit';
                    await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'some1');
                    const view = _converse.api.chatviews.get(muc_jid);
                    const chat_content = view.el.querySelector('.chat-content');

                    expect(sizzle('div.chat-info:first', chat_content).pop().textContent.trim())
                        .toBe("some1 has entered the groupchat");

                    let presence = $pres({
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
                    expect(chat_content.querySelectorAll('div.chat-info').length).toBe(2);
                    expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim())
                        .toBe("newguy has entered the groupchat");

                    presence = $pres({
                            to: 'romeo@montague.lit/_converse.js-29092160',
                            from: 'coven@chat.shakespeare.lit/nomorenicks'
                        })
                        .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'none',
                            'jid': 'nomorenicks@montague.lit/_converse.js-290929789',
                            'role': 'participant'
                        });
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(chat_content.querySelectorAll('div.chat-info').length).toBe(3);
                    expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim())
                        .toBe("nomorenicks has entered the groupchat");

                    // See XEP-0085 https://xmpp.org/extensions/xep-0085.html#definitions

                    // <composing> state
                    let msg = $msg({
                            from: muc_jid+'/newguy',
                            id: u.getUniqueId(),
                            to: 'romeo@montague.lit',
                            type: 'groupchat'
                        }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();

                    await view.model.onMessage(msg);
                    await u.waitUntil(() => view.el.querySelectorAll('.chat-state-notification').length);

                    // Check that the notification appears inside the chatbox in the DOM
                    let events = view.el.querySelectorAll('.chat-event');
                    expect(events.length).toBe(3);
                    expect(events[0].textContent.trim()).toEqual('some1 has entered the groupchat');
                    expect(events[1].textContent.trim()).toEqual('newguy has entered the groupchat');
                    expect(events[2].textContent.trim()).toEqual('nomorenicks has entered the groupchat');

                    let notifications = view.el.querySelectorAll('.chat-state-notification');
                    expect(notifications.length).toBe(1);
                    expect(notifications[0].textContent.trim()).toEqual('newguy is typing');

                    const timeout_functions = [];
                    spyOn(window, 'setTimeout').and.callFake(f => timeout_functions.push(f));

                    // Check that it doesn't appear twice
                    msg = $msg({
                            from: muc_jid+'/newguy',
                            id: u.getUniqueId(),
                            to: 'romeo@montague.lit',
                            type: 'groupchat'
                        }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                    await view.model.onMessage(msg);

                    events = view.el.querySelectorAll('.chat-event');
                    expect(events.length).toBe(3);
                    expect(events[0].textContent.trim()).toEqual('some1 has entered the groupchat');
                    expect(events[1].textContent.trim()).toEqual('newguy has entered the groupchat');
                    expect(events[2].textContent.trim()).toEqual('nomorenicks has entered the groupchat');

                    notifications = view.el.querySelectorAll('.chat-state-notification');
                    expect(notifications.length).toBe(1);
                    expect(notifications[0].textContent.trim()).toEqual('newguy is typing');
                    expect(timeout_functions.length).toBe(1);

                    // <composing> state for a different occupant
                    msg = $msg({
                            from: muc_jid+'/nomorenicks',
                            id: u.getUniqueId(),
                            to: 'romeo@montague.lit',
                            type: 'groupchat'
                        }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                    await view.model.onMessage(msg);
                    events = view.el.querySelectorAll('.chat-event');
                    expect(events.length).toBe(3);
                    expect(events[0].textContent.trim()).toEqual('some1 has entered the groupchat');
                    expect(events[1].textContent.trim()).toEqual('newguy has entered the groupchat');
                    expect(events[2].textContent.trim()).toEqual('nomorenicks has entered the groupchat');

                    await u.waitUntil(() => (view.el.querySelectorAll('.chat-state-notification').length === 2));
                    notifications = view.el.querySelectorAll('.chat-state-notification');
                    expect(notifications.length).toBe(2);
                    expect(notifications[0].textContent.trim()).toEqual('nomorenicks is typing');
                    expect(notifications[1].textContent.trim()).toEqual('newguy is typing');

                    // Check that new messages appear under the chat state notifications
                    msg = $msg({
                        from: `${muc_jid}/some1`,
                        id: u.getUniqueId(),
                        to: 'romeo@montague.lit',
                        type: 'groupchat'
                    }).c('body').t('hello world').tree();
                    await view.model.onMessage(msg);

                    const messages = view.el.querySelectorAll('.message');
                    expect(messages.length).toBe(7);
                    expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
                    expect(view.el.querySelector('.chat-msg .chat-msg__text').textContent.trim()).toBe('hello world');

                    // Test that the composing notifications get removed via timeout.
                    timeout_functions[0]();
                    events = view.el.querySelectorAll('.chat-event');
                    expect(events.length).toBe(3);
                    expect(events[0].textContent.trim()).toEqual('some1 has entered the groupchat');
                    expect(events[1].textContent.trim()).toEqual('newguy has entered the groupchat');
                    expect(events[2].textContent.trim()).toEqual('nomorenicks has entered the groupchat');

                    notifications = view.el.querySelectorAll('.chat-state-notification');
                    expect(notifications.length).toBe(1);
                    expect(notifications[0].textContent.trim()).toEqual('nomorenicks is typing');

                    timeout_functions.filter(f => f.name === 'bound safeDestroy').pop()();

                    events = view.el.querySelectorAll('.chat-event');
                    expect(events.length).toBe(3);
                    expect(events[0].textContent.trim()).toEqual('some1 has entered the groupchat');
                    expect(events[1].textContent.trim()).toEqual('newguy has entered the groupchat');
                    expect(events[2].textContent.trim()).toEqual('nomorenicks has entered the groupchat');

                    notifications = view.el.querySelectorAll('.chat-state-notification');
                    expect(notifications.length).toBe(0);
                    done();
                }));
            });

            describe("A paused notification", function () {
                it("will be shown if received",
                    mock.initConverse(
                        ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        async function (done, _converse) {

                    await test_utils.openChatRoom(_converse, "coven", 'chat.shakespeare.lit', 'some1');
                    const muc_jid = 'coven@chat.shakespeare.lit';
                    const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                    const chat_content = view.el.querySelector('.chat-content');

                    /* <presence to="romeo@montague.lit/_converse.js-29092160"
                        *           from="coven@chat.shakespeare.lit/some1">
                        *      <x xmlns="http://jabber.org/protocol/muc#user">
                        *          <item affiliation="owner" jid="romeo@montague.lit/_converse.js-29092160" role="moderator"/>
                        *          <status code="110"/>
                        *      </x>
                        *  </presence></body>
                        */
                    let presence = $pres({
                            to: 'romeo@montague.lit/_converse.js-29092160',
                            from: 'coven@chat.shakespeare.lit/some1'
                        }).c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'owner',
                            'jid': 'romeo@montague.lit/_converse.js-29092160',
                            'role': 'moderator'
                        }).up()
                        .c('status', {code: '110'});
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(sizzle('div.chat-info:first', chat_content).pop().textContent.trim())
                        .toBe("some1 has entered the groupchat");

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
                    expect(chat_content.querySelectorAll('div.chat-info').length).toBe(2);
                    expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim())
                        .toBe("newguy has entered the groupchat");

                    presence = $pres({
                            to: 'romeo@montague.lit/_converse.js-29092160',
                            from: 'coven@chat.shakespeare.lit/nomorenicks'
                        })
                        .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'none',
                            'jid': 'nomorenicks@montague.lit/_converse.js-290929789',
                            'role': 'participant'
                        });
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(chat_content.querySelectorAll('div.chat-info').length).toBe(3);
                    expect(sizzle('div.chat-info:last', chat_content).pop().textContent.trim())
                        .toBe("nomorenicks has entered the groupchat");

                    // See XEP-0085 https://xmpp.org/extensions/xep-0085.html#definitions

                    // <composing> state
                    var msg = $msg({
                            from: muc_jid+'/newguy',
                            id: u.getUniqueId(),
                            to: 'romeo@montague.lit',
                            type: 'groupchat'
                        }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                    await view.model.onMessage(msg);

                    // Check that the notification appears inside the chatbox in the DOM
                    var events = view.el.querySelectorAll('.chat-event');
                    expect(events.length).toBe(3);
                    expect(events[0].textContent.trim()).toEqual('some1 has entered the groupchat');
                    expect(events[1].textContent.trim()).toEqual('newguy has entered the groupchat');
                    expect(events[2].textContent.trim()).toEqual('nomorenicks has entered the groupchat');

                    await u.waitUntil(() => view.el.querySelectorAll('.chat-state-notification').length);
                    let notifications = view.el.querySelectorAll('.chat-state-notification');
                    expect(notifications.length).toBe(1);
                    expect(notifications[0].textContent.trim()).toEqual('newguy is typing');

                    // Check that it doesn't appear twice
                    msg = $msg({
                            from: muc_jid+'/newguy',
                            id: u.getUniqueId(),
                            to: 'romeo@montague.lit',
                            type: 'groupchat'
                        }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                    await view.model.onMessage(msg);

                    events = view.el.querySelectorAll('.chat-event');
                    expect(events.length).toBe(3);
                    expect(events[0].textContent.trim()).toEqual('some1 has entered the groupchat');
                    expect(events[1].textContent.trim()).toEqual('newguy has entered the groupchat');
                    expect(events[2].textContent.trim()).toEqual('nomorenicks has entered the groupchat');

                    notifications = view.el.querySelectorAll('.chat-state-notification');
                    expect(notifications.length).toBe(1);
                    expect(notifications[0].textContent.trim()).toEqual('newguy is typing');

                    // <composing> state for a different occupant
                    msg = $msg({
                            from: muc_jid+'/nomorenicks',
                            id: u.getUniqueId(),
                            to: 'romeo@montague.lit',
                            type: 'groupchat'
                        }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                    await view.model.onMessage(msg);
                    events = view.el.querySelectorAll('.chat-event');
                    expect(events.length).toBe(3);
                    expect(events[0].textContent.trim()).toEqual('some1 has entered the groupchat');
                    expect(events[1].textContent.trim()).toEqual('newguy has entered the groupchat');
                    expect(events[2].textContent.trim()).toEqual('nomorenicks has entered the groupchat');

                    await u.waitUntil(() => view.el.querySelectorAll('.chat-state-notification').length ===  2);
                    notifications = view.el.querySelectorAll('.chat-state-notification');
                    // We check for the messages' text without assuming order,
                    // because it can be variable since getLastMessageDate
                    // ignore CSN messages.
                    let text = _.map(notifications, 'textContent').join(' ');
                    expect(text.includes('newguy is typing')).toBe(true);
                    expect(text.includes('nomorenicks is typing')).toBe(true);

                    // <paused> state from occupant who typed first
                    msg = $msg({
                            from: muc_jid+'/newguy',
                            id: u.getUniqueId(),
                            to: 'romeo@montague.lit',
                            type: 'groupchat'
                        }).c('body').c('paused', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                    await view.model.onMessage(msg);
                    events = view.el.querySelectorAll('.chat-event');
                    expect(events.length).toBe(3);
                    expect(events[0].textContent.trim()).toEqual('some1 has entered the groupchat');
                    expect(events[1].textContent.trim()).toEqual('newguy has entered the groupchat');
                    expect(events[2].textContent.trim()).toEqual('nomorenicks has entered the groupchat');

                    await u.waitUntil(() => {
                        return _.map(
                            view.el.querySelectorAll('.chat-state-notification'), 'textContent')
                                .join(' ').includes('stopped typing')
                    });
                    notifications = view.el.querySelectorAll('.chat-state-notification');
                    expect(notifications.length).toBe(2);
                    text = _.map(notifications, 'textContent').join(' ');
                    expect(text.includes('newguy has stopped typing')).toBe(true);
                    expect(text.includes('nomorenicks is typing')).toBe(true);
                    done();
                }));
            });
        });

        describe("A muted user", function () {

            it("will receive a user-friendly error message when trying to send a message",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'trollbox@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'troll');
                const view = _converse.api.chatviews.get(muc_jid);
                const textarea = view.el.querySelector('.chat-textarea');
                textarea.value = 'Hello world';
                view.onFormSubmitted(new Event('submit'));
                await new Promise(resolve => view.once('messageInserted', resolve));

                let stanza = u.toStanza(`
                    <message xmlns="jabber:client" type="error" to="troll@montague.lit/resource" from="trollbox@montague.lit">
                        <error type="auth"><forbidden xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await new Promise(resolve => view.once('messageInserted', resolve));
                expect(view.el.querySelector('.chat-error').textContent.trim()).toBe(
                    "Your message was not delivered because you weren't allowed to send it.");

                textarea.value = 'Hello again';
                view.onFormSubmitted(new Event('submit'));
                await new Promise(resolve => view.once('messageInserted', resolve));

                stanza = u.toStanza(`
                    <message xmlns="jabber:client" type="error" to="troll@montague.lit/resource" from="trollbox@montague.lit">
                        <error type="auth">
                            <forbidden xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                            <text xmlns="urn:ietf:params:xml:ns:xmpp-stanzas">Thou shalt not!</text>
                        </error>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await new Promise(resolve => view.once('messageInserted', resolve));

                expect(view.el.querySelector('.message:last-child').textContent.trim()).toBe(
                    'Your message was not delivered because you weren\'t allowed to send it. '+
                    'The message from the server is: "Thou shalt not!"')
                done();
            }));

            it("will see an explanatory message instead of a textarea",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                const features = [
                    'http://jabber.org/protocol/muc',
                    'jabber:iq:register',
                    Strophe.NS.SID,
                    'muc_moderated',
                ]
                const muc_jid = 'trollbox@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'troll', features);
                const view = _converse.api.chatviews.get(muc_jid);
                expect(_.isNull(view.el.querySelector('.chat-textarea'))).toBe(false);

                let stanza = u.toStanza(`
                    <presence
                        from='trollbox@montague.lit/troll'
                        to='romeo@montague.lit/orchard'>
                    <x xmlns='http://jabber.org/protocol/muc#user'>
                        <item affiliation='none'
                            nick='troll'
                            role='visitor'/>
                        <status code='110'/>
                    </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                expect(view.el.querySelector('.chat-textarea')).toBe(null);
                let bottom_panel = view.el.querySelector('.muc-bottom-panel');
                expect(bottom_panel.textContent.trim()).toBe("You're not allowed to send messages in this room");

                // This only applies to moderated rooms, so let's check that
                // the textarea becomes visible when the room's
                // configuration changes to be non-moderated
                view.model.features.set('moderated', false);
                expect(view.el.querySelector('.muc-bottom-panel')).toBe(null);
                let textarea = view.el.querySelector('.chat-textarea');
                expect(textarea === null).toBe(false);

                view.model.features.set('moderated', true);
                expect(view.el.querySelector('.chat-textarea')).toBe(null);
                bottom_panel = view.el.querySelector('.muc-bottom-panel');
                expect(bottom_panel.textContent.trim()).toBe("You're not allowed to send messages in this room");

                // Check now that things get restored when the user is given a voice
                let info_msgs = sizzle('.chat-info', view.el);
                expect(info_msgs.length).toBe(2);
                expect(info_msgs[0].textContent.trim()).toBe("troll has entered the groupchat");
                expect(info_msgs[1].textContent.trim()).toBe("troll is no longer an owner of this groupchat");

                stanza = u.toStanza(`
                    <presence
                        from='trollbox@montague.lit/troll'
                        to='romeo@montague.lit/orchard'>
                    <x xmlns='http://jabber.org/protocol/muc#user'>
                        <item affiliation='none'
                            nick='troll'
                            role='participant'/>
                        <status code='110'/>
                    </x>
                    </presence>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                info_msgs = sizzle('.chat-info', view.el);

                bottom_panel = view.el.querySelector('.muc-bottom-panel');
                expect(bottom_panel).toBe(null);

                textarea = view.el.querySelector('.chat-textarea');
                expect(textarea === null).toBe(false);

                expect(info_msgs.length).toBe(3);
                expect(info_msgs[2].textContent.trim()).toBe("troll has been given a voice");
                done();
            }));
        });
    });
}));
