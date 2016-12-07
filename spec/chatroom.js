(function (root, factory) {
    define(["mock", "converse-api", "test_utils", "utils" ], factory);
} (this, function (mock, converse_api, test_utils, utils) {
    var _ = converse_api.env._;
    var $ = converse_api.env.jQuery;
    var $pres = converse_api.env.$pres;
    var $iq = converse_api.env.$iq;
    var $msg = converse_api.env.$msg;
    var Strophe = converse_api.env.Strophe;

    return describe("ChatRooms", function () {
        describe("The \"rooms\" API", function () {
            afterEach(function () {
                converse_api.user.logout();
                converse_api.listen.not();
                test_utils.clearBrowserStorage();
            });

            it("has a method 'close' which closes rooms by JID or all rooms when called with no arguments", mock.initConverse(function (converse) {
                test_utils.createContacts(converse, 'current');
                runs(function () {
                    test_utils.openChatRoom(converse, 'lounge', 'localhost', 'dummy');
                    test_utils.openChatRoom(converse, 'leisure', 'localhost', 'dummy');
                    test_utils.openChatRoom(converse, 'news', 'localhost', 'dummy');
                    expect(converse.chatboxviews.get('lounge@localhost').$el.is(':visible')).toBeTruthy();
                    expect(converse.chatboxviews.get('leisure@localhost').$el.is(':visible')).toBeTruthy();
                    expect(converse.chatboxviews.get('news@localhost').$el.is(':visible')).toBeTruthy();
                });
                waits('100');
                runs(function () {
                    converse_api.rooms.close('lounge@localhost');
                    expect(converse.chatboxviews.get('lounge@localhost')).toBeUndefined();
                    expect(converse.chatboxviews.get('leisure@localhost').$el.is(':visible')).toBeTruthy();
                    expect(converse.chatboxviews.get('news@localhost').$el.is(':visible')).toBeTruthy();
                    converse_api.rooms.close(['leisure@localhost', 'news@localhost']);
                    expect(converse.chatboxviews.get('lounge@localhost')).toBeUndefined();
                    expect(converse.chatboxviews.get('leisure@localhost')).toBeUndefined();
                    expect(converse.chatboxviews.get('news@localhost')).toBeUndefined();

                    test_utils.openChatRoom(converse, 'lounge', 'localhost', 'dummy');
                    test_utils.openChatRoom(converse, 'leisure', 'localhost', 'dummy');
                    expect(converse.chatboxviews.get('lounge@localhost').$el.is(':visible')).toBeTruthy();
                    expect(converse.chatboxviews.get('leisure@localhost').$el.is(':visible')).toBeTruthy();
                });
                waits('100');
                runs(function () {
                    converse_api.rooms.close();
                    expect(converse.chatboxviews.get('lounge@localhost')).toBeUndefined();
                    expect(converse.chatboxviews.get('leisure@localhost')).toBeUndefined();
                });
            }));

            it("has a method 'get' which returns a wrapped chat room (if it exists)", mock.initConverse(function (converse) {
                test_utils.createContacts(converse, 'current');
                waits('300'); // ChatBox.show() is debounced for 250ms
                runs(function () {
                    test_utils.openChatRoom(converse, 'lounge', 'localhost', 'dummy');
                    var jid = 'lounge@localhost';
                    var room = converse_api.rooms.get(jid);
                    expect(room instanceof Object).toBeTruthy();
                    expect(room.is_chatroom).toBeTruthy();
                    var chatroomview = converse.chatboxviews.get(jid);
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();
                    chatroomview.close();
                });
                waits('300'); // ChatBox.show() is debounced for 250ms
                runs(function () {
                    // Test with mixed case
                    test_utils.openChatRoom(converse, 'Leisure', 'localhost', 'dummy');
                    var jid = 'Leisure@localhost';
                    var room = converse_api.rooms.get(jid);
                    expect(room instanceof Object).toBeTruthy();
                    var chatroomview = converse.chatboxviews.get(jid.toLowerCase());
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();
                });
                waits('300'); // ChatBox.show() is debounced for 250ms
                runs(function () {
                    var jid = 'leisure@localhost';
                    var room = converse_api.rooms.get(jid);
                    expect(room instanceof Object).toBeTruthy();
                    var chatroomview = converse.chatboxviews.get(jid.toLowerCase());
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();

                    jid = 'leiSure@localhost';
                    room = converse_api.rooms.get(jid);
                    expect(room instanceof Object).toBeTruthy();
                    chatroomview = converse.chatboxviews.get(jid.toLowerCase());
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();
                    chatroomview.close();

                    // Non-existing room
                    jid = 'lounge2@localhost';
                    room = converse_api.rooms.get(jid);
                    expect(typeof room === 'undefined').toBeTruthy();
                });
            }));

           it("has a method 'open' which opens (optionally configures) and returns a wrapped chat box", mock.initConverse(function (converse) {
                test_utils.createContacts(converse, 'current');
                var chatroomview;
                var jid = 'lounge@localhost';
                var room = converse_api.rooms.open(jid);
                runs(function () {
                    // Test on chat room that doesn't exist.
                    expect(room instanceof Object).toBeTruthy();
                    expect(room.is_chatroom).toBeTruthy();
                    chatroomview = converse.chatboxviews.get(jid);
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();
                });
                waits('300'); // ChatBox.show() is debounced for 250ms
                runs(function () {
                    // Test again, now that the room exists.
                    room = converse_api.rooms.open(jid);
                    expect(room instanceof Object).toBeTruthy();
                    expect(room.is_chatroom).toBeTruthy();
                    chatroomview = converse.chatboxviews.get(jid);
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();
                });
                waits('300'); // ChatBox.show() is debounced for 250ms
                runs(function () {
                    // Test with mixed case in JID
                    jid = 'Leisure@localhost';
                    room = converse_api.rooms.open(jid);
                    expect(room instanceof Object).toBeTruthy();
                    chatroomview = converse.chatboxviews.get(jid.toLowerCase());
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();

                    jid = 'leisure@localhost';
                    room = converse_api.rooms.open(jid);
                    expect(room instanceof Object).toBeTruthy();
                    chatroomview = converse.chatboxviews.get(jid.toLowerCase());
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();

                    jid = 'leiSure@localhost';
                    room = converse_api.rooms.open(jid);
                    expect(room instanceof Object).toBeTruthy();
                    chatroomview = converse.chatboxviews.get(jid.toLowerCase());
                    expect(chatroomview.$el.is(':visible')).toBeTruthy();
                    chatroomview.close();
                });
                waits('300'); // ChatBox.show() is debounced for 250ms
                runs(function () {
                    converse.muc_instant_rooms = false;
                    var sent_IQ, IQ_id;
                    var sendIQ = converse.connection.sendIQ;
                    spyOn(converse.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                        sent_IQ = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });
                    // Test with configuration
                    converse_api.rooms.open('room@conference.example.org', {
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
                    converse.connection._dataRecv(test_utils.createRequest(features_stanza));

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
                    converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(converse.connection.sendIQ).toHaveBeenCalled();
                    expect(sent_IQ.toLocaleString()).toBe(
                        "<iq to='room@conference.example.org' type='get' xmlns='jabber:client' id='"+IQ_id+
                        "'><query xmlns='http://jabber.org/protocol/muc#owner'/></iq>"
                    );
                    converse.connection._dataRecv(test_utils.createRequest($(
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
                    var $sent_stanza = $(sent_IQ.toLocaleString());
                    expect($sent_stanza.find('field[var="muc#roomconfig_roomname"] value').text()).toBe('Room');
                    expect($sent_stanza.find('field[var="muc#roomconfig_roomdesc"] value').text()).toBe('Welcome to this room');
                    expect($sent_stanza.find('field[var="muc#roomconfig_persistentroom"] value').text()).toBe('1');
                    expect($sent_stanza.find('field[var="muc#roomconfig_publicroom"] value ').text()).toBe('1');
                    expect($sent_stanza.find('field[var="muc#roomconfig_changesubject"] value').text()).toBe('0');
                    expect($sent_stanza.find('field[var="muc#roomconfig_whois"] value ').text()).toBe('anyone');
                    expect($sent_stanza.find('field[var="muc#roomconfig_membersonly"] value').text()).toBe('1');
                    expect($sent_stanza.find('field[var="muc#roomconfig_historylength"] value').text()).toBe('20');
                });
            }));
        });

        describe("A Chat Room", function () {
            afterEach(function () {
                converse_api.user.logout();
                converse_api.listen.not();
                test_utils.clearBrowserStorage();
            });

            it("can have spaces and special characters in its name", mock.initConverse(function (converse) {
                test_utils.openChatRoom(converse, 'lounge & leisure', 'localhost', 'dummy');
                var view = converse.chatboxviews.get(
                        Strophe.escapeNode('lounge & leisure')+'@localhost');
                expect(view instanceof converse.ChatRoomView).toBe(true);
            }));

            it("can be configured if you're its owner", mock.initConverse(function (converse) {
                var view;
                var sent_IQ, IQ_id;
                var sendIQ = converse.connection.sendIQ;
                spyOn(converse.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                runs(function () {
                    converse_api.rooms.open('coven@chat.shakespeare.lit', {'nick': 'some1'});
                    view = converse.chatboxviews.get('coven@chat.shakespeare.lit');
                    spyOn(view, 'saveAffiliationAndRole').andCallThrough();

                    // We pretend this is a new room, so no disco info is returned.
                    var features_stanza = $iq({
                            from: 'coven@chat.shakespeare.lit',
                            'id': IQ_id,
                            'to': 'dummy@localhost/desktop',
                            'type': 'error'
                        }).c('error', {'type': 'cancel'})
                            .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                    converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                    /* <presence to="dummy@localhost/converse.js-29092160"
                     *           from="coven@chat.shakespeare.lit/some1">
                     *      <x xmlns="http://jabber.org/protocol/muc#user">
                     *          <item affiliation="owner" jid="dummy@localhost/converse.js-29092160" role="moderator"/>
                     *          <status code="110"/>
                     *      </x>
                     *  </presence></body>
                     */
                    var presence = $pres({
                            to: 'dummy@localhost/converse.js-29092160',
                            from: 'coven@chat.shakespeare.lit/some1'
                        }).c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'owner',
                            'jid': 'dummy@localhost/converse.js-29092160',
                            'role': 'moderator'
                        }).up()
                        .c('status', {code: '110'});
                    converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect(view.saveAffiliationAndRole).toHaveBeenCalled();
                    expect(view.$('.configure-chatroom-button').is(':visible')).toBeTruthy();
                    expect(view.$('.toggle-chatbox-button').is(':visible')).toBeTruthy();
                    expect(view.$('.toggle-bookmark').is(':visible')).toBeTruthy();
                    view.$('.configure-chatroom-button').click();
                });
                waits(50);
                runs (function () {
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
                                .c('field', {'type': 'hidden', 'var': 'FORM_TYPE'}).
                                    c('value').t('http://jabber.org/protocol/muc#roomconfig').up().up()
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
                     converse.connection._dataRecv(test_utils.createRequest(config_stanza));
                });
                waits(50);
                runs (function () {
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
                });
                waits(50);
                runs (function () {
                    var $sent_stanza = $(sent_IQ.toLocaleString());
                    expect($sent_stanza.find('field[var="muc#roomconfig_membersonly"] value').text()).toBe('1');
                    expect($sent_stanza.find('field[var="muc#roomconfig_moderatedroom"] value').text()).toBe('1');
                    expect($sent_stanza.find('field[var="muc#roomconfig_allowpm"] value').text()).toBe('moderators');
                    expect($sent_stanza.find('field[var="muc#roomconfig_presencebroadcast"] value').text()).toBe('moderator');
                });
            }));

            it("shows users currently present in the room", mock.initConverse(function (converse) {
                test_utils.openAndEnterChatRoom(converse, 'lounge', 'localhost', 'dummy');
                var name;
                var view = converse.chatboxviews.get('lounge@localhost'),
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
                    converse.connection._dataRecv(test_utils.createRequest(presence));
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
                    converse.connection._dataRecv(test_utils.createRequest(presence));
                    expect($occupants.find('li').length).toBe(i+1);
                }
            }));

            it("indicates moderators by means of a special css class and tooltip", mock.initConverse(function (converse) {
                test_utils.openAndEnterChatRoom(converse, 'lounge', 'localhost', 'dummy');
                var view = converse.chatboxviews.get('lounge@localhost');

                var presence = $pres({
                        to:'dummy@localhost/pda',
                        from:'lounge@localhost/moderatorman'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    affiliation: 'admin',
                    jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                    role: 'moderator',
                }).up()
                .c('status').attrs({code:'110'}).nodeTree;

                converse.connection._dataRecv(test_utils.createRequest(presence));
                var occupant = view.$el.find('.occupant-list').find('li');
                expect(occupant.length).toBe(2);
                expect($(occupant).first().text()).toBe("dummy");
                expect($(occupant).last().text()).toBe("moderatorman");
                expect($(occupant).last().attr('class').indexOf('moderator')).not.toBe(-1);
                expect($(occupant).last().attr('title')).toBe('This user is a moderator. Click to mention this user in your message.');
            }));

            it("will use the user's reserved nickname, if it exists", mock.initConverse(function (converse) {
                var sent_IQ, IQ_id;
                var sendIQ = converse.connection.sendIQ;
                spyOn(converse.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                test_utils.openChatRoom(converse, 'lounge', 'localhost', 'dummy');

                // We pretend this is a new room, so no disco info is returned.
                var features_stanza = $iq({
                        from: 'lounge@localhost',
                        'id': IQ_id,
                        'to': 'dummy@localhost/desktop',
                        'type': 'error'
                    }).c('error', {'type': 'cancel'})
                        .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                var view = converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'join').andCallThrough();

                /* <iq from='hag66@shakespeare.lit/pda'
                 *     id='getnick1'
                 *     to='coven@chat.shakespeare.lit'
                 *     type='get'>
                 * <query xmlns='http://jabber.org/protocol/disco#info'
                 *         node='x-roomuser-item'/>
                 * </iq>
                 */
                expect(sent_IQ.toLocaleString()).toBe(
                    "<iq to='lounge@localhost' from='dummy@localhost/resource' "+
                        "type='get' xmlns='jabber:client' id='"+IQ_id+"'>"+
                            "<query xmlns='http://jabber.org/protocol/disco#info' node='x-roomuser-item'/></iq>"
                );
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
                    'to': converse.connection.jid
                }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#info', 'node': 'x-roomuser-item'})
                  .c('identity', {'category': 'conference', 'name': 'thirdwitch', 'type': 'text'});
                converse.connection._dataRecv(test_utils.createRequest(stanza));

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

                converse.connection._dataRecv(test_utils.createRequest(presence));
                var info_text = view.$el.find('.chat-content .chat-info').text();
                expect(info_text).toBe('Your nickname has been automatically set to: thirdwitch');
            }));

            it("allows the user to invite their roster contacts to enter the chat room", mock.initConverse(function (converse) {
                test_utils.openChatRoom(converse, 'lounge', 'localhost', 'dummy');
                spyOn(converse, 'emit');
                spyOn(window, 'prompt').andCallFake(function () {
                    return null;
                });
                var $input;
                var view = converse.chatboxviews.get('lounge@localhost');
                view.$el.find('.chat-area').remove();
                test_utils.createContacts(converse, 'current'); // We need roster contacts, so that we have someone to invite
                $input = view.$el.find('input.invited-contact.tt-input');
                var $hint = view.$el.find('input.invited-contact.tt-hint');
                runs (function () {
                    expect($input.length).toBe(1);
                    expect($input.attr('placeholder')).toBe('Invite');
                    $input.val("Felix");
                    $input.trigger('input');
                });
                waits(350); // Needed, due to debounce
                runs (function () {
                    expect($input.val()).toBe('Felix');
                    expect($hint.val()).toBe('Felix Amsel');
                    var $sugg = view.$el.find('[data-jid="felix.amsel@localhost"]');
                    expect($sugg.length).toBe(1);
                    $sugg.trigger('click');
                    expect(window.prompt).toHaveBeenCalled();
                });
            }));

            it("can be joined automatically, based upon a received invite", mock.initConverse(function (converse) {
                test_utils.createContacts(converse, 'current'); // We need roster contacts, who can invite us
                spyOn(window, 'confirm').andCallFake(function () {
                    return true;
                });
                test_utils.openAndEnterChatRoom(converse, 'lounge', 'localhost', 'dummy');
                var view = converse.chatboxviews.get('lounge@localhost');
                view.close();
                view.model.destroy(); // Manually calling this, otherwise we have to mock stanzas.

                var name = mock.cur_names[0];
                var from_jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                var room_jid = 'lounge@localhost';
                var reason = "Please join this chat room";
                var message = $(
                    "<message from='"+from_jid+"' to='"+converse.bare_jid+"'>" +
                        "<x xmlns='jabber:x:conference'" +
                            "jid='"+room_jid+"'" +
                            "reason='"+reason+"'/>"+
                    "</message>"
                )[0];
                expect(converse.chatboxes.models.length).toBe(1);
                expect(converse.chatboxes.models[0].id).toBe("controlbox");
                converse.onDirectMUCInvitation(message);
                expect(window.confirm).toHaveBeenCalledWith(
                    name + ' has invited you to join a chat room: '+ room_jid +
                    ', and left the following reason: "'+reason+'"');
                expect(converse.chatboxes.models.length).toBe(2);
                expect(converse.chatboxes.models[0].id).toBe('controlbox');
                expect(converse.chatboxes.models[1].id).toBe(room_jid);
            }));

            it("shows received groupchat messages", mock.initConverse(function (converse) {
                test_utils.openChatRoom(converse, 'lounge', 'localhost', 'dummy');
                spyOn(converse, 'emit');
                var view = converse.chatboxviews.get('lounge@localhost');
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
                expect(converse.emit).toHaveBeenCalledWith('message', message.nodeTree);
            }));

            it("shows sent groupchat messages", mock.initConverse(function (converse) {
                test_utils.openAndEnterChatRoom(converse, 'lounge', 'localhost', 'dummy');
                spyOn(converse, 'emit');
                var view = converse.chatboxviews.get('lounge@localhost');
                if (!view.$el.find('.chat-area').length) { view.renderChatArea(); }
                var text = 'This is a sent message';
                view.$el.find('.chat-textarea').text(text);
                view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                expect(converse.emit).toHaveBeenCalledWith('messageSend', text);
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
                expect(converse.emit.callCount, 1);
            }));

            it("will cause the chat area to be scrolled down only if it was at the bottom already", mock.initConverse(function (converse) {
                var message = 'This message is received while the chat area is scrolled up';
                test_utils.openAndEnterChatRoom(converse, 'lounge', 'localhost', 'dummy');
                var view = converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'scrollDown').andCallThrough();
                runs(function () {
                    /* Create enough messages so that there's a
                        * scrollbar.
                        */
                    for (var i=0; i<20; i++) {
                        converse.chatboxes.onMessage(
                            $msg({
                                from: 'lounge@localhost/someone',
                                to: 'dummy@localhost.com',
                                type: 'groupchat',
                                id: (new Date()).getTime(),
                            }).c('body').t('Message: '+i).tree());
                    }
                });
                waits(50);
                runs(function () {
                    view.$content.scrollTop(0);
                });
                waits(250);
                runs(function () {
                    expect(view.model.get('scrolled')).toBeTruthy();
                    converse.chatboxes.onMessage(
                        $msg({
                            from: 'lounge@localhost/someone',
                            to: 'dummy@localhost.com',
                            type: 'groupchat',
                            id: (new Date()).getTime(),
                        }).c('body').t(message).tree());
                });
                waits(150);
                runs(function () {
                    // Now check that the message appears inside the chatbox in the DOM
                    var $chat_content = view.$el.find('.chat-content');
                    var msg_txt = $chat_content.find('.chat-message:last').find('.chat-msg-content').text();
                    expect(msg_txt).toEqual(message);
                    expect(view.$content.scrollTop()).toBe(0);
                });
            }));

            it("shows received chatroom subject messages", mock.initConverse(function (converse) {
                test_utils.openAndEnterChatRoom(converse, 'jdev', 'conference.jabber.org', 'jc');

                var text = 'Jabber/XMPP Development | RFCs and Extensions: http://xmpp.org/ | Protocol and XSF discussions: xsf@muc.xmpp.org';
                var stanza = Strophe.xmlHtmlNode(
                    '<message xmlns="jabber:client" to="jc@opkode.com/converse.js-60429116" type="groupchat" from="jdev@conference.jabber.org/ralphm">'+
                    '    <subject>'+text+'</subject>'+
                    '    <delay xmlns="urn:xmpp:delay" stamp="2014-02-04T09:35:39Z" from="jdev@conference.jabber.org"/>'+
                    '    <x xmlns="jabber:x:delay" stamp="20140204T09:35:39" from="jdev@conference.jabber.org"/>'+
                    '</message>').firstChild;
                converse.connection._dataRecv(test_utils.createRequest(stanza));
                var view = converse.chatboxviews.get('jdev@conference.jabber.org');
                var $chat_content = view.$el.find('.chat-content');
                expect($chat_content.find('.chat-info').length).toBe(1);
                expect($chat_content.find('.chat-info').text()).toBe('Topic set by ralphm to: '+text);
            }));

            it("informs users if their nicknames has been changed.", mock.initConverse(function (converse) {
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
                var __ = utils.__.bind(converse);
                test_utils.openAndEnterChatRoom(converse, 'lounge', 'localhost', 'oldnick');
                var view = converse.chatboxviews.get('lounge@localhost');
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

                converse.connection._dataRecv(test_utils.createRequest(presence));
                var $occupants = view.$('.occupant-list');
                expect($occupants.children().length).toBe(1);
                expect($occupants.children().first(0).text()).toBe("oldnick");

                expect($chat_content.find('div.chat-info').length).toBe(1);
                expect($chat_content.find('div.chat-info').html()).toBe(__(converse.muc.new_nickname_messages["210"], "oldnick"));

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

                converse.connection._dataRecv(test_utils.createRequest(presence));
                expect($chat_content.find('div.chat-info').length).toBe(2);
                expect($chat_content.find('div.chat-info').last().html()).toBe(__(converse.muc.new_nickname_messages["303"], "newnick"));

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

                converse.connection._dataRecv(test_utils.createRequest(presence));
                expect($chat_content.find('div.chat-info').length).toBe(2);
                expect($chat_content.find('div.chat-info').last().html()).toBe(__(converse.muc.new_nickname_messages["303"], "newnick"));
                $occupants = view.$('.occupant-list');
                expect($occupants.children().length).toBe(1);
                expect($occupants.children().first(0).text()).toBe("newnick");
            }));

            it("queries for the room information before attempting to join the user",  mock.initConverse(function (converse) {
                var sent_IQ, IQ_id;
                var sendIQ = converse.connection.sendIQ;
                spyOn(converse.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                converse_api.rooms.open('coven@chat.shakespeare.lit', {'nick': 'some1'});

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
                converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                var view = converse.chatboxviews.get('coven@chat.shakespeare.lit');
                expect(view.model.get('features_fetched')).toBe(true);
                expect(view.model.get('passwordprotected')).toBe(true);
                expect(view.model.get('hidden')).toBe(true);
                expect(view.model.get('temporary')).toBe(true);
                expect(view.model.get('open')).toBe(true);
                expect(view.model.get('unmoderated')).toBe(true);
                expect(view.model.get('nonanonymous')).toBe(true);
            }));

            it("indicates when a room is no longer anonymous", mock.initConverse(function (converse) {
                var sent_IQ, IQ_id;
                var sendIQ = converse.connection.sendIQ;
                spyOn(converse.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                converse_api.rooms.open('coven@chat.shakespeare.lit', {'nick': 'some1'});

                // We pretend this is a new room, so no disco info is returned.
                var features_stanza = $iq({
                        from: 'coven@chat.shakespeare.lit',
                        'id': IQ_id,
                        'to': 'dummy@localhost/desktop',
                        'type': 'error'
                    }).c('error', {'type': 'cancel'})
                        .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
                converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                var view = converse.chatboxviews.get('coven@chat.shakespeare.lit');
                /* <message xmlns="jabber:client"
                 *              type="groupchat"
                 *              to="dummy@localhost/converse.js-27854181"
                 *              from="coven@chat.shakespeare.lit">
                 *      <x xmlns="http://jabber.org/protocol/muc#user">
                 *          <status code="104"/>
                 *          <status code="172"/>
                 *      </x>
                 *  </message>
                 */
                var message = $msg({
                        type:'groupchat',
                        to: 'dummy@localhost/converse.js-27854181',
                        from: 'coven@chat.shakespeare.lit'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                      .c('status', {code: '104'}).up()
                      .c('status', {code: '172'});
                converse.connection._dataRecv(test_utils.createRequest(message));
                var $chat_body = view.$('.chatroom-body');
                expect($chat_body.html().trim().indexOf(
                    '<div class="chat-info">This room is now no longer anonymous</div>'
                )).not.toBe(-1);
            }));

            it("informs users if they have been kicked out of the chat room", mock.initConverse(function (converse) {
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
                test_utils.openAndEnterChatRoom(converse, 'lounge', 'localhost', 'dummy');
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

                var view = converse.chatboxviews.get('lounge@localhost');
                view.onChatRoomPresence(presence);
                expect(view.$('.chat-area').is(':visible')).toBeFalsy();
                expect(view.$('.occupants').is(':visible')).toBeFalsy();
                var $chat_body = view.$('.chatroom-body');
                expect($chat_body.html().trim().indexOf(
                    '<p>You have been kicked from this room</p>'+
                    '<p>This action was done by <strong>Fluellen</strong>.</p>'+
                    '<p>The reason given is: <em>"Avaunt, you cullion!"</em>.</p>'
                )).not.toBe(-1);
            }));

            it("can be saved to, and retrieved from, browserStorage", mock.initConverse(function (converse) {
                test_utils.openChatRoom(converse, 'lounge', 'localhost', 'dummy');
                // We instantiate a new ChatBoxes collection, which by default
                // will be empty.
                test_utils.openControlBox();
                var newchatboxes = new converse.ChatBoxes();
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
                    new_attrs = _.pluck(_.pluck(newchatboxes.models, 'attributes'), attrs[i]);
                    old_attrs = _.pluck(_.pluck(converse.chatboxes.models, 'attributes'), attrs[i]);
                    // FIXME: should have have to sort here? Order must
                    // probably be the same...
                    // This should be fixed once the controlbox always opens
                    // only on the right.
                    expect(_.isEqual(new_attrs.sort(), old_attrs.sort())).toEqual(true);
                }
                converse.rosterview.render();
            }));

            it("can be minimized by clicking a DOM element with class 'toggle-chatbox-button'", mock.initConverse(function (converse) {
                test_utils.openChatRoom(converse, 'lounge', 'localhost', 'dummy');
                var view = converse.chatboxviews.get('lounge@localhost'),
                    trimmed_chatboxes = converse.minimized_chats;
                spyOn(view, 'minimize').andCallThrough();
                spyOn(view, 'maximize').andCallThrough();
                spyOn(converse, 'emit');
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                runs(function () {
                    view.$el.find('.toggle-chatbox-button').click();
                });
                waits(350);
                runs(function () {
                    expect(view.minimize).toHaveBeenCalled();
                    expect(converse.emit).toHaveBeenCalledWith('chatBoxMinimized', jasmine.any(Object));
                    expect(view.$el.is(':visible')).toBeFalsy();
                    expect(view.model.get('minimized')).toBeTruthy();
                    expect(view.minimize).toHaveBeenCalled();
                    var trimmedview = trimmed_chatboxes.get(view.model.get('id'));
                    trimmedview.$("a.restore-chat").click();
                });
                waits(350);
                runs(function () {
                    expect(view.maximize).toHaveBeenCalled();
                    expect(converse.emit).toHaveBeenCalledWith('chatBoxMaximized', jasmine.any(Object));
                    expect(view.$el.is(':visible')).toBeTruthy();
                    expect(view.model.get('minimized')).toBeFalsy();
                    expect(converse.emit.callCount, 3);
                });
            }));

            it("can be closed again by clicking a DOM element with class 'close-chatbox-button'", mock.initConverse(function (converse) {
                test_utils.openChatRoom(converse, 'lounge', 'localhost', 'dummy');
                var view = converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'close').andCallThrough();
                spyOn(converse, 'emit');
                spyOn(view, 'leave');
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                runs(function () {
                    view.$el.find('.close-chatbox-button').click();
                });
                waits(50);
                runs(function () {
                    expect(view.close).toHaveBeenCalled();
                    expect(view.leave).toHaveBeenCalled();
                    // XXX: After refactoring, the chat box only gets closed
                    // once we have confirmation from the server. To test this,
                    // we would have to mock the returned presence stanza.
                    // See the "leave" method on the ChatRoomView.
                    // expect(converse.emit).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                });
            }));
        });


        describe("Each chat room can take special commands", function () {
            afterEach(function () {
                converse_api.user.logout();
                converse_api.listen.not();
                test_utils.clearBrowserStorage();
            });

            it("to clear messages", mock.initConverse(function (converse) {
                test_utils.openChatRoom(converse, 'lounge', 'localhost', 'dummy');
                var view = converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'onMessageSubmitted').andCallThrough();
                spyOn(view, 'clearChatRoomMessages');
                view.$el.find('.chat-textarea').text('/clear');
                view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                expect(view.onMessageSubmitted).toHaveBeenCalled();
                expect(view.clearChatRoomMessages).toHaveBeenCalled();

            }));

            it("to ban a user", mock.initConverse(function (converse) {
                test_utils.openChatRoom(converse, 'lounge', 'localhost', 'dummy');
                var view = converse.chatboxviews.get('lounge@localhost');
                spyOn(view, 'onMessageSubmitted').andCallThrough();
                spyOn(view, 'setAffiliations').andCallThrough();
                spyOn(view, 'showStatusNotification').andCallThrough();
                spyOn(view, 'validateRoleChangeCommand').andCallThrough();
                view.$el.find('.chat-textarea').text('/ban');
                view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                expect(view.onMessageSubmitted).toHaveBeenCalled();
                expect(view.validateRoleChangeCommand).toHaveBeenCalled();
                expect(view.showStatusNotification).toHaveBeenCalledWith(
                    "Error: the \"ban\" command takes two arguments, the user's nickname and optionally a reason.",
                    true
                );
                expect(view.setAffiliations).not.toHaveBeenCalled();

                // Call now with the correct amount of arguments.
                // XXX: Calling onMessageSubmitted directly, trying
                // again via triggering Event doesn't work for some weird
                // reason.
                view.onMessageSubmitted('/ban jid This is the reason');
                expect(view.validateRoleChangeCommand.callCount).toBe(2);
                expect(view.showStatusNotification.callCount).toBe(1);
                expect(view.setAffiliations).toHaveBeenCalled();
            }));
        });

        describe("When attempting to enter a chatroom", function () {
            afterEach(function () {
                converse_api.user.logout();
                converse_api.listen.not();
                test_utils.clearBrowserStorage();
            });

            var submitRoomForm = function (converse) {
                var roomspanel = converse.chatboxviews.get('controlbox').roomspanel;
                var $input = roomspanel.$el.find('input.new-chatroom-name');
                var $nick = roomspanel.$el.find('input.new-chatroom-nick');
                var $server = roomspanel.$el.find('input.new-chatroom-server');
                $input.val('problematic');
                $nick.val('dummy');
                $server.val('muc.localhost');
                roomspanel.$el.find('form').submit();
            };

            it("will show an error message if the room requires a password", mock.initConverse(function (converse) {
                submitRoomForm(converse);
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'auth'})
                    .c('not-authorized').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

                var view = converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'renderPasswordForm').andCallThrough();
                runs(function () {
                    view.onChatRoomPresence(presence);
                });
                waits(250);
                runs(function () {
                    var $chat_body = view.$el.find('.chatroom-body');
                    expect(view.renderPasswordForm).toHaveBeenCalled();
                    expect($chat_body.find('form.chatroom-form').length).toBe(1);
                    expect($chat_body.find('legend').text()).toBe('This chatroom requires a password');
                });
            }));

            it("will show an error message if the room is members-only and the user not included", mock.initConverse(function (converse) {
                submitRoomForm(converse);
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'auth'})
                    .c('registration-required').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body p:last').text()).toBe('You are not on the member list of this room');
            }));

            it("will show an error message if the user has been banned", mock.initConverse(function (converse) {
                submitRoomForm(converse);
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'auth'})
                    .c('forbidden').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body p:last').text()).toBe('You have been banned from this room');
            }));

            it("will render a nickname form if a nickname conflict happens and muc_nickname_from_jid=false", mock.initConverse(function (converse) {
                submitRoomForm(converse);
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body form.chatroom-form label:first').text()).toBe('Please choose your nickname');
            }));

            it("will automatically choose a new nickname if a nickname conflict happens and muc_nickname_from_jid=true", mock.initConverse(function (converse) {
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
                submitRoomForm(converse);
                converse.muc_nickname_from_jid = true;

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

                var view = converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                spyOn(view, 'join').andCallThrough();

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
            }));

            it("will show an error message if the user is not allowed to have created the room", mock.initConverse(function (converse) {
                submitRoomForm(converse);
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('not-allowed').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body p:last').text()).toBe('You are not allowed to create new rooms');
            }));

            it("will show an error message if the user's nickname doesn't conform to room policy", mock.initConverse(function (converse) {
                submitRoomForm(converse);
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('not-acceptable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body p:last').text()).toBe("Your nickname doesn't conform to this room's policies");
            }));

            it("will show an error message if the room doesn't yet exist", mock.initConverse(function (converse) {
                submitRoomForm(converse);
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('item-not-found').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body p:last').text()).toBe("This room does not (yet) exist");
            }));

            it("will show an error message if the room has reached its maximum number of occupants", mock.initConverse(function (converse) {
                submitRoomForm(converse);
                var presence = $pres().attrs({
                    from:'lounge@localhost/thirdwitch',
                        id:'n13mt3l',
                        to:'dummy@localhost/pda',
                        type:'error'})
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({by:'lounge@localhost', type:'cancel'})
                    .c('service-unavailable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
                var view = converse.chatboxviews.get('problematic@muc.localhost');
                spyOn(view, 'showErrorMessage').andCallThrough();
                view.onChatRoomPresence(presence);
                expect(view.$el.find('.chatroom-body p:last').text()).toBe("This room has reached its maximum number of occupants");
            }));
        });

        describe("Someone being invited to a chat room", function () {

            it("will first be added to the member list if the chat room is members only", mock.initConverse(function (converse) {
                var sent_IQs = [], IQ_ids = [];
                var sendIQ = converse.connection.sendIQ;
                spyOn(converse.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                    sent_IQs.push(iq);
                    IQ_ids.push(sendIQ.bind(this)(iq, callback, errback));
                });

                test_utils.openChatRoom(converse, 'coven', 'chat.shakespeare.lit', 'dummy');

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
                converse.connection._dataRecv(test_utils.createRequest(features_stanza));

                var view = converse.chatboxviews.get('coven@chat.shakespeare.lit');
                expect(view.model.get('membersonly')).toBeTruthy();

                test_utils.createContacts(converse, 'current');

                var sent_stanza,
                    sent_id;
                spyOn(converse.connection, 'send').andCallFake(function (stanza) {
                    if (stanza.nodeTree && stanza.nodeTree.nodeName === 'message') {
                        sent_id = stanza.nodeTree.getAttribute('id');
                        sent_stanza = stanza;
                    }
                });

                var name = mock.cur_names[0];
                var invitee_jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                var reason = "Please join this chat room";
                view.directInvite(invitee_jid, reason);

                var admin_iq_id = IQ_ids.pop();
                var owner_iq_id = IQ_ids.pop();
                var member_iq_id = IQ_ids.pop();
                // Check in reverse order that we requested all three lists
                // (member, owner and admin).
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
                converse.connection._dataRecv(test_utils.createRequest(member_list_stanza));

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
                converse.connection._dataRecv(test_utils.createRequest(admin_list_stanza));

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
                converse.connection._dataRecv(test_utils.createRequest(owner_list_stanza));

                // Check that the member list now gets updated
                expect(sent_IQs.pop().toLocaleString()).toBe(
                    "<iq to='coven@chat.shakespeare.lit' type='set' xmlns='jabber:client' id='"+IQ_ids.pop()+"'>"+
                        "<query xmlns='http://jabber.org/protocol/muc#admin'>"+
                            "<item affiliation='member' jid='"+invitee_jid+"'>"+
                                "<reason>Please join this chat room</reason>"+
                            "</item>"+
                        "</query>"+
                    "</iq>");

                // Finally check that the user gets invited.
                expect(sent_stanza.toLocaleString()).toBe( // Strophe adds the xmlns attr (although not in spec)
                    "<message from='dummy@localhost/resource' to='"+invitee_jid+"' id='"+sent_id+"' xmlns='jabber:client'>"+
                        "<x xmlns='jabber:x:conference' jid='coven@chat.shakespeare.lit' reason='Please join this chat room'/>"+
                    "</message>"
                );
            }));
        });
    });
}));
