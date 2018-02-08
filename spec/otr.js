(function (root, factory) {
    define(["jquery", "jasmine", "mock", "converse-core", "test-utils"], factory);
} (this, function ($, jasmine, mock, converse, test_utils) {
    var Strophe = converse.env.Strophe;
    var b64_sha1 = converse.env.b64_sha1;
    var $pres = converse.env.$pres;
    var _ = converse.env._;

    describe("A chatbox with an active OTR session", function() {

        it("will not show the spoiler toolbar button",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';

            // XXX: We need to send a presence from the contact, so that we
            // have a resource, that resource is then queried to see
            // whether Strophe.NS.SPOILER is supported, in which case
            // the spoiler button will appear.
            var presence = $pres({
                'from': contact_jid+'/phone',
                'to': 'dummy@localhost'
            });
            _converse.connection._dataRecv(test_utils.createRequest(presence));
            test_utils.openChatBoxFor(_converse, contact_jid);

            test_utils.waitUntilDiscoConfirmed(_converse, contact_jid+'/phone', [], [Strophe.NS.SPOILER]).then(function () {
                var spoiler_toggle;
                var view = _converse.chatboxviews.get(contact_jid);
                spyOn(view, 'addSpoilerButton').and.callThrough();
                view.model.set('otr_status', 1);

                test_utils.waitUntil(function () {
                    return _.isNull(view.el.querySelector('.toggle-compose-spoiler'));
                }).then(function () {
                    spoiler_toggle = view.el.querySelector('.toggle-compose-spoiler');
                    expect(spoiler_toggle).toBe(null);

                    view.model.set('otr_status', 3);

                    return test_utils.waitUntil(function () {
                        return !_.isNull(view.el.querySelector('.toggle-compose-spoiler'));
                    });
                }).then(function () {
                    spoiler_toggle = view.el.querySelector('.toggle-compose-spoiler');
                    expect(spoiler_toggle).not.toBe(null);

                    view.model.set('otr_status', 2);
                    return test_utils.waitUntil(function () {
                        return _.isNull(view.el.querySelector('.toggle-compose-spoiler'));
                    });
                }).then(function () {
                    spoiler_toggle = view.el.querySelector('.toggle-compose-spoiler');
                    expect(spoiler_toggle).toBe(null);

                    view.model.set('otr_status', 4);
                    return test_utils.waitUntil(function () {
                        return !_.isNull(view.el.querySelector('.toggle-compose-spoiler'));
                    });
                }).then(function () {
                    spoiler_toggle = view.el.querySelector('.toggle-compose-spoiler');
                    expect(spoiler_toggle).not.toBe(null);
                    done();
                });
            });
        }));
    });

    describe("The OTR module", function() {

        it("will add processing hints to sent out encrypted <message> stanzas",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.openControlBox();
            test_utils.openContactsPanel(_converse);
            test_utils.createContacts(_converse, 'current');

            var UNVERIFIED = 1, UNENCRYPTED = 0;
            var contact_name = mock.cur_names[0];
            var contact_jid = contact_name.replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid);
            var chatview = _converse.chatboxviews.get(contact_jid);
            chatview.model.set('otr_status', UNVERIFIED);
            var stanza = chatview.createMessageStanza(new _converse.Message({ message: 'hello world'}));
            var $hints = $(stanza.nodeTree).find('[xmlns="'+Strophe.NS.HINTS+'"]');
            expect($hints.length).toBe(3);
            expect($hints.get(0).tagName).toBe('no-store');
            expect($hints.get(1).tagName).toBe('no-permanent-store');
            expect($hints.get(2).tagName).toBe('no-copy');
            chatview.model.set('otr_status', UNENCRYPTED); // Reset again to UNENCRYPTED
            done();
        }));

        describe("An OTR Chat Message", function () {

            it("will not be carbon copied when it's sent out",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openControlBox();
                test_utils.openContactsPanel(_converse);
                test_utils.createContacts(_converse, 'current');

                var msgtext = "?OTR,1,3,?OTR:AAIDAAAAAAEAAAABAAAAwCQ8HKsag0y0DGKsneo0kzKu1ua5L93M4UKTkCf1I2kbm2RgS5kIxDTxrTj3wVRB+H5Si86E1fKtuBgsDf/bKkGTM0h/49vh5lOD9HkE8cnSrFEn5GN,";
                var sender_jid = mock.cur_names[3].replace(/ /g,'.').toLowerCase() + '@localhost';
                _converse.api.chats.open(sender_jid);
                var chatbox = _converse.chatboxes.get(sender_jid);
                spyOn(_converse.connection, 'send');
                chatbox.set('otr_status', 1); // Set OTR status to UNVERIFIED, to mock an encrypted session
                chatbox.trigger('sendMessage', new _converse.Message({ message: msgtext }));
                var $sent = $(_converse.connection.send.calls.argsFor(0)[0].tree());
                expect($sent.find('body').siblings('private').length).toBe(1);
                expect($sent.find('private').length).toBe(1);
                expect($sent.find('private').attr('xmlns')).toBe('urn:xmpp:carbons:2');
                chatbox.set('otr_status', 0); // Reset again to UNENCRYPTED
                done();
            }));
        });
    });
}));
