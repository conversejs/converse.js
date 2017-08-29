(function (root, factory) {
    define(["jquery.noconflict", "jasmine", "mock", "converse-core", "test-utils", "utils" ], factory);
} (this, function ($, jasmine, mock, converse, test_utils, utils) {
    var _ = converse.env._;
    var $pres = converse.env.$pres;
    var $iq = converse.env.$iq;
    var $msg = converse.env.$msg;
    var Strophe = converse.env.Strophe;
    var Promise = converse.env.Promise;

    return describe("ChatRooms", function () {
        describe("The \"rooms\" API", function () {

            it("has a method 'close' which closes rooms by JID or all rooms when called with no arguments",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                test_utils.openAndEnterChatRoom(_converse, 'leisure', 'localhost', 'dummy').then(function () {
                test_utils.openAndEnterChatRoom(_converse, 'news', 'localhost', 'dummy').then(function () {
                    expect(_converse.chatboxviews.get('lounge@localhost').$el.is(':visible')).toBeTruthy();
                    expect(_converse.chatboxviews.get('leisure@localhost').$el.is(':visible')).toBeTruthy();
                    expect(_converse.chatboxviews.get('news@localhost').$el.is(':visible')).toBeTruthy();

                    // XXX: bit of a cheat here. We want `cleanup()` to be
                    // called on the room. Either it's this or faking
                    // `sendPresence`.
                    _converse.connection.connected = false;

                    _converse.api.rooms.close('lounge@localhost');
                    expect(_converse.chatboxviews.get('lounge@localhost')).toBeUndefined();
                    expect(_converse.chatboxviews.get('leisure@localhost').$el.is(':visible')).toBeTruthy();
                    expect(_converse.chatboxviews.get('news@localhost').$el.is(':visible')).toBeTruthy();

                    _converse.api.rooms.close(['leisure@localhost', 'news@localhost']);
                    expect(_converse.chatboxviews.get('lounge@localhost')).toBeUndefined();
                    expect(_converse.chatboxviews.get('leisure@localhost')).toBeUndefined();
                    expect(_converse.chatboxviews.get('news@localhost')).toBeUndefined();

                    test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                    test_utils.openAndEnterChatRoom(_converse, 'leisure', 'localhost', 'dummy').then(function () {
                        expect(_converse.chatboxviews.get('lounge@localhost').$el.is(':visible')).toBeTruthy();
                        expect(_converse.chatboxviews.get('leisure@localhost').$el.is(':visible')).toBeTruthy();

                        _converse.api.rooms.close();
                        expect(_converse.chatboxviews.get('lounge@localhost')).toBeUndefined();
                        expect(_converse.chatboxviews.get('leisure@localhost')).toBeUndefined();
                        done();
                    });
                    });
                });
                });
                });
            }));

            it("has a method 'get' which returns a wrapped chat room (if it exists)",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                    }, 300)
                .then(function () {
                    test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                        var jid = 'lounge@localhost';
                        var room = _converse.api.rooms.get(jid);
                        expect(room instanceof Object).toBeTruthy();
                        expect(room.is_chatroom).toBeTruthy();
                        var chatroomview = _converse.chatboxviews.get(jid);
                        expect(chatroomview.$el.is(':visible')).toBeTruthy();
                        chatroomview.close();

                        // Test with mixed case
                        test_utils.openAndEnterChatRoom(_converse, 'Leisure', 'localhost', 'dummy').then(function () {
                            jid = 'Leisure@localhost';
                            room = _converse.api.rooms.get(jid);
                            expect(room instanceof Object).toBeTruthy();
                            chatroomview = _converse.chatboxviews.get(jid.toLowerCase());
                            expect(chatroomview.$el.is(':visible')).toBeTruthy();

                            jid = 'leisure@localhost';
                            room = _converse.api.rooms.get(jid);
                            expect(room instanceof Object).toBeTruthy();
                            chatroomview = _converse.chatboxviews.get(jid.toLowerCase());
                            expect(chatroomview.$el.is(':visible')).toBeTruthy();

                            jid = 'leiSure@localhost';
                            room = _converse.api.rooms.get(jid);
                            expect(room instanceof Object).toBeTruthy();
                            chatroomview = _converse.chatboxviews.get(jid.toLowerCase());
                            expect(chatroomview.$el.is(':visible')).toBeTruthy();
                            chatroomview.close();

                            // Non-existing room
                            jid = 'lounge2@localhost';
                            room = _converse.api.rooms.get(jid);
                            expect(typeof room === 'undefined').toBeTruthy();
                            done();
                        });
                    });
                });
            }));

            it("has a method 'open' which opens (optionally configures) and returns a wrapped chat box",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                // Mock 'getRoomFeatures', otherwise the room won't be
                // displayed as it waits first for the features to be returned
                // (when it's a new room being created).
                spyOn(_converse.ChatRoomView.prototype, 'getRoomFeatures').and.callFake(function () {
                    var deferred = new $.Deferred();
                    deferred.resolve();
                    return deferred.promise();
                });

                test_utils.createContacts(_converse, 'current');
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                }, 300).then(function () {
                    var jid = 'lounge@localhost';
                    var room = _converse.api.rooms.open(jid);
                    // Test on chat room that's not yet open
                    expect(room instanceof Object).toBeTruthy();
                    expect(room.is_chatroom).toBeTruthy();
                    var chatroomview = _converse.chatboxviews.get(jid);
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();

                    // Test again, now that the room exists.
                    room = _converse.api.rooms.open(jid);
                    expect(room instanceof Object).toBeTruthy();
                    expect(room.is_chatroom).toBeTruthy();
                    chatroomview = _converse.chatboxviews.get(jid);
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();

                    // Test with mixed case in JID
                    jid = 'Leisure@localhost';
                    room = _converse.api.rooms.open(jid);
                    expect(room instanceof Object).toBeTruthy();
                    chatroomview = _converse.chatboxviews.get(jid.toLowerCase());
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();

                    jid = 'leisure@localhost';
                    room = _converse.api.rooms.open(jid);
                    expect(room instanceof Object).toBeTruthy();
                    chatroomview = _converse.chatboxviews.get(jid.toLowerCase());
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();

                    jid = 'leiSure@localhost';
                    room = _converse.api.rooms.open(jid);
                    expect(room instanceof Object).toBeTruthy();
                    chatroomview = _converse.chatboxviews.get(jid.toLowerCase());
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();
                    chatroomview.close();

                    _converse.muc_instant_rooms = false;
                    var sent_IQ, IQ_id;
                    var sendIQ = _converse.connection.sendIQ;
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                        sent_IQ = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });
                    // Test with configuration
                    _converse.api.rooms.open('room@conference.example.org', {
                        'nick': 'some1',
                        'auto_configure': true,
                        'roomconfig': {
                            'changesubject': false,
                            'membersonly': true,
                            'persistentroom': true,
                            'publicroom': true,
                            'roomdesc': 'Welcome to this room',
                            'whois': 'anyone'
                        }
                    });

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
                        "<iq to='room@conference.example.org' type='get' xmlns='jabber:client' id='"+IQ_id+
                        "'><query xmlns='http://jabber.org/protocol/muc#owner'/></iq>"
                    );
                    _converse.connection._dataRecv(test_utils.createRequest($(
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
                       ' </iq>')[0]));

                    test_utils.waitUntil(function () {
                        return sent_IQ.toLocaleString() !==
                            "<iq to='room@conference.example.org' type='get' xmlns='jabber:client' id='"+IQ_id+
                            "'><query xmlns='http://jabber.org/protocol/muc#owner'/></iq>";
                    }, 300).then(function () {
                        var $sent_stanza = $(sent_IQ.toLocaleString());
                        expect($sent_stanza.find('field[var="muc#roomconfig_roomname"] value').text()).toBe('Room');
                        expect($sent_stanza.find('field[var="muc#roomconfig_roomdesc"] value').text()).toBe('Welcome to this room');
                        expect($sent_stanza.find('field[var="muc#roomconfig_persistentroom"] value').text()).toBe('1');
                        expect($sent_stanza.find('field[var="muc#roomconfig_publicroom"] value ').text()).toBe('1');
                        expect($sent_stanza.find('field[var="muc#roomconfig_changesubject"] value').text()).toBe('0');
                        expect($sent_stanza.find('field[var="muc#roomconfig_whois"] value ').text()).toBe('anyone');
                        expect($sent_stanza.find('field[var="muc#roomconfig_membersonly"] value').text()).toBe('1');
                        expect($sent_stanza.find('field[var="muc#roomconfig_historylength"] value').text()).toBe('20');
                        done();
                    });
                });
            }));
        });

        describe("An instant chat room", function () {
            it("will be created when muc_instant_rooms is set to true",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var sent_IQ, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                /* <iq from="jordie.langen@chat.example.org/converse.js-11659299" to="myroom@conference.chat.example.org" type="get">
                 *     <query xmlns="http://jabber.org/protocol/disco#info"/>
                 * </iq>
                 * <iq xmlns="jabber:client" type="error" to="jordie.langen@chat.example.org/converse.js-11659299" from="myroom@conference.chat.example.org">
                 *     <error type="cancel">
                 *         <item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                 *     </error>
                 * </iq>
                 */
                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                // We pretend this is a new room, so no disco info is returned.
                var features_stanza = $iq({
                        from: 'lounge@localhost',
                        'id': IQ_id,
                        'to': 'dummy@localhost/desktop',
                        'type': 'error'
                    }).c('error', {'type': 'cancel'})
                        .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                var view = _converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'join').and.callThrough();

                /* <iq to="myroom@conference.chat.example.org"
                 *     from="jordie.langen@chat.example.org/converse.js-11659299"
                 *     type="get">
                 *   <query xmlns="http://jabber.org/protocol/disco#info"
                 *          node="x-roomuser-item"/>
                 * </iq>
                 */
                test_utils.waitUntil(function () {
                    return sent_IQ.toLocaleString() ===
                        "<iq to='lounge@localhost' from='dummy@localhost/resource' "+
                            "type='get' xmlns='jabber:client' id='"+IQ_id+"'>"+
                                "<query xmlns='http://jabber.org/protocol/disco#info' node='x-roomuser-item'/></iq>"
                }, 300).then(function () {
                    /* *  <iq xmlns="jabber:client" type="error" to="jordie.langen@chat.example.org/converse.js-11659299" from="myroom@conference.chat.example.org">
                     *      <error type="cancel">
                     *          <item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                     *      </error>
                     *  </iq>
                     */
                    var stanza = $iq({
                        'type': 'error',
                        'id': IQ_id,
                        'from': view.model.get('jid'),
                        'to': _converse.connection.jid
                    }).c('error', {'type': 'cancel'})
                    .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    // TODO: enter nickname
                    var $input = view.$el.find('input.new-chatroom-nick');
                    $input.val('nicky').parents('form').submit();

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
                    var info_text = view.$el.find('.chat-content .chat-info').text();
                    expect(info_text).toBe('A new room has been created');

                    // An instant room is created by saving the default configuratoin.
                    //
                    /* <iq to="myroom@conference.chat.example.org" type="set" xmlns="jabber:client" id="5025e055-036c-4bc5-a227-706e7e352053:sendIQ">
                    *   <query xmlns="http://jabber.org/protocol/muc#owner"><x xmlns="jabber:x:data" type="submit"/></query>
                    * </iq>
                    */
                    expect(sent_IQ.toLocaleString()).toBe(
                        "<iq to='lounge@localhost' type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                            "<query xmlns='http://jabber.org/protocol/muc#owner'><x xmlns='jabber:x:data' type='submit'/>"+
                        "</query></iq>");
                    done();
                });
            }));
        });

        describe("A Chat Room", function () {

            it("shows join/leave messages when users enter or exit a room",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openChatRoom(_converse, "coven", 'chat.shakespeare.lit', 'some1');
                var view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                var $chat_content = view.$el.find('.chat-content');

                /* We don't show join/leave messages for existing occupants. We
                 * know about them because we receive their presences before we
                 * receive our own.
                 */
                presence = $pres({
                        to: 'dummy@localhost/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/oldguy'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'oldguy@localhost/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect($chat_content.find('div.chat-info').length).toBe(0);

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
                        'jid': 'dummy@localhost/_converse.js-29092160',
                        'role': 'moderator'
                    }).up()
                    .c('status', {code: '110'});
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect($chat_content.find('div.chat-info:first').html()).toBe("some1 has joined the room.");

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
                expect($chat_content.find('div.chat-info').length).toBe(2);
                expect($chat_content.find('div.chat-info:last').html()).toBe("newguy has joined the room.");

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
                expect($chat_content.find('div.chat-info').length).toBe(2);

                presence = $pres({
                        to: 'dummy@localhost/_converse.js-29092160',
                        type: 'unavailable',
                        from: 'coven@chat.shakespeare.lit/newguy'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'newguy@localhost/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect($chat_content.find('div.chat-info').length).toBe(3);
                expect($chat_content.find('div.chat-info:last').html()).toBe("newguy has left the room");
                done();
            }));

            it("shows its description in the chat heading",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var sent_IQ, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                var view = _converse.api.rooms.open('coven@chat.shakespeare.lit', {'nick': 'some1'});

                spyOn(view, 'generateHeadingHTML').and.callThrough();
                var features_stanza = $iq({
                        from: 'coven@chat.shakespeare.lit',
                        'id': IQ_id,
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

                expect(view.generateHeadingHTML).toHaveBeenCalled();
                expect(view.$('.chatroom-description').text()).toBe('This is the description');
                done();
            }));

            it("will specially mark messages in which you are mentioned",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    if (!view.$el.find('.chat-area').length) { view.renderChatArea(); }
                    var message = 'dummy: Your attention is required';
                    var nick = mock.chatroom_names[0],
                        msg = $msg({
                            from: 'lounge@localhost/'+nick,
                            id: (new Date()).getTime(),
                            to: 'dummy@localhost',
                            type: 'groupchat'
                        }).c('body').t(message).tree();
                    view.handleMUCMessage(msg);
                    expect(view.$el.find('.chat-message').hasClass('mentioned')).toBeTruthy();
                    done();
                });
            }));

            it("supports the /me command",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    if (!view.$el.find('.chat-area').length) { view.renderChatArea(); }
                    var message = '/me is tired';
                    var nick = mock.chatroom_names[0],
                        msg = $msg({
                            from: 'lounge@localhost/'+nick,
                            id: (new Date()).getTime(),
                            to: 'dummy@localhost',
                            type: 'groupchat'
                        }).c('body').t(message).tree();
                    view.handleMUCMessage(msg);
                    expect(_.includes(view.$el.find('.chat-msg-author').text(), '**Dyon van de Wege')).toBeTruthy();
                    expect(view.$el.find('.chat-msg-content').text()).toBe(' is tired');

                    message = '/me is as well';
                    msg = $msg({
                        from: 'lounge@localhost/dummy',
                        id: (new Date()).getTime(),
                        to: 'dummy@localhost',
                        type: 'groupchat'
                    }).c('body').t(message).tree();
                    view.handleMUCMessage(msg);
                    expect(_.includes(view.$el.find('.chat-msg-author:last').text(), '**Max Mustermann')).toBeTruthy();
                    expect(view.$el.find('.chat-msg-content:last').text()).toBe(' is as well');
                    done();
                });
            }));

            it("can have spaces and special characters in its name",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openChatRoom(_converse, 'lounge & leisure', 'localhost', 'dummy');
                var view = _converse.chatboxviews.get(
                        Strophe.escapeNode('lounge & leisure')+'@localhost');
                expect(view instanceof _converse.ChatRoomView).toBe(true);
                done();
            }));

            it("can be configured if you're its owner",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var view;
                var sent_IQ, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                _converse.api.rooms.open('coven@chat.shakespeare.lit', {'nick': 'some1'});
                view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                spyOn(view, 'saveAffiliationAndRole').and.callThrough();

                // We pretend this is a new room, so no disco info is returned.
                var features_stanza = $iq({
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
                var presence = $pres({
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
                expect(view.saveAffiliationAndRole).toHaveBeenCalled();
                expect(view.$('.configure-chatroom-button').is(':visible')).toBeTruthy();
                expect(view.$('.toggle-chatbox-button').is(':visible')).toBeTruthy();
                expect(view.$('.toggle-bookmark').is(':visible')).toBeTruthy();
                view.$('.configure-chatroom-button').click();

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
                    "<iq to='coven@chat.shakespeare.lit' type='get' xmlns='jabber:client' id='"+IQ_id+"'>"+
                        "<query xmlns='http://jabber.org/protocol/muc#owner'/>"+
                    "</iq>");

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
                            .c('value').t('If a password is required to enter this room,'+
                                        'you must specify the password below.').up().up()
                        .c('field', {
                            'label': 'Password',
                            'type': 'text-private',
                            'var': 'muc#roomconfig_roomsecret'})
                            .c('value').t('cauldronburn');
                _converse.connection._dataRecv(test_utils.createRequest(config_stanza));

                test_utils.waitUntil(function () {
                    return view.$('form.chatroom-form').length;
                }, 300).then(function () {
                    expect(view.$('form.chatroom-form').length).toBe(1);
                    expect(view.$('form.chatroom-form fieldset').length).toBe(2);
                    var $membersonly = view.$('input[name="muc#roomconfig_membersonly"]');
                    expect($membersonly.length).toBe(1);
                    expect($membersonly.attr('type')).toBe('checkbox');
                    $membersonly.prop('checked', true);

                    var $moderated = view.$('input[name="muc#roomconfig_moderatedroom"]');
                    expect($moderated.length).toBe(1);
                    expect($moderated.attr('type')).toBe('checkbox');
                    $moderated.prop('checked', true);

                    var $password = view.$('input[name="muc#roomconfig_roomsecret"]');
                    expect($password.length).toBe(1);
                    expect($password.attr('type')).toBe('password');

                    var $allowpm = view.$('select[name="muc#roomconfig_allowpm"]');
                    expect($allowpm.length).toBe(1);
                    $allowpm.val('moderators');

                    var $presencebroadcast = view.$('select[name="muc#roomconfig_presencebroadcast"]');
                    expect($presencebroadcast.length).toBe(1);
                    $presencebroadcast.val(['moderator']);

                    view.$('input[type="submit"]').click();

                    var $sent_stanza = $(sent_IQ.toLocaleString());
                    expect($sent_stanza.find('field[var="muc#roomconfig_membersonly"] value').text()).toBe('1');
                    expect($sent_stanza.find('field[var="muc#roomconfig_moderatedroom"] value').text()).toBe('1');
                    expect($sent_stanza.find('field[var="muc#roomconfig_allowpm"] value').text()).toBe('moderators');
                    expect($sent_stanza.find('field[var="muc#roomconfig_presencebroadcast"] value').text()).toBe('moderator');
                    done();
                });
            }));

            it("shows users currently present in the room",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function() {
                    var name;
                    var view = _converse.chatboxviews.get('lounge@localhost'),
                        $occupants = view.$('.occupant-list');
                    var presence, role;
                    for (var i=0; i<mock.chatroom_names.length; i++) {
                        name = mock.chatroom_names[i];
                        role = mock.chatroom_roles[name].role;
                        // See example 21 http://xmpp.org/extensions/xep-0045.html#enter-pres
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
                        expect($occupants.find('li').length).toBe(2+i);
                        expect($($occupants.find('li')[i+1]).text()).toBe(mock.chatroom_names[i]);
                        expect($($occupants.find('li')[i+1]).hasClass('moderator')).toBe(role === "moderator");
                    }

                    // Test users leaving the room
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
                        expect($occupants.find('li').length).toBe(i+1);
                    }
                    done();
                });
            }));

            it("escapes occupant nicknames when rendering them, to avoid JS-injection attacks",
                mock.initConverseWithPromises(null, ['rosterGroupsFetched'], {}, function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                    /* <presence xmlns="jabber:client" to="jc@chat.example.org/converse.js-17184538"
                    *      from="oo@conference.chat.example.org/&lt;img src=&quot;x&quot; onerror=&quot;alert(123)&quot;/&gt;">
                    *   <x xmlns="http://jabber.org/protocol/muc#user">
                    *    <item jid="jc@chat.example.org/converse.js-17184538" affiliation="owner" role="moderator"/>
                    *    <status code="110"/>
                    *   </x>
                    * </presence>"
                    */
                    var presence = $pres({
                            to:'dummy@localhost/pda',
                            from:"lounge@localhost/&lt;img src=&quot;x&quot; onerror=&quot;alert(123)&quot;/&gt;"
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        jid: 'someone@localhost',
                        role: 'moderator',
                    }).up()
                    .c('status').attrs({code:'110'}).nodeTree;

                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    var occupant = view.$el.find('.occupant-list').find('li');
                    expect(occupant.length).toBe(2);
                    expect($(occupant).last().text()).toBe("&lt;img src=&quot;x&quot; onerror=&quot;alert(123)&quot;/&gt;");
                    done();
                });
            }));

            it("indicates moderators by means of a special css class and tooltip",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
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
                    var occupant = view.$el.find('.occupant-list').find('li');
                    expect(occupant.length).toBe(2);
                    expect($(occupant).first().text()).toBe("dummy");
                    expect($(occupant).last().text()).toBe("moderatorman");
                    expect($(occupant).last().attr('class').indexOf('moderator')).not.toBe(-1);
                    expect($(occupant).last().attr('title')).toBe(contact_jid + ' This user is a moderator. Click to mention moderatorman in your message.');
                    done();
                });
            }));

            it("will use the user's reserved nickname, if it exists",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var sent_IQ, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');

                // We pretend this is a new room, so no disco info is returned.
                var features_stanza = $iq({
                        from: 'lounge@localhost',
                        'id': IQ_id,
                        'to': 'dummy@localhost/desktop',
                        'type': 'error'
                    }).c('error', {'type': 'cancel'})
                        .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                var view = _converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'join').and.callThrough();

                /* <iq from='hag66@shakespeare.lit/pda'
                 *     id='getnick1'
                 *     to='coven@chat.shakespeare.lit'
                 *     type='get'>
                 * <query xmlns='http://jabber.org/protocol/disco#info'
                 *         node='x-roomuser-item'/>
                 * </iq>
                 */

                test_utils.waitUntil(function () {
                    return sent_IQ.toLocaleString() ===
                        "<iq to='lounge@localhost' from='dummy@localhost/resource' "+
                            "type='get' xmlns='jabber:client' id='"+IQ_id+"'>"+
                                "<query xmlns='http://jabber.org/protocol/disco#info' node='x-roomuser-item'/></iq>";
                }, 300).then(function () {
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
                    var stanza = $iq({
                        'type': 'result',
                        'id': IQ_id,
                        'from': view.model.get('jid'),
                        'to': _converse.connection.jid
                    }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#info', 'node': 'x-roomuser-item'})
                    .c('identity', {'category': 'conference', 'name': 'thirdwitch', 'type': 'text'});
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    expect(view.join).toHaveBeenCalled();

                    // The user has just entered the room (because join was called)
                    // and receives their own presence from the server.
                    // See example 24:
                    // http://xmpp.org/extensions/xep-0045.html#enter-pres
                    var presence = $pres({
                            to:'dummy@localhost/resource',
                            from:'lounge@localhost/thirdwitch',
                            id:'DC352437-C019-40EC-B590-AF29E879AF97'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'member',
                        jid: 'dummy@localhost/resource',
                        role: 'occupant'
                    }).up()
                    .c('status').attrs({code:'110'}).up()
                    .c('status').attrs({code:'210'}).nodeTree;

                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    var info_text = view.$el.find('.chat-content .chat-info').text();
                    expect(info_text).toBe('Your nickname has been automatically set to: thirdwitch');
                    done();
                });
            }));

            it("allows the user to invite their roster contacts to enter the chat room",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                test_utils.createContacts(_converse, 'current'); // We need roster contacts, so that we have someone to invite
                // Since we don't actually fetch roster contacts, we need to
                // cheat here and emit the event.
                _converse.emit('rosterContactsFetched');

                spyOn(_converse, 'emit');
                spyOn(window, 'prompt').and.callFake(function () {
                    return "Please join!";
                });
                var view = _converse.chatboxviews.get('lounge@localhost');

                // XXX: cheating a lttle bit, normally this'll be set after
                // receiving the features for the room.
                view.model.set('open', 'true');

                spyOn(view, 'directInvite').and.callThrough();
                var $input;
                view.$el.find('.chat-area').remove();

                test_utils.waitUntil(function () {
                        return view.$el.find('input.invited-contact').length;
                }, 300).then(function () {
                    var $input = view.$el.find('input.invited-contact');
                    expect($input.attr('placeholder')).toBe('Invite');
                    $input.val("Felix");
                    var evt;
                    // check if Event() is a constructor function
                    // usage as per the spec, if true
                    if (typeof(Event) === 'function') {
                        evt = new Event('input');
                    } else { // the deprecated way for PhantomJS
                        evt = document.createEvent('CustomEvent');
                        evt.initCustomEvent('input', false, false, null);
                    }
                    $input[0].dispatchEvent(evt);

                    var sent_stanza;
                    spyOn(_converse.connection, 'send').and.callFake(function (stanza) {
                        sent_stanza = stanza;
                    });
                    var $hint = $input.siblings('ul').children('li');
                    expect($input.val()).toBe('Felix');
                    expect($hint[0].textContent).toBe('Felix Amsel');
                    expect($hint.length).toBe(1);

                    if (typeof(Event) === 'function') {
                        // Not working on PhantomJS
                        evt = new Event('mousedown', {'bubbles': true});
                        evt.button = 0; // For some reason awesomplete wants this
                        $hint[0].dispatchEvent(evt);
                        expect(window.prompt).toHaveBeenCalled();
                        expect(view.directInvite).toHaveBeenCalled();
                        expect(sent_stanza.toLocaleString()).toBe(
                            "<message from='dummy@localhost/resource' to='felix.amsel@localhost' id='" +
                                    sent_stanza.nodeTree.getAttribute('id') +
                                    "' xmlns='jabber:client'>"+
                                "<x xmlns='jabber:x:conference' jid='lounge@localhost' reason='Please join!'/>"+
                            "</message>"
                        );
                    }
                    done();
                });
            }));

            it("can be joined automatically, based upon a received invite",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current'); // We need roster contacts, who can invite us
                spyOn(window, 'confirm').and.callFake(function () {
                    return true;
                });
                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    view.close(); // Hack, otherwise we have to mock stanzas.

                    var name = mock.cur_names[0];
                    var from_jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                    var room_jid = 'lounge@localhost';
                    var reason = "Please join this chat room";
                    var message = $(
                        "<message from='"+from_jid+"' to='"+_converse.bare_jid+"'>" +
                            "<x xmlns='jabber:x:conference'" +
                                "jid='"+room_jid+"'" +
                                "reason='"+reason+"'/>"+
                        "</message>"
                    )[0];
                    expect(_converse.chatboxes.models.length).toBe(1);
                    expect(_converse.chatboxes.models[0].id).toBe("controlbox");
                    _converse.onDirectMUCInvitation(message);
                    expect(window.confirm).toHaveBeenCalledWith(
                        name + ' has invited you to join a chat room: '+ room_jid +
                        ', and left the following reason: "'+reason+'"');
                    expect(_converse.chatboxes.models.length).toBe(2);
                    expect(_converse.chatboxes.models[0].id).toBe('controlbox');
                    expect(_converse.chatboxes.models[1].id).toBe(room_jid);
                    done();
                });
            }));

            it("shows received groupchat messages",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                spyOn(_converse, 'emit');
                var view = _converse.chatboxviews.get('lounge@localhost');
                if (!view.$el.find('.chat-area').length) { view.renderChatArea(); }
                var nick = mock.chatroom_names[0];
                var text = 'This is a received message';
                var message = $msg({
                    from: 'lounge@localhost/'+nick,
                    id: '1',
                    to: 'dummy@localhost',
                    type: 'groupchat'
                }).c('body').t(text);
                view.onChatRoomMessage(message.nodeTree);
                var $chat_content = view.$el.find('.chat-content');
                expect($chat_content.find('.chat-message').length).toBe(1);
                expect($chat_content.find('.chat-msg-content').text()).toBe(text);
                expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                done();
            }));

            it("shows sent groupchat messages",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                    spyOn(_converse, 'emit');
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    if (!view.$el.find('.chat-area').length) { view.renderChatArea(); }
                    var text = 'This is a sent message';
                    view.$el.find('.chat-textarea').text(text);
                    view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                    expect(_converse.emit).toHaveBeenCalledWith('messageSend', text);
                    var $chat_content = view.$el.find('.chat-content');
                    expect($chat_content.find('.chat-message').length).toBe(1);

                    // Let's check that if we receive the same message again, it's
                    // not shown.
                    var message = $msg({
                        from: 'lounge@localhost/dummy',
                        to: 'dummy@localhost.com',
                        type: 'groupchat',
                        id: view.model.messages.at(0).get('msgid')
                    }).c('body').t(text);
                    view.onChatRoomMessage(message.nodeTree);
                    expect($chat_content.find('.chat-message').length).toBe(1);
                    expect($chat_content.find('.chat-msg-content').last().text()).toBe(text);
                    // We don't emit an event if it's our own message
                    expect(_converse.emit.calls.count(), 1);
                    done();
                });
            }));

            it("will cause the chat area to be scrolled down only if it was at the bottom already",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var message = 'This message is received while the chat area is scrolled up';
                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    spyOn(view, 'scrollDown').and.callThrough();
                    /* Create enough messages so that there's a
                    * scrollbar.
                    */
                    for (var i=0; i<20; i++) {
                        view.handleMUCMessage(
                            $msg({
                                from: 'lounge@localhost/someone',
                                to: 'dummy@localhost.com',
                                type: 'groupchat',
                                id: (new Date()).getTime(),
                            }).c('body').t('Message: '+i).tree());
                    }
                    // Give enough time for `markScrolled` to have been called
                    setTimeout(function () {
                        view.$content.scrollTop(0);
                        view.handleMUCMessage(
                            $msg({
                                from: 'lounge@localhost/someone',
                                to: 'dummy@localhost.com',
                                type: 'groupchat',
                                id: (new Date()).getTime(),
                            }).c('body').t(message).tree());

                        // Now check that the message appears inside the chatbox in the DOM
                        var $chat_content = view.$el.find('.chat-content');
                        var msg_txt = $chat_content.find('.chat-message:last').find('.chat-msg-content').text();
                        expect(msg_txt).toEqual(message);
                        expect(view.$content.scrollTop()).toBe(0);
                        done();
                    }, 500);
                });
            }));

            it("shows received chatroom subject messages",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'jdev', 'conference.jabber.org', 'jc').then(function () {
                    var text = 'Jabber/XMPP Development | RFCs and Extensions: http://xmpp.org/ | Protocol and XSF discussions: xsf@muc.xmpp.org';
                    var stanza = Strophe.xmlHtmlNode(
                        '<message xmlns="jabber:client" to="jc@opkode.com/_converse.js-60429116" type="groupchat" from="jdev@conference.jabber.org/ralphm">'+
                        '    <subject>'+text+'</subject>'+
                        '    <delay xmlns="urn:xmpp:delay" stamp="2014-02-04T09:35:39Z" from="jdev@conference.jabber.org"/>'+
                        '    <x xmlns="jabber:x:delay" stamp="20140204T09:35:39" from="jdev@conference.jabber.org"/>'+
                        '</message>').firstChild;
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));
                    var view = _converse.chatboxviews.get('jdev@conference.jabber.org');
                    var $chat_content = view.$el.find('.chat-content');
                    expect($chat_content.find('.chat-info:last').text()).toBe('Topic set by ralphm to: '+text);
                    done();
                });
            }));

            it("escapes the subject before rendering it, to avoid JS-injection attacks",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'jdev', 'conference.jabber.org', 'jc').then(function () {
                    spyOn(window, 'alert');
                    var subject = '<img src="x" onerror="alert(\'XSS\');"/>';
                    var view = _converse.chatboxviews.get('jdev@conference.jabber.org');
                    view.setChatRoomSubject('ralphm', subject);
                    var $chat_content = view.$el.find('.chat-content');
                    expect($chat_content.find('.chat-info:last').text()).toBe('Topic set by ralphm to: '+subject);
                    done();
                });
            }));

            it("informs users if their nicknames has been changed.",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

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
                 *          role='occupant'/>
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
                 *          role='occupant'/>
                 *      <status code='110'/>
                 *  </x>
                 *  </presence>
                 */
                var __ = utils.__.bind(_converse);
                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'oldnick').then(function () {
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    var $chat_content = view.$el.find('.chat-content');

                    // The user has just entered the room and receives their own
                    // presence from the server.
                    // See example 24:
                    // http://xmpp.org/extensions/xep-0045.html#enter-pres
                    var presence = $pres({
                            to:'dummy@localhost/pda',
                            from:'lounge@localhost/oldnick',
                            id:'DC352437-C019-40EC-B590-AF29E879AF97'
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                    .c('item').attrs({
                        affiliation: 'member',
                        jid: 'dummy@localhost/pda',
                        role: 'occupant'
                    }).up()
                    .c('status').attrs({code:'110'}).up()
                    .c('status').attrs({code:'210'}).nodeTree;

                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    var $occupants = view.$('.occupant-list');
                    expect($occupants.children().length).toBe(1);
                    expect($occupants.children().first(0).text()).toBe("oldnick");

                    expect($chat_content.find('div.chat-info').length).toBe(2);
                    expect($chat_content.find('div.chat-info:first').html()).toBe("oldnick has joined the room.");
                    expect($chat_content.find('div.chat-info:last').html()).toBe(__(_converse.muc.new_nickname_messages["210"], "oldnick"));

                    presence = $pres().attrs({
                            from:'lounge@localhost/oldnick',
                            id:'DC352437-C019-40EC-B590-AF29E879AF98',
                            to:'dummy@localhost/pda',
                            type:'unavailable'
                        })
                        .c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                        .c('item').attrs({
                            affiliation: 'member',
                            jid: 'dummy@localhost/pda',
                            nick: 'newnick',
                            role: 'occupant'
                        }).up()
                        .c('status').attrs({code:'303'}).up()
                        .c('status').attrs({code:'110'}).nodeTree;

                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect($chat_content.find('div.chat-info').length).toBe(3);
                    expect($chat_content.find('div.chat-info').last().html()).toBe(
                        __(_converse.muc.new_nickname_messages["303"], "newnick"));

                    $occupants = view.$('.occupant-list');
                    expect($occupants.children().length).toBe(0);

                    presence = $pres().attrs({
                            from:'lounge@localhost/newnick',
                            id:'5B4F27A4-25ED-43F7-A699-382C6B4AFC67',
                            to:'dummy@localhost/pda'
                        })
                        .c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                        .c('item').attrs({
                            affiliation: 'member',
                            jid: 'dummy@localhost/pda',
                            role: 'occupant'
                        }).up()
                        .c('status').attrs({code:'110'}).nodeTree;

                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect($chat_content.find('div.chat-info').length).toBe(4);
                    expect($chat_content.find('div.chat-info').get(2).textContent).toBe(
                        __(_converse.muc.new_nickname_messages["303"], "newnick"));
                    expect($chat_content.find('div.chat-info').last().html()).toBe(
                        "newnick has joined the room.");
                    $occupants = view.$('.occupant-list');
                    expect($occupants.children().length).toBe(1);
                    expect($occupants.children().first(0).text()).toBe("newnick");
                    done();
                });
            }));

            it("queries for the room information before attempting to join the user",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var sent_IQ, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                _converse.api.rooms.open('coven@chat.shakespeare.lit', {'nick': 'some1'});

                // Check that the room queried for the feautures.
                expect(sent_IQ.toLocaleString()).toBe(
                    "<iq from='dummy@localhost/resource' to='coven@chat.shakespeare.lit' type='get' xmlns='jabber:client' id='"+IQ_id+"'>"+
                        "<query xmlns='http://jabber.org/protocol/disco#info'/>"+
                    "</iq>");

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
                var features_stanza = $iq({
                        from: 'coven@chat.shakespeare.lit',
                        'id': IQ_id,
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

                var view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                expect(view.model.get('features_fetched')).toBe(true);
                expect(view.model.get('passwordprotected')).toBe(true);
                expect(view.model.get('hidden')).toBe(true);
                expect(view.model.get('temporary')).toBe(true);
                expect(view.model.get('open')).toBe(true);
                expect(view.model.get('unmoderated')).toBe(true);
                expect(view.model.get('nonanonymous')).toBe(true);
                done();
            }));

            it("updates the shown features when the room configuration has changed",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var sent_IQ, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                test_utils.openAndEnterChatRoom(_converse, 'room', 'conference.example.org', 'dummy').then(function () {
                    var view = _converse.chatboxviews.get('room@conference.example.org');
                    view.model.set({
                        'passwordprotected': false,
                        'unsecured': true,
                        'hidden': false,
                        'public': true,
                        'membersonly': false,
                        'open': true,
                        'persistent': false,
                        'temporary': true,
                        'nonanonymous': true,
                        'semianonymous': false,
                        'moderated': false,
                        'unmoderated': true
                    });
                    expect(view.model.get('persistent')).toBe(false);
                    expect(view.model.get('temporary')).toBe(true);
                    view.model.set({'persistent': true});
                    expect(view.model.get('persistent')).toBe(true);
                    expect(view.model.get('temporary')).toBe(false);

                    expect(view.model.get('unsecured')).toBe(true);
                    expect(view.model.get('passwordprotected')).toBe(false);
                    view.model.set({'passwordprotected': true});
                    expect(view.model.get('unsecured')).toBe(false);
                    expect(view.model.get('passwordprotected')).toBe(true);

                    expect(view.model.get('unmoderated')).toBe(true);
                    expect(view.model.get('moderated')).toBe(false);
                    view.model.set({'moderated': true});
                    expect(view.model.get('unmoderated')).toBe(false);
                    expect(view.model.get('moderated')).toBe(true);

                    expect(view.model.get('nonanonymous')).toBe(true);
                    expect(view.model.get('semianonymous')).toBe(false);
                    view.model.set({'nonanonymous': false});
                    expect(view.model.get('nonanonymous')).toBe(false);
                    expect(view.model.get('semianonymous')).toBe(true);

                    expect(view.model.get('open')).toBe(true);
                    expect(view.model.get('membersonly')).toBe(false);
                    view.model.set({'membersonly': true});
                    expect(view.model.get('open')).toBe(false);
                    expect(view.model.get('membersonly')).toBe(true);
                    done();
                });
            }));

            it("indicates when a room is no longer anonymous",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var sent_IQ, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                _converse.api.rooms.open('coven@chat.shakespeare.lit', {'nick': 'some1'});

                // We pretend this is a new room, so no disco info is returned.
                var features_stanza = $iq({
                        from: 'coven@chat.shakespeare.lit',
                        'id': IQ_id,
                        'to': 'dummy@localhost/desktop',
                        'type': 'error'
                    }).c('error', {'type': 'cancel'})
                        .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                var view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
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
                var message = $msg({
                        type:'groupchat',
                        to: 'dummy@localhost/_converse.js-27854181',
                        from: 'coven@chat.shakespeare.lit'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                      .c('status', {code: '104'}).up()
                      .c('status', {code: '172'});
                _converse.connection._dataRecv(test_utils.createRequest(message));
                var $chat_body = view.$('.chatroom-body');
                expect($chat_body.html().trim().indexOf(
                    '<div class="chat-info">This room is now no longer anonymous</div>'
                )).not.toBe(-1);
                done();
            }));

            it("informs users if they have been kicked out of the chat room",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

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
                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
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

                    var view = _converse.chatboxviews.get('lounge@localhost');
                    view.onChatRoomPresence(presence);
                    expect(view.$('.chat-area').is(':visible')).toBeFalsy();
                    expect(view.$('.occupants').is(':visible')).toBeFalsy();
                    var $chat_body = view.$('.chatroom-body');
                    expect($chat_body.find('.disconnect-msg').text()).toBe(
                        'You have been kicked from this room'+
                        'This action was done by Fluellen.'+
                        'The reason given is: "Avaunt, you cullion!".'
                    );
                    done();
                });
            }));

            it("can be saved to, and retrieved from, browserStorage",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                // We instantiate a new ChatBoxes collection, which by default
                // will be empty.
                test_utils.openControlBox();
                var newchatboxes = new _converse.ChatBoxes();
                expect(newchatboxes.length).toEqual(0);
                // The chatboxes will then be fetched from browserStorage inside the
                // onConnected method
                newchatboxes.onConnected();
                expect(newchatboxes.length).toEqual(2);
                // Check that the chatrooms retrieved from browserStorage
                // have the same attributes values as the original ones.
                var attrs = ['id', 'box_id', 'visible'];
                var new_attrs, old_attrs;
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
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                var view = _converse.chatboxviews.get('lounge@localhost'),
                    trimmed_chatboxes = _converse.minimized_chats;

                spyOn(view, 'minimize').and.callThrough();
                spyOn(view, 'maximize').and.callThrough();
                spyOn(_converse, 'emit');
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                view.$el.find('.toggle-chatbox-button').click();

                expect(view.minimize).toHaveBeenCalled();
                expect(_converse.emit).toHaveBeenCalledWith('chatBoxMinimized', jasmine.any(Object));
                expect(view.$el.is(':visible')).toBeFalsy();
                expect(view.model.get('minimized')).toBeTruthy();
                expect(view.minimize).toHaveBeenCalled();
                var trimmedview = trimmed_chatboxes.get(view.model.get('id'));
                trimmedview.$("a.restore-chat").click();
                expect(view.maximize).toHaveBeenCalled();
                expect(_converse.emit).toHaveBeenCalledWith('chatBoxMaximized', jasmine.any(Object));
                expect(view.model.get('minimized')).toBeFalsy();
                expect(_converse.emit.calls.count(), 3);
                done();
            }));

            it("can be closed again by clicking a DOM element with class 'close-chatbox-button'",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                var view = _converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'close').and.callThrough();
                spyOn(_converse, 'emit');
                spyOn(view, 'leave');
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                view.$el.find('.close-chatbox-button').click();
                expect(view.close).toHaveBeenCalled();
                expect(view.leave).toHaveBeenCalled();
                // XXX: After refactoring, the chat box only gets closed
                // once we have confirmation from the server. To test this,
                // we would have to mock the returned presence stanza.
                // See the "leave" method on the ChatRoomView.
                // expect(_converse.emit).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                done();
            }));
        });


        describe("Each chat room can take special commands", function () {

            it("to set the room topic",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var sent_stanza;
                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                var view = _converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'onMessageSubmitted').and.callThrough();
                spyOn(view, 'clearChatRoomMessages');
                spyOn(_converse.connection, 'send').and.callFake(function (stanza) {
                    sent_stanza = stanza;
                });
                // Check the alias /topic
                var $textarea = view.$el.find('.chat-textarea');
                $textarea.text('/topic This is the room subject');
                $textarea.trigger($.Event('keypress', {keyCode: 13}));
                expect(view.onMessageSubmitted).toHaveBeenCalled();
                expect(_converse.connection.send).toHaveBeenCalled();
                expect(sent_stanza.textContent).toBe('This is the room subject');

                // Check /subject
                $textarea.val('/subject This is a new subject');
                $textarea.trigger($.Event('keypress', {keyCode: 13}));
                expect(sent_stanza.textContent).toBe('This is a new subject');

                // Check case insensitivity
                //
                // XXX: This works in the browser but fails on phantomjs
                // expect(sent_stanza.outerHTML).toBe(
                //     '<message to="lounge@localhost" from="dummy@localhost/resource" type="groupchat" xmlns="jabber:client">'+
                //         '<subject xmlns="jabber:client">This is yet another subject</subject>'+
                //     '</message>');
                $textarea.val('/Subject This is yet another subject');
                $textarea.trigger($.Event('keypress', {keyCode: 13}));
                expect(sent_stanza.textContent).toBe('This is yet another subject');
                done();
            }));

            it("to clear messages",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                var view = _converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'onMessageSubmitted').and.callThrough();
                spyOn(view, 'clearChatRoomMessages');
                view.$el.find('.chat-textarea').text('/clear');
                view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                expect(view.onMessageSubmitted).toHaveBeenCalled();
                expect(view.clearChatRoomMessages).toHaveBeenCalled();
                done();
            }));

            it("to make a user an owner",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var sent_IQ, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                var view = _converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'onMessageSubmitted').and.callThrough();
                spyOn(view, 'setAffiliation').and.callThrough();
                spyOn(view, 'showStatusNotification').and.callThrough();
                spyOn(view, 'validateRoleChangeCommand').and.callThrough();
                view.$el.find('.chat-textarea').text('/owner');
                view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                expect(view.onMessageSubmitted).toHaveBeenCalled();
                expect(view.validateRoleChangeCommand).toHaveBeenCalled();
                expect(view.showStatusNotification).toHaveBeenCalledWith(
                    "Error: the \"owner\" command takes two arguments, the user's nickname and optionally a reason.",
                    true
                );
                expect(view.setAffiliation).not.toHaveBeenCalled();

                // Call now with the correct amount of arguments.
                // XXX: Calling onMessageSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                view.onMessageSubmitted('/owner annoyingGuy@localhost You\'re annoying');
                expect(view.validateRoleChangeCommand.calls.count()).toBe(2);
                expect(view.showStatusNotification.calls.count()).toBe(1);
                expect(view.setAffiliation).toHaveBeenCalled();
                // Check that the member list now gets updated
                expect(sent_IQ.toLocaleString()).toBe(
                    "<iq to='lounge@localhost' type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                        "<query xmlns='http://jabber.org/protocol/muc#admin'>"+
                            "<item affiliation='owner' jid='annoyingGuy@localhost'>"+
                                "<reason>You&apos;re annoying</reason>"+
                            "</item>"+
                        "</query>"+
                    "</iq>");
                done();
            }));

            it("to ban a user",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var sent_IQ, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                var view = _converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'onMessageSubmitted').and.callThrough();
                spyOn(view, 'setAffiliation').and.callThrough();
                spyOn(view, 'showStatusNotification').and.callThrough();
                spyOn(view, 'validateRoleChangeCommand').and.callThrough();
                view.$el.find('.chat-textarea').text('/ban');
                view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                expect(view.onMessageSubmitted).toHaveBeenCalled();
                expect(view.validateRoleChangeCommand).toHaveBeenCalled();
                expect(view.showStatusNotification).toHaveBeenCalledWith(
                    "Error: the \"ban\" command takes two arguments, the user's nickname and optionally a reason.",
                    true
                );
                expect(view.setAffiliation).not.toHaveBeenCalled();
                // Call now with the correct amount of arguments.
                // XXX: Calling onMessageSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                view.onMessageSubmitted('/ban annoyingGuy@localhost You\'re annoying');
                expect(view.validateRoleChangeCommand.calls.count()).toBe(2);
                expect(view.showStatusNotification.calls.count()).toBe(1);
                expect(view.setAffiliation).toHaveBeenCalled();
                // Check that the member list now gets updated
                expect(sent_IQ.toLocaleString()).toBe(
                    "<iq to='lounge@localhost' type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                        "<query xmlns='http://jabber.org/protocol/muc#admin'>"+
                            "<item affiliation='outcast' jid='annoyingGuy@localhost'>"+
                                "<reason>You&apos;re annoying</reason>"+
                            "</item>"+
                        "</query>"+
                    "</iq>");
                done();
            }));
        });

        describe("When attempting to enter a chatroom", function () {

            var submitRoomForm = function (_converse) {
                var roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                var $input = roomspanel.$el.find('input.new-chatroom-name');
                var $nick = roomspanel.$el.find('input.new-chatroom-nick');
                var $server = roomspanel.$el.find('input.new-chatroom-server');
                $input.val('problematic');
                $nick.val('dummy');
                $server.val('muc.localhost');
                roomspanel.$el.find('form').submit();
            };

            it("will show an error message if the room requires a password",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                submitRoomForm(_converse);
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'auth'})
                    .c('not-authorized').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                var view = _converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'renderPasswordForm').and.callThrough();
                view.onChatRoomPresence(presence);

                var $chat_body = view.$el.find('.chatroom-body');
                expect(view.renderPasswordForm).toHaveBeenCalled();
                expect($chat_body.find('form.chatroom-form').length).toBe(1);
                expect($chat_body.find('legend').text()).toBe('This chatroom requires a password');
                done();
            }));

            it("will show an error message if the room is members-only and the user not included",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                submitRoomForm(_converse);
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'auth'})
                    .c('registration-required').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = _converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').and.callThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body p:last').text()).toBe('You are not on the member list of this room.');
                done();
            }));

            it("will show an error message if the user has been banned",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                submitRoomForm(_converse);
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'auth'})
                    .c('forbidden').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = _converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').and.callThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body p:last').text()).toBe('You have been banned from this room.');
                done();
            }));

            it("will render a nickname form if a nickname conflict happens and muc_nickname_from_jid=false",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                submitRoomForm(_converse);
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = _converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').and.callThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body form.chatroom-form label:first').text()).toBe('Please choose your nickname');
                done();
            }));

            it("will automatically choose a new nickname if a nickname conflict happens and muc_nickname_from_jid=true",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

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
                submitRoomForm(_converse);
                _converse.muc_nickname_from_jid = true;

                var attrs = {
                    from:'lounge@localhost/dummy',
                    id:'n13mt3l',
                    to:'dummy@localhost/pda',
                    type:'error'
                };
                var presence = $pres().attrs(attrs)
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                        .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                var view = _converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').and.callThrough();
                spyOn(view, 'join').and.callThrough();

                // Simulate repeatedly that there's already someone in the room
                // with that nickname
                view.onChatRoomPresence(presence);
                expect(view.join).toHaveBeenCalledWith('dummy-2');

                attrs.from = 'lounge@localhost/dummy-2';
                presence = $pres().attrs(attrs)
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                        .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                view.onChatRoomPresence(presence);

                expect(view.join).toHaveBeenCalledWith('dummy-3');

                attrs.from = 'lounge@localhost/dummy-3';
                presence = $pres().attrs(attrs)
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                        .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                view.onChatRoomPresence(presence);
                expect(view.join).toHaveBeenCalledWith('dummy-4');
                done();
            }));

            it("will show an error message if the user is not allowed to have created the room",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                submitRoomForm(_converse);
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('not-allowed').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = _converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').and.callThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body p:last').text()).toBe('You are not allowed to create new rooms.');
                done();
            }));

            it("will show an error message if the user's nickname doesn't conform to room policy",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                submitRoomForm(_converse);
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('not-acceptable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = _converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').and.callThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body p:last').text()).toBe("Your nickname doesn't conform to this room's policies.");
                done();
            }));

            it("will show an error message if the room doesn't yet exist",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                submitRoomForm(_converse);
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('item-not-found').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = _converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').and.callThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body p:last').text()).toBe("This room does not (yet) exist.");
                done();
            }));

            it("will show an error message if the room has reached its maximum number of occupants",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                submitRoomForm(_converse);
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('service-unavailable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = _converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').and.callThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body p:last').text()).toBe("This room has reached its maximum number of occupants.");
                done();
            }));
        });

        describe("Someone being invited to a chat room", function () {

            it("will first be added to the member list if the chat room is members only",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var sent_IQs = [], IQ_ids = [];
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQs.push(iq);
                    IQ_ids.push(sendIQ.bind(this)(iq, callback, errback));
                });

                _converse.api.rooms.open('coven@chat.shakespeare.lit', {'nick': 'dummy'});

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

                var view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                expect(view.model.get('membersonly')).toBeTruthy();

                test_utils.createContacts(_converse, 'current');

                var sent_stanza, sent_id;
                spyOn(_converse.connection, 'send').and.callFake(function (stanza) {
                    if (stanza.nodeTree && stanza.nodeTree.nodeName === 'message') {
                        sent_id = stanza.nodeTree.getAttribute('id');
                        sent_stanza = stanza;
                    }
                });
                var name = mock.cur_names[0];
                var invitee_jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                var reason = "Please join this chat room";
                view.directInvite(invitee_jid, reason);

                // Check in reverse order that we requested all three lists
                // (member, owner and admin).
                var admin_iq_id = IQ_ids.pop();
                var owner_iq_id = IQ_ids.pop();
                var member_iq_id = IQ_ids.pop();

                expect(sent_IQs.pop().toLocaleString()).toBe(
                    "<iq to='coven@chat.shakespeare.lit' type='get' xmlns='jabber:client' id='"+admin_iq_id+"'>"+
                        "<query xmlns='http://jabber.org/protocol/muc#admin'>"+
                            "<item affiliation='admin'/>"+
                        "</query>"+
                    "</iq>");
                expect(sent_IQs.pop().toLocaleString()).toBe(
                    "<iq to='coven@chat.shakespeare.lit' type='get' xmlns='jabber:client' id='"+owner_iq_id+"'>"+
                        "<query xmlns='http://jabber.org/protocol/muc#admin'>"+
                            "<item affiliation='owner'/>"+
                        "</query>"+
                    "</iq>");
                expect(sent_IQs.pop().toLocaleString()).toBe(
                    "<iq to='coven@chat.shakespeare.lit' type='get' xmlns='jabber:client' id='"+member_iq_id+"'>"+
                        "<query xmlns='http://jabber.org/protocol/muc#admin'>"+
                            "<item affiliation='member'/>"+
                        "</query>"+
                    "</iq>");

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

                test_utils.waitUntil(function () {
                    return IQ_ids.length;
                }, 300).then(function () {
                    // Check that the member list now gets updated
                    var iq = "<iq to='coven@chat.shakespeare.lit' type='set' xmlns='jabber:client' id='"+IQ_ids.pop()+"'>"+
                            "<query xmlns='http://jabber.org/protocol/muc#admin'>"+
                                "<item affiliation='member' jid='"+invitee_jid+"'>"+
                                    "<reason>Please join this chat room</reason>"+
                                "</item>"+
                            "</query>"+
                        "</iq>";

                    test_utils.waitUntil(function () {
                        return _.includes(_.invokeMap(sent_IQs, Object.prototype.toLocaleString), iq);
                    }, 300).then(function () {
                        // Finally check that the user gets invited.
                        expect(sent_stanza.toLocaleString()).toBe( // Strophe adds the xmlns attr (although not in spec)
                            "<message from='dummy@localhost/resource' to='"+invitee_jid+"' id='"+sent_id+"' xmlns='jabber:client'>"+
                                "<x xmlns='jabber:x:conference' jid='coven@chat.shakespeare.lit' reason='Please join this chat room'/>"+
                            "</message>"
                        );
                        done();
                    });
                });
            }));
        });

        describe("The affiliations delta", function () {

            it("can be computed in various ways",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openChatRoom(_converse, 'coven', 'chat.shakespeare.lit', 'dummy');
                var roomview = _converse.chatboxviews.get('coven@chat.shakespeare.lit');

                var exclude_existing = false;
                var remove_absentees = false;
                var new_list = [];
                var old_list = [];
                var delta = roomview.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(0);

                new_list = [{'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'member'}];
                old_list = [{'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'member'}];
                delta = roomview.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(0);

                // When remove_absentees is false, then affiliations in the old
                // list which are not in the new one won't be removed.
                old_list = [{'jid': 'oldhag666@shakespeare.lit', 'affiliation': 'owner'},
                            {'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'member'}];
                delta = roomview.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(0);

                // With exclude_existing set to false, any changed affiliations
                // will be included in the delta (i.e. existing affiliations
                // are included in the comparison).
                old_list = [{'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'owner'}];
                delta = roomview.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(1);
                expect(delta[0].jid).toBe('wiccarocks@shakespeare.lit');
                expect(delta[0].affiliation).toBe('member');

                // To also remove affiliations from the old list which are not
                // in the new list, we set remove_absentees to true
                remove_absentees = true;
                old_list = [{'jid': 'oldhag666@shakespeare.lit', 'affiliation': 'owner'},
                            {'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'member'}];
                delta = roomview.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(1);
                expect(delta[0].jid).toBe('oldhag666@shakespeare.lit');
                expect(delta[0].affiliation).toBe('none');

                delta = roomview.computeAffiliationsDelta(exclude_existing, remove_absentees, [], old_list);
                expect(delta.length).toBe(2);
                expect(delta[0].jid).toBe('oldhag666@shakespeare.lit');
                expect(delta[0].affiliation).toBe('none');
                expect(delta[1].jid).toBe('wiccarocks@shakespeare.lit');
                expect(delta[1].affiliation).toBe('none');

                // To only add a user if they don't already have an
                // affiliation, we set 'exclude_existing' to true
                exclude_existing = true;
                old_list = [{'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'owner'}];
                delta = roomview.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
                expect(delta.length).toBe(0);
                done();
            }));
        });

        describe("The \"Rooms\" Panel", function () {

            it("is opened by clicking the 'Chatrooms' tab",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openControlBox();
                var cbview = _converse.chatboxviews.get('controlbox');
                var $tabs = cbview.$el.find('#controlbox-tabs');
                var $panels = cbview.$el.find('.controlbox-panes');
                var $contacts = $panels.children().first();
                var $chatrooms = $panels.children().last();
                spyOn(cbview, 'switchTab').and.callThrough();
                cbview.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                $tabs.find('li').last().find('a').click(); // Clicks the chatrooms tab
                expect($contacts.is(':visible')).toBe(false);
                expect($chatrooms.is(':visible')).toBe(true);
                expect(cbview.switchTab).toHaveBeenCalled();
                done();
            }));

            it("contains a form through which a new chatroom can be created",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openControlBox();
                var roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                var $input = roomspanel.$el.find('input.new-chatroom-name');
                var $nick = roomspanel.$el.find('input.new-chatroom-nick');
                var $server = roomspanel.$el.find('input.new-chatroom-server');
                expect($input.length).toBe(1);
                expect($server.length).toBe(1);
                expect($('.chatroom:visible').length).toBe(0); // There shouldn't be any chatrooms open currently
                spyOn(roomspanel, 'openChatRoom').and.callThrough();
                spyOn(_converse.ChatRoomView.prototype, 'getRoomFeatures').and.callFake(function () {
                    var deferred = new $.Deferred();
                    deferred.resolve();
                    return deferred.promise();
                });

                roomspanel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                $input.val('Lounge');
                $nick.val('dummy');
                $server.val('muc.localhost');
                roomspanel.$el.find('form').submit();
                expect(roomspanel.openChatRoom).toHaveBeenCalled();
                expect($('.chatroom:visible').length).toBe(1); // There should now be an open chatroom
                done();
            }));

            it("can list rooms publically available on the server",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openControlBox();
                var panel = _converse.chatboxviews.get('controlbox').roomspanel;
                $(panel.tabs).find('li').last().find('a').click(); // Click the chatrooms tab
                panel.model.set({'muc_domain': 'muc.localhost'}); // Make sure the domain is set
                // See: http://xmpp.org/extensions/xep-0045.html#disco-rooms
                expect($('#available-chatrooms').children('dt').length).toBe(0);
                expect($('#available-chatrooms').children('dd').length).toBe(0);

                var iq = $iq({
                    from:'muc.localhost',
                    to:'dummy@localhost/pda',
                    type:'result'
                }).c('query')
                  .c('item', { jid:'heath@chat.shakespeare.lit', name:'A Lonely Heath'}).up()
                  .c('item', { jid:'coven@chat.shakespeare.lit', name:'A Dark Cave'}).up()
                  .c('item', { jid:'forres@chat.shakespeare.lit', name:'The Palace'}).up()
                  .c('item', { jid:'inverness@chat.shakespeare.lit', name:'Macbeth&apos;s Castle'}).nodeTree;

                panel.onRoomsFound(iq);
                expect(panel.$('#available-chatrooms').children('dt').length).toBe(1);
                expect(panel.$('#available-chatrooms').children('dt').first().text()).toBe("Rooms on muc.localhost");
                expect(panel.$('#available-chatrooms').children('dd').length).toBe(4);
                done();
            }));
        });
            
        describe("The \"Rooms\" Panel", function () {

            it("shows the number of unread mentions received",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var room_jid = 'kitchen@conference.shakespeare.lit';
                test_utils.openAndEnterChatRoom(
                        _converse, 'kitchen', 'conference.shakespeare.lit', 'fires').then(function () {

                    test_utils.openContactsPanel(_converse);
                    var roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                    expect(_.isNull(roomspanel.tab_el.querySelector('.msgs-indicator'))).toBeTruthy();

                    var view = _converse.chatboxviews.get(room_jid);
                    view.model.set({'minimized': true});

                    var contact_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@localhost';
                    var message = 'fires: Your attention is required';
                    var nick = mock.chatroom_names[0],
                        msg = $msg({
                            from: room_jid+'/'+nick,
                            id: (new Date()).getTime(),
                            to: 'dummy@localhost',
                            type: 'groupchat'
                        }).c('body').t(message).tree();

                    view.handleMUCMessage(msg);

                    test_utils.waitUntil(function () {
                        return _.includes(roomspanel.tab_el.firstChild.classList, 'unread-msgs');
                    }, 300).then(function () {
                        expect(_.includes(roomspanel.tab_el.firstChild.classList, 'unread-msgs')).toBeTruthy();
                        expect(roomspanel.tab_el.querySelector('.msgs-indicator').textContent).toBe('1');

                        msg = $msg({
                            from: room_jid+'/'+nick,
                            id: (new Date()).getTime(),
                            to: 'dummy@localhost',
                            type: 'groupchat'
                        }).c('body').t(message).tree();
                        view.handleMUCMessage(msg);
                        expect(roomspanel.tab_el.querySelector('.msgs-indicator').textContent).toBe('2');

                        var contacts_panel = _converse.chatboxviews.get('controlbox').contactspanel;
                        expect(_.isNull(contacts_panel.tab_el.querySelector('.msgs-indicator'))).toBeTruthy();

                        view.model.set({'minimized': false});
                        expect(_.includes(roomspanel.tab_el.firstChild.classList, 'unread-msgs')).toBeFalsy();
                        expect(_.isNull(roomspanel.tab_el.querySelector('.msgs-indicator'))).toBeTruthy();
                        done();
                    });
                });
            }));
        });
    });
}));
