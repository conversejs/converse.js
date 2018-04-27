(function (root, factory) {
    define([
        "jasmine",
        "utils",
        "mock",
        "converse-core",
        "test-utils"
        ], factory);
} (this, function (jasmine, utils, mock, converse, test_utils) {

    var _ = converse.env._;
    var Strophe = converse.env.Strophe;
    var $msg = converse.env.$msg;
    var $pres = converse.env.$pres;
    var u = converse.env.utils;

    return describe("A spoiler message", function () {

        it("can be received with a hint",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';

            /* <message to='romeo@montague.net/orchard' from='juliet@capulet.net/balcony' id='spoiler2'>
             *      <body>And at the end of the story, both of them die! It is so tragic!</body>
             *      <spoiler xmlns='urn:xmpp:spoiler:0'>Love story end</spoiler>
             *  </message>
             */
            var spoiler_hint = "Love story end"
            var spoiler = "And at the end of the story, both of them die! It is so tragic!";
            var msg = $msg({
                    'xmlns': 'jabber:client',
                    'to': _converse.bare_jid,
                    'from': sender_jid,
                    'type': 'chat'
                }).c('body').t(spoiler).up()
                  .c('spoiler', {
                      'xmlns': 'urn:xmpp:spoiler:0',
                    }).t(spoiler_hint)
                .tree();
            _converse.chatboxes.onMessage(msg);

            var view = _converse.chatboxviews.get(sender_jid);
            expect(view.el.querySelector('.chat-msg-author').textContent).toBe('Max Frankfurter');

            var message_content = view.el.querySelector('.chat-msg-text');
            expect(message_content.textContent).toBe(spoiler);

            var spoiler_hint_el = view.el.querySelector('.spoiler-hint');
            expect(spoiler_hint_el.textContent).toBe(spoiler_hint);
            done();
        }));

        it("can be received without a hint",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';

            /* <message to='romeo@montague.net/orchard' from='juliet@capulet.net/balcony' id='spoiler2'>
             *      <body>And at the end of the story, both of them die! It is so tragic!</body>
             *      <spoiler xmlns='urn:xmpp:spoiler:0'>Love story end</spoiler>
             *  </message>
             */
            var spoiler = "And at the end of the story, both of them die! It is so tragic!";
            var msg = $msg({
                    'xmlns': 'jabber:client',
                    'to': _converse.bare_jid,
                    'from': sender_jid,
                    'type': 'chat'
                }).c('body').t(spoiler).up()
                  .c('spoiler', {
                      'xmlns': 'urn:xmpp:spoiler:0',
                    }).tree();
            _converse.chatboxes.onMessage(msg);

            var view = _converse.chatboxviews.get(sender_jid);
            expect(_.includes(view.el.querySelector('.chat-msg-author').textContent, 'Max Frankfurter')).toBeTruthy();

            var message_content = view.el.querySelector('.chat-msg-text');
            expect(message_content.textContent).toBe(spoiler);

            var spoiler_hint_el = view.el.querySelector('.spoiler-hint');
            expect(spoiler_hint_el.textContent).toBe('');
            done();
        }));

        it("can be sent without a hint",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            test_utils.openControlBox();
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
                var view = _converse.chatboxviews.get(contact_jid);
                spyOn(view, 'onMessageSubmitted').and.callThrough();
                spyOn(_converse.connection, 'send');

                var spoiler_toggle = view.el.querySelector('.toggle-compose-spoiler');
                spoiler_toggle.click();

                var textarea = view.el.querySelector('.chat-textarea');
                textarea.value = 'This is the spoiler';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13
                });
                expect(view.onMessageSubmitted).toHaveBeenCalled();

                /* Test the XML stanza 
                 *
                 * <message from="dummy@localhost/resource"
                 *          to="max.frankfurter@localhost"
                 *          type="chat"
                 *          id="4547c38b-d98b-45a5-8f44-b4004dbc335e"
                 *          xmlns="jabber:client">
                 *    <body>This is the spoiler</body>
                 *    <active xmlns="http://jabber.org/protocol/chatstates"/>
                 *    <spoiler xmlns="urn:xmpp:spoiler:0"/>
                 * </message>"
                 */
                var stanza = _converse.connection.send.calls.argsFor(0)[0].tree();
                var spoiler_el = stanza.querySelector('spoiler[xmlns="urn:xmpp:spoiler:0"]');
                expect(_.isNull(spoiler_el)).toBeFalsy();
                expect(spoiler_el.textContent).toBe('');

                var body_el = stanza.querySelector('body');
                expect(body_el.textContent).toBe('This is the spoiler');

                /* Test the HTML spoiler message */
                expect(view.el.querySelector('.chat-msg-author').textContent).toBe('dummy@localhost');

                var spoiler_msg_el = view.el.querySelector('.chat-msg-text.spoiler');
                expect(spoiler_msg_el.textContent).toBe('This is the spoiler');
                expect(_.includes(spoiler_msg_el.classList, 'collapsed')).toBeTruthy();

                spoiler_toggle = view.el.querySelector('.spoiler-toggle');
                expect(spoiler_toggle.textContent).toBe('Show more');
                spoiler_toggle.click();
                expect(_.includes(spoiler_msg_el.classList, 'collapsed')).toBeFalsy();
                expect(spoiler_toggle.textContent).toBe('Show less');
                spoiler_toggle.click();
                expect(_.includes(spoiler_msg_el.classList, 'collapsed')).toBeTruthy();
                done();
            });
        }));

        it("can be sent with a hint",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            test_utils.openControlBox();
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
                var view = _converse.chatboxviews.get(contact_jid);
                var spoiler_toggle = view.el.querySelector('.toggle-compose-spoiler');
                spoiler_toggle.click();

                spyOn(view, 'onMessageSubmitted').and.callThrough();
                spyOn(_converse.connection, 'send');

                var textarea = view.el.querySelector('.chat-textarea');
                textarea.value = 'This is the spoiler';
                var hint_input = view.el.querySelector('.spoiler-hint');
                hint_input.value = 'This is the hint';

                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13
                });
                expect(view.onMessageSubmitted).toHaveBeenCalled();

                /* Test the XML stanza 
                *
                * <message from="dummy@localhost/resource"
                *          to="max.frankfurter@localhost"
                *          type="chat"
                *          id="4547c38b-d98b-45a5-8f44-b4004dbc335e"
                *          xmlns="jabber:client">
                *    <body>This is the spoiler</body>
                *    <active xmlns="http://jabber.org/protocol/chatstates"/>
                *    <spoiler xmlns="urn:xmpp:spoiler:0">This is the hint</spoiler>
                * </message>"
                */
                var stanza = _converse.connection.send.calls.argsFor(0)[0].tree();
                var spoiler_el = stanza.querySelector('spoiler[xmlns="urn:xmpp:spoiler:0"]');

                expect(_.isNull(spoiler_el)).toBeFalsy();
                expect(spoiler_el.textContent).toBe('This is the hint');

                var body_el = stanza.querySelector('body');
                expect(body_el.textContent).toBe('This is the spoiler');

                /* Test the HTML spoiler message */
                expect(view.el.querySelector('.chat-msg-author').textContent).toBe('dummy@localhost');

                var spoiler_msg_el = view.el.querySelector('.chat-msg-text.spoiler');
                expect(spoiler_msg_el.textContent).toBe('This is the spoiler');
                expect(_.includes(spoiler_msg_el.classList, 'collapsed')).toBeTruthy();

                spoiler_toggle = view.el.querySelector('.spoiler-toggle');
                expect(spoiler_toggle.textContent).toBe('Show more');
                spoiler_toggle.click();
                expect(_.includes(spoiler_msg_el.classList, 'collapsed')).toBeFalsy();
                expect(spoiler_toggle.textContent).toBe('Show less');
                spoiler_toggle.click();
                expect(_.includes(spoiler_msg_el.classList, 'collapsed')).toBeTruthy();
                done();
            });
        }));
    });
}));
