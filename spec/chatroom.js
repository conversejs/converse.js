(function (root, factory) {
    define(["jasmine", "mock", "test-utils" ], factory);
} (this, function (jasmine, mock, test_utils) {
    const _ = converse.env._,
          $pres = converse.env.$pres,
          $iq = converse.env.$iq,
          $msg = converse.env.$msg,
          Strophe = converse.env.Strophe,
          Promise = converse.env.Promise,
          moment = converse.env.moment,
          sizzle = converse.env.sizzle,
          Backbone = converse.env.Backbone,
          u = converse.env.utils;

    describe("Chatrooms", function () {

        describe("The \"rooms\" API", function () {

            it("has a method 'close' which closes rooms by JID or all rooms when called with no arguments",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                await test_utils.openAndEnterChatRoom(_converse, 'leisure', 'localhost', 'dummy');
                await test_utils.openAndEnterChatRoom(_converse, 'news', 'localhost', 'dummy');
                expect(u.isVisible(_converse.chatboxviews.get('lounge@localhost').el)).toBeTruthy();
                expect(u.isVisible(_converse.chatboxviews.get('leisure@localhost').el)).toBeTruthy();
                expect(u.isVisible(_converse.chatboxviews.get('news@localhost').el)).toBeTruthy();

                // XXX: bit of a cheat here. We want `cleanup()` to be
                // called on the room. Either it's this or faking
                // `sendPresence`.
                _converse.connection.connected = false;

                await _converse.api.roomviews.close('lounge@localhost');
                expect(_converse.chatboxviews.get('lounge@localhost')).toBeUndefined();
                expect(u.isVisible(_converse.chatboxviews.get('leisure@localhost').el)).toBeTruthy();
                expect(u.isVisible(_converse.chatboxviews.get('news@localhost').el)).toBeTruthy();

                await _converse.api.roomviews.close(['leisure@localhost', 'news@localhost']);
                expect(_converse.chatboxviews.get('lounge@localhost')).toBeUndefined();
                expect(_converse.chatboxviews.get('leisure@localhost')).toBeUndefined();
                expect(_converse.chatboxviews.get('news@localhost')).toBeUndefined();
                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                await test_utils.openAndEnterChatRoom(_converse, 'leisure', 'localhost', 'dummy');
                expect(u.isVisible(_converse.chatboxviews.get('lounge@localhost').el)).toBeTruthy();
                expect(u.isVisible(_converse.chatboxviews.get('leisure@localhost').el)).toBeTruthy();
                await _converse.api.roomviews.close();
                expect(_converse.chatboxviews.get('lounge@localhost')).toBeUndefined();
                expect(_converse.chatboxviews.get('leisure@localhost')).toBeUndefined();
                done();
            }));

            it("has a method 'get' which returns a wrapped groupchat (if it exists)",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.createContacts(_converse, 'current');
                await test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group .group-toggle').length, 300);
                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                let jid = 'lounge@localhost';
                let room = await _converse.api.rooms.get(jid);
                expect(room instanceof Object).toBeTruthy();

                let view = _converse.chatboxviews.get(jid);
                expect(view.is_chatroom).toBeTruthy();

                expect(u.isVisible(view.el)).toBeTruthy();
                await view.close();

                // Test with mixed case
                await test_utils.openAndEnterChatRoom(_converse, 'Leisure', 'localhost', 'dummy');
                jid = 'Leisure@localhost';
                room = await _converse.api.rooms.get(jid);
                expect(room instanceof Object).toBeTruthy();
                view = _converse.chatboxviews.get(jid.toLowerCase());
                expect(u.isVisible(view.el)).toBeTruthy();

                jid = 'leisure@localhost';
                room = await _converse.api.rooms.get(jid);
                expect(room instanceof Object).toBeTruthy();
                view = _converse.chatboxviews.get(jid.toLowerCase());
                expect(u.isVisible(view.el)).toBeTruthy();

                jid = 'leiSure@localhost';
                room = await _converse.api.rooms.get(jid);
                expect(room instanceof Object).toBeTruthy();
                view = _converse.chatboxviews.get(jid.toLowerCase());
                expect(u.isVisible(view.el)).toBeTruthy();
                await view.close();

                // Non-existing room
                jid = 'lounge2@localhost';
                room = await _converse.api.rooms.get(jid);
                expect(typeof room === 'undefined').toBeTruthy();
                done();
            }));

            it("has a method 'open' which opens (optionally configures) and returns a wrapped chat box",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                // Mock 'getRoomFeatures', otherwise the room won't be
                // displayed as it waits first for the features to be returned
                // (when it's a new room being created).
                spyOn(_converse.ChatRoom.prototype, 'getRoomFeatures').and.callFake(() => Promise.resolve());

                const sent_IQ_els = [];
                let jid = 'lounge@localhost';
                let chatroomview, sent_IQ, IQ_id;
                test_utils.openControlBox();
                await test_utils.createContacts(_converse, 'current');
                await test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group .group-toggle').length);
                let room = await _converse.api.rooms.open(jid);
                // Test on groupchat that's not yet open
                expect(room instanceof Backbone.Model).toBeTruthy();
                chatroomview = _converse.chatboxviews.get(jid);
                expect(chatroomview.is_chatroom).toBeTruthy();
                expect(u.isVisible(chatroomview.el)).toBeTruthy();

                // Test again, now that the room exists.
                room = await _converse.api.rooms.open(jid);
                expect(room instanceof Backbone.Model).toBeTruthy();
                chatroomview = _converse.chatboxviews.get(jid);
                expect(chatroomview.is_chatroom).toBeTruthy();
                expect(u.isVisible(chatroomview.el)).toBeTruthy();
                await chatroomview.close();

                // Test with mixed case in JID
                jid = 'Leisure@localhost';
                room = await _converse.api.rooms.open(jid);
                expect(room instanceof Backbone.Model).toBeTruthy();
                chatroomview = _converse.chatboxviews.get(jid.toLowerCase());
                expect(u.isVisible(chatroomview.el)).toBeTruthy();

                jid = 'leisure@localhost';
                room = await _converse.api.rooms.open(jid);
                expect(room instanceof Backbone.Model).toBeTruthy();
                chatroomview = _converse.chatboxviews.get(jid.toLowerCase());
                expect(u.isVisible(chatroomview.el)).toBeTruthy();

                jid = 'leiSure@localhost';
                room = await _converse.api.rooms.open(jid);
                expect(room instanceof Backbone.Model).toBeTruthy();
                chatroomview = _converse.chatboxviews.get(jid.toLowerCase());
                expect(u.isVisible(chatroomview.el)).toBeTruthy();
                await chatroomview.close();

                _converse.muc_instant_rooms = false;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    sent_IQ_els.push(iq.nodeTree);
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                // Test with configuration
                room = await _converse.api.rooms.open('room@conference.example.org', {
                    'nick': 'some1',
                    'auto_configure': true,
                    'roomconfig': {
                        'changesubject': false,
                        'membersonly': true,
                        'persistentroom': true,
                        'publicroom': true,
                        'roomdesc': 'Welcome to this groupchat',
                        'whois': 'anyone'
                    }
                });
                chatroomview = _converse.chatboxviews.get('room@conference.example.org');

                // We pretend this is a new room, so no disco info is returned.
                var features_stanza = $iq({
                        from: 'room@conference.example.org',
                        'id': IQ_id,
                        'to': 'dummy@localhost/desktop',
                        'type': 'error'
                    }).c('error', {'type': 'cancel'})
                        .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                /* <presence xmlns="jabber:client" to="dummy@localhost/pda" from="room@conference.example.org/yo">
                 *  <x xmlns="http://jabber.org/protocol/muc#user">
                 *      <item affiliation="owner" jid="dummy@localhost/pda" role="moderator"/>
                 *      <status code="110"/>
                 *      <status code="201"/>
                 *  </x>
                 * </presence>
                 */
                var presence = $pres({
                        from:'room@conference.example.org/some1',
                        to:'dummy@localhost/pda'
                    })
                    .c('x', {xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        affiliation: 'owner',
                        jid: 'dummy@localhost/pda',
                        role: 'moderator'
                    }).up()
                    .c('status', {code:'110'}).up()
                    .c('status', {code:'201'});
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(_converse.connection.sendIQ).toHaveBeenCalled();
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="room@conference.example.org" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#owner"/></iq>`
                );
                var node = Strophe.xmlHtmlNode(
                   '<iq xmlns="jabber:client"'+
                   '     type="result"'+
                   '     to="dummy@localhost/pda"'+
                   '     from="room@conference.example.org" id="'+IQ_id+'">'+
                   ' <query xmlns="http://jabber.org/protocol/muc#owner">'+
                   '     <x xmlns="jabber:x:data" type="form">'+
                   '     <title>Configuration for room@conference.example.org</title>'+
                   '     <instructions>Complete and submit this form to configure the room.</instructions>'+
                   '     <field var="FORM_TYPE" type="hidden">'+
                   '         <value>http://jabber.org/protocol/muc#roomconfig</value>'+
                   '     </field>'+
                   '     <field type="text-single" var="muc#roomconfig_roomname" label="Name">'+
                   '         <value>Room</value>'+
                   '     </field>'+
                   '     <field type="text-single" var="muc#roomconfig_roomdesc" label="Description"><value/></field>'+
                   '     <field type="boolean" var="muc#roomconfig_persistentroom" label="Make Room Persistent?"/>'+
                   '     <field type="boolean" var="muc#roomconfig_publicroom" label="Make Room Publicly Searchable?"><value>1</value></field>'+
                   '     <field type="boolean" var="muc#roomconfig_changesubject" label="Allow Occupants to Change Subject?"/>'+
                   '     <field type="list-single" var="muc#roomconfig_whois" label="Who May Discover Real JIDs?"><option label="Moderators Only">'+
                   '        <value>moderators</value></option><option label="Anyone"><value>anyone</value></option>'+
                   '     </field>'+
                   '     <field type="text-private" var="muc#roomconfig_roomsecret" label="Password"><value/></field>'+
                   '     <field type="boolean" var="muc#roomconfig_moderatedroom" label="Make Room Moderated?"/>'+
                   '     <field type="boolean" var="muc#roomconfig_membersonly" label="Make Room Members-Only?"/>'+
                   '     <field type="text-single" var="muc#roomconfig_historylength" label="Maximum Number of History Messages Returned by Room">'+
                   '        <value>20</value></field>'+
                   '     </x>'+
                   ' </query>'+
                   ' </iq>');

                spyOn(chatroomview.model, 'sendConfiguration').and.callThrough();
                _converse.connection._dataRecv(test_utils.createRequest(node.firstElementChild));
                await test_utils.waitUntil(() => chatroomview.model.sendConfiguration.calls.count() === 1);
                var sent_stanza = sent_IQ_els.pop();
                while (sent_stanza.getAttribute('type') !== 'set') {
                    sent_stanza = sent_IQ_els.pop();
                }
                expect(sizzle('field[var="muc#roomconfig_roomname"] value', sent_stanza).pop().textContent).toBe('Room');
                expect(sizzle('field[var="muc#roomconfig_roomdesc"] value', sent_stanza).pop().textContent).toBe('Welcome to this groupchat');
                expect(sizzle('field[var="muc#roomconfig_persistentroom"] value', sent_stanza).pop().textContent).toBe('1');
                expect(sizzle('field[var="muc#roomconfig_publicroom"] value ', sent_stanza).pop().textContent).toBe('1');
                expect(sizzle('field[var="muc#roomconfig_changesubject"] value', sent_stanza).pop().textContent).toBe('0');
                expect(sizzle('field[var="muc#roomconfig_whois"] value ', sent_stanza).pop().textContent).toBe('anyone');
                expect(sizzle('field[var="muc#roomconfig_membersonly"] value', sent_stanza).pop().textContent).toBe('1');
                expect(sizzle('field[var="muc#roomconfig_historylength"] value', sent_stanza).pop().textContent).toBe('20');
                done();
            }));
        });

        describe("An instant groupchat", function () {

            it("will be created when muc_instant_rooms is set to true",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                const IQ_stanzas = _converse.connection.IQ_stanzas;
                const sendIQ = _converse.connection.sendIQ;
                const room_jid = 'lounge@localhost';
                let sent_IQ, IQ_id;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    if (iq.nodeTree.getAttribute('to') === 'lounge@localhost') {
                        sent_IQ = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    } else {
                        sendIQ.bind(this)(iq, callback, errback);
                    }
                });
                await test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                let stanza = await test_utils.waitUntil(() => _.get(_.filter(
                    IQ_stanzas,
                    iq => iq.nodeTree.querySelector(
                        `iq[to="${room_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                    )).pop(), 'nodeTree'));
                // We pretend this is a new room, so no disco info is returned.

                /* <iq from="jordie.langen@chat.example.org/converse.js-11659299" to="myroom@conference.chat.example.org" type="get">
                 *     <query xmlns="http://jabber.org/protocol/disco#info"/>
                 * </iq>
                 * <iq xmlns="jabber:client" type="error" to="jordie.langen@chat.example.org/converse.js-11659299" from="myroom@conference.chat.example.org">
                 *     <error type="cancel">
                 *         <item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                 *     </error>
                 * </iq>
                 */
                const features_stanza = $iq({
                        'from': 'lounge@localhost',
                        'id': stanza.getAttribute('id'),
                        'to': 'dummy@localhost/desktop',
                        'type': 'error'
                    }).c('error', {'type': 'cancel'})
                        .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                const view = _converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'join').and.callThrough();
                spyOn(view, 'submitNickname').and.callThrough();

                /* <iq to="myroom@conference.chat.example.org"
                 *     from="jordie.langen@chat.example.org/converse.js-11659299"
                 *     type="get">
                 *   <query xmlns="http://jabber.org/protocol/disco#info"
                 *          node="x-roomuser-item"/>
                 * </iq>
                 */
                const node = await test_utils.waitUntil(() => _.filter(
                        IQ_stanzas,
                        s => sizzle(`iq[to="${room_jid}"] query[node="x-roomuser-item"]`, s.nodeTree).length
                    ).pop()
                );
                stanza = node.nodeTree;
                expect(node.toLocaleString()).toBe(
                    `<iq from="dummy@localhost/resource" id="${stanza.getAttribute("id")}" to="lounge@localhost" `+
                        `type="get" xmlns="jabber:client">`+
                            `<query node="x-roomuser-item" xmlns="http://jabber.org/protocol/disco#info"/></iq>`);

                /* <iq xmlns="jabber:client" type="error" to="jordie.langen@chat.example.org/converse.js-11659299" from="myroom@conference.chat.example.org">
                 *      <error type="cancel">
                 *          <item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                 *      </error>
                 *  </iq>
                 */
                var result_stanza = $iq({
                    'type': 'error',
                    'id': stanza.getAttribute('id'),
                    'from': view.model.get('jid'),
                    'to': _converse.connection.jid
                }).c('error', {'type': 'cancel'})
                    .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                _converse.connection._dataRecv(test_utils.createRequest(result_stanza));
                const input = await test_utils.waitUntil(() => view.el.querySelector('input[name="nick"]'));
                input.value = 'nicky';
                view.el.querySelector('input[type=submit]').click();
                expect(view.submitNickname).toHaveBeenCalled();
                expect(view.join).toHaveBeenCalled();

                // The user has just entered the room (because join was called)
                // and receives their own presence from the server.
                // See example 24:
                // http://xmpp.org/extensions/xep-0045.html#enter-pres
                //
                /* <presence xmlns="jabber:client" to="jordie.langen@chat.example.org/converse.js-11659299" from="myroom@conference.chat.example.org/jc">
                 *    <x xmlns="http://jabber.org/protocol/muc#user">
                 *        <item jid="jordie.langen@chat.example.org/converse.js-11659299" affiliation="owner" role="moderator"/>
                 *        <status code="110"/>
                 *        <status code="201"/>
                 *    </x>
                 *  </presence>
                 */
                var presence = $pres({
                        to:'dummy@localhost/resource',
                        from:'lounge@localhost/thirdwitch',
                        id:'5025e055-036c-4bc5-a227-706e7e352053'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    affiliation: 'owner',
                    jid: 'dummy@localhost/resource',
                    role: 'moderator'
                }).up()
                .c('status').attrs({code:'110'}).up()
                .c('status').attrs({code:'201'}).nodeTree;

                _converse.connection._dataRecv(test_utils.createRequest(presence));
                var info_text = view.el.querySelector('.chat-content .chat-info').textContent;
                expect(info_text).toBe('A new groupchat has been created');

                // An instant room is created by saving the default configuratoin.
                //
                /* <iq to="myroom@conference.chat.example.org" type="set" xmlns="jabber:client" id="5025e055-036c-4bc5-a227-706e7e352053:sendIQ">
                 *   <query xmlns="http://jabber.org/protocol/muc#owner"><x xmlns="jabber:x:data" type="submit"/></query>
                 * </iq>
                 */
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="lounge@localhost" type="set" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#owner"><x type="submit" xmlns="jabber:x:data"/>`+
                    `</query></iq>`);
                done();
            }));
        });

        describe("A Groupchat", function () {

            it("is opened when an xmpp: URI is clicked inside another groupchat",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.createContacts(_converse, 'current');
                await test_utils.waitUntil(() => test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy'));
                const view = _converse.chatboxviews.get('lounge@localhost');
                if (!view.el.querySelectorAll('.chat-area').length) {
                    view.renderChatArea();
                }
                expect(_converse.chatboxes.length).toEqual(2);
                const message = 'Please go to xmpp:coven@chat.shakespeare.lit?join',
                        nick = mock.chatroom_names[0],
                        msg = $msg({
                        'from': 'lounge@localhost/'+nick,
                        'id': (new Date()).getTime(),
                        'to': 'dummy@localhost',
                        'type': 'groupchat'
                    }).c('body').t(message).tree();

                view.model.onMessage(msg);
                await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                view.el.querySelector('.chat-msg__text a').click();
                await test_utils.waitUntil(() => _converse.chatboxes.length === 3)
                expect(_.includes(_converse.chatboxes.pluck('id'), 'coven@chat.shakespeare.lit')).toBe(true);
                done()
            }));

            it("shows a notification if its not anonymous",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.openChatRoom(_converse, "coven", 'chat.shakespeare.lit', 'some1');
                const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                const chat_content = view.el.querySelector('.chat-content');
                /* <presence to="dummy@localhost/_converse.js-29092160"
                 *           from="coven@chat.shakespeare.lit/some1">
                 *      <x xmlns="http://jabber.org/protocol/muc#user">
                 *          <item affiliation="owner" jid="dummy@localhost/_converse.js-29092160" role="moderator"/>
                 *          <status code="110"/>
                 *          <status code="100"/>
                 *      </x>
                 *  </presence></body>
                 */
                let presence = $pres({
                        to: 'dummy@localhost/resource',
                        from: 'coven@chat.shakespeare.lit/some1'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'owner',
                        'jid': 'dummy@localhost/_converse.js-29092160',
                        'role': 'moderator'
                    }).up()
                    .c('status', {code: '110'}).up()
                    .c('status', {code: '100'});
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                await test_utils.waitUntil(() => sizzle('div.chat-info', chat_content).length > 1);

                expect(chat_content.querySelectorAll('.chat-info').length).toBe(2);
                expect(sizzle('div.chat-info:first', chat_content).pop().textContent)
                    .toBe("This groupchat is not anonymous");
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent)
                    .toBe("some1 has entered the groupchat");

                // Check that we don't show the notification twice
                presence = $pres({
                        to: 'dummy@localhost/resource',
                        from: 'coven@chat.shakespeare.lit/some1'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'owner',
                        'jid': 'dummy@localhost/_converse.js-29092160',
                        'role': 'moderator'
                    }).up()
                    .c('status', {code: '110'}).up()
                    .c('status', {code: '100'});
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('.chat-info').length).toBe(2);
                expect(sizzle('div.chat-info:first', chat_content).pop().textContent)
                    .toBe("This groupchat is not anonymous");
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent)
                    .toBe("some1 has entered the groupchat");
                done();
            }));


            it("shows join/leave messages when users enter or exit a groupchat",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.openChatRoom(_converse, "coven", 'chat.shakespeare.lit', 'some1');
                const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                const chat_content = view.el.querySelector('.chat-content');
                /* We don't show join/leave messages for existing occupants. We
                 * know about them because we receive their presences before we
                 * receive our own.
                 */
                let presence = $pres({
                        to: 'dummy@localhost/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/oldguy'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'oldguy@localhost/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(0);

                /* <presence to="dummy@localhost/_converse.js-29092160"
                 *           from="coven@chat.shakespeare.lit/some1">
                 *      <x xmlns="http://jabber.org/protocol/muc#user">
                 *          <item affiliation="owner" jid="dummy@localhost/_converse.js-29092160" role="moderator"/>
                 *          <status code="110"/>
                 *      </x>
                 *  </presence></body>
                 */
                presence = $pres({
                        to: 'dummy@localhost/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/some1'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'owner',
                        'jid': 'dummy@localhost/_converse.js-29092160',
                        'role': 'moderator'
                    }).up()
                    .c('status', {code: '110'});
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info:first', chat_content).pop().textContent)
                    .toBe("some1 has entered the groupchat");

                presence = $pres({
                        to: 'dummy@localhost/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/newguy'
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'newguy@localhost/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(2);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent)
                    .toBe("newguy has entered the groupchat");

                const msg = $msg({
                    'from': 'coven@chat.shakespeare.lit/some1',
                    'id': (new Date()).getTime(),
                    'to': 'dummy@localhost',
                    'type': 'groupchat'
                }).c('body').t('hello world').tree();
                _converse.connection._dataRecv(test_utils.createRequest(msg));
                await new Promise((resolve, reject) => view.once('messageInserted', resolve));

                // Add another entrant, otherwise the above message will be
                // collapsed if "newguy" leaves immediately again
                presence = $pres({
                        to: 'dummy@localhost/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/newgirl'
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'newgirl@localhost/_converse.js-213098781',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(3);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent)
                    .toBe("newgirl has entered the groupchat");

                // Don't show duplicate join messages
                presence = $pres({
                        to: 'dummy@localhost/_converse.js-290918392',
                        from: 'coven@chat.shakespeare.lit/newguy'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'newguy@localhost/_converse.js-290929789',
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
                        to: 'dummy@localhost/_converse.js-29092160',
                        type: 'unavailable',
                        from: 'coven@chat.shakespeare.lit/newguy'
                    })
                    .c('status', 'Disconnected: Replaced by new connection').up()
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'none',
                            'jid': 'newguy@localhost/_converse.js-290929789',
                            'role': 'none'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(4);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent).toBe(
                    'newguy has left the groupchat. '+
                    '"Disconnected: Replaced by new connection"');

                // When the user immediately joins again, we collapse the
                // multiple join/leave messages.
                presence = $pres({
                        to: 'dummy@localhost/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/newguy'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'newguy@localhost/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(4);
                let msg_el = sizzle('div.chat-info:last', chat_content).pop();
                expect(msg_el.textContent).toBe("newguy has left and re-entered the groupchat");
                expect(msg_el.getAttribute('data-leavejoin')).toBe('newguy');

                presence = $pres({
                        to: 'dummy@localhost/_converse.js-29092160',
                        type: 'unavailable',
                        from: 'coven@chat.shakespeare.lit/newguy'
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'none',
                            'jid': 'newguy@localhost/_converse.js-290929789',
                            'role': 'none'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(4);
                msg_el = sizzle('div.chat-info', chat_content).pop();
                expect(msg_el.textContent).toBe('newguy has left the groupchat');
                expect(msg_el.getAttribute('data-leave')).toBe('newguy');

                presence = $pres({
                        to: 'dummy@localhost/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/nomorenicks'
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'nomorenicks@localhost/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(5);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent)
                    .toBe("nomorenicks has entered the groupchat");

                presence = $pres({
                        to: 'dummy@localhost/_converse.js-290918392',
                        type: 'unavailable',
                        from: 'coven@chat.shakespeare.lit/nomorenicks'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'nomorenicks@localhost/_converse.js-290929789',
                        'role': 'none'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(5);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent)
                    .toBe("nomorenicks has entered and left the groupchat");

                presence = $pres({
                        to: 'dummy@localhost/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/nomorenicks'
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'nomorenicks@localhost/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(5);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent)
                    .toBe("nomorenicks has entered the groupchat");

                // Test a member joining and leaving
                presence = $pres({
                        to: 'dummy@localhost/_converse.js-290918392',
                        from: 'coven@chat.shakespeare.lit/insider'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'member',
                        'jid': 'insider@localhost/_converse.js-290929789',
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
                        to: 'dummy@localhost/_converse.js-29092160',
                        type: 'unavailable',
                        from: 'coven@chat.shakespeare.lit/insider'
                    })
                    .c('status', 'Disconnected: Replaced by new connection').up()
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'member',
                            'jid': 'insider@localhost/_converse.js-290929789',
                            'role': 'none'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(6);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent).toBe(
                    'insider has entered and left the groupchat. '+
                    '"Disconnected: Replaced by new connection"');

                expect(view.model.occupants.length).toBe(5);
                expect(view.model.occupants.findWhere({'jid': 'insider@localhost'}).get('show')).toBe('offline');

                // New girl leaves
                presence = $pres({
                        'to': 'dummy@localhost/_converse.js-29092160',
                        'type': 'unavailable',
                        'from': 'coven@chat.shakespeare.lit/newgirl'
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'newgirl@localhost/_converse.js-213098781',
                        'role': 'none'
                    });

                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(6);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent).toBe("newgirl has entered and left the groupchat");
                expect(view.model.occupants.length).toBe(4);
                done();
            }));

            it("combines subsequent join/leave messages when users enter or exit a groupchat",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'coven', 'chat.shakespeare.lit', 'dummy')
                const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                const chat_content = view.el.querySelector('.chat-content');

                expect(sizzle('div.chat-info', chat_content).length).toBe(1);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent).toBe("dummy has entered the groupchat");

                let presence = Strophe.xmlHtmlNode(
                    `<presence xmlns="jabber:client" to="dummy@localhost/resource" from="coven@chat.shakespeare.lit/fabio">
                        <c xmlns="http://jabber.org/protocol/caps" node="http://conversations.im" ver="INI3xjRUioclBTP/aACfWi5m9UY=" hash="sha-1"/>
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="participant"/>
                        </x>
                    </presence>`).firstElementChild;
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(2);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent).toBe("fabio has entered the groupchat");

                presence = Strophe.xmlHtmlNode(
                    `<presence xmlns="jabber:client" to="dummy@localhost/resource" from="coven@chat.shakespeare.lit/Dele Olajide">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="deleo@traderlynk.4ng.net/converse.js-39320524" role="participant"/>
                        </x>
                    </presence>`).firstElementChild;
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(3);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent).toBe("Dele Olajide has entered the groupchat");

                presence = Strophe.xmlHtmlNode(
                    `<presence xmlns="jabber:client" to="dummy@localhost/resource" from="coven@chat.shakespeare.lit/jcbrand">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="owner" jid="jc@opkode.com/converse.js-30645022" role="moderator"/>
                            <status code="110"/>
                        </x>
                    </presence>`).firstElementChild;
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                await test_utils.waitUntil(() => sizzle('div.chat-info', chat_content).length > 3);

                expect(sizzle('div.chat-info', chat_content).length).toBe(4);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent).toBe("jcbrand has entered the groupchat");

                presence = Strophe.xmlHtmlNode(
                    `<presence xmlns="jabber:client" to="dummy@localhost/resource" type="unavailable" from="coven@chat.shakespeare.lit/Dele Olajide">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="deleo@traderlynk.4ng.net/converse.js-39320524" role="none"/>
                        </x>
                    </presence>`).firstElementChild;
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(4);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent).toBe("Dele Olajide has entered and left the groupchat");

                presence = Strophe.xmlHtmlNode(
                    `<presence xmlns="jabber:client" to="dummy@localhost/resource" from="coven@chat.shakespeare.lit/Dele Olajide">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="deleo@traderlynk.4ng.net/converse.js-74567907" role="participant"/>
                        </x>
                    </presence>`).firstElementChild;
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(4);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent).toBe("Dele Olajide has entered the groupchat");

                presence = Strophe.xmlHtmlNode(
                    `<presence xmlns="jabber:client" to="dummy@localhost/resource" from="coven@chat.shakespeare.lit/fuvuv" xml:lang="en">
                        <c xmlns="http://jabber.org/protocol/caps" node="http://jabber.pix-art.de" ver="5tOurnuFnp2h50hKafeUyeN4Yl8=" hash="sha-1"/>
                        <x xmlns="vcard-temp:x:update"/>
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="fuvuv@blabber.im/Pix-Art Messenger.8zoB" role="participant"/>
                        </x>
                    </presence>`).firstElementChild;
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(5);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent).toBe("fuvuv has entered the groupchat");

                presence = Strophe.xmlHtmlNode(
                    `<presence xmlns="jabber:client" to="dummy@localhost/resource" type="unavailable" from="coven@chat.shakespeare.lit/fuvuv">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="fuvuv@blabber.im/Pix-Art Messenger.8zoB" role="none"/>
                        </x>
                    </presence>`).firstElementChild;
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(5);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent).toBe("fuvuv has entered and left the groupchat");

                presence = Strophe.xmlHtmlNode(
                    `<presence xmlns="jabber:client" to="dummy@localhost/resource" type="unavailable" from="coven@chat.shakespeare.lit/fabio">
                        <status>Disconnected: Replaced by new connection</status>
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="none"/>
                        </x>
                    </presence>`).firstElementChild;
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(5);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent).toBe(
                    `fabio has entered and left the groupchat. "Disconnected: Replaced by new connection"`);

                presence = Strophe.xmlHtmlNode(
                    `<presence xmlns="jabber:client" to="dummy@localhost/resource" from="coven@chat.shakespeare.lit/fabio">
                        <c xmlns="http://jabber.org/protocol/caps" node="http://conversations.im" ver="INI3xjRUioclBTP/aACfWi5m9UY=" hash="sha-1"/>
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="participant"/>
                        </x>
                    </presence>`).firstElementChild;
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(5);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent).toBe(
                    `fabio has entered the groupchat`);

                // XXX: hack so that we can test leave/enter of occupants
                // who were already in the room when we joined.
                chat_content.innerHTML = '';

                presence = Strophe.xmlHtmlNode(
                    `<presence xmlns="jabber:client" to="dummy@localhost/resource" type="unavailable" from="coven@chat.shakespeare.lit/fabio">
                        <status>Disconnected: closed</status>
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="none"/>
                        </x>
                    </presence>`).firstElementChild;
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(1);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent).toBe(
                    `fabio has left the groupchat. "Disconnected: closed"`);

                presence = Strophe.xmlHtmlNode(
                    `<presence xmlns="jabber:client" to="dummy@localhost/resource" type="unavailable" from="coven@chat.shakespeare.lit/Dele Olajide">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="deleo@traderlynk.4ng.net/converse.js-74567907" role="none"/>
                        </x>
                    </presence>`).firstElementChild;
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(2);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent).toBe(
                    `Dele Olajide has left the groupchat`);

                presence = Strophe.xmlHtmlNode(
                    `<presence xmlns="jabber:client" to="dummy@localhost/resource" from="coven@chat.shakespeare.lit/fabio">
                        <c xmlns="http://jabber.org/protocol/caps" node="http://conversations.im" ver="INI3xjRUioclBTP/aACfWi5m9UY=" hash="sha-1"/>
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="participant"/>
                        </x>
                    </presence>`).firstElementChild;
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('div.chat-info', chat_content).length).toBe(2);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent).toBe(
                    `fabio has left and re-entered the groupchat`);

                done();
            }));

            it("role-change messages that follow a MUC leave are left out",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                // See https://github.com/conversejs/converse.js/issues/1259

                await test_utils.openAndEnterChatRoom(_converse, 'conversations', 'conference.siacs.eu', 'dummy');

                const presence = $pres({
                        to: 'dummy@localhost/resource',
                        from: 'conversations@conference.siacs.eu/Guus'
                    }).c('x', {
                        'xmlns': Strophe.NS.MUC_USER
                    }).c('item', {
                        'affiliation': 'none',
                        'jid': 'Guus@localhost/xxx',
                        'role': 'visitor'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                const view = _converse.chatboxviews.get('conversations@conference.siacs.eu');
                const msg = $msg({
                        'from': 'conversations@conference.siacs.eu/dummy',
                        'id': (new Date()).getTime(),
                        'to': 'dummy@localhost',
                        'type': 'groupchat'
                    }).c('body').t('Some message').tree();

                view.model.onMessage(msg);
                await new Promise((resolve, reject) => view.once('messageInserted', resolve));

                let stanza = Strophe.xmlHtmlNode(
                    `<presence xmlns="jabber:client" to="dummy@localhost/resource" type="unavailable" from="conversations@conference.siacs.eu/Guus">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" role="none"/>
                        </x>
                    </presence>`
                ).firstElementChild;
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                stanza = Strophe.xmlHtmlNode(
                    `<presence xmlns="jabber:client" to="dummy@localhost/resource" from="conversations@conference.siacs.eu/Guus">
                        <c xmlns="http://jabber.org/protocol/caps" node="http://conversations.im" ver="ISg6+9AoK1/cwhbNEDviSvjdPzI=" hash="sha-1"/>
                        <x xmlns="vcard-temp:x:update">
                            <photo>bf987c486c51fbc05a6a4a9f20dd19b5efba3758</photo>
                        </x>
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" role="visitor"/>
                        </x>
                    </presence>`
                ).firstElementChild;
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                const chat_content = view.el.querySelector('.chat-content');
                const messages = chat_content.querySelectorAll('div.chat-info');
                expect(messages.length).toBe(3);
                expect(messages[0].textContent).toBe('dummy has entered the groupchat');
                expect(messages[1].textContent).toBe('Guus has entered the groupchat');
                expect(messages[2].textContent).toBe('Guus has left and re-entered the groupchat');
                done();
            }));


            it("shows a new day indicator if a join/leave message is received on a new day",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'coven', 'chat.shakespeare.lit', 'dummy');
                const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                const chat_content = view.el.querySelector('.chat-content');
                let indicator = chat_content.querySelector('.date-separator');
                expect(indicator).not.toBe(null);
                expect(indicator.getAttribute('class')).toEqual('message date-separator');
                expect(indicator.getAttribute('data-isodate')).toEqual(moment().startOf('day').format());
                expect(indicator.querySelector('time').textContent).toEqual(moment().startOf('day').format("dddd MMM Do YYYY"));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(1);
                expect(chat_content.querySelector('div.chat-info').textContent).toBe("dummy has entered the groupchat");

                const baseTime = new Date();
                jasmine.clock().install();
                jasmine.clock().mockDate(baseTime);
                var ONE_DAY_LATER = 86400000;
                jasmine.clock().tick(ONE_DAY_LATER);

                /* <presence to="dummy@localhost/_converse.js-29092160"
                 *           from="coven@chat.shakespeare.lit/some1">
                 *      <x xmlns="http://jabber.org/protocol/muc#user">
                 *          <item affiliation="owner" jid="dummy@localhost/_converse.js-29092160" role="moderator"/>
                 *          <status code="110"/>
                 *      </x>
                 *  </presence></body>
                 */
                var presence = $pres({
                        to: 'dummy@localhost/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/some1'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'owner',
                        'jid': 'some1@localhost/_converse.js-290929789',
                        'role': 'moderator'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                indicator = chat_content.querySelector('.date-separator[data-isodate="'+moment().startOf('day').format()+'"]');
                expect(indicator).not.toBe(null);

                expect(indicator.getAttribute('class')).toEqual('message date-separator');
                expect(indicator.getAttribute('data-isodate')).toEqual(moment().startOf('day').format());
                expect(indicator.querySelector('time').getAttribute('class')).toEqual('separator-text');
                expect(indicator.querySelector('time').textContent).toEqual(moment().startOf('day').format("dddd MMM Do YYYY"));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(2);
                expect(chat_content.querySelector('div.chat-info:last-child').textContent).toBe(
                    "some1 has entered the groupchat"
                );

                jasmine.clock().tick(ONE_DAY_LATER);

                // Test a user leaving a groupchat
                presence = $pres({
                        to: 'dummy@localhost/_converse.js-29092160',
                        type: 'unavailable',
                        from: 'coven@chat.shakespeare.lit/some1'
                    })
                    .c('status', 'Disconnected: Replaced by new connection').up()
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'owner',
                            'jid': 'some1@localhost/_converse.js-290929789',
                            'role': 'moderator'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                indicator = chat_content.querySelector('.date-separator[data-isodate="'+moment().startOf('day').format()+'"]');

                expect(indicator).not.toBe(null);
                expect(indicator.getAttribute('class')).toEqual('message date-separator');
                expect(indicator.getAttribute('data-isodate')).toEqual(moment().startOf('day').format());

                expect(indicator.querySelector('time').textContent).toEqual(moment().startOf('day').format("dddd MMM Do YYYY"));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(3);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent).toBe(
                    'some1 has left the groupchat. '+
                    '"Disconnected: Replaced by new connection"');

                jasmine.clock().tick(ONE_DAY_LATER);

                let stanza = Strophe.xmlHtmlNode(
                    '<message xmlns="jabber:client"' +
                    '   to="dummy@localhost/_converse.js-290929789"' +
                    '   type="groupchat"' +
                    '   from="coven@chat.shakespeare.lit/some1">'+
                    '       <body>hello world</body>'+
                    '       <delay xmlns="urn:xmpp:delay" stamp="'+moment().format()+'" from="some1@localhost"/>'+
                    '</message>').firstChild;
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await new Promise((resolve, reject) => view.once('messageInserted', resolve));

                presence = $pres({
                        to: 'dummy@localhost/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/newguy'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'newguy@localhost/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                let time = chat_content.querySelectorAll('time.separator-text');
                expect(time.length).toEqual(4);

                indicator = sizzle('.date-separator:eq(3)', chat_content).pop();
                expect(indicator.getAttribute('class')).toEqual('message date-separator');
                expect(indicator.getAttribute('data-isodate')).toEqual(moment().startOf('day').format());
                expect(indicator.querySelector('time').textContent).toEqual(moment().startOf('day').format("dddd MMM Do YYYY"));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(4);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent)
                    .toBe("newguy has entered the groupchat");

                jasmine.clock().tick(ONE_DAY_LATER);

                stanza = Strophe.xmlHtmlNode(
                    '<message xmlns="jabber:client"' +
                    '   to="dummy@localhost/_converse.js-290929789"' +
                    '   type="groupchat"' +
                    '   from="coven@chat.shakespeare.lit/some1">'+
                    '       <body>hello world</body>'+
                    '       <delay xmlns="urn:xmpp:delay" stamp="'+moment().format()+'" from="some1@localhost"/>'+
                    '</message>').firstChild;
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await new Promise((resolve, reject) => view.once('messageInserted', resolve));

                jasmine.clock().tick(ONE_DAY_LATER);
                // Test a user leaving a groupchat
                presence = $pres({
                        to: 'dummy@localhost/_converse.js-29092160',
                        type: 'unavailable',
                        from: 'coven@chat.shakespeare.lit/newguy'
                    })
                    .c('status', 'Disconnected: Replaced by new connection').up()
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'none',
                            'jid': 'newguy@localhost/_converse.js-290929789',
                            'role': 'none'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                time = chat_content.querySelectorAll('time.separator-text');
                expect(time.length).toEqual(6);

                indicator = sizzle('.date-separator:eq(5)', chat_content).pop();
                expect(indicator.getAttribute('class')).toEqual('message date-separator');
                expect(indicator.getAttribute('data-isodate')).toEqual(moment().startOf('day').format());
                expect(indicator.querySelector('time').textContent).toEqual(moment().startOf('day').format("dddd MMM Do YYYY"));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(5);
                expect(sizzle('div.chat-info:last', chat_content).pop().textContent).toBe(
                    'newguy has left the groupchat. '+
                    '"Disconnected: Replaced by new connection"');
                jasmine.clock().uninstall();
                done();
            }));


            it("supports the /me command",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitUntilDiscoConfirmed(_converse, 'localhost', [], ['vcard-temp']);
                await test_utils.waitUntil(() => _converse.xmppstatus.vcard.get('fullname'));
                await test_utils.createContacts(_converse, 'current');
                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                const view = _converse.chatboxviews.get('lounge@localhost');
                if (!view.el.querySelectorAll('.chat-area').length) {
                    view.renderChatArea();
                }
                let message = '/me is tired';
                const nick = mock.chatroom_names[0];
                let msg = $msg({
                        'from': 'lounge@localhost/'+nick,
                        'id': (new Date()).getTime(),
                        'to': 'dummy@localhost',
                        'type': 'groupchat'
                    }).c('body').t(message).tree();
                view.model.onMessage(msg);
                await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                expect(_.includes(view.el.querySelector('.chat-msg__author').textContent, '**Dyon van de Wege')).toBeTruthy();
                expect(view.el.querySelector('.chat-msg__text').textContent).toBe('is tired');

                message = '/me is as well';
                msg = $msg({
                    from: 'lounge@localhost/Max Mustermann',
                    id: (new Date()).getTime(),
                    to: 'dummy@localhost',
                    type: 'groupchat'
                }).c('body').t(message).tree();
                view.model.onMessage(msg);
                await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                expect(_.includes(sizzle('.chat-msg__author:last', view.el).pop().textContent, '**Max Mustermann')).toBeTruthy();
                expect(sizzle('.chat-msg__text:last', view.el).pop().textContent).toBe('is as well');
                done();
            }));

            it("can be configured if you're its owner",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                let sent_IQ, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                await _converse.api.rooms.open('coven@chat.shakespeare.lit', {'nick': 'some1'});
                const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                spyOn(view.model, 'saveAffiliationAndRole').and.callThrough();
                // We pretend this is a new room, so no disco info is returned.
                const features_stanza = $iq({
                        from: 'coven@chat.shakespeare.lit',
                        'id': IQ_id,
                        'to': 'dummy@localhost/desktop',
                        'type': 'error'
                    }).c('error', {'type': 'cancel'})
                        .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                /* <presence to="dummy@localhost/_converse.js-29092160"
                 *           from="coven@chat.shakespeare.lit/some1">
                 *      <x xmlns="http://jabber.org/protocol/muc#user">
                 *          <item affiliation="owner" jid="dummy@localhost/_converse.js-29092160" role="moderator"/>
                 *          <status code="110"/>
                 *      </x>
                 *  </presence></body>
                 */
                const presence = $pres({
                        to: 'dummy@localhost/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/some1'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'owner',
                        'jid': 'dummy@localhost/_converse.js-29092160',
                        'role': 'moderator'
                    }).up()
                    .c('status', {code: '110'});
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.model.saveAffiliationAndRole).toHaveBeenCalled();

                expect(u.isVisible(view.el.querySelector('.toggle-chatbox-button'))).toBeTruthy();
                await test_utils.waitUntil(() => !_.isNull(view.el.querySelector('.configure-chatroom-button')))

                expect(u.isVisible(view.el.querySelector('.configure-chatroom-button'))).toBeTruthy();
                view.el.querySelector('.configure-chatroom-button').click();

                /* Check that an IQ is sent out, asking for the
                 * configuration form.
                 * See: // http://xmpp.org/extensions/xep-0045.html#example-163
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
                 * See: // http://xmpp.org/extensions/xep-0045.html#example-165
                 */
                var config_stanza = $iq({from: 'coven@chat.shakespeare.lit',
                    'id': IQ_id,
                    'to': 'dummy@localhost/desktop',
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
                            .c('value').t('If a password is required to enter this groupchat,'+
                                        'you must specify the password below.').up().up()
                        .c('field', {
                            'label': 'Password',
                            'type': 'text-private',
                            'var': 'muc#roomconfig_roomsecret'})
                            .c('value').t('cauldronburn');
                _converse.connection._dataRecv(test_utils.createRequest(config_stanza));

                await test_utils.waitUntil(() => view.el.querySelectorAll('form.chatroom-form').length)
                expect(view.el.querySelectorAll('form.chatroom-form').length).toBe(1);
                expect(view.el.querySelectorAll('form.chatroom-form fieldset').length).toBe(2);
                var membersonly = view.el.querySelectorAll('input[name="muc#roomconfig_membersonly"]');
                expect(membersonly.length).toBe(1);
                expect(membersonly[0].getAttribute('type')).toBe('checkbox');
                membersonly[0].checked = true;

                var moderated = view.el.querySelectorAll('input[name="muc#roomconfig_moderatedroom"]');
                expect(moderated.length).toBe(1);
                expect(moderated[0].getAttribute('type')).toBe('checkbox');
                moderated[0].checked = true;

                var password = view.el.querySelectorAll('input[name="muc#roomconfig_roomsecret"]');
                expect(password.length).toBe(1);
                expect(password[0].getAttribute('type')).toBe('password');

                var allowpm = view.el.querySelectorAll('select[name="muc#roomconfig_allowpm"]');
                expect(allowpm.length).toBe(1);
                allowpm[0].value = 'moderators';

                var presencebroadcast = view.el.querySelectorAll('select[name="muc#roomconfig_presencebroadcast"]');
                expect(presencebroadcast.length).toBe(1);
                presencebroadcast[0].value = ['moderator'];

                view.el.querySelector('input[type="submit"]').click();

                const sent_stanza = sent_IQ.nodeTree;
                expect(sent_stanza.querySelector('field[var="muc#roomconfig_membersonly"] value').textContent).toBe('1');
                expect(sent_stanza.querySelector('field[var="muc#roomconfig_moderatedroom"] value').textContent).toBe('1');
                expect(sent_stanza.querySelector('field[var="muc#roomconfig_allowpm"] value').textContent).toBe('moderators');
                expect(sent_stanza.querySelector('field[var="muc#roomconfig_presencebroadcast"] value').textContent).toBe('moderator');
                done();
            }));

            it("shows all members even if they're not currently present in the groupchat",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                var name;
                var view = _converse.chatboxviews.get('lounge@localhost'),
                    occupants = view.el.querySelector('.occupant-list');
                var presence, role, jid, model;
                for (var i=0; i<mock.chatroom_names.length; i++) {
                    name = mock.chatroom_names[i];
                    role = mock.chatroom_roles[name].role;
                    // See example 21 http://xmpp.org/extensions/xep-0045.html#enter-pres
                    jid =
                    presence = $pres({
                            to:'dummy@localhost/pda',
                            from:'lounge@localhost/'+name
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: mock.chatroom_roles[name].affiliation,
                        jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                        role: role
                    }).up()
                    .c('status').attrs({code:'110'}).nodeTree;
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(occupants.querySelectorAll('li').length).toBe(2+i);
                    model = view.occupantsview.model.where({'nick': name})[0];
                    var index = view.occupantsview.model.indexOf(model);
                    expect(occupants.querySelectorAll('li .occupant-nick')[index].textContent.trim()).toBe(mock.chatroom_names[i]);
                }

                // Test users leaving the groupchat
                // http://xmpp.org/extensions/xep-0045.html#exit
                for (i=mock.chatroom_names.length-1; i>-1; i--) {
                    name = mock.chatroom_names[i];
                    role = mock.chatroom_roles[name].role;
                    // See example 21 http://xmpp.org/extensions/xep-0045.html#enter-pres
                    presence = $pres({
                        to:'dummy@localhost/pda',
                        from:'lounge@localhost/'+name,
                        type: 'unavailable'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: mock.chatroom_roles[name].affiliation,
                        jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                        role: 'none'
                    }).nodeTree;
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(occupants.querySelectorAll('li').length).toBe(7);
                }
                done();
            }));

            it("shows users currently present in the groupchat",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                var name;
                var view = _converse.chatboxviews.get('lounge@localhost'),
                    occupants = view.el.querySelector('.occupant-list');
                var presence, role, jid, model;
                for (var i=0; i<mock.chatroom_names.length; i++) {
                    name = mock.chatroom_names[i];
                    role = mock.chatroom_roles[name].role;
                    // See example 21 http://xmpp.org/extensions/xep-0045.html#enter-pres
                    jid =
                    presence = $pres({
                            to:'dummy@localhost/pda',
                            from:'lounge@localhost/'+name
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'none',
                        jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                        role: role
                    }).up()
                    .c('status').attrs({code:'110'}).nodeTree;
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(occupants.querySelectorAll('li').length).toBe(2+i);
                    model = view.occupantsview.model.where({'nick': name})[0];
                    var index = view.occupantsview.model.indexOf(model);
                    expect(occupants.querySelectorAll('li .occupant-nick')[index].textContent.trim()).toBe(mock.chatroom_names[i]);
                }

                // Test users leaving the groupchat
                // http://xmpp.org/extensions/xep-0045.html#exit
                for (i=mock.chatroom_names.length-1; i>-1; i--) {
                    name = mock.chatroom_names[i];
                    role = mock.chatroom_roles[name].role;
                    // See example 21 http://xmpp.org/extensions/xep-0045.html#enter-pres
                    presence = $pres({
                        to:'dummy@localhost/pda',
                        from:'lounge@localhost/'+name,
                        type: 'unavailable'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: mock.chatroom_roles[name].affiliation,
                        jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                        role: 'none'
                    }).nodeTree;
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(occupants.querySelectorAll('li').length).toBe(i+1);
                }
                done();
            }));

            it("escapes occupant nicknames when rendering them, to avoid JS-injection attacks",
                mock.initConverseWithPromises(null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                /* <presence xmlns="jabber:client" to="jc@chat.example.org/converse.js-17184538"
                 *      from="oo@conference.chat.example.org/&lt;img src=&quot;x&quot; onerror=&quot;alert(123)&quot;/&gt;">
                 *   <x xmlns="http://jabber.org/protocol/muc#user">
                 *    <item jid="jc@chat.example.org/converse.js-17184538" affiliation="owner" role="moderator"/>
                 *    <status code="110"/>
                 *   </x>
                 * </presence>"
                 */
                const presence = $pres({
                        to:'dummy@localhost/pda',
                        from:"lounge@localhost/&lt;img src=&quot;x&quot; onerror=&quot;alert(123)&quot;/&gt;"
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        jid: 'someone@localhost',
                        role: 'moderator',
                    }).up()
                    .c('status').attrs({code:'110'}).nodeTree;

                _converse.connection._dataRecv(test_utils.createRequest(presence));
                const view = _converse.chatboxviews.get('lounge@localhost');
                const occupants = view.el.querySelector('.occupant-list').querySelectorAll('li .occupant-nick');
                expect(occupants.length).toBe(2);
                expect(occupants[0].textContent.trim()).toBe("&lt;img src=&quot;x&quot; onerror=&quot;alert(123)&quot;/&gt;");
                done();
            }));

            it("indicates moderators and visitors by means of a special css class and tooltip",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {'view_mode': 'fullscreen'},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                const view = _converse.chatboxviews.get('lounge@localhost');
                let contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';

                let occupants = view.el.querySelector('.occupant-list').querySelectorAll('li');
                expect(occupants.length).toBe(1);
                expect(occupants[0].querySelector('.occupant-nick').textContent.trim()).toBe("dummy");
                expect(occupants[0].querySelectorAll('.badge').length).toBe(2);
                expect(occupants[0].querySelectorAll('.badge')[0].textContent).toBe('Owner');
                expect(sizzle('.badge:last', occupants[0]).pop().textContent).toBe('Moderator');

                var presence = $pres({
                        to:'dummy@localhost/pda',
                        from:'lounge@localhost/moderatorman'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    affiliation: 'admin',
                    jid: contact_jid,
                    role: 'moderator',
                }).up()
                .c('status').attrs({code:'110'}).nodeTree;

                _converse.connection._dataRecv(test_utils.createRequest(presence));
                occupants = view.el.querySelectorAll('.occupant-list li');
                expect(occupants.length).toBe(2);
                expect(occupants[0].querySelector('.occupant-nick').textContent.trim()).toBe("dummy");
                expect(occupants[1].querySelector('.occupant-nick').textContent.trim()).toBe("moderatorman");
                expect(occupants[1].querySelectorAll('.badge').length).toBe(2);
                expect(occupants[1].querySelectorAll('.badge')[0].textContent).toBe('Admin');
                expect(occupants[1].querySelectorAll('.badge')[1].textContent).toBe('Moderator');

                expect(occupants[1].getAttribute('title')).toBe(
                    contact_jid + ' This user is a moderator. Click to mention moderatorman in your message.'
                );

                contact_jid = mock.cur_names[3].replace(/ /g,'.').toLowerCase() + '@localhost';
                presence = $pres({
                    to:'dummy@localhost/pda',
                    from:'lounge@localhost/visitorwoman'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    jid: contact_jid,
                    role: 'visitor',
                }).up()
                .c('status').attrs({code:'110'}).nodeTree;
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                occupants = view.el.querySelector('.occupant-list').querySelectorAll('li');
                expect(occupants.length).toBe(3);
                expect(occupants[2].querySelector('.occupant-nick').textContent.trim()).toBe("visitorwoman");
                expect(occupants[2].querySelectorAll('.badge').length).toBe(1);
                expect(sizzle('.badge', occupants[2]).pop().textContent).toBe('Visitor');
                expect(occupants[2].getAttribute('title')).toBe(
                    contact_jid + ' This user can NOT send messages in this groupchat. Click to mention visitorwoman in your message.'
                );
                done();
            }));

            it("properly handles notification that a room has been destroyed",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openChatRoomViaModal(_converse, 'problematic@muc.localhost', 'dummy')
                const presence = $pres().attrs({
                    from:'problematic@muc.localhost',
                    id:'n13mt3l',
                    to:'dummy@localhost/pda',
                    type:'error'})
                .c('error').attrs({'type':'cancel'})
                    .c('gone').attrs({'xmlns':'urn:ietf:params:xml:ns:xmpp-stanzas'})
                        .t('xmpp:other-room@chat.jabberfr.org?join').up()
                    .c('text').attrs({'xmlns':'urn:ietf:params:xml:ns:xmpp-stanzas'})
                        .t("We didn't like the name").nodeTree;

                const view = _converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').and.callThrough();
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.el.querySelector('.chatroom-body .disconnect-msg').textContent)
                    .toBe('This groupchat no longer exists');
                expect(view.el.querySelector('.chatroom-body .destroyed-reason').textContent)
                    .toBe(`"We didn't like the name"`);
                expect(view.el.querySelector('.chatroom-body .moved-label').textContent.trim())
                    .toBe('The conversation has moved. Click below to enter.');
                expect(view.el.querySelector('.chatroom-body .moved-link').textContent.trim())
                    .toBe(`other-room@chat.jabberfr.org`);
                done();
            }));

            it("will use the user's reserved nickname, if it exists",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                const IQ_stanzas = _converse.connection.IQ_stanzas;
                const sendIQ = _converse.connection.sendIQ;
                const room_jid = 'lounge@localhost';

                await test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');

                let stanza = await test_utils.waitUntil(() => _.get(_.filter(
                    IQ_stanzas,
                    iq => iq.nodeTree.querySelector(
                        `iq[to="${room_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                    )).pop(), 'nodeTree')
                );

                // We pretend this is a new room, so no disco info is returned.
                const features_stanza = $iq({
                        from: 'lounge@localhost',
                        'id': stanza.getAttribute('id'),
                        'to': 'dummy@localhost/desktop',
                        'type': 'error'
                    }).c('error', {'type': 'cancel'})
                        .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                const view = _converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'join').and.callThrough();

                /* <iq from='hag66@shakespeare.lit/pda'
                 *     id='getnick1'
                 *     to='coven@chat.shakespeare.lit'
                 *     type='get'>
                 * <query xmlns='http://jabber.org/protocol/disco#info'
                 *         node='x-roomuser-item'/>
                 * </iq>
                 */
                const node = await test_utils.waitUntil(() => _.filter(
                        IQ_stanzas,
                        s => sizzle(`iq[to="${room_jid}"] query[node="x-roomuser-item"]`, s.nodeTree).length
                    ).pop()
                );
                const iq = node.nodeTree;
                expect(node.toLocaleString()).toBe(
                    `<iq from="dummy@localhost/resource" id="${iq.getAttribute('id')}" to="lounge@localhost" `+
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
                stanza = $iq({
                    'type': 'result',
                    'id': node.nodeTree.getAttribute('id'),
                    'from': view.model.get('jid'),
                    'to': _converse.connection.jid
                }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#info', 'node': 'x-roomuser-item'})
                .c('identity', {'category': 'conference', 'name': 'thirdwitch', 'type': 'text'});
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                expect(view.join).toHaveBeenCalled();

                // The user has just entered the groupchat (because join was called)
                // and receives their own presence from the server.
                // See example 24:
                // http://xmpp.org/extensions/xep-0045.html#enter-pres
                const presence = $pres({
                        to:'dummy@localhost/resource',
                        from:'lounge@localhost/thirdwitch',
                        id:'DC352437-C019-40EC-B590-AF29E879AF97'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'member',
                        jid: 'dummy@localhost/resource',
                        role: 'participant'
                    }).up()
                    .c('status').attrs({code:'110'}).up()
                    .c('status').attrs({code:'210'}).nodeTree;

                _converse.connection._dataRecv(test_utils.createRequest(presence));
                const info_text = sizzle('.chat-content .chat-info:first', view.el).pop().textContent;
                expect(info_text).toBe('Your nickname has been automatically set to thirdwitch');
                done();
            }));

            it("allows the user to invite their roster contacts to enter the groupchat",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.createContacts(_converse, 'current'); // We need roster contacts, so that we have someone to invite
                // Since we don't actually fetch roster contacts, we need to
                // cheat here and emit the event.
                _converse.emit('rosterContactsFetched');

                await test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                spyOn(_converse, 'emit');
                spyOn(window, 'prompt').and.callFake(function () {
                    return "Please join!";
                });
                const view = _converse.chatboxviews.get('lounge@localhost');

                // XXX: cheating a lttle bit, normally this'll be set after
                // receiving the features for the groupchat.
                view.model.set('open', 'true');

                spyOn(view.model, 'directInvite').and.callThrough();
                const chat_area = view.el.querySelector('.chat-area');
                chat_area.parentElement.removeChild(chat_area);
                await test_utils.waitUntil(() => view.el.querySelectorAll('input.invited-contact').length);
                const input = view.el.querySelector('input.invited-contact');
                expect(input.getAttribute('placeholder')).toBe('Invite');
                input.value = "Felix";
                let evt = new Event('input');
                input.dispatchEvent(evt);

                let sent_stanza;
                spyOn(_converse.connection, 'send').and.callFake(function (stanza) {
                    sent_stanza = stanza;
                });
                const hint = input.nextSibling.firstElementChild;
                expect(input.value).toBe('Felix');
                expect(hint.textContent).toBe('Felix Amsel');
                expect(input.nextSibling.childNodes.length).toBe(1);

                if (typeof(Event) === 'function') {
                    // Not working on PhantomJS
                    evt = new Event('mousedown', {'bubbles': true});
                    evt.button = 0; // For some reason awesomplete wants this
                    hint.dispatchEvent(evt);
                    expect(window.prompt).toHaveBeenCalled();
                    expect(view.model.directInvite).toHaveBeenCalled();
                    expect(sent_stanza.toLocaleString()).toBe(
                        `<message from="dummy@localhost/resource" `+
                                `id="${sent_stanza.nodeTree.getAttribute("id")}" `+
                                `to="felix.amsel@localhost" `+
                                `xmlns="jabber:client">`+
                            `<x jid="lounge@localhost" reason="Please join!" xmlns="jabber:x:conference"/>`+
                        `</message>`
                    );
                }
                done();
            }));

            it("can be joined automatically, based upon a received invite",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const result = await test_utils.createContacts(_converse, 'current', 1);
                spyOn(window, 'confirm').and.callFake(() => true);
                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                const view = _converse.chatboxviews.get('lounge@localhost');
                await view.close(); // Hack, otherwise we have to mock stanzas.

                const name = mock.cur_names[0];
                const from_jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                const room_jid = 'lounge@localhost';
                const reason = "Please join this groupchat";

                expect(_converse.chatboxes.models.length).toBe(1);
                expect(_converse.chatboxes.models[0].id).toBe("controlbox");

                await test_utils.waitUntil(() => _converse.roster.get(from_jid).get('fullname'));

                const stanza = Strophe.xmlHtmlNode(
                    '<message xmlns="jabber:client" to="'+_converse.bare_jid+'" from="'+from_jid+'" id="9bceb415-f34b-4fa4-80d5-c0d076a24231">'+
                        '<x xmlns="jabber:x:conference" jid="'+room_jid+'" reason="'+reason+'"/>'+
                    '</message>').firstChild;
                await _converse.onDirectMUCInvitation(stanza);


                expect(window.confirm).toHaveBeenCalledWith(
                    name + ' has invited you to join a groupchat: '+ room_jid +
                    ', and left the following reason: "'+reason+'"');
                expect(_converse.chatboxes.models.length).toBe(2);
                expect(_converse.chatboxes.models[0].id).toBe('controlbox');
                expect(_converse.chatboxes.models[1].id).toBe(room_jid);
                done();
            }));

            it("shows received groupchat messages",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const text = 'This is a received message';
                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                spyOn(_converse, 'emit');
                const view = _converse.chatboxviews.get('lounge@localhost');
                if (!view.el.querySelectorAll('.chat-area').length) {
                    view.renderChatArea();
                }
                var nick = mock.chatroom_names[0];
                view.model.occupants.create({
                    'nick': nick,
                    'muc_jid': `${view.model.get('jid')}/${nick}`
                });

                const message = $msg({
                    from: 'lounge@localhost/'+nick,
                    id: '1',
                    to: 'dummy@localhost',
                    type: 'groupchat'
                }).c('body').t(text);
                view.model.onMessage(message.nodeTree);
                await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                const chat_content = view.el.querySelector('.chat-content');
                expect(chat_content.querySelectorAll('.chat-msg').length).toBe(1);
                expect(chat_content.querySelector('.chat-msg__text').textContent).toBe(text);
                expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                done();
            }));

            it("shows sent groupchat messages",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                spyOn(_converse, 'emit');
                const view = _converse.chatboxviews.get('lounge@localhost');
                if (!view.el.querySelectorAll('.chat-area').length) {
                    view.renderChatArea();
                }
                const text = 'This is a sent message';
                const textarea = view.el.querySelector('.chat-textarea');
                textarea.value = text;
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13
                });
                await new Promise((resolve, reject) => view.once('messageInserted', resolve));

                expect(_converse.emit).toHaveBeenCalledWith('messageSend', text);
                const chat_content = view.el.querySelector('.chat-content');
                expect(chat_content.querySelectorAll('.chat-msg').length).toBe(1);

                // Let's check that if we receive the same message again, it's
                // not shown.
                const message = $msg({
                    from: 'lounge@localhost/dummy',
                    to: 'dummy@localhost.com',
                    type: 'groupchat',
                    id: view.model.messages.at(0).get('msgid')
                }).c('body').t(text);
                view.model.onMessage(message.nodeTree);
                expect(chat_content.querySelectorAll('.chat-msg').length).toBe(1);
                expect(sizzle('.chat-msg__text:last').pop().textContent).toBe(text);
                expect(view.model.messages.length).toBe(1);
                // We don't emit an event if it's our own message
                expect(_converse.emit.calls.count(), 1);
                done();
            }));

            it("will cause the chat area to be scrolled down only if it was at the bottom already",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                var message = 'This message is received while the chat area is scrolled up';
                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                var view = _converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'scrollDown').and.callThrough();
                // Create enough messages so that there's a scrollbar.
                const promises = [];
                for (var i=0; i<20; i++) {
                    view.model.onMessage(
                        $msg({
                            from: 'lounge@localhost/someone',
                            to: 'dummy@localhost.com',
                            type: 'groupchat',
                            id: (new Date()).getTime(),
                        }).c('body').t('Message: '+i).tree());
                    promises.push(new Promise((resolve, reject) => view.once('messageInserted', resolve)))
                }
                await Promise.all(promises);
                // Give enough time for `markScrolled` to have been called
                setTimeout(async () => {
                    view.content.scrollTop = 0;
                    view.model.onMessage(
                        $msg({
                            from: 'lounge@localhost/someone',
                            to: 'dummy@localhost.com',
                            type: 'groupchat',
                            id: (new Date()).getTime(),
                        }).c('body').t(message).tree());
                    await new Promise((resolve, reject) => view.once('messageInserted', resolve));

                    // Now check that the message appears inside the chatbox in the DOM
                    const chat_content = view.el.querySelector('.chat-content');
                    const msg_txt = sizzle('.chat-msg:last .chat-msg__text', chat_content).pop().textContent;
                    expect(msg_txt).toEqual(message);
                    expect(view.content.scrollTop).toBe(0);
                    done();
                }, 500);
            }));

            it("shows the room topic in the header",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'jdev', 'conference.jabber.org', 'jc');
                const text = 'Jabber/XMPP Development | RFCs and Extensions: http://xmpp.org/ | Protocol and XSF discussions: xsf@muc.xmpp.org';
                const stanza = Strophe.xmlHtmlNode(
                    '<message xmlns="jabber:client" to="jc@opkode.com/_converse.js-60429116" type="groupchat" from="jdev@conference.jabber.org/ralphm">'+
                    '    <subject>'+text+'</subject>'+
                    '    <delay xmlns="urn:xmpp:delay" stamp="2014-02-04T09:35:39Z" from="jdev@conference.jabber.org"/>'+
                    '    <x xmlns="jabber:x:delay" stamp="20140204T09:35:39" from="jdev@conference.jabber.org"/>'+
                    '</message>').firstChild;
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                const view = _converse.chatboxviews.get('jdev@conference.jabber.org');
                const chat_content = view.el.querySelector('.chat-content');
                expect(sizzle('.chat-event:last').pop().textContent).toBe('Topic set by ralphm');
                expect(sizzle('.chat-topic:last').pop().textContent).toBe(text);
                expect(view.el.querySelector('.chatroom-description').textContent).toBe(text);
                done();
            }));

            it("escapes the subject before rendering it, to avoid JS-injection attacks",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'jdev', 'conference.jabber.org', 'jc');
                spyOn(window, 'alert');
                const subject = '<img src="x" onerror="alert(\'XSS\');"/>';
                const view = _converse.chatboxviews.get('jdev@conference.jabber.org');
                view.model.set({'subject': {
                    'text': subject,
                    'author': 'ralphm'
                }});
                const chat_content = view.el.querySelector('.chat-content');
                expect(sizzle('.chat-event:last').pop().textContent).toBe('Topic set by ralphm');
                expect(sizzle('.chat-topic:last').pop().textContent).toBe(subject);
                done();
            }));

            it("informs users if their nicknames has been changed.",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                /* The service then sends two presence stanzas to the full JID
                 * of each occupant (including the occupant who is changing his
                 * or her room nickname), one of type "unavailable" for the old
                 * nickname and one indicating availability for the new
                 * nickname.
                 *
                 * See: http://xmpp.org/extensions/xep-0045.html#changenick
                 *
                 *  <presence
                 *      from='coven@localhost/thirdwitch'
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
                 *      from='coven@localhost/oldhag'
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
                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'oldnick');
                const view = _converse.chatboxviews.get('lounge@localhost');
                const chat_content = view.el.querySelector('.chat-content');

                let occupants = view.el.querySelector('.occupant-list');
                expect(occupants.childNodes.length).toBe(1);
                expect(occupants.firstElementChild.querySelector('.occupant-nick').textContent.trim()).toBe("oldnick");

                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(1);
                expect(sizzle('div.chat-info:first', chat_content).pop().textContent)
                    .toBe("oldnick has entered the groupchat");

                let presence = $pres().attrs({
                        from:'lounge@localhost/oldnick',
                        id:'DC352437-C019-40EC-B590-AF29E879AF98',
                        to:'dummy@localhost/pda',
                        type:'unavailable'
                    })
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'owner',
                        jid: 'dummy@localhost/pda',
                        nick: 'newnick',
                        role: 'moderator'
                    }).up()
                    .c('status').attrs({code:'303'}).up()
                    .c('status').attrs({code:'110'}).nodeTree;

                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(2);
                expect(sizzle('div.chat-info:last').pop().textContent).toBe(
                    __(_converse.muc.new_nickname_messages["303"], "newnick")
                );

                occupants = view.el.querySelector('.occupant-list');
                expect(occupants.childNodes.length).toBe(1);

                presence = $pres().attrs({
                        from:'lounge@localhost/newnick',
                        id:'5B4F27A4-25ED-43F7-A699-382C6B4AFC67',
                        to:'dummy@localhost/pda'
                    })
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'owner',
                        jid: 'dummy@localhost/pda',
                        role: 'moderator'
                    }).up()
                    .c('status').attrs({code:'110'}).nodeTree;

                _converse.connection._dataRecv(test_utils.createRequest(presence));
                // XXX: currently we still have an additional "has entered the groupchat"
                // notification for the new nickname. Ideally we'd not have
                // that, but that's probably not possible without some
                // significant refactoring.
                expect(chat_content.querySelectorAll('div.chat-info').length).toBe(3);
                expect(sizzle('div.chat-info', chat_content)[1].textContent).toBe(
                    __(_converse.muc.new_nickname_messages["303"], "newnick")
                );
                occupants = view.el.querySelector('.occupant-list');
                expect(occupants.childNodes.length).toBe(1);
                expect(sizzle('.occupant-nick:first', occupants).pop().textContent).toBe("newnick");
                done();
            }));

            it("queries for the groupchat information before attempting to join the user",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                const IQ_stanzas = _converse.connection.IQ_stanzas;
                const room_jid = 'coven@chat.shakespeare.lit';

                await _converse.api.rooms.open(room_jid, {'nick': 'some1'});
                const node = await test_utils.waitUntil(() => _.filter(
                    IQ_stanzas,
                    iq => iq.nodeTree.querySelector(
                        `iq[to="${room_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                    )).pop());

                // Check that the groupchat queried for the feautures.
                const stanza = node.nodeTree;
                expect(node.toLocaleString()).toBe(
                    `<iq from="dummy@localhost/resource" id="${stanza.getAttribute("id")}" to="${room_jid}" type="get" xmlns="jabber:client">`+
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
                        'from': room_jid,
                        'id': stanza.getAttribute('id'),
                        'to': 'dummy@localhost/desktop',
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
                await test_utils.waitUntil(() => (view.model.get('connection_status') === converse.ROOMSTATUS.CONNECTING));
                view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                expect(view.model.get('features_fetched')).toBeTruthy();
                expect(view.model.get('passwordprotected')).toBe(true);
                expect(view.model.get('hidden')).toBe(true);
                expect(view.model.get('temporary')).toBe(true);
                expect(view.model.get('open')).toBe(true);
                expect(view.model.get('unmoderated')).toBe(true);
                expect(view.model.get('nonanonymous')).toBe(true);
                done();
            }));

            it("updates the shown features when the groupchat configuration has changed",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {'view_mode': 'fullscreen'},
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
                await test_utils.openAndEnterChatRoom(_converse, 'room', 'conference.example.org', 'dummy', features);
                const jid = 'room@conference.example.org';
                const chatroomview = _converse.chatboxviews.get(jid);
                let features_list = chatroomview.el.querySelector('.features-list');
                let features_shown = features_list.textContent.split('\n').map(s => s.trim()).filter(s => s);
                expect(_.difference(["Password protected", "Open", "Temporary", "Not anonymous", "Not moderated"], features_shown).length).toBe(0);
                expect(chatroomview.model.get('hidden')).toBe(false);
                expect(chatroomview.model.get('mam_enabled')).toBe(false);
                expect(chatroomview.model.get('membersonly')).toBe(false);
                expect(chatroomview.model.get('moderated')).toBe(false);
                expect(chatroomview.model.get('nonanonymous')).toBe(true);
                expect(chatroomview.model.get('open')).toBe(true);
                expect(chatroomview.model.get('passwordprotected')).toBe(true);
                expect(chatroomview.model.get('persistent')).toBe(false);
                expect(chatroomview.model.get('publicroom')).toBe(true);
                expect(chatroomview.model.get('semianonymous')).toBe(false);
                expect(chatroomview.model.get('temporary')).toBe(true);
                expect(chatroomview.model.get('unmoderated')).toBe(true);
                expect(chatroomview.model.get('unsecured')).toBe(false);
                expect(chatroomview.el.querySelector('.chat-title').textContent.trim()).toBe('Room');

                chatroomview.el.querySelector('.configure-chatroom-button').click();

                const IQs = _converse.connection.IQ_stanzas;
                let iq = await test_utils.waitUntil(() => _.filter(
                    IQs,
                    iq => iq.nodeTree.querySelector(
                        `iq[to="${jid}"] query[xmlns="${Strophe.NS.MUC_OWNER}"]`
                    )).pop());

                const response = Strophe.xmlHtmlNode(
                   `<iq xmlns="jabber:client"
                         type="result"
                         to="dummy@localhost/pda"
                         from="room@conference.example.org" id="${iq.nodeTree.getAttribute('id')}">
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
                const response_el = response.firstElementChild;
                _converse.connection._dataRecv(test_utils.createRequest(response_el));
                const el = await test_utils.waitUntil(() => document.querySelector('.chatroom-form legend'));
                expect(el.textContent).toBe("Configuration for room@conference.example.org");
                sizzle('[name="muc#roomconfig_membersonly"]', chatroomview.el).pop().click();
                sizzle('[name="muc#roomconfig_roomname"]', chatroomview.el).pop().value = "New room name"
                chatroomview.el.querySelector('.btn-primary').click();

                iq = await test_utils.waitUntil(() => _.filter(IQs, iq => u.matchesSelector(iq.nodeTree, `iq[to="${jid}"][type="set"]`)).pop());
                const result = $iq({
                    "xmlns": "jabber:client",
                    "type": "result",
                    "to": "dummy@localhost/resource",
                    "from": "lounge@muc.localhost",
                    "id": iq.nodeTree.getAttribute('id')
                });

                IQs.length = 0; // Empty the array
                _converse.connection._dataRecv(test_utils.createRequest(result));

                iq = await test_utils.waitUntil(() => _.filter(
                    IQs,
                    iq => iq.nodeTree.querySelector(
                        `iq[to="${jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                    )).pop());

                const features_stanza = $iq({
                    'from': jid,
                    'id': iq.nodeTree.getAttribute('id'),
                    'to': 'dummy@localhost/desktop',
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
                    'muc_open',
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

                spyOn(chatroomview.occupantsview, 'renderRoomFeatures').and.callThrough();

                await test_utils.waitUntil(() => chatroomview.occupantsview.renderRoomFeatures.calls.count());
                features_list = chatroomview.el.querySelector('.features-list');
                features_shown = features_list.textContent.split('\n').map(s => s.trim()).filter(s => s);
                expect(_.difference(["Password protected", "Hidden", "Open", "Temporary", "Not anonymous", "Not moderated"], features_shown).length).toBe(0);
                expect(chatroomview.model.get('hidden')).toBe(true);
                expect(chatroomview.model.get('mam_enabled')).toBe(false);
                expect(chatroomview.model.get('membersonly')).toBe(false);
                expect(chatroomview.model.get('moderated')).toBe(false);
                expect(chatroomview.model.get('nonanonymous')).toBe(true);
                expect(chatroomview.model.get('open')).toBe(true);
                expect(chatroomview.model.get('passwordprotected')).toBe(true);
                expect(chatroomview.model.get('persistent')).toBe(false);
                expect(chatroomview.model.get('publicroom')).toBe(false);
                expect(chatroomview.model.get('semianonymous')).toBe(false);
                expect(chatroomview.model.get('temporary')).toBe(true);
                expect(chatroomview.model.get('unmoderated')).toBe(true);
                expect(chatroomview.model.get('unsecured')).toBe(false);
                expect(chatroomview.el.querySelector('.chat-title').textContent.trim()).toBe('New room name');
                done();
            }));

            it("indicates when a room is no longer anonymous",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                let sent_IQ, IQ_id;
                const sendIQ = _converse.connection.sendIQ;

                await test_utils.openAndEnterChatRoom(_converse, 'coven', 'chat.shakespeare.lit', 'some1');
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                // We pretend this is a new room, so no disco info is returned.
                const features_stanza = $iq({
                        from: 'coven@chat.shakespeare.lit',
                        'id': IQ_id,
                        'to': 'dummy@localhost/desktop',
                        'type': 'error'
                    }).c('error', {'type': 'cancel'})
                        .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                /* <message xmlns="jabber:client"
                *              type="groupchat"
                *              to="dummy@localhost/_converse.js-27854181"
                *              from="coven@chat.shakespeare.lit">
                *      <x xmlns="http://jabber.org/protocol/muc#user">
                *          <status code="104"/>
                *          <status code="172"/>
                *      </x>
                *  </message>
                */
                const message = $msg({
                        type:'groupchat',
                        to: 'dummy@localhost/_converse.js-27854181',
                        from: 'coven@chat.shakespeare.lit'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('status', {code: '104'}).up()
                    .c('status', {code: '172'});
                _converse.connection._dataRecv(test_utils.createRequest(message));
                const chat_body = view.el.querySelector('.chatroom-body');
                expect(sizzle('.message:last', chat_body).pop().textContent)
                    .toBe('This groupchat is now no longer anonymous');
                done();
            }));

            it("informs users if they have been kicked out of the groupchat",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
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
                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                var presence = $pres().attrs({
                        from:'lounge@localhost/dummy',
                        to:'dummy@localhost/pda',
                        type:'unavailable'
                    })
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'none',
                        jid: 'dummy@localhost/pda',
                        role: 'none'
                    })
                    .c('actor').attrs({nick: 'Fluellen'}).up()
                    .c('reason').t('Avaunt, you cullion!').up()
                    .up()
                    .c('status').attrs({code:'110'}).up()
                    .c('status').attrs({code:'307'}).nodeTree;
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                const view = _converse.chatboxviews.get('lounge@localhost');
                expect(u.isVisible(view.el.querySelector('.chat-area'))).toBeFalsy();
                expect(u.isVisible(view.el.querySelector('.occupants'))).toBeFalsy();
                const chat_body = view.el.querySelector('.chatroom-body');
                expect(chat_body.querySelectorAll('.disconnect-msg').length).toBe(3);
                expect(chat_body.querySelector('.disconnect-msg:first-child').textContent).toBe(
                    'You have been kicked from this groupchat');
                expect(chat_body.querySelector('.disconnect-msg:nth-child(2)').textContent).toBe(
                    'This action was done by Fluellen.');
                expect(chat_body.querySelector('.disconnect-msg:nth-child(3)').textContent).toBe(
                    'The reason given is: "Avaunt, you cullion!".');
                done();
            }));


            it("can be saved to, and retrieved from, browserStorage",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                // We instantiate a new ChatBoxes collection, which by default
                // will be empty.
                test_utils.openControlBox();
                const newchatboxes = new _converse.ChatBoxes();
                expect(newchatboxes.length).toEqual(0);
                // The chatboxes will then be fetched from browserStorage inside the
                // onConnected method
                newchatboxes.onConnected();
                await new Promise((resolve, reject) => _converse.api.listen.once('chatBoxesFetched', resolve));

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
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                const view = _converse.chatboxviews.get('lounge@localhost'),
                      trimmed_chatboxes = _converse.minimized_chats;

                spyOn(view, 'minimize').and.callThrough();
                spyOn(view, 'maximize').and.callThrough();
                spyOn(_converse, 'emit');
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                view.el.querySelector('.toggle-chatbox-button').click();

                expect(view.minimize).toHaveBeenCalled();
                expect(_converse.emit).toHaveBeenCalledWith('chatBoxMinimized', jasmine.any(Object));
                expect(u.isVisible(view.el)).toBeFalsy();
                expect(view.model.get('minimized')).toBeTruthy();
                expect(view.minimize).toHaveBeenCalled();
                await test_utils.waitUntil(() => trimmed_chatboxes.get(view.model.get('id')));
                const trimmedview = trimmed_chatboxes.get(view.model.get('id'));
                trimmedview.el.querySelector("a.restore-chat").click();
                expect(view.maximize).toHaveBeenCalled();
                expect(_converse.emit).toHaveBeenCalledWith('chatBoxMaximized', jasmine.any(Object));
                expect(view.model.get('minimized')).toBeFalsy();
                expect(_converse.emit.calls.count(), 3);
                done();

            }));

            it("can be closed again by clicking a DOM element with class 'close-chatbox-button'",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                const view = _converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'close').and.callThrough();
                spyOn(_converse, 'emit');
                spyOn(view.model, 'leave');
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                view.el.querySelector('.close-chatbox-button').click();
                expect(view.close).toHaveBeenCalled();
                expect(view.model.leave).toHaveBeenCalled();
                await test_utils.waitUntil(() => _converse.emit.calls.count());
                expect(_converse.emit).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                done();
            }));
        });


        describe("Each chat groupchat can take special commands", function () {

            it("takes /help to show the available commands",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                const view = _converse.chatboxviews.get('lounge@localhost');
                var textarea = view.el.querySelector('.chat-textarea');
                textarea.value = '/help This is the groupchat subject';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13
                });

                const info_messages = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info'), 0);
                expect(info_messages.length).toBe(19);
                expect(info_messages.pop().textContent).toBe('/voice: Allow muted user to post messages');
                expect(info_messages.pop().textContent).toBe('/topic: Set groupchat subject (alias for /subject)');
                expect(info_messages.pop().textContent).toBe('/subject: Set groupchat subject');
                expect(info_messages.pop().textContent).toBe('/revoke: Revoke user\'s membership');
                expect(info_messages.pop().textContent).toBe('/register: Register a nickname for this groupchat');
                expect(info_messages.pop().textContent).toBe('/owner: Grant ownership of this groupchat');
                expect(info_messages.pop().textContent).toBe('/op: Grant moderator role to user');
                expect(info_messages.pop().textContent).toBe('/nick: Change your nickname');
                expect(info_messages.pop().textContent).toBe('/mute: Remove user\'s ability to post messages');
                expect(info_messages.pop().textContent).toBe('/member: Grant membership to a user');
                expect(info_messages.pop().textContent).toBe('/me: Write in 3rd person');
                expect(info_messages.pop().textContent).toBe('/kick: Kick user from groupchat');
                expect(info_messages.pop().textContent).toBe('/help: Show this menu');
                expect(info_messages.pop().textContent).toBe('/destroy: Destroy room');
                expect(info_messages.pop().textContent).toBe('/deop: Change user role to participant');
                expect(info_messages.pop().textContent).toBe('/clear: Remove messages');
                expect(info_messages.pop().textContent).toBe('/ban: Ban user from groupchat');
                expect(info_messages.pop().textContent).toBe('/admin: Change user\'s affiliation to admin');
                done();
            }));

            it("takes /member to make an occupant a member",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                let iq_stanza;

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'muc.localhost', 'dummy');
                const view = _converse.chatboxviews.get('lounge@muc.localhost');
                /* We don't show join/leave messages for existing occupants. We
                 * know about them because we receive their presences before we
                 * receive our own.
                 */
                const presence = $pres({
                        to: 'dummy@localhost/resource',
                        from: 'lounge@muc.localhost/marc'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'marc@localhost/_converse.js-290929789',
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
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13
                });
                expect(_converse.connection.send).not.toHaveBeenCalled();
                expect(view.el.querySelectorAll('.chat-error').length).toBe(1);
                expect(view.el.querySelector('.chat-error').textContent.trim())
                    .toBe(`Error: couldn't find a groupchat participant "chris"`)

                // Now test with an existing nick
                textarea.value = '/member marc Welcome to the club!';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13
                });
                expect(_converse.connection.send).toHaveBeenCalled();
                expect(Strophe.serialize(sent_stanza)).toBe(
                    `<iq id="${sent_stanza.getAttribute('id')}" to="lounge@muc.localhost" type="set" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item affiliation="member" jid="marc@localhost">`+
                                `<reason>Welcome to the club!</reason>`+
                            `</item>`+
                        `</query>`+
                    `</iq>`);

                let result = $iq({
                    "xmlns": "jabber:client",
                    "type": "result",
                    "to": "dummy@localhost/resource",
                    "from": "lounge@muc.localhost",
                    "id": sent_stanza.getAttribute('id')
                });
                _converse.connection.IQ_stanzas = [];
                _converse.connection._dataRecv(test_utils.createRequest(result));
                let node = await test_utils.waitUntil(() => _.filter(
                    _converse.connection.IQ_stanzas,
                    iq => iq.nodeTree.querySelector('iq[to="lounge@muc.localhost"][type="get"] item[affiliation="member"]')).pop()
                );

                iq_stanza = node.nodeTree;
                expect(node.toLocaleString()).toBe(
                    `<iq id="${iq_stanza.getAttribute('id')}" to="lounge@muc.localhost" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item affiliation="member"/>`+
                        `</query>`+
                    `</iq>`)
                expect(view.model.occupants.length).toBe(2);

                result = $iq({
                    "xmlns": "jabber:client",
                    "type": "result",
                    "to": "dummy@localhost/resource",
                    "from": "lounge@muc.localhost",
                    "id": iq_stanza.getAttribute("id")
                }).c("query", {"xmlns": "http://jabber.org/protocol/muc#admin"})
                    .c("item", {"jid": "marc", "affiliation": "member"});
                _converse.connection._dataRecv(test_utils.createRequest(result));

                expect(view.model.occupants.length).toBe(2);
                node = await test_utils.waitUntil(() => _.filter(
                    _converse.connection.IQ_stanzas,
                    (iq) => iq.nodeTree.querySelector('iq[to="lounge@muc.localhost"][type="get"] item[affiliation="owner"]')).pop()
                );

                iq_stanza = node.nodeTree;
                expect(node.toLocaleString()).toBe(
                    `<iq id="${iq_stanza.getAttribute('id')}" to="lounge@muc.localhost" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item affiliation="owner"/>`+
                        `</query>`+
                    `</iq>`)
                expect(view.model.occupants.length).toBe(2);

                result = $iq({
                    "xmlns": "jabber:client",
                    "type": "result",
                    "to": "dummy@localhost/resource",
                    "from": "lounge@muc.localhost",
                    "id": iq_stanza.getAttribute("id")
                }).c("query", {"xmlns": "http://jabber.org/protocol/muc#admin"})
                    .c("item", {"jid": "dummy@localhost", "affiliation": "owner"});
                _converse.connection._dataRecv(test_utils.createRequest(result));

                expect(view.model.occupants.length).toBe(2);
                node = await test_utils.waitUntil(() => _.filter(
                    _converse.connection.IQ_stanzas,
                    (iq) => iq.nodeTree.querySelector('iq[to="lounge@muc.localhost"][type="get"] item[affiliation="admin"]')).pop()
                );

                iq_stanza = node.nodeTree;
                expect(node.toLocaleString()).toBe(
                    `<iq id="${iq_stanza.getAttribute('id')}" to="lounge@muc.localhost" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item affiliation="admin"/>`+
                        `</query>`+
                    `</iq>`)
                expect(view.model.occupants.length).toBe(2);

                result = $iq({
                    "xmlns": "jabber:client",
                    "type": "result",
                    "to": "dummy@localhost/resource",
                    "from": "lounge@muc.localhost",
                    "id": iq_stanza.getAttribute("id")
                }).c("query", {"xmlns": "http://jabber.org/protocol/muc#admin"})
                _converse.connection._dataRecv(test_utils.createRequest(result));

                await test_utils.waitUntil(() => view.el.querySelectorAll('.badge').length > 1);
                expect(view.model.occupants.length).toBe(2);
                expect(view.el.querySelectorAll('.occupant').length).toBe(2);
                done();
            }));

            it("takes /topic to set the groupchat topic",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                const view = _converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'clearMessages');
                let sent_stanza;
                spyOn(_converse.connection, 'send').and.callFake(function (stanza) {
                    sent_stanza = stanza;
                });
                // Check the alias /topic
                const textarea = view.el.querySelector('.chat-textarea');
                textarea.value = '/topic This is the groupchat subject';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13
                });
                expect(_converse.connection.send).toHaveBeenCalled();
                expect(sent_stanza.textContent).toBe('This is the groupchat subject');

                // Check /subject
                textarea.value = '/subject This is a new subject';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13
                });

                expect(sent_stanza.textContent).toBe('This is a new subject');
                expect(Strophe.serialize(sent_stanza).toLocaleString()).toBe(
                    '<message from="dummy@localhost/resource" to="lounge@localhost" type="groupchat" xmlns="jabber:client">'+
                        '<subject xmlns="jabber:client">This is a new subject</subject>'+
                    '</message>');

                // Check case insensitivity
                textarea.value = '/Subject This is yet another subject';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13
                });
                expect(sent_stanza.textContent).toBe('This is yet another subject');
                expect(Strophe.serialize(sent_stanza).toLocaleString()).toBe(
                    '<message from="dummy@localhost/resource" to="lounge@localhost" type="groupchat" xmlns="jabber:client">'+
                        '<subject xmlns="jabber:client">This is yet another subject</subject>'+
                    '</message>');
                done();
            }));

            it("takes /clear to clear messages",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                const view = _converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'clearMessages');
                const textarea = view.el.querySelector('.chat-textarea')
                textarea.value = '/clear';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13
                });
                expect(view.clearMessages).toHaveBeenCalled();
                done();
            }));

            it("takes /owner to make a user an owner",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                let sent_IQ, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                const view = _converse.chatboxviews.get('lounge@localhost');
                spyOn(view.model, 'setAffiliation').and.callThrough();
                spyOn(view, 'showErrorMessage').and.callThrough();
                spyOn(view, 'validateRoleChangeCommand').and.callThrough();

                let presence = $pres({
                        'from': 'lounge@localhost/annoyingGuy',
                        'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                        'to': 'dummy@localhost/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@localhost',
                            'affiliation': 'member',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                var textarea = view.el.querySelector('.chat-textarea')
                textarea.value = '/owner';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13
                });
                expect(view.validateRoleChangeCommand).toHaveBeenCalled();
                expect(view.showErrorMessage).toHaveBeenCalledWith(
                    "Error: the \"owner\" command takes two arguments, the user's nickname and optionally a reason.");
                expect(view.model.setAffiliation).not.toHaveBeenCalled();
                // XXX: Calling onFormSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                textarea.value = '/owner nobody You\'re responsible';
                view.onFormSubmitted(new Event('submit'));

                expect(view.showErrorMessage).toHaveBeenCalledWith(
                    'Error: couldn\'t find a groupchat participant "nobody"');
                expect(view.model.setAffiliation).not.toHaveBeenCalled();

                // Call now with the correct of arguments.
                // XXX: Calling onFormSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                textarea.value = '/owner annoyingGuy You\'re responsible';
                view.onFormSubmitted(new Event('submit'));

                expect(view.validateRoleChangeCommand.calls.count()).toBe(3);
                expect(view.model.setAffiliation).toHaveBeenCalled();
                expect(view.showErrorMessage.calls.count()).toBe(2);
                // Check that the member list now gets updated
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="lounge@localhost" type="set" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item affiliation="owner" jid="annoyingGuy">`+
                                `<reason>You&apos;re responsible</reason>`+
                            `</item>`+
                        `</query>`+
                    `</iq>`);

                presence = $pres({
                        'from': 'lounge@localhost/annoyingGuy',
                        'id':'27C55F89-1C6A-459A-9EB5-77690145D628',
                        'to': 'dummy@localhost/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@localhost',
                            'affiliation': 'owner',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.el.querySelectorAll('.chat-info')[4].textContent).toBe("annoyingGuy is now an owner of this groupchat");
                done();
            }));

            it("takes /ban to ban a user",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                let sent_IQ, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                const view = _converse.chatboxviews.get('lounge@localhost');
                spyOn(view.model, 'setAffiliation').and.callThrough();
                spyOn(view, 'showErrorMessage').and.callThrough();
                spyOn(view, 'validateRoleChangeCommand').and.callThrough();

                let presence = $pres({
                        'from': 'lounge@localhost/annoyingGuy',
                        'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                        'to': 'dummy@localhost/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@localhost',
                            'affiliation': 'member',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                const textarea = view.el.querySelector('.chat-textarea')
                textarea.value = '/ban';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13
                });
                expect(view.validateRoleChangeCommand).toHaveBeenCalled();
                expect(view.showErrorMessage).toHaveBeenCalledWith(
                    "Error: the \"ban\" command takes two arguments, the user's nickname and optionally a reason.");
                expect(view.model.setAffiliation).not.toHaveBeenCalled();
                // Call now with the correct amount of arguments.
                // XXX: Calling onFormSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                textarea.value = '/ban annoyingGuy You\'re annoying';
                view.onFormSubmitted(new Event('submit'));

                expect(view.validateRoleChangeCommand.calls.count()).toBe(2);
                expect(view.showErrorMessage.calls.count()).toBe(1);
                expect(view.model.setAffiliation).toHaveBeenCalled();
                // Check that the member list now gets updated
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="lounge@localhost" type="set" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item affiliation="outcast" jid="annoyingGuy">`+
                                `<reason>You&apos;re annoying</reason>`+
                            `</item>`+
                        `</query>`+
                    `</iq>`);

                presence = $pres({
                        'from': 'lounge@localhost/annoyingGuy',
                        'id':'27C55F89-1C6A-459A-9EB5-77690145D628',
                        'to': 'dummy@localhost/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@localhost',
                            'affiliation': 'outcast',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(
                    view.el.querySelectorAll('.chat-info')[3].textContent).toBe(
                    "annoyingGuy has been banned from this groupchat");
                done();
            }));

            it("takes /kick to kick a user",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                let sent_IQ, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                const view = _converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'modifyRole').and.callThrough();
                spyOn(view, 'showErrorMessage').and.callThrough();
                spyOn(view, 'validateRoleChangeCommand').and.callThrough();

                let presence = $pres({
                        'from': 'lounge@localhost/annoyingGuy',
                        'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                        'to': 'dummy@localhost/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@localhost',
                            'affiliation': 'none',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                var textarea = view.el.querySelector('.chat-textarea')
                textarea.value = '/kick';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13
                });
                expect(view.validateRoleChangeCommand).toHaveBeenCalled();
                expect(view.showErrorMessage).toHaveBeenCalledWith(
                    "Error: the \"kick\" command takes two arguments, the user's nickname and optionally a reason.");
                expect(view.modifyRole).not.toHaveBeenCalled();
                // Call now with the correct amount of arguments.
                // XXX: Calling onFormSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                textarea.value = '/kick annoyingGuy You\'re annoying';
                view.onFormSubmitted(new Event('submit'));

                expect(view.validateRoleChangeCommand.calls.count()).toBe(2);
                expect(view.showErrorMessage.calls.count()).toBe(1);
                expect(view.modifyRole).toHaveBeenCalled();
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="lounge@localhost" type="set" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item nick="annoyingGuy" role="none">`+
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
                        'from': 'lounge@localhost/annoyingGuy',
                        'to': 'dummy@localhost/desktop',
                        'type': 'unavailable'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'affiliation': 'none',
                            'role': 'none'
                        }).up()
                        .c('status', {'code': '307'});
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.el.querySelectorAll('.chat-info')[3].textContent).toBe("annoyingGuy has been kicked out");
                expect(view.el.querySelectorAll('.chat-info').length).toBe(4);
                done();
            }));


            it("takes /op and /deop to make a user a moderator or not",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                var sent_IQ, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                var view = _converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'modifyRole').and.callThrough();
                spyOn(view, 'showErrorMessage').and.callThrough();
                spyOn(view, 'showChatEvent').and.callThrough();
                spyOn(view, 'validateRoleChangeCommand').and.callThrough();

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
                var presence = $pres({
                        'from': 'lounge@localhost/trustworthyguy',
                        'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                        'to': 'dummy@localhost/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'trustworthyguy@localhost',
                            'affiliation': 'member',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                var info_msgs = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info'), 0);
                expect(info_msgs.pop().textContent).toBe("trustworthyguy has entered the groupchat");

                var textarea = view.el.querySelector('.chat-textarea')
                textarea.value = '/op';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13
                });

                expect(view.validateRoleChangeCommand).toHaveBeenCalled();
                expect(view.showErrorMessage).toHaveBeenCalledWith(
                    "Error: the \"op\" command takes two arguments, the user's nickname and optionally a reason.");

                expect(view.modifyRole).not.toHaveBeenCalled();
                // Call now with the correct amount of arguments.
                // XXX: Calling onFormSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                textarea.value = '/op trustworthyguy You\'re trustworthy';
                view.onFormSubmitted(new Event('submit'));

                expect(view.validateRoleChangeCommand.calls.count()).toBe(2);
                expect(view.showErrorMessage.calls.count()).toBe(1);
                expect(view.modifyRole).toHaveBeenCalled();
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="lounge@localhost" type="set" xmlns="jabber:client">`+
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
                        'from': 'lounge@localhost/trustworthyguy',
                        'to': 'dummy@localhost/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'trustworthyguy@localhost',
                            'affiliation': 'member',
                            'role': 'moderator'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                info_msgs = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info'), 0);
                expect(info_msgs.pop().textContent).toBe("trustworthyguy is now a moderator");
                // Call now with the correct amount of arguments.
                // XXX: Calling onFormSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                textarea.value = '/deop trustworthyguy Perhaps not';
                view.onFormSubmitted(new Event('submit'));

                expect(view.validateRoleChangeCommand.calls.count()).toBe(3);
                expect(view.showChatEvent.calls.count()).toBe(1);
                expect(view.modifyRole).toHaveBeenCalled();
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="lounge@localhost" type="set" xmlns="jabber:client">`+
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
                        'from': 'lounge@localhost/trustworthyguy',
                        'to': 'dummy@localhost/desktop'
                    }).c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'trustworthyguy@localhost',
                            'affiliation': 'member',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                info_msgs = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info'), 0);
                expect(info_msgs.pop().textContent).toBe("trustworthyguy is no longer a moderator");
                done();
            }));

            it("takes /mute and /voice to mute and unmute a user",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                var sent_IQ, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                var view = _converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'modifyRole').and.callThrough();
                spyOn(view, 'showErrorMessage').and.callThrough();
                spyOn(view, 'showChatEvent').and.callThrough();
                spyOn(view, 'validateRoleChangeCommand').and.callThrough();

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
                        'from': 'lounge@localhost/annoyingGuy',
                        'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                        'to': 'dummy@localhost/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@localhost',
                            'affiliation': 'member',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                var info_msgs = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info'), 0);
                expect(info_msgs.pop().textContent).toBe("annoyingGuy has entered the groupchat");

                const textarea = view.el.querySelector('.chat-textarea')
                textarea.value = '/mute';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13
                });

                expect(view.validateRoleChangeCommand).toHaveBeenCalled();
                expect(view.showErrorMessage).toHaveBeenCalledWith(
                    "Error: the \"mute\" command takes two arguments, the user's nickname and optionally a reason.");
                expect(view.modifyRole).not.toHaveBeenCalled();
                // Call now with the correct amount of arguments.
                // XXX: Calling onFormSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                textarea.value = '/mute annoyingGuy You\'re annoying';
                view.onFormSubmitted(new Event('submit'));

                expect(view.validateRoleChangeCommand.calls.count()).toBe(2);
                expect(view.showErrorMessage.calls.count()).toBe(1);
                expect(view.modifyRole).toHaveBeenCalled();
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="lounge@localhost" type="set" xmlns="jabber:client">`+
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
                        'from': 'lounge@localhost/annoyingGuy',
                        'to': 'dummy@localhost/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@localhost',
                            'affiliation': 'member',
                            'role': 'visitor'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                info_msgs = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info'), 0);
                expect(info_msgs.pop().textContent).toBe("annoyingGuy has been muted");

                // Call now with the correct of arguments.
                // XXX: Calling onFormSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                textarea.value = '/voice annoyingGuy Now you can talk again';
                view.onFormSubmitted(new Event('submit'));

                expect(view.validateRoleChangeCommand.calls.count()).toBe(3);
                expect(view.showChatEvent.calls.count()).toBe(1);
                expect(view.modifyRole).toHaveBeenCalled();
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="lounge@localhost" type="set" xmlns="jabber:client">`+
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
                        'from': 'lounge@localhost/annoyingGuy',
                        'to': 'dummy@localhost/desktop'
                    })
                    .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                        .c('item', {
                            'jid': 'annoyingguy@localhost',
                            'affiliation': 'member',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                info_msgs = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info'), 0);
                expect(info_msgs.pop().textContent).toBe("annoyingGuy has been given a voice again");
                done();
            }));

            it("takes /destroy to destroy a muc",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                let sent_IQ, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                const view = _converse.chatboxviews.get('lounge@localhost');
                const textarea = view.el.querySelector('.chat-textarea');
                textarea.value = '/destroy bored';
                view.onFormSubmitted(new Event('submit'));
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="lounge@localhost" type="set" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#owner">`+
                            `<destroy>`+
                                `<reason>`+
                                    `bored`+
                                `</reason>`+
                            `</destroy>`+
                        `</query>`+
                    `</iq>`);

                /* <iq from="lounge@localhost"
                 *  id="${IQ_id}"
                 *  to="dummy@localhost/resource"
                 *  type="result"
                 *  xmlns="jabber:client"/>
                */
                const result_stanza = $iq({
                    'type': 'result',
                    'id': IQ_id,
                    'from': view.model.get('jid'),
                    'to': _converse.connection.jid
                });
                spyOn(view, 'close').and.callThrough();
                spyOn(_converse, 'emit');
                _converse.connection._dataRecv(test_utils.createRequest(result_stanza));
                await test_utils.waitUntil(() => (view.model.get('connection_status') === converse.ROOMSTATUS.DISCONNECTED));
                expect(view.close).toHaveBeenCalled();
                expect(_converse.emit).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                done();
            }));
        });

        describe("When attempting to enter a groupchat", function () {

            it("will use the nickname set in the global settings if the user doesn't have a VCard nickname",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {'nickname': 'Benedict-Cucumberpatch'},
                    async function (done, _converse) {

                await test_utils.openChatRoomViaModal(_converse, 'roomy@muc.localhost');
                const view = _converse.chatboxviews.get('roomy@muc.localhost');
                expect(view.model.get('nick')).toBe('Benedict-Cucumberpatch');
                done();
            }));

            it("will show an error message if the groupchat requires a password",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                const groupchat_jid = 'protected';
                await test_utils.openChatRoomViaModal(_converse, groupchat_jid, 'dummy');
                const view = _converse.chatboxviews.get(groupchat_jid);
                spyOn(view, 'renderPasswordForm').and.callThrough();

                var presence = $pres().attrs({
                        'from': `${groupchat_jid}/dummy`,
                        'id': u.getUniqueId(),
                        'to': 'dummy@localhost/pda',
                        'type': 'error'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                      .c('error').attrs({by:'lounge@localhost', type:'auth'})
                          .c('not-authorized').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'});

                _converse.connection._dataRecv(test_utils.createRequest(presence));

                const chat_body = view.el.querySelector('.chatroom-body');
                expect(view.renderPasswordForm).toHaveBeenCalled();
                expect(chat_body.querySelectorAll('form.chatroom-form').length).toBe(1);
                expect(chat_body.querySelector('legend').textContent)
                    .toBe('This groupchat requires a password');

                // Let's submit the form
                spyOn(view, 'join');
                const input_el = view.el.querySelector('[name="password"]');
                input_el.value = 'secret';
                view.el.querySelector('input[type=submit]').click();
                expect(view.join).toHaveBeenCalledWith('dummy', 'secret');
                done();
            }));

            it("will show an error message if the groupchat is members-only and the user not included",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const groupchat_jid = 'members-only@muc.localhost'
                await test_utils.openChatRoomViaModal(_converse, groupchat_jid, 'dummy');
                const presence = $pres().attrs({
                        from: `${groupchat_jid}/dummy`,
                        id: u.getUniqueId(),
                        to: 'dummy@localhost/pda',
                        type: 'error'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                      .c('error').attrs({by:'lounge@localhost', type:'auth'})
                          .c('registration-required').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                const view = _converse.chatboxviews.get(groupchat_jid);
                spyOn(view, 'showErrorMessage').and.callThrough();
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.el.querySelector('.chatroom-body .disconnect-container .disconnect-msg:last-child').textContent)
                    .toBe('You are not on the member list of this groupchat.');
                done();
            }));

            it("will show an error message if the user has been banned",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const groupchat_jid = 'off-limits@muc.localhost'
                await test_utils.openChatRoomViaModal(_converse, groupchat_jid, 'dummy');
                const presence = $pres().attrs({
                        from: `${groupchat_jid}/dummy`,
                        id: u.getUniqueId(),
                        to: 'dummy@localhost/pda',
                        type: 'error'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                      .c('error').attrs({by:'lounge@localhost', type:'auth'})
                          .c('forbidden').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                const view = _converse.chatboxviews.get(groupchat_jid);
                spyOn(view, 'showErrorMessage').and.callThrough();
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.el.querySelector('.chatroom-body .disconnect-container .disconnect-msg:last-child').textContent)
                    .toBe('You have been banned from this groupchat.');
                done();
            }));

            it("will render a nickname form if a nickname conflict happens and muc_nickname_from_jid=false",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const groupchat_jid = 'conflicted@muc.localhost';
                await test_utils.openChatRoomViaModal(_converse, groupchat_jid, 'dummy');
                var presence = $pres().attrs({
                        from: `${groupchat_jid}/dummy`,
                        id: u.getUniqueId(),
                        to: 'dummy@localhost/pda',
                        type: 'error'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                      .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                          .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                const view = _converse.chatboxviews.get(groupchat_jid);
                spyOn(view, 'showErrorMessage').and.callThrough();
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(sizzle('.chatroom-body form.chatroom-form label:first', view.el).pop().textContent)
                    .toBe('Please choose your nickname');

                const input = sizzle('.chatroom-body form.chatroom-form input:first', view.el).pop();
                input.value = 'nicky';
                view.el.querySelector('input[type=submit]').click();
                done();
            }));

            it("will automatically choose a new nickname if a nickname conflict happens and muc_nickname_from_jid=true",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const groupchat_jid = 'conflicting@muc.localhost'
                await test_utils.openChatRoomViaModal(_converse, groupchat_jid, 'dummy');
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
                    'from': `${groupchat_jid}/dummy`,
                    'id': u.getUniqueId(),
                    'to': 'dummy@localhost/pda',
                    'type': 'error'
                };
                let presence = $pres().attrs(attrs)
                    .c('x').attrs({'xmlns':'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({'by': groupchat_jid, 'type':'cancel'})
                        .c('conflict').attrs({'xmlns':'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                const view = _converse.chatboxviews.get(groupchat_jid);
                spyOn(view, 'showErrorMessage').and.callThrough();
                spyOn(view, 'join').and.callThrough();

                // Simulate repeatedly that there's already someone in the groupchat
                // with that nickname
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.join).toHaveBeenCalledWith('dummy-2');

                attrs.from = `${groupchat_jid}/dummy-2`;
                attrs.id = u.getUniqueId();
                presence = $pres().attrs(attrs)
                    .c('x').attrs({'xmlns':'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({'by': groupchat_jid, type:'cancel'})
                        .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                expect(view.join).toHaveBeenCalledWith('dummy-3');

                attrs.from = `${groupchat_jid}/dummy-3`;
                attrs.id = new Date().getTime();
                presence = $pres().attrs(attrs)
                    .c('x').attrs({'xmlns': 'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({'by': groupchat_jid, 'type': 'cancel'})
                        .c('conflict').attrs({'xmlns':'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.join).toHaveBeenCalledWith('dummy-4');
                done();
            }));

            it("will show an error message if the user is not allowed to have created the groupchat",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const groupchat_jid = 'impermissable@muc.localhost'
                await test_utils.openChatRoomViaModal(_converse, groupchat_jid, 'dummy')
                var presence = $pres().attrs({
                        from: `${groupchat_jid}/dummy`,
                        id: u.getUniqueId(),
                        to:'dummy@localhost/pda',
                        type:'error'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                      .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                          .c('not-allowed').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                const view = _converse.chatboxviews.get(groupchat_jid);
                spyOn(view, 'showErrorMessage').and.callThrough();
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.el.querySelector('.chatroom-body .disconnect-container .disconnect-msg:last-child').textContent)
                    .toBe('You are not allowed to create new groupchats.');
                done();
            }));

            it("will show an error message if the user's nickname doesn't conform to groupchat policy",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const groupchat_jid = 'conformist@muc.localhost'
                await test_utils.openChatRoomViaModal(_converse, groupchat_jid, 'dummy');
                const presence = $pres().attrs({
                        from: `${groupchat_jid}/dummy`,
                        id: u.getUniqueId(),
                        to:'dummy@localhost/pda',
                        type:'error'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                      .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                          .c('not-acceptable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                const view = _converse.chatboxviews.get(groupchat_jid);
                spyOn(view, 'showErrorMessage').and.callThrough();
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.el.querySelector('.chatroom-body .disconnect-container .disconnect-msg:last-child').textContent)
                    .toBe("Your nickname doesn't conform to this groupchat's policies.");
                done();
            }));

            it("will show an error message if the groupchat doesn't yet exist",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const groupchat_jid = 'nonexistent@muc.localhost'
                await test_utils.openChatRoomViaModal(_converse, groupchat_jid, 'dummy');
                const presence = $pres().attrs({
                        from: `${groupchat_jid}/dummy`,
                        id: u.getUniqueId(),
                        to: 'dummy@localhost/pda',
                        type:'error'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                      .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                          .c('item-not-found').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                const view = _converse.chatboxviews.get(groupchat_jid);
                spyOn(view, 'showErrorMessage').and.callThrough();
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.el.querySelector('.chatroom-body .disconnect-container .disconnect-msg:last-child').textContent)
                    .toBe("This groupchat does not (yet) exist.");
                done();
            }));

            it("will show an error message if the groupchat has reached its maximum number of participants",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const groupchat_jid = 'maxed-out@muc.localhost'
                await test_utils.openChatRoomViaModal(_converse, groupchat_jid, 'dummy')
                const presence = $pres().attrs({
                        from: `${groupchat_jid}/dummy`,
                        id: u.getUniqueId(),
                        to:'dummy@localhost/pda',
                        type:'error'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                      .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                          .c('service-unavailable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                const view = _converse.chatboxviews.get(groupchat_jid);
                spyOn(view, 'showErrorMessage').and.callThrough();
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.el.querySelector('.chatroom-body .disconnect-container .disconnect-msg:last-child').textContent)
                    .toBe("This groupchat has reached its maximum number of participants.");
                done();
            }));
        });

        describe("Someone being invited to a groupchat", function () {

            it("will first be added to the member list if the groupchat is members only",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                var sent_IQs = [], IQ_ids = [];
                const sendIQ = _converse.connection.sendIQ;
                const IQ_stanzas = _converse.connection.IQ_stanzas;
                const room_jid = 'coven@chat.shakespeare.lit';
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQs.push(iq);
                    IQ_ids.push(sendIQ.bind(this)(iq, callback, errback));
                });

                await _converse.api.rooms.open(room_jid, {'nick': 'dummy'});
                const node = await test_utils.waitUntil(() => _.filter(
                    IQ_stanzas,
                    iq => iq.nodeTree.querySelector(
                        `iq[to="${room_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                    )).pop());
                // Check that the groupchat queried for the feautures.
                let stanza = node.nodeTree;
                expect(node.toLocaleString()).toBe(
                    `<iq from="dummy@localhost/resource" id="${stanza.getAttribute("id")}" to="${room_jid}" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/disco#info"/>`+
                    `</iq>`);

                const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                // State that the chat is members-only via the features IQ
                var features_stanza = $iq({
                        from: 'coven@chat.shakespeare.lit',
                        'id': IQ_ids.pop(),
                        'to': 'dummy@localhost/desktop',
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
                await test_utils.waitUntil(() => (view.model.get('connection_status') === converse.ROOMSTATUS.CONNECTING));
                expect(view.model.get('membersonly')).toBeTruthy();

                await test_utils.createContacts(_converse, 'current');

                let sent_stanza, sent_id;
                spyOn(_converse.connection, 'send').and.callFake(function (stanza) {
                    if (stanza.nodeTree && stanza.nodeTree.nodeName === 'message') {
                        sent_id = stanza.nodeTree.getAttribute('id');
                        sent_stanza = stanza;
                    }
                });
                var name = mock.cur_names[0];
                const invitee_jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                var reason = "Please join this groupchat";
                view.model.directInvite(invitee_jid, reason);

                // Check in reverse order that we requested all three lists
                // (member, owner and admin).
                var admin_iq_id = IQ_ids.pop();
                var owner_iq_id = IQ_ids.pop();
                var member_iq_id = IQ_ids.pop();

                expect(sent_IQs.pop().toLocaleString()).toBe(
                    `<iq id="${admin_iq_id}" to="coven@chat.shakespeare.lit" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item affiliation="admin"/>`+
                        `</query>`+
                    `</iq>`);
                expect(sent_IQs.pop().toLocaleString()).toBe(
                    `<iq id="${owner_iq_id}" to="coven@chat.shakespeare.lit" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item affiliation="owner"/>`+
                        `</query>`+
                    `</iq>`);
                expect(sent_IQs.pop().toLocaleString()).toBe(
                    `<iq id="${member_iq_id}" to="coven@chat.shakespeare.lit" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item affiliation="member"/>`+
                        `</query>`+
                    `</iq>`);

                /* Now the service sends the member list to the user
                 *
                 *  <iq from='coven@chat.shakespeare.lit'
                 *      id='member3'
                 *      to='crone1@shakespeare.lit/desktop'
                 *      type='result'>
                 *  <query xmlns='http://jabber.org/protocol/muc#admin'>
                 *      <item affiliation='member'
                 *          jid='hag66@shakespeare.lit'
                 *          nick='thirdwitch'
                 *          role='participant'/>
                 *  </query>
                 *  </iq>
                 */
                var member_list_stanza = $iq({
                        'from': 'coven@chat.shakespeare.lit',
                        'id': member_iq_id,
                        'to': 'dummy@localhost/resource',
                        'type': 'result'
                    }).c('query', {'xmlns': Strophe.NS.MUC_ADMIN})
                        .c('item', {
                            'affiliation': 'member',
                            'jid': 'hag66@shakespeare.lit',
                            'nick': 'thirdwitch',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(member_list_stanza));

                var admin_list_stanza = $iq({
                        'from': 'coven@chat.shakespeare.lit',
                        'id': admin_iq_id,
                        'to': 'dummy@localhost/resource',
                        'type': 'result'
                    }).c('query', {'xmlns': Strophe.NS.MUC_ADMIN})
                        .c('item', {
                            'affiliation': 'admin',
                            'jid': 'wiccarocks@shakespeare.lit',
                            'nick': 'secondwitch'
                        });
                _converse.connection._dataRecv(test_utils.createRequest(admin_list_stanza));

                var owner_list_stanza = $iq({
                        'from': 'coven@chat.shakespeare.lit',
                        'id': owner_iq_id,
                        'to': 'dummy@localhost/resource',
                        'type': 'result'
                    }).c('query', {'xmlns': Strophe.NS.MUC_ADMIN})
                        .c('item', {
                            'affiliation': 'owner',
                            'jid': 'crone1@shakespeare.lit',
                        });
                _converse.connection._dataRecv(test_utils.createRequest(owner_list_stanza));
                await test_utils.waitUntil(() => IQ_ids.length, 300);
                stanza = await test_utils.waitUntil(() => _.get(_.filter(
                    IQ_stanzas,
                    iq => iq.nodeTree.querySelector(
                        `iq[to="${room_jid}"] query[xmlns="http://jabber.org/protocol/muc#admin"]`
                    )).pop(), 'nodeTree'));
                expect(stanza.outerHTML,
                    `<iq id="${IQ_ids.pop()}" to="coven@chat.shakespeare.lit" type="set" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                            `<item affiliation="member" jid="${invitee_jid}">`+
                                `<reason>Please join this groupchat</reason>`+
                            `</item>`+
                        `</query>`+
                    `</iq>`);
                // Finally check that the user gets invited.
                expect(sent_stanza.toLocaleString()).toBe( // Strophe adds the xmlns attr (although not in spec)
                    `<message from="dummy@localhost/resource" id="${sent_id}" to="${invitee_jid}" xmlns="jabber:client">`+
                        `<x jid="coven@chat.shakespeare.lit" reason="Please join this groupchat" xmlns="jabber:x:conference"/>`+
                    `</message>`
                );
                done();
            }));
        });

        describe("The affiliations delta", function () {

            it("can be computed in various ways",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openChatRoom(_converse, 'coven', 'chat.shakespeare.lit', 'dummy');
                var roomview = _converse.chatboxviews.get('coven@chat.shakespeare.lit');

                var exclude_existing = false;
                var remove_absentees = false;
                var new_list = [];
                var old_list = [];
                var delta = u.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(0);

                new_list = [{'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'member'}];
                old_list = [{'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'member'}];
                delta = u.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(0);

                // When remove_absentees is false, then affiliations in the old
                // list which are not in the new one won't be removed.
                old_list = [{'jid': 'oldhag666@shakespeare.lit', 'affiliation': 'owner'},
                            {'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'member'}];
                delta = u.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(0);

                // With exclude_existing set to false, any changed affiliations
                // will be included in the delta (i.e. existing affiliations
                // are included in the comparison).
                old_list = [{'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'owner'}];
                delta = u.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(1);
                expect(delta[0].jid).toBe('wiccarocks@shakespeare.lit');
                expect(delta[0].affiliation).toBe('member');

                // To also remove affiliations from the old list which are not
                // in the new list, we set remove_absentees to true
                remove_absentees = true;
                old_list = [{'jid': 'oldhag666@shakespeare.lit', 'affiliation': 'owner'},
                            {'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'member'}];
                delta = u.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(1);
                expect(delta[0].jid).toBe('oldhag666@shakespeare.lit');
                expect(delta[0].affiliation).toBe('none');

                delta = u.computeAffiliationsDelta(exclude_existing, remove_absentees, [], old_list);
                expect(delta.length).toBe(2);
                expect(delta[0].jid).toBe('oldhag666@shakespeare.lit');
                expect(delta[0].affiliation).toBe('none');
                expect(delta[1].jid).toBe('wiccarocks@shakespeare.lit');
                expect(delta[1].affiliation).toBe('none');

                // To only add a user if they don't already have an
                // affiliation, we set 'exclude_existing' to true
                exclude_existing = true;
                old_list = [{'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'owner'}];
                delta = u.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(0);
                done();
            }));
        });

        describe("The \"Groupchats\" section", function () {

            it("contains a link to a modal through which a new chatroom can be created",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                test_utils.openControlBox();
                _converse.emit('rosterContactsFetched');

                const roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                roomspanel.el.querySelector('.show-add-muc-modal').click();
                test_utils.closeControlBox(_converse);
                const modal = roomspanel.add_room_modal;
                await test_utils.waitUntil(() => u.isVisible(modal.el), 1000)
                spyOn(_converse.ChatRoom.prototype, 'getRoomFeatures').and.callFake(() => Promise.resolve());
                roomspanel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                modal.el.querySelector('input[name="chatroom"]').value = 'lounce@muc.localhost';
                modal.el.querySelector('form input[type="submit"]').click();
                await test_utils.waitUntil(() => _converse.chatboxes.length > 1);
                expect(sizzle('.chatroom', _converse.el).filter(u.isVisible).length).toBe(1); // There should now be an open chatroom
                done();
            }));

            it("contains a link to a modal which can list groupchats publically available on the server",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                var sendIQ = _converse.connection.sendIQ;
                var sent_stanza, IQ_id;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                test_utils.openControlBox();
                var roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                roomspanel.el.querySelector('.show-list-muc-modal').click();
                test_utils.closeControlBox(_converse);
                const modal = roomspanel.list_rooms_modal;
                await test_utils.waitUntil(() => u.isVisible(modal.el), 1000);
                spyOn(_converse.ChatRoom.prototype, 'getRoomFeatures').and.callFake(() => Promise.resolve());
                roomspanel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called

                // See: http://xmpp.org/extensions/xep-0045.html#disco-rooms
                expect(modal.el.querySelectorAll('.available-chatrooms li').length).toBe(0);

                const input = modal.el.querySelector('input[name="server"]').value = 'chat.shakespear.lit';
                modal.el.querySelector('input[type="submit"]').click();
                await test_utils.waitUntil(() => _converse.chatboxes.length);
                expect(sent_stanza.toLocaleString()).toBe(
                    `<iq from="dummy@localhost/resource" id="${IQ_id}" to="chat.shakespear.lit" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/disco#items"/>`+
                    `</iq>`
                );

                const iq = $iq({
                    from:'muc.localhost',
                    to:'dummy@localhost/pda',
                    id: IQ_id,
                    type:'result'
                }).c('query')
                .c('item', { jid:'heath@chat.shakespeare.lit', name:'A Lonely Heath'}).up()
                .c('item', { jid:'coven@chat.shakespeare.lit', name:'A Dark Cave'}).up()
                .c('item', { jid:'forres@chat.shakespeare.lit', name:'The Palace'}).up()
                .c('item', { jid:'inverness@chat.shakespeare.lit', name:'Macbeth&apos;s Castle'}).nodeTree;
                _converse.connection._dataRecv(test_utils.createRequest(iq));

                await test_utils.waitUntil(() => modal.el.querySelectorAll('.available-chatrooms li').length === 5);

                const rooms = modal.el.querySelectorAll('.available-chatrooms li');
                expect(rooms[0].textContent.trim()).toBe("Groupchats found:");
                expect(rooms[1].textContent.trim()).toBe("A Lonely Heath");
                expect(rooms[2].textContent.trim()).toBe("A Dark Cave");
                expect(rooms[3].textContent.trim()).toBe("The Palace");
                expect(rooms[4].textContent.trim()).toBe("Macbeth's Castle");

                rooms[4].querySelector('.open-room').click();
                await test_utils.waitUntil(() => _converse.chatboxes.length > 1);
                expect(sizzle('.chatroom', _converse.el).filter(u.isVisible).length).toBe(1); // There should now be an open chatroom
                var view = _converse.chatboxviews.get('inverness@chat.shakespeare.lit');
                expect(view.el.querySelector('.chat-head-chatroom').textContent.trim()).toBe("Macbeth's Castle");
                done();
            }));

            it("shows the number of unread mentions received",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {'allow_bookmarks': false},
                    async function (done, _converse) {
                // XXX: we set `allow_bookmarks` to false, so that the groupchats
                // list gets rendered. Otherwise we would have to mock
                // the bookmark stanza exchange.

                test_utils.openControlBox();
                const roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                expect(roomspanel.el.querySelectorAll('.available-room').length).toBe(0);

                const room_jid = 'kitchen@conference.shakespeare.lit';
                const message = 'fires: Your attention is required';
                await test_utils.openAndEnterChatRoom(_converse, 'kitchen', 'conference.shakespeare.lit', 'fires');
                expect(roomspanel.el.querySelectorAll('.available-room').length).toBe(1);
                expect(roomspanel.el.querySelectorAll('.msgs-indicator').length).toBe(0);

                const view = _converse.chatboxviews.get(room_jid);
                view.model.set({'minimized': true});

                const contact_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@localhost';
                const nick = mock.chatroom_names[0];

                view.model.onMessage($msg({
                        from: room_jid+'/'+nick,
                        id: (new Date()).getTime(),
                        to: 'dummy@localhost',
                        type: 'groupchat'
                    }).c('body').t(message).tree());
                await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                await test_utils.waitUntil(() => view.model.messages.length);
                expect(roomspanel.el.querySelectorAll('.available-room').length).toBe(1);
                expect(roomspanel.el.querySelectorAll('.msgs-indicator').length).toBe(1);
                expect(roomspanel.el.querySelector('.msgs-indicator').textContent).toBe('1');

                view.model.onMessage($msg({
                    'from': room_jid+'/'+nick,
                    'id': (new Date()).getTime(),
                    'to': 'dummy@localhost',
                    'type': 'groupchat'
                }).c('body').t(message).tree());
                await test_utils.waitUntil(() => view.model.messages.length > 1);
                expect(roomspanel.el.querySelectorAll('.available-room').length).toBe(1);
                expect(roomspanel.el.querySelectorAll('.msgs-indicator').length).toBe(1);
                expect(roomspanel.el.querySelector('.msgs-indicator').textContent).toBe('2');
                view.model.set({'minimized': false});
                expect(roomspanel.el.querySelectorAll('.available-room').length).toBe(1);
                expect(roomspanel.el.querySelectorAll('.msgs-indicator').length).toBe(0);
                done();
            }));

            describe("A Chat Status Notification", function () {

                describe("A composing notification", function () {

                    it("will be shown if received",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            async function (done, _converse) {

                        const room_jid = 'coven@chat.shakespeare.lit';
                        await test_utils.openAndEnterChatRoom(_converse, 'coven', 'chat.shakespeare.lit', 'some1');
                        const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                        const chat_content = view.el.querySelector('.chat-content');

                        expect(sizzle('div.chat-info:first', chat_content).pop().textContent)
                            .toBe("some1 has entered the groupchat");

                        let presence = $pres({
                                to: 'dummy@localhost/_converse.js-29092160',
                                from: 'coven@chat.shakespeare.lit/newguy'
                            })
                            .c('x', {xmlns: Strophe.NS.MUC_USER})
                            .c('item', {
                                'affiliation': 'none',
                                'jid': 'newguy@localhost/_converse.js-290929789',
                                'role': 'participant'
                            });
                        _converse.connection._dataRecv(test_utils.createRequest(presence));
                        expect(chat_content.querySelectorAll('div.chat-info').length).toBe(2);
                        expect(sizzle('div.chat-info:last', chat_content).pop().textContent)
                            .toBe("newguy has entered the groupchat");

                        presence = $pres({
                                to: 'dummy@localhost/_converse.js-29092160',
                                from: 'coven@chat.shakespeare.lit/nomorenicks'
                            })
                            .c('x', {xmlns: Strophe.NS.MUC_USER})
                            .c('item', {
                                'affiliation': 'none',
                                'jid': 'nomorenicks@localhost/_converse.js-290929789',
                                'role': 'participant'
                            });
                        _converse.connection._dataRecv(test_utils.createRequest(presence));
                        expect(chat_content.querySelectorAll('div.chat-info').length).toBe(3);
                        expect(sizzle('div.chat-info:last', chat_content).pop().textContent)
                            .toBe("nomorenicks has entered the groupchat");

                        // See XEP-0085 http://xmpp.org/extensions/xep-0085.html#definitions

                        // <composing> state
                        var msg = $msg({
                                from: room_jid+'/newguy',
                                id: (new Date()).getTime(),
                                to: 'dummy@localhost',
                                type: 'groupchat'
                            }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();

                        view.model.onMessage(msg);
                        await test_utils.waitUntil(() => view.el.querySelectorAll('.chat-state-notification').length);

                        // Check that the notification appears inside the chatbox in the DOM
                        let events = view.el.querySelectorAll('.chat-event');
                        expect(events.length).toBe(3);
                        expect(events[0].textContent).toEqual('some1 has entered the groupchat');
                        expect(events[1].textContent).toEqual('newguy has entered the groupchat');
                        expect(events[2].textContent).toEqual('nomorenicks has entered the groupchat');

                        let notifications = view.el.querySelectorAll('.chat-state-notification');
                        expect(notifications.length).toBe(1);
                        expect(notifications[0].textContent).toEqual('newguy is typing');

                        const timeout_functions = [];
                        spyOn(window, 'setTimeout').and.callFake(function (func, delay) {
                            timeout_functions.push(func);
                        });

                        // Check that it doesn't appear twice
                        msg = $msg({
                                from: room_jid+'/newguy',
                                id: (new Date()).getTime(),
                                to: 'dummy@localhost',
                                type: 'groupchat'
                            }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        view.model.onMessage(msg);
                        await new Promise((resolve, reject) => view.once('messageInserted', resolve));

                        events = view.el.querySelectorAll('.chat-event');
                        expect(events.length).toBe(3);
                        expect(events[0].textContent).toEqual('some1 has entered the groupchat');
                        expect(events[1].textContent).toEqual('newguy has entered the groupchat');
                        expect(events[2].textContent).toEqual('nomorenicks has entered the groupchat');

                        notifications = view.el.querySelectorAll('.chat-state-notification');
                        expect(notifications.length).toBe(1);
                        expect(notifications[0].textContent).toEqual('newguy is typing');

                        expect(timeout_functions.length).toBe(1);

                        // <composing> state for a different occupant
                        msg = $msg({
                                from: room_jid+'/nomorenicks',
                                id: (new Date()).getTime(),
                                to: 'dummy@localhost',
                                type: 'groupchat'
                            }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        view.model.onMessage(msg);
                        await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                        events = view.el.querySelectorAll('.chat-event');
                        expect(events.length).toBe(3);
                        expect(events[0].textContent).toEqual('some1 has entered the groupchat');
                        expect(events[1].textContent).toEqual('newguy has entered the groupchat');
                        expect(events[2].textContent).toEqual('nomorenicks has entered the groupchat');

                        notifications = view.el.querySelectorAll('.chat-state-notification');
                        expect(notifications.length).toBe(2);
                        expect(notifications[0].textContent).toEqual('newguy is typing');
                        expect(notifications[1].textContent).toEqual('nomorenicks is typing');
                        expect(timeout_functions.length).toBe(2);

                        // Check that new messages appear under the chat state
                        // notifications
                        msg = $msg({
                            from: 'lounge@localhost/some1',
                            id: (new Date()).getTime(),
                            to: 'dummy@localhost',
                            type: 'groupchat'
                        }).c('body').t('hello world').tree();
                        view.model.onMessage(msg);
                        await new Promise((resolve, reject) => view.once('messageInserted', resolve));

                        const messages = view.el.querySelectorAll('.message');
                        expect(messages.length).toBe(7);
                        expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
                        expect(view.el.querySelector('.chat-msg .chat-msg__text').textContent).toBe('hello world');

                        // Test that the composing notifications get removed
                        // via timeout.
                        timeout_functions[0]();
                        events = view.el.querySelectorAll('.chat-event');
                        expect(events.length).toBe(3);
                        expect(events[0].textContent).toEqual('some1 has entered the groupchat');
                        expect(events[1].textContent).toEqual('newguy has entered the groupchat');
                        expect(events[2].textContent).toEqual('nomorenicks has entered the groupchat');

                        notifications = view.el.querySelectorAll('.chat-state-notification');
                        expect(notifications.length).toBe(1);
                        expect(notifications[0].textContent).toEqual('nomorenicks is typing');

                        timeout_functions[1]();
                        events = view.el.querySelectorAll('.chat-event');
                        expect(events.length).toBe(3);
                        expect(events[0].textContent).toEqual('some1 has entered the groupchat');
                        expect(events[1].textContent).toEqual('newguy has entered the groupchat');
                        expect(events[2].textContent).toEqual('nomorenicks has entered the groupchat');

                        notifications = view.el.querySelectorAll('.chat-state-notification');
                        expect(notifications.length).toBe(0);
                        done();
                    }));
                });

                describe("A paused notification", function () {
                    it("will be shown if received",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched', 'chatBoxViewsInitialized'], {},
                            async function (done, _converse) {

                        await test_utils.openChatRoom(_converse, "coven", 'chat.shakespeare.lit', 'some1');
                        const room_jid = 'coven@chat.shakespeare.lit';
                        const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                        const chat_content = view.el.querySelector('.chat-content');

                        /* <presence to="dummy@localhost/_converse.js-29092160"
                         *           from="coven@chat.shakespeare.lit/some1">
                         *      <x xmlns="http://jabber.org/protocol/muc#user">
                         *          <item affiliation="owner" jid="dummy@localhost/_converse.js-29092160" role="moderator"/>
                         *          <status code="110"/>
                         *      </x>
                         *  </presence></body>
                         */
                        let presence = $pres({
                                to: 'dummy@localhost/_converse.js-29092160',
                                from: 'coven@chat.shakespeare.lit/some1'
                            }).c('x', {xmlns: Strophe.NS.MUC_USER})
                            .c('item', {
                                'affiliation': 'owner',
                                'jid': 'dummy@localhost/_converse.js-29092160',
                                'role': 'moderator'
                            }).up()
                            .c('status', {code: '110'});
                        _converse.connection._dataRecv(test_utils.createRequest(presence));
                        await test_utils.waitUntil(() => sizzle('div.chat-info:first', chat_content).length);

                        expect(sizzle('div.chat-info:first', chat_content).pop().textContent)
                            .toBe("some1 has entered the groupchat");

                        presence = $pres({
                                to: 'dummy@localhost/_converse.js-29092160',
                                from: 'coven@chat.shakespeare.lit/newguy'
                            })
                            .c('x', {xmlns: Strophe.NS.MUC_USER})
                            .c('item', {
                                'affiliation': 'none',
                                'jid': 'newguy@localhost/_converse.js-290929789',
                                'role': 'participant'
                            });
                        _converse.connection._dataRecv(test_utils.createRequest(presence));
                        expect(chat_content.querySelectorAll('div.chat-info').length).toBe(2);
                        expect(sizzle('div.chat-info:last', chat_content).pop().textContent)
                            .toBe("newguy has entered the groupchat");

                        presence = $pres({
                                to: 'dummy@localhost/_converse.js-29092160',
                                from: 'coven@chat.shakespeare.lit/nomorenicks'
                            })
                            .c('x', {xmlns: Strophe.NS.MUC_USER})
                            .c('item', {
                                'affiliation': 'none',
                                'jid': 'nomorenicks@localhost/_converse.js-290929789',
                                'role': 'participant'
                            });
                        _converse.connection._dataRecv(test_utils.createRequest(presence));
                        expect(chat_content.querySelectorAll('div.chat-info').length).toBe(3);
                        expect(sizzle('div.chat-info:last', chat_content).pop().textContent)
                            .toBe("nomorenicks has entered the groupchat");

                        // See XEP-0085 http://xmpp.org/extensions/xep-0085.html#definitions

                        // <composing> state
                        var msg = $msg({
                                from: room_jid+'/newguy',
                                id: (new Date()).getTime(),
                                to: 'dummy@localhost',
                                type: 'groupchat'
                            }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        view.model.onMessage(msg);
                        await new Promise((resolve, reject) => view.once('messageInserted', resolve));

                        // Check that the notification appears inside the chatbox in the DOM
                        var events = view.el.querySelectorAll('.chat-event');
                        expect(events.length).toBe(3);
                        expect(events[0].textContent).toEqual('some1 has entered the groupchat');
                        expect(events[1].textContent).toEqual('newguy has entered the groupchat');
                        expect(events[2].textContent).toEqual('nomorenicks has entered the groupchat');

                        var notifications = view.el.querySelectorAll('.chat-state-notification');
                        expect(notifications.length).toBe(1);
                        expect(notifications[0].textContent).toEqual('newguy is typing');

                        // Check that it doesn't appear twice
                        msg = $msg({
                                from: room_jid+'/newguy',
                                id: (new Date()).getTime(),
                                to: 'dummy@localhost',
                                type: 'groupchat'
                            }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        view.model.onMessage(msg);
                        await new Promise((resolve, reject) => view.once('messageInserted', resolve));

                        events = view.el.querySelectorAll('.chat-event');
                        expect(events.length).toBe(3);
                        expect(events[0].textContent).toEqual('some1 has entered the groupchat');
                        expect(events[1].textContent).toEqual('newguy has entered the groupchat');
                        expect(events[2].textContent).toEqual('nomorenicks has entered the groupchat');

                        notifications = view.el.querySelectorAll('.chat-state-notification');
                        expect(notifications.length).toBe(1);
                        expect(notifications[0].textContent).toEqual('newguy is typing');

                        // <composing> state for a different occupant
                        msg = $msg({
                                from: room_jid+'/nomorenicks',
                                id: (new Date()).getTime(),
                                to: 'dummy@localhost',
                                type: 'groupchat'
                            }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        view.model.onMessage(msg);
                        await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                        events = view.el.querySelectorAll('.chat-event');
                        expect(events.length).toBe(3);
                        expect(events[0].textContent).toEqual('some1 has entered the groupchat');
                        expect(events[1].textContent).toEqual('newguy has entered the groupchat');
                        expect(events[2].textContent).toEqual('nomorenicks has entered the groupchat');

                        notifications = view.el.querySelectorAll('.chat-state-notification');
                        expect(notifications.length).toBe(2);
                        expect(notifications[0].textContent).toEqual('newguy is typing');
                        expect(notifications[1].textContent).toEqual('nomorenicks is typing');

                        // <paused> state from occupant who typed first
                        msg = $msg({
                                from: room_jid+'/newguy',
                                id: (new Date()).getTime(),
                                to: 'dummy@localhost',
                                type: 'groupchat'
                            }).c('body').c('paused', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        view.model.onMessage(msg);
                        await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                        events = view.el.querySelectorAll('.chat-event');
                        expect(events.length).toBe(3);
                        expect(events[0].textContent).toEqual('some1 has entered the groupchat');
                        expect(events[1].textContent).toEqual('newguy has entered the groupchat');
                        expect(events[2].textContent).toEqual('nomorenicks has entered the groupchat');

                        notifications = view.el.querySelectorAll('.chat-state-notification');
                        expect(notifications.length).toBe(2);
                        expect(notifications[0].textContent).toEqual('nomorenicks is typing');
                        expect(notifications[1].textContent).toEqual('newguy has stopped typing');
                        done();
                    }));
                });
            });
        });
    });
}));
