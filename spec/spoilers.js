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

    return describe("A spoiler message", function () {

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
