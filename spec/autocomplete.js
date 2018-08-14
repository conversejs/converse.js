(function (root, factory) {
    define([
        "jasmine",
        "mock",
        "test-utils"
        ], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const _ = converse.env._;
    const $iq = converse.env.$iq;
    const $msg = converse.env.$msg;
    const $pres = converse.env.$pres;
    const Strophe = converse.env.Strophe;
    const u = converse.env.utils;
    const sizzle = converse.env.sizzle;

    return describe("A groupchat textarea", function () {

        it("autocompletes when the user presses tab",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

            test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy')
            .then(() => {
                const view = _converse.chatboxviews.get('lounge@localhost');
                expect(view.model.occupants.length).toBe(1);
                const presence = $pres({
                        'to': 'dummy@localhost/resource',
                        'from': 'lounge@localhost/some1'
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'some1@localhost/resource',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                expect(view.model.occupants.length).toBe(2);

                const textarea = view.el.querySelector('textarea.chat-textarea');
                textarea.value = "hello som";

                // Press tab
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 9
                });
                expect(view.el.querySelector('.suggestion-box__results').hidden).toBeFalsy();
                done();
            }).catch(_.partial(console.error, _));
        }));
    });
}));
