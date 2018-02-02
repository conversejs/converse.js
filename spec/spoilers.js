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
    var $msg = converse.env.$msg;

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
            const spoiler_hint = "Love story end"
            const spoiler = "And at the end of the story, both of them die! It is so tragic!";
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

            var chatboxview = _converse.chatboxviews.get(sender_jid);
            var message_content = chatboxview.el.querySelector('.chat-message .chat-msg-content');

            // TODO add better assertions, currently only checks whether the
            // text is in the DOM, not whether the spoiler is shown or
            // not. Before updating this the spoiler rendering code needs
            // improvement.
            expect(_.includes(message_content.outerHTML, spoiler_hint)).toBeTruthy();
            expect(_.includes(message_content.outerHTML, spoiler)).toBeTruthy();
            done();
        }));

        it("can be sent without a hint",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            test_utils.openControlBox();
            test_utils.openContactsPanel(_converse);
            var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid);

            var view = _converse.chatboxviews.get(contact_jid);
            spyOn(view, 'onMessageSubmitted').and.callThrough();

            var spoiler_toggle = view.el.querySelector('.toggle-spoiler-edit');
            spoiler_toggle.click();

            var textarea = view.el.querySelector('.chat-textarea');
            textarea.value = 'This is the spoiler';
            view.keyPressed({
                target: textarea,
                preventDefault: _.noop,
                keyCode: 13
            });
            expect(view.onMessageSubmitted).toHaveBeenCalled();
            done();
        }));

        it("can be sent with a hint",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            test_utils.openControlBox();
            test_utils.openContactsPanel(_converse);
            var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid);

            var view = _converse.chatboxviews.get(contact_jid);

            var spoiler_toggle = view.el.querySelector('.toggle-spoiler-edit');
            spoiler_toggle.click();

            var hint_input = view.el.querySelector('.chat-textarea-hint');

            // TODO

            done();
        }));
    });
}));
