(function (root, factory) {
    define([
        "jquery",
        "mock",
        "test_utils"
        ], function ($, mock, test_utils) {
            return factory($, mock, test_utils);
        }
    );
} (this, function ($, mock, test_utils) {
    var b64_sha1 = converse_api.env.b64_sha1;

    return describe("Converse", $.proxy(function(mock, test_utils) {

        describe("Authentication", function () {
            it("needs either a bosh_service_url a websocket_url or both", function () {
                expect(converse.initConnection.bind({})).toThrow(
                    new Error("initConnection: you must supply a value for either the bosh_service_url or websocket_url or both."));
            });

            describe("with prebind", function () {
                it("needs a jid when also using keepalive", function () {
                    var authentication = converse.authentication;
                    var connection = converse.connection;
                    var jid = converse.jid;
                    converse.bosh_service_url = "localhost";
                    converse.connection = undefined;
                    converse.jid = undefined;
                    converse.keepalive = true;
                    converse.authentication = "prebind";
                    expect(converse.initConnection.bind(converse)).toThrow(
                        new Error("initConnection: when using 'keepalive' with 'prebind, you must supply the JID of the current user."));
                    converse.authentication= authentication;
                    converse.bosh_service_url = undefined;
                    converse.connection = connection;
                    converse.jid = jid;
                    converse.keepalive = undefined;
                });

                it("needs jid, rid and sid values when not using keepalive", function () {
                    var authentication = converse.authentication;
                    var connection = converse.connection;
                    var jid = converse.jid;
                    converse.bosh_service_url = "localhost";
                    converse.connection = undefined;
                    converse.jid = undefined;
                    converse.keepalive = false;
                    converse.authentication = "prebind";
                    expect(converse.initConnection.bind(converse)).toThrow(
                        new Error("initConnection: If you use prebind and not keepalive, then you MUST supply JID, RID and SID values"));
                    converse.authentication= authentication;
                    converse.bosh_service_url = undefined;
                    converse.connection = connection;
                    converse.jid = jid;
                    converse.keepalive = undefined;
                });
            });
        });

        describe("A chat state indication", function () {

            it("are sent out when the client becomes or stops being idle", function () {
                spyOn(converse, 'sendCSI').andCallThrough();
                var sent_stanza;
                spyOn(converse.connection, 'send').andCallFake(function (stanza) {
                    sent_stanza = stanza;
                });
                var i = 0;
                converse.idle_seconds = 0; // Usually initialized by registerIntervalHandler
                converse.features['urn:xmpp:csi:0'] = true; // Mock that the server supports CSI

                converse.csi_waiting_time = 3; // The relevant config option
                while (i <= converse.csi_waiting_time) {
                    expect(converse.sendCSI).not.toHaveBeenCalled();
                    converse.onEverySecond();
                    i++;
                }
                expect(converse.sendCSI).toHaveBeenCalledWith('inactive');
                expect(sent_stanza.toLocaleString()).toBe(
                    "<inactive xmlns='urn:xmpp:csi:0'/>"
                );
                converse.onUserActivity();
                expect(converse.sendCSI).toHaveBeenCalledWith('active');
                expect(sent_stanza.toLocaleString()).toBe(
                    "<active xmlns='urn:xmpp:csi:0'/>"
                );

                // Reset values
                converse.csi_waiting_time = 0;
                converse.features['urn:xmpp:csi:0'] = false;
            });
        });

        describe("Automatic status change", function () {

            it("happens when the client is idle for long enough", function () {
                var i = 0;
                // Usually initialized by registerIntervalHandler
                converse.idle_seconds = 0; 
                converse.auto_changed_status = false;

                // The relevant config options
                converse.auto_away = 3;
                converse.auto_xa = 6;

                expect(converse.xmppstatus.getStatus()).toBe('online');

                while (i <= converse.auto_away) {
                    converse.onEverySecond();
                    i++;
                }
                expect(converse.auto_changed_status).toBe(true);

                while (i <= converse.auto_xa) {
                    expect(converse.xmppstatus.getStatus()).toBe('away');
                    converse.onEverySecond();
                    i++;
                }
                expect(converse.xmppstatus.getStatus()).toBe('xa');
                expect(converse.auto_changed_status).toBe(true);

                converse.onUserActivity();
                expect(converse.xmppstatus.getStatus()).toBe('online');
                expect(converse.auto_changed_status).toBe(false);

                // Reset values
                converse.auto_away = 0;
                converse.auto_xa = 0;
                converse.auto_changed_status = false;
            });
        });

        describe("The \"user\" grouping", function () {

            describe("The \"status\" API", function () {
                beforeEach(function () {
                    test_utils.closeAllChatBoxes();
                    test_utils.clearBrowserStorage();
                    converse.rosterview.model.reset();
                });

                it("has a method for getting the user's availability", function () {
                    converse.xmppstatus.set('status', 'online');
                    expect(converse_api.user.status.get()).toBe('online');
                    converse.xmppstatus.set('status', 'dnd');
                    expect(converse_api.user.status.get()).toBe('dnd');
                });

                it("has a method for setting the user's availability", function () {
                    converse_api.user.status.set('away');
                    expect(converse.xmppstatus.get('status')).toBe('away');
                    converse_api.user.status.set('dnd');
                    expect(converse.xmppstatus.get('status')).toBe('dnd');
                    converse_api.user.status.set('xa');
                    expect(converse.xmppstatus.get('status')).toBe('xa');
                    converse_api.user.status.set('chat');
                    expect(converse.xmppstatus.get('status')).toBe('chat');
                    expect(_.partial(converse_api.user.status.set, 'invalid')).toThrow(
                        new Error('Invalid availability value. See https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.1')
                    );
                });

                it("allows setting the status message as well", function () {
                    converse_api.user.status.set('away', "I'm in a meeting");
                    expect(converse.xmppstatus.get('status')).toBe('away');
                    expect(converse.xmppstatus.get('status_message')).toBe("I'm in a meeting");
                });

                it("has a method for getting the user's status message", function () {
                    converse.xmppstatus.set('status_message', undefined);
                    expect(converse_api.user.status.message.get()).toBe(undefined);
                    converse.xmppstatus.set('status_message', "I'm in a meeting");
                    expect(converse_api.user.status.message.get()).toBe("I'm in a meeting");
                });

                it("has a method for setting the user's status message", function () {
                    converse.xmppstatus.set('status_message', undefined);
                    converse_api.user.status.message.set("I'm in a meeting");
                    expect(converse.xmppstatus.get('status_message')).toBe("I'm in a meeting");
                });
            });
        });

        describe("The \"tokens\" API", $.proxy(function () {
            beforeEach(function () {
                test_utils.closeAllChatBoxes();
                test_utils.clearBrowserStorage();
                converse.rosterview.model.reset();
                test_utils.createContacts('current');
            });

            it("has a method for retrieving the next RID", $.proxy(function () {
                var old_connection = converse.connection;
                converse.connection._proto.rid = '1234';
                converse.expose_rid_and_sid = false;
                expect(converse_api.tokens.get('rid')).toBe(null);
                converse.expose_rid_and_sid = true;
                expect(converse_api.tokens.get('rid')).toBe('1234');
                converse.connection = undefined;
                expect(converse_api.tokens.get('rid')).toBe(null);
                // Restore the connection
                converse.connection = old_connection;
            }, converse));

            it("has a method for retrieving the SID", $.proxy(function () {
                var old_connection = converse.connection;
                converse.connection._proto.sid = '1234';
                converse.expose_rid_and_sid = false;
                expect(converse_api.tokens.get('sid')).toBe(null);
                converse.expose_rid_and_sid = true;
                expect(converse_api.tokens.get('sid')).toBe('1234');
                converse.connection = undefined;
                expect(converse_api.tokens.get('sid')).toBe(null);
                // Restore the connection
                converse.connection = old_connection;
            }, converse));
        }, converse));

        describe("The \"contacts\" API", $.proxy(function () {
            beforeEach($.proxy(function () {
                test_utils.closeAllChatBoxes();
                test_utils.clearBrowserStorage();
                converse.rosterview.model.reset();
                test_utils.createContacts('current');
            }, converse));

            it("has a method 'get' which returns wrapped contacts", $.proxy(function () {
                // Check that it returns nothing if a non-existing JID is given
                expect(converse_api.contacts.get('non-existing@jabber.org')).toBeFalsy();
                // Check when a single jid is given
                var jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                var attrs = converse_api.contacts.get(jid);
                expect(typeof attrs).toBe('object');
                expect(attrs.fullname).toBe(mock.cur_names[0]);
                expect(attrs.jid).toBe(jid);
                // You can retrieve multiple contacts by passing in an array
                var jid2 = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                var list = converse_api.contacts.get([jid, jid2]);
                expect(Array.isArray(list)).toBeTruthy();
                expect(list[0].fullname).toBe(mock.cur_names[0]);
                expect(list[1].fullname).toBe(mock.cur_names[1]);
                // Check that all JIDs are returned if you call without any parameters
                list = converse_api.contacts.get();
                expect(list.length).toBe(mock.cur_names.length);
            }, converse));

            it("has a method 'add' with which contacts can be added", $.proxy(function () {
                var error = new TypeError('contacts.add: invalid jid');
                expect(converse_api.contacts.add).toThrow(error);
                expect(converse_api.contacts.add.bind(converse_api, "invalid jid")).toThrow(error);
                spyOn(converse.roster, 'addAndSubscribe');
                converse_api.contacts.add("newcontact@example.org");
                expect(converse.roster.addAndSubscribe).toHaveBeenCalled();
            }, converse));

        }, converse));

        describe("The \"chats\" API", $.proxy(function() {
            beforeEach($.proxy(function () {
                test_utils.closeAllChatBoxes();
                test_utils.clearBrowserStorage();
                converse.rosterview.model.reset();
                test_utils.createContacts('current');
            }, converse));

            it("has a method 'get' which returns a wrapped chat box", $.proxy(function () {
                // Test on chat that doesn't exist.
                expect(converse_api.chats.get('non-existing@jabber.org')).toBeFalsy();

                // Test on chat that's not open
                var jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                var box = converse_api.chats.get(jid);
                expect(box instanceof Object).toBeTruthy();
                var chatboxview = this.chatboxviews.get(jid);
                expect(chatboxview.$el.is(':visible')).toBeFalsy();

                // Test for single JID
                test_utils.openChatBoxFor(jid);
                box = converse_api.chats.get(jid);
                expect(box instanceof Object).toBeTruthy();
                expect(box.get('box_id')).toBe(b64_sha1(jid));
                chatboxview = this.chatboxviews.get(jid);
                expect(chatboxview.$el.is(':visible')).toBeTruthy();

                // Test for multiple JIDs
                var jid2 = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                test_utils.openChatBoxFor(jid2);
                var list = converse_api.chats.get([jid, jid2]);
                expect(Array.isArray(list)).toBeTruthy();
                expect(list[0].get('box_id')).toBe(b64_sha1(jid));
                expect(list[1].get('box_id')).toBe(b64_sha1(jid2));
            }, converse));

            it("has a method 'open' which opens and returns a wrapped chat box", $.proxy(function () {
                // Test on chat that doesn't exist.
                expect(converse_api.chats.get('non-existing@jabber.org')).toBeFalsy();

                var jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                var box = converse_api.chats.open(jid);
                expect(box instanceof Object).toBeTruthy();
                expect(box.get('box_id')).toBe(b64_sha1(jid));
                var chatboxview = this.chatboxviews.get(jid);
                expect(chatboxview.$el.is(':visible')).toBeTruthy();

                // Test for multiple JIDs
                var jid2 = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
                var list = converse_api.chats.open([jid, jid2]);
                expect(Array.isArray(list)).toBeTruthy();
                expect(list[0].get('box_id')).toBe(b64_sha1(jid));
                expect(list[1].get('box_id')).toBe(b64_sha1(jid2));
            }, converse));
        }, converse));

        describe("The \"settings\" API", $.proxy(function() {
            beforeEach($.proxy(function () {
                test_utils.closeAllChatBoxes();
                test_utils.clearBrowserStorage();
                converse.rosterview.model.reset();
                test_utils.createContacts('current');
            }, converse));

            it("has methods 'get' and 'set' to set configuration settings", $.proxy(function () {
                expect(Object.keys(converse_api.settings)).toEqual(["get", "set"]);
                expect(converse_api.settings.get("play_sounds")).toBe(false);
                converse_api.settings.set("play_sounds", true);
                expect(converse_api.settings.get("play_sounds")).toBe(true);
                converse_api.settings.set({"play_sounds": false});
                expect(converse_api.settings.get("play_sounds")).toBe(false);
                // Only whitelisted settings allowed.
                expect(typeof converse_api.settings.get("non_existing")).toBe("undefined");
                converse_api.settings.set("non_existing", true);
                expect(typeof converse_api.settings.get("non_existing")).toBe("undefined");
            }, converse));
        }, converse));
    }, converse, mock, test_utils));
}));
