/*global converse */
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
    var Strophe = converse_api.env.Strophe;
    var b64_sha1 = converse_api.env.b64_sha1;

    return describe("The OTR module", function() {
        beforeEach(function () {
            test_utils.openControlBox();
            test_utils.openContactsPanel();
            test_utils.createContacts('current');
        });

        it("can store a session passphrase in session storage", function () {
            // With no prebind, the user's XMPP password is used and nothing is
            // stored in session storage.
            var auth = converse.authentication;
            var pass = converse.connection.pass;
            converse.authentication = "manual";
            converse.connection.pass = 's3cr3t!';
            expect(converse.otr.getSessionPassphrase()).toBe(converse.connection.pass);

            // With prebind, a random passphrase is generated and stored in
            // session storage.
            converse.authentication = "prebind";
            var pp = converse.otr.getSessionPassphrase();
            expect(pp).not.toBe(converse.connection.pass);
            expect(pp).toBe(window.sessionStorage[b64_sha1(converse.connection.jid)]);

            // Clean up
            converse.authentication = auth;
            converse.connection.pass = pass;
        });

        it("will add processing hints to sent out encrypted <message> stanzas", function () {
            var UNVERIFIED = 1, UNENCRYPTED = 0;
            var contact_name = mock.cur_names[0];
            var contact_jid = contact_name.replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(contact_jid);
            var chatview = converse.chatboxviews.get(contact_jid);
            chatview.model.set('otr_status', UNVERIFIED);
            var stanza = chatview.createMessageStanza(new converse.Message({ message: 'hello world'}));
            var $hints = $(stanza.nodeTree).find('[xmlns="'+Strophe.NS.HINTS+'"]');
            expect($hints.length).toBe(3);
            expect($hints.get(0).tagName).toBe('no-store');
            expect($hints.get(1).tagName).toBe('no-permanent-store');
            expect($hints.get(2).tagName).toBe('no-copy');
            chatview.model.set('otr_status', UNENCRYPTED); // Reset again to UNENCRYPTED
        });

        describe("An OTR Chat Message", function () {

            it("will not be carbon copied when it's sent out", function () {
                var msgtext = "?OTR,1,3,?OTR:AAIDAAAAAAEAAAABAAAAwCQ8HKsag0y0DGKsneo0kzKu1ua5L93M4UKTkCf1I2kbm2RgS5kIxDTxrTj3wVRB+H5Si86E1fKtuBgsDf/bKkGTM0h/49vh5lOD9HkE8cnSrFEn5GN,";
                var sender_jid = mock.cur_names[3].replace(/ /g,'.').toLowerCase() + '@localhost';
                converse_api.chats.open(sender_jid);
                var chatbox = converse.chatboxes.get(sender_jid);
                spyOn(converse.connection, 'send');
                chatbox.set('otr_status', 1); // Set OTR status to UNVERIFIED, to mock an encrypted session
                chatbox.trigger('sendMessage', new converse.Message({ message: msgtext }));
                var $sent = $(converse.connection.send.argsForCall[0][0].tree());
                expect($sent.find('body').siblings('private').length).toBe(1);
                expect($sent.find('private').length).toBe(1);
                expect($sent.find('private').attr('xmlns')).toBe('urn:xmpp:carbons:2');
                chatbox.set('otr_status', 0); // Reset again to UNENCRYPTED
            });
        });
    });
}));
