(function (root, factory) {
    define([
        "jasmine",
        "mock",
        "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    const b64_sha1 = converse.env.b64_sha1,
          _ = converse.env._,
          u = converse.env.utils;

    describe("Converse", function() {
        
        describe("Authentication", function () {

            it("needs either a bosh_service_url a websocket_url or both", mock.initConverse((done, _converse) => {
                const url = _converse.bosh_service_url;
                const connection = _converse.connection;
                delete _converse.bosh_service_url;
                delete _converse.connection;
                expect(_converse.initConnection).toThrow(
                    new Error("initConnection: you must supply a value for either the bosh_service_url or websocket_url or both."));
                _converse.bosh_service_url = url;
                _converse.connection = connection;
                done();
            }));

            describe("with prebind", function () {

                it("needs a jid when also using keepalive", mock.initConverse([], null, {'auto_login': false}, (done, _converse) => {
                    const authentication = _converse.authentication;
                    const jid = _converse.jid;
                    delete _converse.jid;
                    _converse.keepalive = true;
                    _converse.authentication = "prebind";
                    expect(_converse.logIn.bind(_converse)).toThrow(
                        new Error(
                            "restoreBOSHSession: tried to restore a \"keepalive\" session "+
                            "but we don't have the JID for the user!"));
                    _converse.authentication= authentication;
                    _converse.jid = jid;
                    _converse.keepalive = false;
                    done();
                }));

                it("needs jid, rid and sid values when not using keepalive", mock.initConverse((done, _converse) => {
                    const jid = _converse.jid;
                    delete _converse.jid;
                    _converse.keepalive = false;
                    _converse.authentication = "prebind";
                    expect(_converse.logIn.bind(_converse)).toThrow(
                        new Error("attemptPreboundSession: If you use prebind and not keepalive, then you MUST supply JID, RID and SID values or a prebind_url."));
                    _converse.bosh_service_url = undefined;
                    _converse.jid = jid;
                    done();
                }));
            });
        });

        describe("A chat state indication", function () {

            it("are sent out when the client becomes or stops being idle",
                mock.initConverse(null, ['discoInitialized'], {}, (done, _converse) => {

                spyOn(_converse, 'sendCSI').and.callThrough();
                let sent_stanza;
                spyOn(_converse.connection, 'send').and.callFake(function (stanza) {
                    sent_stanza = stanza;
                });
                let i = 0;
                _converse.idle_seconds = 0; // Usually initialized by registerIntervalHandler
                _converse.disco_entities.get(_converse.domain).features['urn:xmpp:csi:0'] = true; // Mock that the server supports CSI

                _converse.csi_waiting_time = 3; // The relevant config option
                while (i <= _converse.csi_waiting_time) {
                    expect(_converse.sendCSI).not.toHaveBeenCalled();
                    _converse.onEverySecond();
                    i++;
                }
                expect(_converse.sendCSI).toHaveBeenCalledWith('inactive');
                expect(sent_stanza.toLocaleString()).toBe('<inactive xmlns="urn:xmpp:csi:0"/>');
                _converse.onUserActivity();
                expect(_converse.sendCSI).toHaveBeenCalledWith('active');
                expect(sent_stanza.toLocaleString()).toBe('<active xmlns="urn:xmpp:csi:0"/>');
                // Reset values
                _converse.csi_waiting_time = 0;
                _converse.disco_entities.get(_converse.domain).features['urn:xmpp:csi:0'] = false;
                done();
            }));
        });

        describe("Automatic status change", function () {

            it("happens when the client is idle for long enough", mock.initConverse((done, _converse) => {
                let i = 0;
                // Usually initialized by registerIntervalHandler
                _converse.idle_seconds = 0;
                _converse.auto_changed_status = false;

                // The relevant config options
                _converse.auto_away = 3;
                _converse.auto_xa = 6;

                expect(_converse.api.user.status.get()).toBe('online');
                while (i <= _converse.auto_away) {
                    _converse.onEverySecond(); i++;
                }
                expect(_converse.auto_changed_status).toBe(true);

                while (i <= _converse.auto_xa) {
                    expect(_converse.api.user.status.get()).toBe('away');
                    _converse.onEverySecond();
                    i++;
                }
                expect(_converse.api.user.status.get()).toBe('xa');
                expect(_converse.auto_changed_status).toBe(true);

                _converse.onUserActivity();
                expect(_converse.api.user.status.get()).toBe('online');
                expect(_converse.auto_changed_status).toBe(false);

                // Check that it also works for the chat feature
                _converse.api.user.status.set('chat')
                i = 0;
                while (i <= _converse.auto_away) {
                    _converse.onEverySecond();
                    i++;
                }
                expect(_converse.auto_changed_status).toBe(true);
                while (i <= _converse.auto_xa) {
                    expect(_converse.api.user.status.get()).toBe('away');
                    _converse.onEverySecond();
                    i++;
                }
                expect(_converse.api.user.status.get()).toBe('xa');
                expect(_converse.auto_changed_status).toBe(true);

                _converse.onUserActivity();
                expect(_converse.api.user.status.get()).toBe('online');
                expect(_converse.auto_changed_status).toBe(false);

                // Check that it doesn't work for 'dnd'
                _converse.api.user.status.set('dnd');
                i = 0;
                while (i <= _converse.auto_away) {
                    _converse.onEverySecond();
                    i++;
                }
                expect(_converse.api.user.status.get()).toBe('dnd');
                expect(_converse.auto_changed_status).toBe(false);
                while (i <= _converse.auto_xa) {
                    expect(_converse.api.user.status.get()).toBe('dnd');
                    _converse.onEverySecond();
                    i++;
                }
                expect(_converse.api.user.status.get()).toBe('dnd');
                expect(_converse.auto_changed_status).toBe(false);

                _converse.onUserActivity();
                expect(_converse.api.user.status.get()).toBe('dnd');
                expect(_converse.auto_changed_status).toBe(false);
                done();
            }));
        });

        describe("The \"user\" grouping", function () {

            describe("The \"status\" API", function () {

                it("has a method for getting the user's availability", mock.initConverse((done, _converse) => {
                    _converse.xmppstatus.set('status', 'online');
                    expect(_converse.api.user.status.get()).toBe('online');
                    _converse.xmppstatus.set('status', 'dnd');
                    expect(_converse.api.user.status.get()).toBe('dnd');
                    done();
                }));

                it("has a method for setting the user's availability", mock.initConverse((done, _converse) => {
                    _converse.api.user.status.set('away');
                    expect(_converse.xmppstatus.get('status')).toBe('away');
                    _converse.api.user.status.set('dnd');
                    expect(_converse.xmppstatus.get('status')).toBe('dnd');
                    _converse.api.user.status.set('xa');
                    expect(_converse.xmppstatus.get('status')).toBe('xa');
                    _converse.api.user.status.set('chat');
                    expect(_converse.xmppstatus.get('status')).toBe('chat');
                    expect(_.partial(_converse.api.user.status.set, 'invalid')).toThrow(
                        new Error('Invalid availability value. See https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.1')
                    );
                    done();
                }));

                it("allows setting the status message as well", mock.initConverse((done, _converse) => {
                    _converse.api.user.status.set('away', "I'm in a meeting");
                    expect(_converse.xmppstatus.get('status')).toBe('away');
                    expect(_converse.xmppstatus.get('status_message')).toBe("I'm in a meeting");
                    done();
                }));

                it("has a method for getting the user's status message", mock.initConverse((done, _converse) => {
                    _converse.xmppstatus.set('status_message', undefined);
                    expect(_converse.api.user.status.message.get()).toBe(undefined);
                    _converse.xmppstatus.set('status_message', "I'm in a meeting");
                    expect(_converse.api.user.status.message.get()).toBe("I'm in a meeting");
                    done();
                }));

                it("has a method for setting the user's status message", mock.initConverse((done, _converse) => {
                    _converse.xmppstatus.set('status_message', undefined);
                    _converse.api.user.status.message.set("I'm in a meeting");
                    expect(_converse.xmppstatus.get('status_message')).toBe("I'm in a meeting");
                    done();
                }));
            });
        });

        describe("The \"tokens\" API", function () {

            it("has a method for retrieving the next RID", mock.initConverse((done, _converse) => {
                test_utils.createContacts(_converse, 'current');
                const old_connection = _converse.connection;
                _converse.connection._proto.rid = '1234';
                _converse.expose_rid_and_sid = false;
                expect(_converse.api.tokens.get('rid')).toBe(null);
                _converse.expose_rid_and_sid = true;
                expect(_converse.api.tokens.get('rid')).toBe('1234');
                _converse.connection = undefined;
                expect(_converse.api.tokens.get('rid')).toBe(null);
                // Restore the connection
                _converse.connection = old_connection;
                done();
            }));

            it("has a method for retrieving the SID", mock.initConverse((done, _converse) => {
                test_utils.createContacts(_converse, 'current');
                const old_connection = _converse.connection;
                _converse.connection._proto.sid = '1234';
                _converse.expose_rid_and_sid = false;
                expect(_converse.api.tokens.get('sid')).toBe(null);
                _converse.expose_rid_and_sid = true;
                expect(_converse.api.tokens.get('sid')).toBe('1234');
                _converse.connection = undefined;
                expect(_converse.api.tokens.get('sid')).toBe(null);
                // Restore the connection
                _converse.connection = old_connection;
                done();
            }));
        });

        describe("The \"contacts\" API", function () {

            it("has a method 'get' which returns wrapped contacts", mock.initConverse(async (done, _converse) => {
                // Check that it returns nothing if a non-existing JID is given
                test_utils.createContacts(_converse, 'current');
                let contact = await _converse.api.contacts.get('non-existing@jabber.org');
                expect(contact).toBeFalsy();
                // Check when a single jid is given
                const jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                contact = await _converse.api.contacts.get(jid);
                expect(contact.get('fullname')).toBe(mock.cur_names[0]);
                expect(contact.get('jid')).toBe(jid);
                // You can retrieve multiple contacts by passing in an array
                const jid2 = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                let list = await _converse.api.contacts.get([jid, jid2]);
                expect(_.isArray(list)).toBeTruthy();
                expect(list[0].get('fullname')).toBe(mock.cur_names[0]);
                expect(list[1].get('fullname')).toBe(mock.cur_names[1]);
                // Check that all JIDs are returned if you call without any parameters
                list = await _converse.api.contacts.get();
                expect(list.length).toBe(mock.cur_names.length);
                done();
            }));

            it("has a method 'add' with which contacts can be added", mock.initConverse((done, _converse) => {
                test_utils.createContacts(_converse, 'current');
                const error = new TypeError('contacts.add: invalid jid');
                expect(_converse.api.contacts.add).toThrow(error);
                expect(_converse.api.contacts.add.bind(_converse.api, "invalid jid")).toThrow(error);
                spyOn(_converse.roster, 'addAndSubscribe');
                _converse.api.contacts.add("newcontact@example.org");
                expect(_converse.roster.addAndSubscribe).toHaveBeenCalled();
                done();
            }));
        });

        describe("The \"chats\" API", function() {

            it("has a method 'get' which returns the promise that resolves to a chat model", mock.initConverse(
                null, ['rosterInitialized', 'chatBoxesInitialized'], {},
                async (done, _converse) => {

                test_utils.openControlBox();
                test_utils.createContacts(_converse, 'current', 2);
                _converse.api.trigger('rosterContactsFetched');

                // Test on chat that doesn't exist.
                expect(_converse.api.chats.get('non-existing@jabber.org')).toBeFalsy();
                const jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                const jid2 = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';

                // Test on chat that's not open
                let box = _converse.api.chats.get(jid);
                expect(typeof box === 'undefined').toBeTruthy();
                expect(_converse.chatboxes.length).toBe(1);

                // Test for one JID
                box = await _converse.api.chats.open(jid);
                expect(box instanceof Object).toBeTruthy();
                expect(box.get('box_id')).toBe(`box-${btoa(jid)}`);

                const chatboxview = _converse.chatboxviews.get(jid);
                expect(u.isVisible(chatboxview.el)).toBeTruthy();
                // Test for multiple JIDs
                test_utils.openChatBoxFor(_converse, jid2);
                await test_utils.waitUntil(() => _converse.chatboxes.length == 2);
                const list = _converse.api.chats.get([jid, jid2]);
                expect(_.isArray(list)).toBeTruthy();
                expect(list[0].get('box_id')).toBe(`box-${btoa(jid)}`);
                expect(list[1].get('box_id')).toBe(`box-${btoa(jid2)}`);
                done();
            }));

            it("has a method 'open' which opens and returns a promise that resolves to a chat model", mock.initConverse(
                null, ['rosterGroupsFetched', 'chatBoxesInitialized'], {},
                async (done, _converse) => {

                test_utils.openControlBox();
                test_utils.createContacts(_converse, 'current', 2);
                _converse.api.trigger('rosterContactsFetched');

                const jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                const jid2 = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                // Test on chat that doesn't exist.
                expect(_converse.api.chats.get('non-existing@jabber.org')).toBeFalsy();

                const box = await _converse.api.chats.open(jid);
                expect(box instanceof Object).toBeTruthy();
                expect(box.get('box_id')).toBe(`box-${btoa(jid)}`);
                expect(
                    _.keys(box),
                    ['close', 'endOTR', 'focus', 'get', 'initiateOTR', 'is_chatroom', 'maximize', 'minimize', 'open', 'set']
                );
                const chatboxview = _converse.chatboxviews.get(jid);
                expect(u.isVisible(chatboxview.el)).toBeTruthy();
                // Test for multiple JIDs
                const list = await _converse.api.chats.open([jid, jid2]);
                expect(_.isArray(list)).toBeTruthy();
                expect(list[0].get('box_id')).toBe(`box-${btoa(jid)}`);
                expect(list[1].get('box_id')).toBe(`box-${btoa(jid2)}`);
                done();
            }));
        });

        describe("The \"settings\" API", function() {
            it("has methods 'get' and 'set' to set configuration settings", mock.initConverse(
                    null, null, {'play_sounds': true}, 
                    (done, _converse) => {

                expect(_.keys(_converse.api.settings)).toEqual(["update", "get", "set"]);
                expect(_converse.api.settings.get("play_sounds")).toBe(true);
                _converse.api.settings.set("play_sounds", false);
                expect(_converse.api.settings.get("play_sounds")).toBe(false);
                _converse.api.settings.set({"play_sounds": true});
                expect(_converse.api.settings.get("play_sounds")).toBe(true);
                // Only whitelisted settings allowed.
                expect(typeof _converse.api.settings.get("non_existing")).toBe("undefined");
                _converse.api.settings.set("non_existing", true);
                expect(typeof _converse.api.settings.get("non_existing")).toBe("undefined");
                done();
            }));
        });

        describe("The \"plugins\" API", function() {
            it("only has a method 'add' for registering plugins", mock.initConverse((done, _converse) => {
                expect(_.keys(converse.plugins)).toEqual(["add"]);
                // Cheating a little bit. We clear the plugins to test more easily.
                const _old_plugins = _converse.pluggable.plugins;
                _converse.pluggable.plugins = [];
                converse.plugins.add('plugin1', {});
                expect(_.keys(_converse.pluggable.plugins)).toEqual(['plugin1']);
                converse.plugins.add('plugin2', {});
                expect(_.keys(_converse.pluggable.plugins)).toEqual(['plugin1', 'plugin2']);
                _converse.pluggable.plugins = _old_plugins;
                done();
            }));

            describe("The \"plugins.add\" method", function() {
                it("throws an error when multiple plugins attempt to register with the same name",
                        mock.initConverse((done, _converse) => {

                    converse.plugins.add('myplugin', {});
                    const error = new TypeError('Error: plugin with name "myplugin" has already been registered!');
                    expect(_.partial(converse.plugins.add, 'myplugin', {})).toThrow(error);
                    done();
                }));
            });
        });
    });
}));
