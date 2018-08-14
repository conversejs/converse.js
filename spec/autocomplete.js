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

    return describe("A groupchat textarea", function () {

        it("autocompletes when the user presses tab",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

            test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy')
            .then(() => {
                const view = _converse.chatboxviews.get('lounge@localhost');
                expect(view.model.occupants.length).toBe(1);
                let presence = $pres({
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
                const tab_event = {
                    'target': textarea,
                    'preventDefault': _.noop,
                    'keyCode': 9
                }
                view.keyPressed(tab_event);
                view.keyUp(tab_event);
                expect(view.el.querySelector('.suggestion-box__results').hidden).toBeFalsy();
                expect(view.el.querySelectorAll('.suggestion-box__results li').length).toBe(1);
                expect(view.el.querySelector('.suggestion-box__results li').textContent).toBe('some1');

                const backspace_event = {
                    'target': textarea,
                    'preventDefault': _.noop,
                    'keyCode': 8
                }
                for (var i=0; i<3; i++) {
                    // Press backspace 3 times to remove "som"
                    view.keyPressed(backspace_event);
                    textarea.value = textarea.value.slice(0, textarea.value.length-1)
                    view.keyUp(backspace_event);
                }
                expect(view.el.querySelector('.suggestion-box__results').hidden).toBeTruthy();

                presence = $pres({
                        'to': 'dummy@localhost/resource',
                        'from': 'lounge@localhost/some2'
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'some2@localhost/resource',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                textarea.value = "hello s";
                view.keyPressed(tab_event);
                view.keyUp(tab_event);
                expect(view.el.querySelector('.suggestion-box__results').hidden).toBeFalsy();
                expect(view.el.querySelectorAll('.suggestion-box__results li').length).toBe(2);

                const up_arrow_event = {
                    'target': textarea,
                    'preventDefault': () => (up_arrow_event.defaultPrevented = true),
                    'stopPropagation': _.noop,
                    'keyCode': 38
                }
                view.keyPressed(up_arrow_event);
                view.keyUp(up_arrow_event);

                done();
            }).catch(_.partial(console.error, _));
        }));
    });
}));
