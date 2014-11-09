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
    return describe("Converse", $.proxy(function(mock, test_utils) {

        describe("The \"tokens\" API", $.proxy(function () {
            beforeEach($.proxy(function () {
                test_utils.closeAllChatBoxes();
                test_utils.clearBrowserStorage();
                converse.rosterview.model.reset();
                test_utils.createContacts('current');
            }, converse));

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

            it("has a method 'get' which returns a wrapped contact", $.proxy(function () {
                // TODO: test multiple JIDs passed in
                var jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                expect(converse_api.contacts.get('non-existing@jabber.org')).toBeFalsy();
                var attrs = converse_api.contacts.get(jid);
                expect(typeof attrs).toBe('object');
                expect(attrs.fullname).toBe(mock.cur_names[0]);
                expect(attrs.jid).toBe(jid);
            }, converse));
        }, converse));

        describe("The \"chats\" API", $.proxy(function() {
            beforeEach($.proxy(function () {
                test_utils.closeAllChatBoxes();
                test_utils.clearBrowserStorage();
                converse.rosterview.model.reset();
                test_utils.createContacts('current');
            }, converse));

            it("has a method 'get' which returns a wrapped chat box object", $.proxy(function () {
                // TODO: test multiple JIDs passed in
                // FIXME: when a non-existing chat box is "get(ted)", it's
                // opened, which we don't want...
                expect(converse_api.chats.get('non-existing@jabber.org')).toBeFalsy(); // test on user that doesn't exist.
                var jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                var box = converse_api.chats.get(jid);
                expect(box instanceof Object).toBeTruthy();
                expect(box.get('box_id')).toBe(b64_sha1(jid));
                var chatboxview = this.chatboxviews.get(jid);
                expect(chatboxview.$el.is(':visible')).toBeTruthy();
            }, converse));
        }, converse));

        describe("The DEPRECATED API", $.proxy(function() {
            beforeEach($.proxy(function () {
                test_utils.closeAllChatBoxes();
                test_utils.clearBrowserStorage();
                converse.rosterview.model.reset();
                test_utils.createContacts('current');
            }, converse));

            it("has a method for retrieving the next RID", $.proxy(function () {
                var old_connection = converse.connection;
                converse.connection._proto.rid = '1234';
                converse.expose_rid_and_sid = false;
                expect(converse_api.getRID()).toBe(null);

                converse.expose_rid_and_sid = true;
                expect(converse_api.getRID()).toBe('1234');

                converse.connection = undefined;
                expect(converse_api.getRID()).toBe(null);
                // Restore the connection
                converse.connection = old_connection;
            }, converse));

            it("has a method for retrieving the SID", $.proxy(function () {
                var old_connection = converse.connection;
                converse.connection._proto.sid = '1234';
                converse.expose_rid_and_sid = false;
                expect(converse_api.getSID()).toBe(null);

                converse.expose_rid_and_sid = true;
                expect(converse_api.getSID()).toBe('1234');

                converse.connection = undefined;
                expect(converse_api.getSID()).toBe(null);
                // Restore the connection
                converse.connection = old_connection;
            }, converse));

            it("has a method for retrieving a buddy's attributes", $.proxy(function () {
                var jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                expect(converse_api.getBuddy('non-existing@jabber.org')).toBeFalsy();
                var attrs = converse_api.getBuddy(jid);
                expect(typeof attrs).toBe('object');
                expect(attrs.fullname).toBe(mock.cur_names[0]);
                expect(attrs.jid).toBe(jid);
            }, converse));
        }, converse));


    }, converse, mock, test_utils));
}));
