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

        beforeEach($.proxy(function () {
            test_utils.closeAllChatBoxes();
            test_utils.clearBrowserStorage();
            converse.rosterview.model.reset();
            test_utils.createContacts('current');
        }, converse));

        it("has an API method for retrieving the next RID", $.proxy(function () {
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

        it("has an API method for retrieving the SID", $.proxy(function () {
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

        it("has an API method for retrieving a buddy's attributes", $.proxy(function () {
            var jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            expect(converse_api.getBuddy('non-existing@jabber.org')).toBeFalsy();
            var attrs = converse_api.getBuddy(jid);
            expect(typeof attrs).toBe('object');
            expect(attrs.fullname).toBe(mock.cur_names[0]);
            expect(attrs.jid).toBe(jid);
        }, converse));

        it("has an API method, openChatBox, for opening a chat box for a buddy", $.proxy(function () {
            expect(converse_api.openChatBox('non-existing@jabber.org')).toBeFalsy(); // test on user that doesn't exist.
            var jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            var box = converse_api.openChatBox(jid);
            expect(box instanceof Object).toBeTruthy();
            expect(box.get('box_id')).toBe(b64_sha1(jid));
            var chatboxview = this.chatboxviews.get(jid);
            expect(chatboxview.$el.is(':visible')).toBeTruthy();
        }, converse));

        it("will focus an already open chat box, if the openChatBox API method is called for it.", $.proxy(function () {
            // Calling openChatBox on an already open chat will focus it.
            var jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            var chatboxview = this.chatboxviews.get(jid);
            spyOn(chatboxview, 'focus');
            test_utils.openChatBoxFor(jid);
            box = converse_api.openChatBox(jid);
            expect(chatboxview.focus).toHaveBeenCalled();
            expect(box.get('box_id')).toBe(b64_sha1(jid));

        }, converse));

        it("has an API method, getChatBox, for retrieving chat box", $.proxy(function () {
            var jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            expect(converse_api.getChatBox(jid)).toBeFalsy();
            test_utils.openChatBoxFor(jid);
            var box = converse_api.getChatBox(jid);
            expect(box instanceof Object).toBeTruthy();
            expect(box.get('box_id')).toBe(b64_sha1(jid));
        }, converse));

    }, converse, mock, test_utils));
}));
