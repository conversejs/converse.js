(function (root, factory) {
    define(["jquery", "jasmine", "mock", "test-utils" ], factory);
} (this, function ($, jasmine, mock, test_utils) {
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

    return describe("ChatRooms", function () {
        describe("The \"rooms\" API", function () {

            it("has a method 'close' which closes rooms by JID or all rooms when called with no arguments",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy')
                .then(() => test_utils.openAndEnterChatRoom(_converse, 'leisure', 'localhost', 'dummy'))
                .then(() => test_utils.openAndEnterChatRoom(_converse, 'news', 'localhost', 'dummy'))
                .then(() => {
                    expect(u.isVisible(_converse.chatboxviews.get('lounge@localhost').el)).toBeTruthy();
                    expect(u.isVisible(_converse.chatboxviews.get('leisure@localhost').el)).toBeTruthy();
                    expect(u.isVisible(_converse.chatboxviews.get('news@localhost').el)).toBeTruthy();

                    // XXX: bit of a cheat here. We want `cleanup()` to be
                    // called on the room. Either it's this or faking
                    // `sendPresence`.
                    _converse.connection.connected = false;

                    _converse.api.rooms.close('lounge@localhost');
                    expect(_converse.chatboxviews.get('lounge@localhost')).toBeUndefined();
                    expect(u.isVisible(_converse.chatboxviews.get('leisure@localhost').el)).toBeTruthy();
                    expect(u.isVisible(_converse.chatboxviews.get('news@localhost').el)).toBeTruthy();

                    _converse.api.rooms.close(['leisure@localhost', 'news@localhost']);
                    expect(_converse.chatboxviews.get('lounge@localhost')).toBeUndefined();
                    expect(_converse.chatboxviews.get('leisure@localhost')).toBeUndefined();
                    expect(_converse.chatboxviews.get('news@localhost')).toBeUndefined();
                    return test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                })
                .then(() => test_utils.openAndEnterChatRoom(_converse, 'leisure', 'localhost', 'dummy'))
                .then(() => {
                    expect(u.isVisible(_converse.chatboxviews.get('lounge@localhost').el)).toBeTruthy();
                    expect(u.isVisible(_converse.chatboxviews.get('leisure@localhost').el)).toBeTruthy();
                    _converse.api.rooms.close();
                    expect(_converse.chatboxviews.get('lounge@localhost')).toBeUndefined();
                    expect(_converse.chatboxviews.get('leisure@localhost')).toBeUndefined();
                    done();
                }).catch(_.partial(console.error, _));
            }));

            it("has a method 'get' which returns a wrapped groupchat (if it exists)",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                let jid, room, chatroomview;

                test_utils.createContacts(_converse, 'current');
                test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group .group-toggle').length, 300)
                .then(() => test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy'))
                .then(() => {
                    jid = 'lounge@localhost';
                    room = _converse.api.rooms.get(jid);
                    expect(room instanceof Object).toBeTruthy();

                    chatroomview = _converse.chatboxviews.get(jid);
                    expect(chatroomview.is_chatroom).toBeTruthy();

                    expect(u.isVisible(chatroomview.el)).toBeTruthy();
                    chatroomview.close();

                    // Test with mixed case
                    return test_utils.openAndEnterChatRoom(_converse, 'Leisure', 'localhost', 'dummy');
                }).then(() => {
                    jid = 'Leisure@localhost';
                    room = _converse.api.rooms.get(jid);
                    expect(room instanceof Object).toBeTruthy();
                    chatroomview = _converse.chatboxviews.get(jid.toLowerCase());
                    expect(u.isVisible(chatroomview.el)).toBeTruthy();

                    jid = 'leisure@localhost';
                    room = _converse.api.rooms.get(jid);
                    expect(room instanceof Object).toBeTruthy();
                    chatroomview = _converse.chatboxviews.get(jid.toLowerCase());
                    expect(u.isVisible(chatroomview.el)).toBeTruthy();

                    jid = 'leiSure@localhost';
                    room = _converse.api.rooms.get(jid);
                    expect(room instanceof Object).toBeTruthy();
                    chatroomview = _converse.chatboxviews.get(jid.toLowerCase());
                    expect(u.isVisible(chatroomview.el)).toBeTruthy();
                    chatroomview.close();

                    // Non-existing room
                    jid = 'lounge2@localhost';
                    room = _converse.api.rooms.get(jid);
                    expect(typeof room === 'undefined').toBeTruthy();
                    done();
                });
            }));

            it("has a method 'open' which opens (optionally configures) and returns a wrapped chat box",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        function (done, _converse) {

                // Mock 'getRoomFeatures', otherwise the room won't be
                // displayed as it waits first for the features to be returned
                // (when it's a new room being created).
                spyOn(_converse.ChatRoom.prototype, 'getRoomFeatures').and.callFake(function () {
                    var deferred = new $.Deferred();
                    deferred.resolve();
                    return deferred.promise();
                });

                const sent_IQ_els = [];
                let jid = 'lounge@localhost';
                let chatroomview, sent_IQ, IQ_id;
                test_utils.openControlBox();
                test_utils.createContacts(_converse, 'current');
                test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group .group-toggle').length)
                .then(() => _converse.api.rooms.open(jid))
                .then((room) => {
                    // Test on groupchat that's not yet open
                    expect(room instanceof Backbone.Model).toBeTruthy();
                    chatroomview = _converse.chatboxviews.get(jid);
                    expect(chatroomview.is_chatroom).toBeTruthy();
                    expect(u.isVisible(chatroomview.el)).toBeTruthy();

                    // Test again, now that the room exists.
                    return _converse.api.rooms.open(jid);
                }).then((room) => {
                    expect(room instanceof Backbone.Model).toBeTruthy();
                    chatroomview = _converse.chatboxviews.get(jid);
                    expect(chatroomview.is_chatroom).toBeTruthy();
                    expect(u.isVisible(chatroomview.el)).toBeTruthy();
                    chatroomview.close();

                    // Test with mixed case in JID
                    jid = 'Leisure@localhost';
                    return _converse.api.rooms.open(jid);
                }).then((room) => {
                    expect(room instanceof Backbone.Model).toBeTruthy();
                    chatroomview = _converse.chatboxviews.get(jid.toLowerCase());
                    expect(u.isVisible(chatroomview.el)).toBeTruthy();

                    jid = 'leisure@localhost';
                    return _converse.api.rooms.open(jid);
                }).then((room) => {
                    expect(room instanceof Backbone.Model).toBeTruthy();
                    chatroomview = _converse.chatboxviews.get(jid.toLowerCase());
                    expect(u.isVisible(chatroomview.el)).toBeTruthy();

                    jid = 'leiSure@localhost';
                    return _converse.api.rooms.open(jid);
                }).then((room) => {
                    expect(room instanceof Backbone.Model).toBeTruthy();
                    chatroomview = _converse.chatboxviews.get(jid.toLowerCase());
                    expect(u.isVisible(chatroomview.el)).toBeTruthy();
                    chatroomview.close();

                    _converse.muc_instant_rooms = false;
                    var sendIQ = _converse.connection.sendIQ;
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                        sent_IQ = iq;
                        sent_IQ_els.push(iq.nodeTree);
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });
                    // Test with configuration
                    return _converse.api.rooms.open('room@conference.example.org', {
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
                }).then((room) => {
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
                        "<iq to='room@conference.example.org' type='get' xmlns='jabber:client' id='"+IQ_id+
                        "'><query xmlns='http://jabber.org/protocol/muc#owner'/></iq>"
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
                    return test_utils.waitUntil(() => chatroomview.model.sendConfiguration.calls.count() === 1);
                }).then(() => {
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
                });
            }));
        });

        describe("An instant groupchat", function () {

            it("will be created when muc_instant_rooms is set to true",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        function (done, _converse) {

                const IQ_stanzas = _converse.connection.IQ_stanzas;
                const sendIQ = _converse.connection.sendIQ;
                let sent_IQ, IQ_id, view;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    if (iq.nodeTree.getAttribute('to') === 'lounge@localhost') {
                        sent_IQ = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    } else {
                        sendIQ.bind(this)(iq, callback, errback);
                    }
                });
                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy')
                .then(() => {
                    // We pretend this is a new room, so no disco info is returned.
                    //
                    /* <iq from="jordie.langen@chat.example.org/converse.js-11659299" to="myroom@conference.chat.example.org" type="get">
                     *     <query xmlns="http://jabber.org/protocol/disco#info"/>
                     * </iq>
                     * <iq xmlns="jabber:client" type="error" to="jordie.langen@chat.example.org/converse.js-11659299" from="myroom@conference.chat.example.org">
                     *     <error type="cancel">
                     *         <item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                     *     </error>
                     * </iq>
                     */
                    var features_stanza = $iq({
                            'from': 'lounge@localhost',
                            'id': IQ_id,
                            'to': 'dummy@localhost/desktop',
                            'type': 'error'
                        }).c('error', {'type': 'cancel'})
                            .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                    _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                    view = _converse.chatboxviews.get('lounge@localhost');
                    spyOn(view, 'join').and.callThrough();
                    spyOn(view, 'submitNickname').and.callThrough();

                    /* <iq to="myroom@conference.chat.example.org"
                     *     from="jordie.langen@chat.example.org/converse.js-11659299"
                     *     type="get">
                     *   <query xmlns="http://jabber.org/protocol/disco#info"
                     *          node="x-roomuser-item"/>
                     * </iq>
                     */
                    return test_utils.waitUntil(() => _.filter(IQ_stanzas, (iq) => iq.nodeTree.querySelector('query[node="x-roomuser-item"]')).length);
                }).then(() => {
                    const iq = _.filter(IQ_stanzas, function (iq) {
                        return iq.nodeTree.querySelector(`query[node="x-roomuser-item"]`);
                    }).pop();

                    const id = iq.nodeTree.getAttribute('id');
                    expect(iq.toLocaleString()).toBe(
                        "<iq to='lounge@localhost' from='dummy@localhost/resource' "+
                            "type='get' xmlns='jabber:client' id='"+id+"'>"+
                                "<query xmlns='http://jabber.org/protocol/disco#info' node='x-roomuser-item'/></iq>");

                    /* <iq xmlns="jabber:client" type="error" to="jordie.langen@chat.example.org/converse.js-11659299" from="myroom@conference.chat.example.org">
                     *      <error type="cancel">
                     *          <item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                     *      </error>
                     *  </iq>
                     */
                    var stanza = $iq({
                        'type': 'error',
                        'id': id,
                        'from': view.model.get('jid'),
                        'to': _converse.connection.jid
                    }).c('error', {'type': 'cancel'})
                    .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    var input = view.el.querySelector('input[name="nick"]');
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
                        "<iq to='lounge@localhost' type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                            "<query xmlns='http://jabber.org/protocol/muc#owner'><x xmlns='jabber:x:data' type='submit'/>"+
                        "</query></iq>");
                    done();
                });
            }));
        });

        describe("A Groupchat", function () {

            it("shows join/leave messages when users enter or exit a groupchat",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        function (done, _converse) {

                test_utils.openChatRoom(_converse, "coven", 'chat.shakespeare.lit', 'some1')
                .then(() => {
                    var view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                    var $chat_content = $(view.el).find('.chat-content');

                    /* We don't show join/leave messages for existing occupants. We
                     * know about them because we receive their presences before we
                     * receive our own.
                     */
                    var presence = $pres({
                            to: 'dummy@localhost/_converse.js-29092160',
                            from: 'coven@chat.shakespeare.lit/oldguy'
                        }).c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'none',
                            'jid': 'oldguy@localhost/_converse.js-290929789',
                            'role': 'participant'
                        });
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect($chat_content[0].querySelectorAll('div.chat-info').length).toBe(0);

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
                    expect($chat_content.find('div.chat-info:first').html()).toBe("some1 has entered the groupchat");

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
                    expect($chat_content[0].querySelectorAll('div.chat-info').length).toBe(2);
                    expect($chat_content.find('div.chat-info:last').html()).toBe("newguy has entered the groupchat");

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
                    expect($chat_content[0].querySelectorAll('div.chat-info').length).toBe(3);
                    expect($chat_content.find('div.chat-info:last').html()).toBe("newgirl has entered the groupchat");

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
                    expect($chat_content[0].querySelectorAll('div.chat-info').length).toBe(3);

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
                    expect($chat_content.find('div.chat-info').length).toBe(4);
                    expect($chat_content.find('div.chat-info:last').html()).toBe(
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
                    expect($chat_content.find('div.chat-info').length).toBe(4);
                    var $msg_el = $chat_content.find('div.chat-info:last');
                    expect($msg_el.html()).toBe("newguy has left and re-entered the groupchat");
                    expect($msg_el.data('leavejoin')).toBe('"newguy"');

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
                    expect($chat_content.find('div.chat-info').length).toBe(4);
                    $msg_el = $chat_content.find('div.chat-info:last');
                    expect($msg_el.html()).toBe('newguy has left the groupchat');
                    expect($msg_el.data('leave')).toBe('"newguy"');

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
                    expect($chat_content[0].querySelectorAll('div.chat-info').length).toBe(5);
                    expect($chat_content.find('div.chat-info:last').html()).toBe("nomorenicks has entered the groupchat");

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
                    expect($chat_content[0].querySelectorAll('div.chat-info').length).toBe(5);
                    expect($chat_content.find('div.chat-info:last').html()).toBe("nomorenicks has entered and left the groupchat");

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
                    expect($chat_content[0].querySelectorAll('div.chat-info').length).toBe(5);
                    expect($chat_content.find('div.chat-info:last').html()).toBe("nomorenicks has entered the groupchat");
                    done();
                });
            }));

            it("shows a new day indicator if a join/leave message is received on a new day",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'coven', 'chat.shakespeare.lit', 'dummy').then(function () {
                    var view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                    var chat_content = view.el.querySelector('.chat-content');
                    var $chat_content = $(chat_content);
                    var indicator = chat_content.querySelector('.date-separator');
                    expect(indicator).not.toBe(null);
                    expect(indicator.getAttribute('class')).toEqual('message date-separator');
                    expect(indicator.getAttribute('data-isodate')).toEqual(moment().startOf('day').format());
                    expect(indicator.querySelector('time').textContent).toEqual(moment().startOf('day').format("dddd MMM Do YYYY"));
                    expect(chat_content.querySelectorAll('div.chat-info').length).toBe(1);
                    expect(chat_content.querySelector('div.chat-info').textContent).toBe(
                        "dummy has entered the groupchat"
                    );

                    var baseTime = new Date();
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
                    expect($(chat_content).find('div.chat-info:last').html()).toBe(
                        'some1 has left the groupchat. '+
                        '"Disconnected: Replaced by new connection"');

                    jasmine.clock().tick(ONE_DAY_LATER);

                    var stanza = Strophe.xmlHtmlNode(
                        '<message xmlns="jabber:client"' +
                        '   to="dummy@localhost/_converse.js-290929789"' +
                        '   type="groupchat"' +
                        '   from="coven@chat.shakespeare.lit/some1">'+
                        '       <body>hello world</body>'+
                        '       <delay xmlns="urn:xmpp:delay" stamp="'+moment().format()+'" from="some1@localhost"/>'+
                        '</message>').firstChild;
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

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

                    var $indicator = $chat_content.find('.date-separator:eq(3)');
                    expect($indicator.attr('class')).toEqual('message date-separator');
                    expect($indicator.data('isodate')).toEqual(moment().startOf('day').format());
                    expect($indicator.find('time').text()).toEqual(moment().startOf('day').format("dddd MMM Do YYYY"));
                    expect(chat_content.querySelectorAll('div.chat-info').length).toBe(4);
                    expect($chat_content.find('div.chat-info:last').html()).toBe("newguy has entered the groupchat");

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

                    $indicator = $chat_content.find('.date-separator:eq(5)');
                    expect($indicator.attr('class')).toEqual('message date-separator');
                    expect($indicator.data('isodate')).toEqual(moment().startOf('day').format());

                    expect($indicator.find('time').text()).toEqual(moment().startOf('day').format("dddd MMM Do YYYY"));
                    expect(chat_content.querySelectorAll('div.chat-info').length).toBe(5);
                    expect($chat_content.find('div.chat-info:last').html()).toBe(
                        'newguy has left the groupchat. '+
                        '"Disconnected: Replaced by new connection"');

                    jasmine.clock().uninstall();
                    done();
                    return;
                });
            }));

            it("shows its description in the chat heading",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        function (done, _converse) {

                let sent_IQ, IQ_id, view;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                _converse.api.rooms.open('coven@chat.shakespeare.lit', {'nick': 'some1'})
                .then(() => {
                    view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                    const features_stanza = $iq({
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
                                .c('field', {'type':'text-single', 'var':'muc#roominfo_occupants', 'label':'Number of participants'})
                                    .c('value').t(0);
                    _converse.connection._dataRecv(test_utils.createRequest(features_stanza));
                    return test_utils.waitUntil(() => _.get(view.el.querySelector('.chatroom-description'), 'textContent'))
                }).then(function () {
                    expect(view.el.querySelector('.chatroom-description').textContent).toBe('This is the description');
                    done();
                });
            }));

            it("supports the /me command",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.waitUntilDiscoConfirmed(_converse, 'localhost', [], ['vcard-temp'])
                .then(function () {
                    return test_utils.waitUntil(() => _converse.xmppstatus.vcard.get('fullname'))
                }).then(function () {
                    test_utils.createContacts(_converse, 'current');
                    return test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                }).then(function () {
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    if (!$(view.el).find('.chat-area').length) { view.renderChatArea(); }
                    var message = '/me is tired';
                    var nick = mock.chatroom_names[0],
                        msg = $msg({
                            'from': 'lounge@localhost/'+nick,
                            'id': (new Date()).getTime(),
                            'to': 'dummy@localhost',
                            'type': 'groupchat'
                        }).c('body').t(message).tree();
                    view.model.onMessage(msg);
                    expect(_.includes($(view.el).find('.chat-msg__author').text(), '**Dyon van de Wege')).toBeTruthy();
                    expect($(view.el).find('.chat-msg__text').text()).toBe(' is tired');

                    message = '/me is as well';
                    msg = $msg({
                        from: 'lounge@localhost/Max Mustermann',
                        id: (new Date()).getTime(),
                        to: 'dummy@localhost',
                        type: 'groupchat'
                    }).c('body').t(message).tree();
                    view.model.onMessage(msg);
                    expect(_.includes($(view.el).find('.chat-msg__author:last').text(), '**Max Mustermann')).toBeTruthy();
                    expect($(view.el).find('.chat-msg__text:last').text()).toBe(' is as well');
                    done();
                });
            }));

            it("can be configured if you're its owner",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        function (done, _converse) {

                var view;
                var sent_IQ, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                _converse.api.rooms.open('coven@chat.shakespeare.lit', {'nick': 'some1'})
                .then(() => {
                    view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');

                    spyOn(view.model, 'saveAffiliationAndRole').and.callThrough();

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
                    expect(view.model.saveAffiliationAndRole).toHaveBeenCalled();
                    expect($(view.el.querySelector('.toggle-chatbox-button')).is(':visible')).toBeTruthy();
                    return test_utils.waitUntil(() => !_.isNull(view.el.querySelector('.configure-chatroom-button')))
                }).then(() => {
                    expect($(view.el.querySelector('.configure-chatroom-button')).is(':visible')).toBeTruthy();
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
                                .c('value').t('If a password is required to enter this groupchat,'+
                                            'you must specify the password below.').up().up()
                            .c('field', {
                                'label': 'Password',
                                'type': 'text-private',
                                'var': 'muc#roomconfig_roomsecret'})
                                .c('value').t('cauldronburn');
                    _converse.connection._dataRecv(test_utils.createRequest(config_stanza));

                    return test_utils.waitUntil(() => view.el.querySelectorAll('form.chatroom-form').length)
                }).then(() => {
                    expect($(view.el.querySelector('form.chatroom-form')).length).toBe(1);
                    expect(view.el.querySelectorAll('form.chatroom-form fieldset').length).toBe(2);
                    var $membersonly = $(view.el.querySelector('input[name="muc#roomconfig_membersonly"]'));
                    expect($membersonly.length).toBe(1);
                    expect($membersonly.attr('type')).toBe('checkbox');
                    $membersonly.prop('checked', true);

                    var $moderated = $(view.el.querySelector('input[name="muc#roomconfig_moderatedroom"]'));
                    expect($moderated.length).toBe(1);
                    expect($moderated.attr('type')).toBe('checkbox');
                    $moderated.prop('checked', true);

                    var $password = $(view.el.querySelector('input[name="muc#roomconfig_roomsecret"]'));
                    expect($password.length).toBe(1);
                    expect($password.attr('type')).toBe('password');

                    var $allowpm = $(view.el.querySelector('select[name="muc#roomconfig_allowpm"]'));
                    expect($allowpm.length).toBe(1);
                    $allowpm.val('moderators');

                    var $presencebroadcast = $(view.el.querySelector('select[name="muc#roomconfig_presencebroadcast"]'));
                    expect($presencebroadcast.length).toBe(1);
                    $presencebroadcast.val(['moderator']);

                    view.el.querySelector('input[type="submit"]').click();

                    var $sent_stanza = $(sent_IQ.toLocaleString());
                    expect($sent_stanza.find('field[var="muc#roomconfig_membersonly"] value').text()).toBe('1');
                    expect($sent_stanza.find('field[var="muc#roomconfig_moderatedroom"] value').text()).toBe('1');
                    expect($sent_stanza.find('field[var="muc#roomconfig_allowpm"] value').text()).toBe('moderators');
                    expect($sent_stanza.find('field[var="muc#roomconfig_presencebroadcast"] value').text()).toBe('moderator');
                    done();
                }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
            }));

            it("shows all members even if they're not currently present in the groupchat",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function() {
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
                }).catch(_.partial(console.error, _));
            }));

            it("shows users currently present in the groupchat",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function() {
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
                }).catch(_.partial(console.error, _));
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
                    var occupants = view.el.querySelector('.occupant-list').querySelectorAll('li .occupant-nick');
                    expect(occupants.length).toBe(2);
                    expect($(occupants).first().text().trim()).toBe("&lt;img src=&quot;x&quot; onerror=&quot;alert(123)&quot;/&gt;");
                    done();
                });
            }));

            it("indicates moderators and visitors by means of a special css class and tooltip",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';

                    var occupants = view.el.querySelector('.occupant-list').querySelectorAll('li');
                    expect(occupants.length).toBe(1);
                    expect($(occupants).first().find('.occupant-nick').text().trim()).toBe("dummy");
                    expect($(occupants).first().find('.badge').length).toBe(2);
                    expect($(occupants).first().find('.badge').first().text()).toBe('Owner');
                    expect($(occupants).first().find('.badge').last().text()).toBe('Moderator');

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
                    expect($(occupants).first().find('.occupant-nick').text().trim()).toBe("dummy");
                    expect($(occupants).last().find('.occupant-nick').text().trim()).toBe("moderatorman");
                    expect($(occupants).last().find('.badge').length).toBe(2);
                    expect($(occupants).last().find('.badge').first().text()).toBe('Admin');
                    expect($(occupants).last().find('.badge').last().text()).toBe('Moderator');

                    expect($(occupants).last().attr('title')).toBe(
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
                    expect($(occupants).last().find('.occupant-nick').text().trim()).toBe("visitorwoman");
                    expect($(occupants).last().find('.badge').length).toBe(1);
                    expect($(occupants).last().find('.badge').last().text()).toBe('Visitor');
                    expect($(occupants).last().attr('title')).toBe(
                        contact_jid + ' This user can NOT send messages in this groupchat. Click to mention visitorwoman in your message.'
                    );
                    done();
                }).catch(_.partial(console.error, _));
            }));

            it("will use the user's reserved nickname, if it exists",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        function (done, _converse) {

                let sent_IQ, IQ_id, view;
                const IQ_stanzas = _converse.connection.IQ_stanzas;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    if (iq.nodeTree.getAttribute('to') === 'lounge@localhost') {
                        sent_IQ = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    } else {
                        sendIQ.bind(this)(iq, callback, errback);
                    }
                });

                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy')
                .then(() => {
                    // We pretend this is a new room, so no disco info is returned.
                    var features_stanza = $iq({
                            from: 'lounge@localhost',
                            'id': IQ_id,
                            'to': 'dummy@localhost/desktop',
                            'type': 'error'
                        }).c('error', {'type': 'cancel'})
                            .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                    _converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                    view = _converse.chatboxviews.get('lounge@localhost');
                    spyOn(view, 'join').and.callThrough();

                    /* <iq from='hag66@shakespeare.lit/pda'
                     *     id='getnick1'
                     *     to='coven@chat.shakespeare.lit'
                     *     type='get'>
                     * <query xmlns='http://jabber.org/protocol/disco#info'
                     *         node='x-roomuser-item'/>
                     * </iq>
                     */
                    return test_utils.waitUntil(() => _.filter(IQ_stanzas, (iq) => iq.nodeTree.querySelector('query[node="x-roomuser-item"]')).length)
                }).then(() => {
                    const iq = _.filter(IQ_stanzas, function (iq) {
                        return iq.nodeTree.querySelector(`query[node="x-roomuser-item"]`);
                    }).pop();
                    const id = iq.nodeTree.getAttribute('id');
                    expect(iq.toLocaleString()).toBe(
                        "<iq to='lounge@localhost' from='dummy@localhost/resource' "+
                            "type='get' xmlns='jabber:client' id='"+id+"'>"+
                                "<query xmlns='http://jabber.org/protocol/disco#info' node='x-roomuser-item'/></iq>");

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

                    // The user has just entered the groupchat (because join was called)
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
                        role: 'participant'
                    }).up()
                    .c('status').attrs({code:'110'}).up()
                    .c('status').attrs({code:'210'}).nodeTree;

                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    var info_text = $(view.el).find('.chat-content .chat-info:first').text();
                    expect(info_text).toBe('Your nickname has been automatically set to thirdwitch');
                    done();
                });
            }));

            it("allows the user to invite their roster contacts to enter the groupchat",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        function (done, _converse) {

                test_utils.createContacts(_converse, 'current'); // We need roster contacts, so that we have someone to invite
                // Since we don't actually fetch roster contacts, we need to
                // cheat here and emit the event.
                _converse.emit('rosterContactsFetched');

                let view;
                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy')
                .then(() => {

                    spyOn(_converse, 'emit');
                    spyOn(window, 'prompt').and.callFake(function () {
                        return "Please join!";
                    });
                    view = _converse.chatboxviews.get('lounge@localhost');

                    // XXX: cheating a lttle bit, normally this'll be set after
                    // receiving the features for the groupchat.
                    view.model.set('open', 'true');

                    spyOn(view.model, 'directInvite').and.callThrough();
                    var $input;
                    $(view.el).find('.chat-area').remove();

                    return test_utils.waitUntil(() => view.el.querySelectorAll('input.invited-contact').length)
                }).then(function () {
                    var $input = $(view.el).find('input.invited-contact');
                    expect($input.attr('placeholder')).toBe('Invite');
                    $input.val("Felix");
                    var evt = new Event('input');
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
                        expect(view.model.directInvite).toHaveBeenCalled();
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
                    var reason = "Please join this groupchat";

                    expect(_converse.chatboxes.models.length).toBe(1);
                    expect(_converse.chatboxes.models[0].id).toBe("controlbox");

                    var stanza = Strophe.xmlHtmlNode(
                        '<message xmlns="jabber:client" to="'+_converse.bare_jid+'" from="'+from_jid+'" id="9bceb415-f34b-4fa4-80d5-c0d076a24231">'+
                            '<x xmlns="jabber:x:conference" jid="'+room_jid+'" reason="'+reason+'"/>'+
                        '</message>').firstChild;
                    _converse.onDirectMUCInvitation(stanza);
                    expect(window.confirm).toHaveBeenCalledWith(
                        name + ' has invited you to join a groupchat: '+ room_jid +
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

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                    spyOn(_converse, 'emit');
                    var view = _converse.chatboxviews.get('lounge@localhost');


                    if (!$(view.el).find('.chat-area').length) { view.renderChatArea(); }
                    var nick = mock.chatroom_names[0];

                    view.model.occupants.create({
                        'nick': nick,
                        'muc_jid': `${view.model.get('jid')}/${nick}`
                    });

                    var text = 'This is a received message';
                    var message = $msg({
                        from: 'lounge@localhost/'+nick,
                        id: '1',
                        to: 'dummy@localhost',
                        type: 'groupchat'
                    }).c('body').t(text);
                    view.model.onMessage(message.nodeTree);
                    var $chat_content = $(view.el).find('.chat-content');
                    expect($chat_content.find('.chat-msg').length).toBe(1);
                    expect($chat_content.find('.chat-msg__text').text()).toBe(text);
                    expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                    done();
                });
            }));

            it("shows sent groupchat messages",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                    spyOn(_converse, 'emit');
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    if (!$(view.el).find('.chat-area').length) { view.renderChatArea(); }
                    var text = 'This is a sent message';
                    var textarea = view.el.querySelector('.chat-textarea');
                    textarea.value = text;
                    view.keyPressed({
                        target: textarea,
                        preventDefault: _.noop,
                        keyCode: 13
                    });

                    expect(_converse.emit).toHaveBeenCalledWith('messageSend', text);
                    var $chat_content = $(view.el).find('.chat-content');
                    expect($chat_content.find('.chat-msg').length).toBe(1);

                    // Let's check that if we receive the same message again, it's
                    // not shown.
                    var message = $msg({
                        from: 'lounge@localhost/dummy',
                        to: 'dummy@localhost.com',
                        type: 'groupchat',
                        id: view.model.messages.at(0).get('msgid')
                    }).c('body').t(text);
                    view.model.onMessage(message.nodeTree);
                    expect($chat_content.find('.chat-msg').length).toBe(1);
                    expect($chat_content.find('.chat-msg__text').last().text()).toBe(text);
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
                        view.model.onMessage(
                            $msg({
                                from: 'lounge@localhost/someone',
                                to: 'dummy@localhost.com',
                                type: 'groupchat',
                                id: (new Date()).getTime(),
                            }).c('body').t('Message: '+i).tree());
                    }
                    // Give enough time for `markScrolled` to have been called
                    setTimeout(function () {
                        view.content.scrollTop = 0;
                        view.model.onMessage(
                            $msg({
                                from: 'lounge@localhost/someone',
                                to: 'dummy@localhost.com',
                                type: 'groupchat',
                                id: (new Date()).getTime(),
                            }).c('body').t(message).tree());

                        // Now check that the message appears inside the chatbox in the DOM
                        var $chat_content = $(view.el).find('.chat-content');
                        var msg_txt = $chat_content.find('.chat-msg:last').find('.chat-msg__text').text();
                        expect(msg_txt).toEqual(message);
                        expect(view.content.scrollTop).toBe(0);
                        done();
                    }, 500);
                });
            }));

            it("shows received groupchat subject messages",
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
                    var chat_content = view.el.querySelector('.chat-content');
                    expect($(chat_content).find('.chat-event:last').text()).toBe('Topic set by ralphm');
                    expect($(chat_content).find('.chat-topic:last').text()).toBe(text);
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
                    view.model.set({'subject': {
                        'text': subject,
                        'author': 'ralphm'
                    }});
                    var chat_content = view.el.querySelector('.chat-content');
                    expect($(chat_content).find('.chat-event:last').text()).toBe('Topic set by ralphm');
                    expect($(chat_content).find('.chat-topic:last').text()).toBe(subject);
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
                var __ = _converse.__;
                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'oldnick').then(function () {
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    var $chat_content = $(view.el).find('.chat-content');

                    var $occupants = $(view.el.querySelector('.occupant-list'));
                    expect($occupants.children().length).toBe(1);
                    expect($occupants.children().first(0).find('.occupant-nick').text().trim()).toBe("oldnick");

                    expect($chat_content.find('div.chat-info').length).toBe(1);
                    expect($chat_content.find('div.chat-info:first').html()).toBe("oldnick has entered the groupchat");

                    var presence = $pres().attrs({
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
                    expect($chat_content.find('div.chat-info').length).toBe(2);
                    expect($chat_content.find('div.chat-info').last().html()).toBe(
                        __(_converse.muc.new_nickname_messages["303"], "newnick")
                    );

                    $occupants = $(view.el.querySelector('.occupant-list'));
                    expect($occupants.children().length).toBe(1);

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
                    expect($chat_content.find('div.chat-info').length).toBe(3);
                    expect($chat_content.find('div.chat-info').get(1).textContent).toBe(
                        __(_converse.muc.new_nickname_messages["303"], "newnick")
                    );
                    $occupants = $(view.el.querySelector('.occupant-list'));
                    expect($occupants.children().length).toBe(1);
                    expect($occupants.children().find('.occupant-nick').first(0).text()).toBe("newnick");
                    done();
                });
            }));

            it("queries for the groupchat information before attempting to join the user",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        function (done, _converse) {

                var sent_IQ, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                let view;
                _converse.api.rooms.open('coven@chat.shakespeare.lit', {'nick': 'some1'})
                .then(() => {
                    // Check that the groupchat queried for the feautures.
                    expect(sent_IQ.toLocaleString()).toBe(
                        "<iq from='dummy@localhost/resource' to='coven@chat.shakespeare.lit' type='get' xmlns='jabber:client' id='"+IQ_id+"'>"+
                            "<query xmlns='http://jabber.org/protocol/disco#info'/>"+
                        "</iq>");

                    view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                    spyOn(view.model, 'parseRoomFeatures').and.callThrough();
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
                    return test_utils.waitUntil(() => view.model.parseRoomFeatures.calls.count(), 300)
                }).then(() => {
                    expect(view.model.get('features_fetched')).toBeTruthy();
                    expect(view.model.get('passwordprotected')).toBe(true);
                    expect(view.model.get('hidden')).toBe(true);
                    expect(view.model.get('temporary')).toBe(true);
                    expect(view.model.get('open')).toBe(true);
                    expect(view.model.get('unmoderated')).toBe(true);
                    expect(view.model.get('nonanonymous')).toBe(true);
                    done();
                });
            }));

            it("updates the shown features when the groupchat configuration has changed",
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
                }).catch(_.partial(console.error, _));
            }));

            it("indicates when a room is no longer anonymous",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var sent_IQ, IQ_id;
                var sendIQ = _converse.connection.sendIQ;

                test_utils.openAndEnterChatRoom(_converse, 'coven', 'chat.shakespeare.lit', 'some1').then(function () {
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                        sent_IQ = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });

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
                    var $chat_body = $(view.el.querySelector('.chatroom-body'));
                    expect($chat_body.find('.message:last').text()).toBe('This groupchat is now no longer anonymous');
                    done();
                });
            }));

            it("informs users if they have been kicked out of the groupchat",
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
                    _converse.connection._dataRecv(test_utils.createRequest(presence));

                    const view = _converse.chatboxviews.get('lounge@localhost');
                    expect($(view.el.querySelector('.chat-area')).is(':visible')).toBeFalsy();
                    expect($(view.el.querySelector('.occupants')).is(':visible')).toBeFalsy();
                    const chat_body = view.el.querySelector('.chatroom-body');
                    expect(chat_body.querySelectorAll('.disconnect-msg').length).toBe(3);
                    expect(chat_body.querySelector('.disconnect-msg:first-child').textContent).toBe(
                        'You have been kicked from this groupchat');
                    expect(chat_body.querySelector('.disconnect-msg:nth-child(2)').textContent).toBe(
                        'This action was done by Fluellen.');
                    expect(chat_body.querySelector('.disconnect-msg:nth-child(3)').textContent).toBe(
                        'The reason given is: "Avaunt, you cullion!".');
                    done();
                });
            }));

            it("can be saved to, and retrieved from, browserStorage",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        function (done, _converse) {

                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy')
                .then(() => {
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
                });
            }));

            it("can be minimized by clicking a DOM element with class 'toggle-chatbox-button'",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        function (done, _converse) {

                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy')
                .then(() => {
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
                    var trimmedview = trimmed_chatboxes.get(view.model.get('id'));
                    trimmedview.el.querySelector("a.restore-chat").click();
                    expect(view.maximize).toHaveBeenCalled();
                    expect(_converse.emit).toHaveBeenCalledWith('chatBoxMaximized', jasmine.any(Object));
                    expect(view.model.get('minimized')).toBeFalsy();
                    expect(_converse.emit.calls.count(), 3);
                    done();

                });
            }));

            it("can be closed again by clicking a DOM element with class 'close-chatbox-button'",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        function (done, _converse) {

                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy')
                .then(() => {
                    const view = _converse.chatboxviews.get('lounge@localhost');
                    spyOn(view, 'close').and.callThrough();
                    spyOn(_converse, 'emit');
                    spyOn(view.model, 'leave');
                    view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                    view.el.querySelector('.close-chatbox-button').click();
                    expect(view.close).toHaveBeenCalled();
                    expect(view.model.leave).toHaveBeenCalled();
                    expect(_converse.emit).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                    done();
                });
            }));
        });


        describe("Each chat groupchat can take special commands", function () {

            it("takes /help to show the available commands",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    spyOn(view, 'onMessageSubmitted').and.callThrough();
                    var textarea = view.el.querySelector('.chat-textarea');
                    textarea.value = '/help This is the groupchat subject';
                    view.keyPressed({
                        target: textarea,
                        preventDefault: _.noop,
                        keyCode: 13
                    });

                    expect(view.onMessageSubmitted).toHaveBeenCalled();
                    const info_messages = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info'), 0);
                    expect(info_messages.length).toBe(17);
                    expect(info_messages.pop().textContent).toBe('/voice: Allow muted user to post messages');
                    expect(info_messages.pop().textContent).toBe('/topic: Set groupchat subject (alias for /subject)');
                    expect(info_messages.pop().textContent).toBe('/subject: Set groupchat subject');
                    expect(info_messages.pop().textContent).toBe('/revoke: Revoke user\'s membership');
                    expect(info_messages.pop().textContent).toBe('/owner: Grant ownership of this groupchat');
                    expect(info_messages.pop().textContent).toBe('/op: Grant moderator role to user');
                    expect(info_messages.pop().textContent).toBe('/nick: Change your nickname');
                    expect(info_messages.pop().textContent).toBe('/mute: Remove user\'s ability to post messages');
                    expect(info_messages.pop().textContent).toBe('/member: Grant membership to a user');
                    expect(info_messages.pop().textContent).toBe('/me: Write in 3rd person');
                    expect(info_messages.pop().textContent).toBe('/kick: Kick user from groupchat');
                    expect(info_messages.pop().textContent).toBe('/help: Show this menu');
                    expect(info_messages.pop().textContent).toBe('/deop: Change user role to participant');
                    expect(info_messages.pop().textContent).toBe('/clear: Remove messages');
                    expect(info_messages.pop().textContent).toBe('/ban: Ban user from groupchat');
                    expect(info_messages.pop().textContent).toBe('/admin: Change user\'s affiliation to admin');
                    done();
                }).catch(_.partial(console.error, _));
            }));

            it("takes /member to make an occupant a member",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                let iq_stanza, view;

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'muc.localhost', 'dummy')
                .then(() => {

                    view = _converse.chatboxviews.get('lounge@muc.localhost');
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
                        .toBe(`Error: Can't find a groupchat participant with the nickname "chris"`)

                    // Now test with an existing nick
                    textarea.value = '/member marc Welcome to the club!';
                    view.keyPressed({
                        target: textarea,
                        preventDefault: _.noop,
                        keyCode: 13
                    });
                    expect(_converse.connection.send).toHaveBeenCalled();
                    expect(sent_stanza.outerHTML).toBe(
                        `<iq to="lounge@muc.localhost" type="set" xmlns="jabber:client" id="${sent_stanza.getAttribute('id')}">`+
                            `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                                `<item affiliation="member" jid="marc@localhost">`+
                                    `<reason>Welcome to the club!</reason>`+
                                `</item>`+
                            `</query>`+
                        `</iq>`);

                    const result = $iq({
                        "xmlns": "jabber:client",
                        "type": "result",
                        "to": "dummy@localhost/resource",
                        "from": "lounge@muc.localhost",
                        "id": sent_stanza.getAttribute('id')
                    });
                    _converse.connection.IQ_stanzas = [];
                    _converse.connection._dataRecv(test_utils.createRequest(result));

                    return test_utils.waitUntil(() => {
                        return _.filter(
                            _converse.connection.IQ_stanzas,
                            (iq) => {
                                const node = iq.nodeTree.querySelector('iq[to="lounge@muc.localhost"][type="get"] item[affiliation="member"]');
                                if (node) { iq_stanza = iq.nodeTree;}
                                return node;
                            }).length;
                    });
                }).then(() => {
                    expect(iq_stanza.outerHTML).toBe(
                        `<iq to="lounge@muc.localhost" type="get" xmlns="jabber:client" id="${iq_stanza.getAttribute('id')}">`+
                            `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                                `<item affiliation="member"/>`+
                            `</query>`+
                        `</iq>`)
                    expect(view.model.occupants.length).toBe(2);

                    const result = $iq({
                        "xmlns": "jabber:client",
                        "type": "result",
                        "to": "dummy@localhost/resource",
                        "from": "lounge@muc.localhost",
                        "id": iq_stanza.getAttribute("id")
                    }).c("query", {"xmlns": "http://jabber.org/protocol/muc#admin"})
                        .c("item", {"jid": "marc", "affiliation": "member"});
                    _converse.connection._dataRecv(test_utils.createRequest(result));

                    expect(view.model.occupants.length).toBe(2);
                    return test_utils.waitUntil(() => {
                        return _.filter(
                            _converse.connection.IQ_stanzas,
                            (iq) => {
                                const node = iq.nodeTree.querySelector('iq[to="lounge@muc.localhost"][type="get"] item[affiliation="owner"]');
                                if (node) { iq_stanza = iq.nodeTree;}
                                return node;
                            }).length;
                    });
                }).then(() => {
                    expect(iq_stanza.outerHTML).toBe(
                        `<iq to="lounge@muc.localhost" type="get" xmlns="jabber:client" id="${iq_stanza.getAttribute('id')}">`+
                            `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                                `<item affiliation="owner"/>`+
                            `</query>`+
                        `</iq>`)
                    expect(view.model.occupants.length).toBe(2);

                    const result = $iq({
                        "xmlns": "jabber:client",
                        "type": "result",
                        "to": "dummy@localhost/resource",
                        "from": "lounge@muc.localhost",
                        "id": iq_stanza.getAttribute("id")
                    }).c("query", {"xmlns": "http://jabber.org/protocol/muc#admin"})
                        .c("item", {"jid": "dummy@localhost", "affiliation": "owner"});
                    _converse.connection._dataRecv(test_utils.createRequest(result));

                    expect(view.model.occupants.length).toBe(2);
                    return test_utils.waitUntil(() => {
                        return _.filter(
                            _converse.connection.IQ_stanzas,
                            (iq) => {
                                const node = iq.nodeTree.querySelector('iq[to="lounge@muc.localhost"][type="get"] item[affiliation="admin"]');
                                if (node) { iq_stanza = iq.nodeTree;}
                                return node;
                            }).length;
                    });
                }).then(() => {
                    expect(iq_stanza.outerHTML).toBe(
                        `<iq to="lounge@muc.localhost" type="get" xmlns="jabber:client" id="${iq_stanza.getAttribute('id')}">`+
                            `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                                `<item affiliation="admin"/>`+
                            `</query>`+
                        `</iq>`)
                    expect(view.model.occupants.length).toBe(2);

                    const result = $iq({
                        "xmlns": "jabber:client",
                        "type": "result",
                        "to": "dummy@localhost/resource",
                        "from": "lounge@muc.localhost",
                        "id": iq_stanza.getAttribute("id")
                    }).c("query", {"xmlns": "http://jabber.org/protocol/muc#admin"})
                    _converse.connection._dataRecv(test_utils.createRequest(result));

                    return test_utils.waitUntil(() => view.el.querySelectorAll('.badge').length > 1);
                }).then(() => {
                    expect(view.model.occupants.length).toBe(2);
                    expect(view.el.querySelectorAll('.occupant').length).toBe(2);
                    done();
                }).catch(_.partial(console.error, _));
            }));

            it("takes /topic to set the groupchat topic",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                    var sent_stanza;
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    spyOn(view, 'onMessageSubmitted').and.callThrough();
                    spyOn(view, 'clearMessages');
                    spyOn(_converse.connection, 'send').and.callFake(function (stanza) {
                        sent_stanza = stanza;
                    });
                    // Check the alias /topic
                    var textarea = view.el.querySelector('.chat-textarea');
                    textarea.value = '/topic This is the groupchat subject';
                    view.keyPressed({
                        target: textarea,
                        preventDefault: _.noop,
                        keyCode: 13
                    });
                    expect(view.onMessageSubmitted).toHaveBeenCalled();
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
                    expect(sent_stanza.outerHTML).toBe(
                        '<message to="lounge@localhost" from="dummy@localhost/resource" type="groupchat" xmlns="jabber:client">'+
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
                    expect(sent_stanza.outerHTML).toBe(
                        '<message to="lounge@localhost" from="dummy@localhost/resource" type="groupchat" xmlns="jabber:client">'+
                            '<subject xmlns="jabber:client">This is yet another subject</subject>'+
                        '</message>');
                    done();
                }).catch(_.partial(console.error, _));
            }));

            it("takes /clear to clear messages",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    spyOn(view, 'onMessageSubmitted').and.callThrough();
                    spyOn(view, 'clearMessages');
                    var textarea = view.el.querySelector('.chat-textarea')
                    textarea.value = '/clear';
                    view.keyPressed({
                        target: textarea,
                        preventDefault: _.noop,
                        keyCode: 13
                    });

                    expect(view.onMessageSubmitted).toHaveBeenCalled();
                    expect(view.clearMessages).toHaveBeenCalled();
                    done();
                }).catch(_.partial(console.error, _));
            }));

            it("takes /owner to make a user an owner",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                    var sent_IQ, IQ_id;
                    var sendIQ = _converse.connection.sendIQ;
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                        sent_IQ = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    spyOn(view, 'onMessageSubmitted').and.callThrough();
                    spyOn(view.model, 'setAffiliation').and.callThrough();
                    spyOn(view, 'showErrorMessage').and.callThrough();
                    spyOn(view, 'validateRoleChangeCommand').and.callThrough();
                    var textarea = view.el.querySelector('.chat-textarea')
                    textarea.value = '/owner';
                    view.keyPressed({
                        target: textarea,
                        preventDefault: _.noop,
                        keyCode: 13
                    });
                    expect(view.onMessageSubmitted).toHaveBeenCalled();
                    expect(view.validateRoleChangeCommand).toHaveBeenCalled();
                    expect(view.showErrorMessage).toHaveBeenCalledWith(
                        "Error: the \"owner\" command takes two arguments, the user's nickname and optionally a reason.");
                    expect(view.model.setAffiliation).not.toHaveBeenCalled();

                    // Call now with the correct amount of arguments.
                    // XXX: Calling onMessageSubmitted directly, trying
                    // again via triggering Event doesn't work for some weird
                    // reason.
                    view.onMessageSubmitted('/owner annoyingGuy@localhost You\'re responsible');
                    expect(view.validateRoleChangeCommand.calls.count()).toBe(2);
                    expect(view.showErrorMessage.calls.count()).toBe(1);
                    expect(view.model.setAffiliation).toHaveBeenCalled();
                    // Check that the member list now gets updated
                    expect(sent_IQ.toLocaleString()).toBe(
                        "<iq to='lounge@localhost' type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                            "<query xmlns='http://jabber.org/protocol/muc#admin'>"+
                                "<item affiliation='owner' jid='annoyingGuy@localhost'>"+
                                    "<reason>You&apos;re responsible</reason>"+
                                "</item>"+
                            "</query>"+
                        "</iq>");
                    done();
                }).catch(_.partial(console.error, _));
            }));

            it("takes /ban to ban a user",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                    var sent_IQ, IQ_id;
                    var sendIQ = _converse.connection.sendIQ;
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                        sent_IQ = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    spyOn(view, 'onMessageSubmitted').and.callThrough();
                    spyOn(view.model, 'setAffiliation').and.callThrough();
                    spyOn(view, 'showErrorMessage').and.callThrough();
                    spyOn(view, 'validateRoleChangeCommand').and.callThrough();
                    var textarea = view.el.querySelector('.chat-textarea')
                    textarea.value = '/ban';
                    view.keyPressed({
                        target: textarea,
                        preventDefault: _.noop,
                        keyCode: 13
                    });
                    expect(view.onMessageSubmitted).toHaveBeenCalled();
                    expect(view.validateRoleChangeCommand).toHaveBeenCalled();
                    expect(view.showErrorMessage).toHaveBeenCalledWith(
                        "Error: the \"ban\" command takes two arguments, the user's nickname and optionally a reason.");
                    expect(view.model.setAffiliation).not.toHaveBeenCalled();
                    // Call now with the correct amount of arguments.
                    // XXX: Calling onMessageSubmitted directly, trying
                    // again via triggering Event doesn't work for some weird
                    // reason.
                    view.onMessageSubmitted('/ban annoyingGuy@localhost You\'re annoying');
                    expect(view.validateRoleChangeCommand.calls.count()).toBe(2);
                    expect(view.showErrorMessage.calls.count()).toBe(1);
                    expect(view.model.setAffiliation).toHaveBeenCalled();
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
                }).catch(_.partial(console.error, _));
            }));

            it("takes /kick to kick a user",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                    var sent_IQ, IQ_id;
                    var sendIQ = _converse.connection.sendIQ;
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                        sent_IQ = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    spyOn(view, 'onMessageSubmitted').and.callThrough();
                    spyOn(view, 'modifyRole').and.callThrough();
                    spyOn(view, 'showErrorMessage').and.callThrough();
                    spyOn(view, 'validateRoleChangeCommand').and.callThrough();

                    var textarea = view.el.querySelector('.chat-textarea')
                    textarea.value = '/kick';
                    view.keyPressed({
                        target: textarea,
                        preventDefault: _.noop,
                        keyCode: 13
                    });
                    expect(view.onMessageSubmitted).toHaveBeenCalled();
                    expect(view.validateRoleChangeCommand).toHaveBeenCalled();
                    expect(view.showErrorMessage).toHaveBeenCalledWith(
                        "Error: the \"kick\" command takes two arguments, the user's nickname and optionally a reason.");
                    expect(view.modifyRole).not.toHaveBeenCalled();
                    // Call now with the correct amount of arguments.
                    // XXX: Calling onMessageSubmitted directly, trying
                    // again via triggering Event doesn't work for some weird
                    // reason.
                    view.onMessageSubmitted('/kick annoyingGuy You\'re annoying');
                    expect(view.validateRoleChangeCommand.calls.count()).toBe(2);
                    expect(view.showErrorMessage.calls.count()).toBe(1);
                    expect(view.modifyRole).toHaveBeenCalled();
                    expect(sent_IQ.toLocaleString()).toBe(
                        "<iq to='lounge@localhost' type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                            "<query xmlns='http://jabber.org/protocol/muc#admin'>"+
                                "<item nick='annoyingGuy' role='none'>"+
                                    "<reason>You&apos;re annoying</reason>"+
                                "</item>"+
                            "</query>"+
                        "</iq>");

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
                    var presence = $pres({
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
                    expect(
                        view.el.querySelectorAll('.chat-info')[2].textContent).toBe(
                        "annoyingGuy has been kicked out");
                    done();
                }).catch(_.partial(console.error, _));
            }));


            it("takes /op and /deop to make a user a moderator or not",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                    var sent_IQ, IQ_id;
                    var sendIQ = _converse.connection.sendIQ;
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                        sent_IQ = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    spyOn(view, 'onMessageSubmitted').and.callThrough();
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

                    expect(view.onMessageSubmitted).toHaveBeenCalled();
                    expect(view.validateRoleChangeCommand).toHaveBeenCalled();
                    expect(view.showErrorMessage).toHaveBeenCalledWith(
                        "Error: the \"op\" command takes two arguments, the user's nickname and optionally a reason.");

                    expect(view.modifyRole).not.toHaveBeenCalled();
                    // Call now with the correct amount of arguments.
                    // XXX: Calling onMessageSubmitted directly, trying
                    // again via triggering Event doesn't work for some weird
                    // reason.
                    view.onMessageSubmitted('/op trustworthyguy You\'re trustworthy');
                    expect(view.validateRoleChangeCommand.calls.count()).toBe(2);
                    expect(view.showErrorMessage.calls.count()).toBe(1);
                    expect(view.modifyRole).toHaveBeenCalled();
                    expect(sent_IQ.toLocaleString()).toBe(
                        "<iq to='lounge@localhost' type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                            "<query xmlns='http://jabber.org/protocol/muc#admin'>"+
                                "<item nick='trustworthyguy' role='moderator'>"+
                                    "<reason>You&apos;re trustworthy</reason>"+
                                "</item>"+
                            "</query>"+
                        "</iq>");

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

                    view.onMessageSubmitted('/deop trustworthyguy Perhaps not');
                    expect(view.validateRoleChangeCommand.calls.count()).toBe(3);
                    expect(view.showChatEvent.calls.count()).toBe(1);
                    expect(view.modifyRole).toHaveBeenCalled();
                    expect(sent_IQ.toLocaleString()).toBe(
                        "<iq to='lounge@localhost' type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                            "<query xmlns='http://jabber.org/protocol/muc#admin'>"+
                                "<item nick='trustworthyguy' role='participant'>"+
                                    "<reason>Perhaps not</reason>"+
                                "</item>"+
                            "</query>"+
                        "</iq>");

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
                }).catch(_.partial(console.error, _));
            }));

            it("takes /mute and /voice to mute and unmute a user",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy')
                .then(() => {
                    var sent_IQ, IQ_id;
                    var sendIQ = _converse.connection.sendIQ;
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                        sent_IQ = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });
                    var view = _converse.chatboxviews.get('lounge@localhost');
                    spyOn(view, 'onMessageSubmitted').and.callThrough();
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

                    var textarea = view.el.querySelector('.chat-textarea')
                    textarea.value = '/mute';
                    view.keyPressed({
                        target: textarea,
                        preventDefault: _.noop,
                        keyCode: 13
                    });

                    expect(view.onMessageSubmitted).toHaveBeenCalled();
                    expect(view.validateRoleChangeCommand).toHaveBeenCalled();
                    expect(view.showErrorMessage).toHaveBeenCalledWith(
                        "Error: the \"mute\" command takes two arguments, the user's nickname and optionally a reason.");
                    expect(view.modifyRole).not.toHaveBeenCalled();
                    // Call now with the correct amount of arguments.
                    // XXX: Calling onMessageSubmitted directly, trying
                    // again via triggering Event doesn't work for some weird
                    // reason.
                    view.onMessageSubmitted('/mute annoyingGuy You\'re annoying');
                    expect(view.validateRoleChangeCommand.calls.count()).toBe(2);
                    expect(view.showErrorMessage.calls.count()).toBe(1);
                    expect(view.modifyRole).toHaveBeenCalled();
                    expect(sent_IQ.toLocaleString()).toBe(
                        "<iq to='lounge@localhost' type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                            "<query xmlns='http://jabber.org/protocol/muc#admin'>"+
                                "<item nick='annoyingGuy' role='visitor'>"+
                                    "<reason>You&apos;re annoying</reason>"+
                                "</item>"+
                            "</query>"+
                        "</iq>");

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

                    view.onMessageSubmitted('/voice annoyingGuy Now you can talk again');
                    expect(view.validateRoleChangeCommand.calls.count()).toBe(3);
                    expect(view.showChatEvent.calls.count()).toBe(1);
                    expect(view.modifyRole).toHaveBeenCalled();
                    expect(sent_IQ.toLocaleString()).toBe(
                        "<iq to='lounge@localhost' type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                            "<query xmlns='http://jabber.org/protocol/muc#admin'>"+
                                "<item nick='annoyingGuy' role='participant'>"+
                                    "<reason>Now you can talk again</reason>"+
                                "</item>"+
                            "</query>"+
                        "</iq>");

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
                }).catch(_.partial(console.error, _));
            }));
        });

        describe("When attempting to enter a groupchat", function () {

            it("will use the nickname set in the global settings if the user doesn't have a VCard nickname",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {'nickname': 'Benedict-Cucumberpatch'},
                    function (done, _converse) {

                test_utils.openChatRoomViaModal(_converse, 'problematic@muc.localhost')
                .then(function () {
                    const view = _converse.chatboxviews.get('problematic@muc.localhost');
                    expect(view.model.get('nick')).toBe('Benedict-Cucumberpatch');
                    done();
                }).catch(_.partial(console.error, _));
            }));

            it("will show an error message if the groupchat requires a password",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    function (done, _converse) {

                test_utils.openChatRoomViaModal(_converse, 'problematic@muc.localhost', 'dummy')
                .then(function () {
                    var view = _converse.chatboxviews.get('problematic@muc.localhost');
                    spyOn(view, 'renderPasswordForm').and.callThrough();

                    var presence = $pres().attrs({
                        from:'problematic@muc.localhost/dummy',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({by:'lounge@localhost', type:'auth'})
                        .c('not-authorized').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'});

                    _converse.connection._dataRecv(test_utils.createRequest(presence));

                    var $chat_body = $(view.el).find('.chatroom-body');
                    expect(view.renderPasswordForm).toHaveBeenCalled();
                    expect($chat_body.find('form.chatroom-form').length).toBe(1);
                    expect($chat_body.find('legend').text()).toBe('This groupchat requires a password');

                    // Let's submit the form
                    spyOn(view, 'join');
                    var input_el = view.el.querySelector('[name="password"]');
                    input_el.value = 'secret';
                    view.el.querySelector('input[type=submit]').click();
                    expect(view.join).toHaveBeenCalledWith('dummy', 'secret');
                    done();
                }).catch(_.partial(console.error, _));
            }));

            it("will show an error message if the groupchat is members-only and the user not included",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openChatRoomViaModal(_converse, 'problematic@muc.localhost', 'dummy')
                .then(function () {
                    var presence = $pres().attrs({
                        from:'problematic@muc.localhost/dummy',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({by:'lounge@localhost', type:'auth'})
                        .c('registration-required').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                    var view = _converse.chatboxviews.get('problematic@muc.localhost');
                    spyOn(view, 'showErrorMessage').and.callThrough();
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(view.el.querySelector('.chatroom-body .disconnect-container .disconnect-msg:last-child').textContent)
                        .toBe('You are not on the member list of this groupchat.');
                    done();
                }).catch(_.partial(console.error, _));
            }));

            it("will show an error message if the user has been banned",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openChatRoomViaModal(_converse, 'problematic@muc.localhost', 'dummy')
                .then(function () {
                    var presence = $pres().attrs({
                        from:'problematic@muc.localhost/dummy',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({by:'lounge@localhost', type:'auth'})
                        .c('forbidden').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                    var view = _converse.chatboxviews.get('problematic@muc.localhost');
                    spyOn(view, 'showErrorMessage').and.callThrough();
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(view.el.querySelector('.chatroom-body .disconnect-container .disconnect-msg:last-child').textContent)
                        .toBe('You have been banned from this groupchat.');
                    done();
                }).catch(_.partial(console.error, _));
            }));

            it("will render a nickname form if a nickname conflict happens and muc_nickname_from_jid=false",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openChatRoomViaModal(_converse, 'problematic@muc.localhost', 'dummy')
                .then(function () {
                    var presence = $pres().attrs({
                        from:'problematic@muc.localhost/dummy',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                        .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                    var view = _converse.chatboxviews.get('problematic@muc.localhost');
                    spyOn(view, 'showErrorMessage').and.callThrough();
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect($(view.el).find('.chatroom-body form.chatroom-form label:first').text()).toBe('Please choose your nickname');

                    var $input = $(view.el).find('.chatroom-body form.chatroom-form input:first');
                    $input.val('nicky');
                    view.el.querySelector('input[type=submit]').click();
                    done();
                }).catch(_.partial(console.error, _));
            }));

            it("will automatically choose a new nickname if a nickname conflict happens and muc_nickname_from_jid=true",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openChatRoomViaModal(_converse, 'problematic@muc.localhost', 'dummy')
                .then(function () {
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

                    var attrs = {
                        from:'problematic@muc.localhost/dummy',
                        to:'dummy@localhost/pda',
                        type:'error'
                    };
                    attrs.id = new Date().getTime();
                    var presence = $pres().attrs(attrs)
                        .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                        .c('error').attrs({by:'problematic@muc.localhost', type:'cancel'})
                            .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                    var view = _converse.chatboxviews.get('problematic@muc.localhost');
                    spyOn(view, 'showErrorMessage').and.callThrough();
                    spyOn(view, 'join').and.callThrough();

                    // Simulate repeatedly that there's already someone in the groupchat
                    // with that nickname
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(view.join).toHaveBeenCalledWith('dummy-2');

                    attrs.from = 'problematic@muc.localhost/dummy-2';
                    attrs.id = new Date().getTime();
                    presence = $pres().attrs(attrs)
                        .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                        .c('error').attrs({by:'problematic@muc.localhost', type:'cancel'})
                            .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                    _converse.connection._dataRecv(test_utils.createRequest(presence));

                    expect(view.join).toHaveBeenCalledWith('dummy-3');

                    attrs.from = 'problematic@muc.localhost/dummy-3';
                    attrs.id = new Date().getTime();
                    presence = $pres().attrs(attrs)
                        .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                        .c('error').attrs({by:'problematic@muc.localhost', type:'cancel'})
                            .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(view.join).toHaveBeenCalledWith('dummy-4');
                    done();
                }).catch(_.partial(console.error, _));
            }));

            it("will show an error message if the user is not allowed to have created the groupchat",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openChatRoomViaModal(_converse, 'problematic@muc.localhost', 'dummy')
                .then(function () {
                    var presence = $pres().attrs({
                        from:'problematic@muc.localhost/dummy',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                        .c('not-allowed').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                    var view = _converse.chatboxviews.get('problematic@muc.localhost');
                    spyOn(view, 'showErrorMessage').and.callThrough();
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(view.el.querySelector('.chatroom-body .disconnect-container .disconnect-msg:last-child').textContent)
                        .toBe('You are not allowed to create new groupchats.');
                    done();
                }).catch(_.partial(console.error, _));
            }));

            it("will show an error message if the user's nickname doesn't conform to room policy",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openChatRoomViaModal(_converse, 'problematic@muc.localhost', 'dummy')
                .then(function () {
                    var presence = $pres().attrs({
                        from:'problematic@muc.localhost/dummy',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                        .c('not-acceptable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                    var view = _converse.chatboxviews.get('problematic@muc.localhost');
                    spyOn(view, 'showErrorMessage').and.callThrough();
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(view.el.querySelector('.chatroom-body .disconnect-container .disconnect-msg:last-child').textContent)
                        .toBe("Your nickname doesn't conform to this groupchat's policies.");
                    done();
                }).catch(_.partial(console.error, _));
            }));

            it("will show an error message if the groupchat doesn't yet exist",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openChatRoomViaModal(_converse, 'problematic@muc.localhost', 'dummy')
                .then(function () {
                    var presence = $pres().attrs({
                        from:'problematic@muc.localhost/dummy',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                        .c('item-not-found').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                    var view = _converse.chatboxviews.get('problematic@muc.localhost');
                    spyOn(view, 'showErrorMessage').and.callThrough();
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(view.el.querySelector('.chatroom-body .disconnect-container .disconnect-msg:last-child').textContent)
                        .toBe("This groupchat does not (yet) exist.");
                    done();
                }).catch(_.partial(console.error, _));
            }));

            it("will show an error message if the groupchat has reached its maximum number of participants",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openChatRoomViaModal(_converse, 'problematic@muc.localhost', 'dummy')
                .then(function () {
                    var presence = $pres().attrs({
                        from:'problematic@muc.localhost/dummy',
                            id:'n13mt3l',
                            to:'dummy@localhost/pda',
                            type:'error'})
                    .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                    .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                        .c('service-unavailable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                    var view = _converse.chatboxviews.get('problematic@muc.localhost');
                    spyOn(view, 'showErrorMessage').and.callThrough();
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(view.el.querySelector('.chatroom-body .disconnect-container .disconnect-msg:last-child').textContent)
                        .toBe("This groupchat has reached its maximum number of participants.");
                    done();
                }).catch(_.partial(console.error, _));
            }));
        });

        describe("Someone being invited to a groupchat", function () {

            it("will first be added to the member list if the groupchat is members only",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        function (done, _converse) {

                var sent_IQs = [], IQ_ids = [];
                let invitee_jid, sent_stanza, sent_id, view;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQs.push(iq);
                    IQ_ids.push(sendIQ.bind(this)(iq, callback, errback));
                });

                _converse.api.rooms.open('coven@chat.shakespeare.lit', {'nick': 'dummy'})
                .then(() => {
                    view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                    spyOn(view.model, 'parseRoomFeatures').and.callThrough();

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

                    return test_utils.waitUntil(() => view.model.parseRoomFeatures.calls.count(), 300);
                }).then(() => {
                   expect(view.model.get('membersonly')).toBeTruthy();

                   test_utils.createContacts(_converse, 'current');

                   spyOn(_converse.connection, 'send').and.callFake(function (stanza) {
                       if (stanza.nodeTree && stanza.nodeTree.nodeName === 'message') {
                           sent_id = stanza.nodeTree.getAttribute('id');
                           sent_stanza = stanza;
                       }
                   });
                   var name = mock.cur_names[0];
                   invitee_jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                   var reason = "Please join this groupchat";
                   view.model.directInvite(invitee_jid, reason);

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
                    return test_utils.waitUntil(() => IQ_ids.length, 300);
                }).then(() => {
                    // Check that the member list now gets updated
                    var iq = "<iq to='coven@chat.shakespeare.lit' type='set' xmlns='jabber:client' id='"+IQ_ids.pop()+"'>"+
                            "<query xmlns='http://jabber.org/protocol/muc#admin'>"+
                                "<item affiliation='member' jid='"+invitee_jid+"'>"+
                                    "<reason>Please join this groupchat</reason>"+
                                "</item>"+
                            "</query>"+
                        "</iq>";
                    return test_utils.waitUntil(() => _.includes(_.invokeMap(sent_IQs, Object.prototype.toLocaleString), iq), 300);
                }).then(() => {
                    // Finally check that the user gets invited.
                    expect(sent_stanza.toLocaleString()).toBe( // Strophe adds the xmlns attr (although not in spec)
                        "<message from='dummy@localhost/resource' to='"+invitee_jid+"' id='"+sent_id+"' xmlns='jabber:client'>"+
                            "<x xmlns='jabber:x:conference' jid='coven@chat.shakespeare.lit' reason='Please join this groupchat'/>"+
                        "</message>"
                    );
                    done();
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
                        function (done, _converse) {

                test_utils.openControlBox();
                _converse.emit('rosterContactsFetched');

                var roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                roomspanel.el.querySelector('.show-add-muc-modal').click();
                test_utils.closeControlBox(_converse);
                const modal = roomspanel.add_room_modal;
                test_utils.waitUntil(() => u.isVisible(modal.el), 1000)
               .then(function () {
                    spyOn(_converse.ChatRoom.prototype, 'getRoomFeatures').and.callFake(function () {
                        var deferred = new $.Deferred();
                        deferred.resolve();
                        return deferred.promise();
                    });
                    roomspanel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called

                    modal.el.querySelector('input[name="chatroom"]').value = 'lounce@muc.localhost';
                    modal.el.querySelector('form input[type="submit"]').click();
                    return test_utils.waitUntil(() => _converse.chatboxes.length);
               }).then(() => {
                    expect($('.chatroom:visible').length).toBe(1); // There should now be an open chatroom
                    done();
                }).catch(_.partial(console.error, _));
            }));

            it("contains a link to a modal which can list groupchats publically available on the server",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        function (done, _converse) {

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
                test_utils.waitUntil(() => u.isVisible(modal.el), 1000)
                .then(() => {
                    spyOn(_converse.ChatRoom.prototype, 'getRoomFeatures').and.callFake(function () {
                        var deferred = new $.Deferred();
                        deferred.resolve();
                        return deferred.promise();
                    });
                    roomspanel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called

                    // See: http://xmpp.org/extensions/xep-0045.html#disco-rooms
                    expect(modal.el.querySelectorAll('.available-chatrooms li').length).toBe(0);

                    const input = modal.el.querySelector('input[name="server"]').value = 'chat.shakespear.lit';
                    modal.el.querySelector('input[type="submit"]').click();
                    return test_utils.waitUntil(() => _converse.chatboxes.length);
                }).then(() => {
                    expect(sent_stanza.toLocaleString()).toBe(
                        "<iq to='chat.shakespear.lit' from='dummy@localhost/resource' type='get' xmlns='jabber:client' id='"+IQ_id+"'>"+
                            "<query xmlns='http://jabber.org/protocol/disco#items'/>"+
                        "</iq>"
                    );

                    var iq = $iq({
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

                    expect(modal.el.querySelectorAll('.available-chatrooms li').length).toBe(5);

                    const rooms = modal.el.querySelectorAll('.available-chatrooms li');
                    expect(rooms[0].textContent.trim()).toBe("Groupchats found:");
                    expect(rooms[1].textContent.trim()).toBe("A Lonely Heath");
                    expect(rooms[2].textContent.trim()).toBe("A Dark Cave");
                    expect(rooms[3].textContent.trim()).toBe("The Palace");
                    expect(rooms[4].textContent.trim()).toBe("Macbeth's Castle");

                    rooms[4].querySelector('.open-room').click();
                    return test_utils.waitUntil(() => _converse.chatboxes.length > 1);
                }).then(() => {
                    expect($('.chatroom:visible').length).toBe(1); // There should now be an open chatroom
                    var view = _converse.chatboxviews.get('inverness@chat.shakespeare.lit');
                    expect(view.el.querySelector('.chat-head-chatroom').textContent.trim()).toBe("Macbeth's Castle");
                    done();
                }).catch(_.partial(console.error, _));
            }));

            it("shows the number of unread mentions received",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {'allow_bookmarks': false},
                    function (done, _converse) {
                // XXX: we set `allow_bookmarks` to false, so that the groupchats
                // list gets rendered. Otherwise we would have to mock
                // the bookmark stanza exchange.

                test_utils.openControlBox();
                var roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                expect(roomspanel.el.querySelectorAll('.available-room').length).toBe(0);

                var room_jid = 'kitchen@conference.shakespeare.lit';
                test_utils.openAndEnterChatRoom(
                        _converse, 'kitchen', 'conference.shakespeare.lit', 'fires').then(function () {

                    expect(roomspanel.el.querySelectorAll('.available-room').length).toBe(1);
                    expect(roomspanel.el.querySelectorAll('.msgs-indicator').length).toBe(0);

                    var view = _converse.chatboxviews.get(room_jid);
                    view.model.set({'minimized': true});

                    var contact_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@localhost';
                    var message = 'fires: Your attention is required';
                    var nick = mock.chatroom_names[0];

                    view.model.onMessage($msg({
                            from: room_jid+'/'+nick,
                            id: (new Date()).getTime(),
                            to: 'dummy@localhost',
                            type: 'groupchat'
                        }).c('body').t(message).tree());

                    expect(roomspanel.el.querySelectorAll('.available-room').length).toBe(1);
                    expect(roomspanel.el.querySelectorAll('.msgs-indicator').length).toBe(1);
                    expect(roomspanel.el.querySelector('.msgs-indicator').textContent).toBe('1');

                    view.model.onMessage($msg({
                        'from': room_jid+'/'+nick,
                        'id': (new Date()).getTime(),
                        'to': 'dummy@localhost',
                        'type': 'groupchat'
                    }).c('body').t(message).tree());

                    expect(roomspanel.el.querySelectorAll('.available-room').length).toBe(1);
                    expect(roomspanel.el.querySelectorAll('.msgs-indicator').length).toBe(1);
                    expect(roomspanel.el.querySelector('.msgs-indicator').textContent).toBe('2');

                    view.model.set({'minimized': false});

                    expect(roomspanel.el.querySelectorAll('.available-room').length).toBe(1);
                    expect(roomspanel.el.querySelectorAll('.msgs-indicator').length).toBe(0);
                    done();
                });
            }));

            describe("A Chat Status Notification", function () {

                describe("A composing notification", function () {

                    it("will be shown if received",
                        mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched'], {},
                            function (done, _converse) {

                        test_utils.openAndEnterChatRoom(
                                _converse, 'coven', 'chat.shakespeare.lit', 'some1').then(function () {

                            var room_jid = 'coven@chat.shakespeare.lit';
                            var view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                            var $chat_content = $(view.el).find('.chat-content');

                            expect($chat_content.find('div.chat-info:first').html()).toBe("some1 has entered the groupchat");

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
                            expect($chat_content[0].querySelectorAll('div.chat-info').length).toBe(2);
                            expect($chat_content.find('div.chat-info:last').html()).toBe("newguy has entered the groupchat");

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
                            expect($chat_content[0].querySelectorAll('div.chat-info').length).toBe(3);
                            expect($chat_content.find('div.chat-info:last').html()).toBe("nomorenicks has entered the groupchat");

                            // See XEP-0085 http://xmpp.org/extensions/xep-0085.html#definitions

                            // <composing> state
                            var msg = $msg({
                                    from: room_jid+'/newguy',
                                    id: (new Date()).getTime(),
                                    to: 'dummy@localhost',
                                    type: 'groupchat'
                                }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();

                            view.model.onMessage(msg);

                            // Check that the notification appears inside the chatbox in the DOM
                            var events = view.el.querySelectorAll('.chat-event');
                            expect(events.length).toBe(3);
                            expect(events[0].textContent).toEqual('some1 has entered the groupchat');
                            expect(events[1].textContent).toEqual('newguy has entered the groupchat');
                            expect(events[2].textContent).toEqual('nomorenicks has entered the groupchat');

                            var notifications = view.el.querySelectorAll('.chat-state-notification');
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

                            var messages = view.el.querySelectorAll('.message');
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
                        });
                    }));
                });

                describe("A paused notification", function () {
                    it("will be shown if received",
                            mock.initConverseWithPromises(
                                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                                function (done, _converse) {

                        test_utils.openChatRoom(_converse, "coven", 'chat.shakespeare.lit', 'some1')
                        .then(() => {
                            var room_jid = 'coven@chat.shakespeare.lit';
                            var view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                            var $chat_content = $(view.el).find('.chat-content');

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
                            expect($chat_content.find('div.chat-info:first').html()).toBe("some1 has entered the groupchat");

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
                            expect($chat_content[0].querySelectorAll('div.chat-info').length).toBe(2);
                            expect($chat_content.find('div.chat-info:last').html()).toBe("newguy has entered the groupchat");

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
                            expect($chat_content[0].querySelectorAll('div.chat-info').length).toBe(3);
                            expect($chat_content.find('div.chat-info:last').html()).toBe("nomorenicks has entered the groupchat");

                            // See XEP-0085 http://xmpp.org/extensions/xep-0085.html#definitions

                            // <composing> state
                            var msg = $msg({
                                    from: room_jid+'/newguy',
                                    id: (new Date()).getTime(),
                                    to: 'dummy@localhost',
                                    type: 'groupchat'
                                }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                            view.model.onMessage(msg);

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
                        });
                    }));
                });
            });
        });
    });
}));
