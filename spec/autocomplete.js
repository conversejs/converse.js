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

    describe("The nickname autocomplete feature", function () {

        it("shows all autocompletion options when the user presses @",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

            await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'tom');
            const view = _converse.chatboxviews.get('lounge@localhost');

            ['dick', 'harry'].forEach((nick) => {
                _converse.connection._dataRecv(test_utils.createRequest(
                    $pres({
                        'to': 'tom@localhost/resource',
                        'from': `lounge@localhost/${nick}`
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': `${nick}@localhost/resource`,
                        'role': 'participant'
                    })));
            });

            // Test that pressing @ brings up all options
            const textarea = view.el.querySelector('textarea.chat-textarea');
            const at_event = {
                'target': textarea,
                'preventDefault': _.noop,
                'stopPropagation': _.noop,
                'keyCode': 50,
                'key': '@'
            };
            view.keyPressed(at_event);
            textarea.value = '@';
            view.keyUp(at_event);

            expect(view.el.querySelectorAll('.suggestion-box__results li').length).toBe(3);
            expect(view.el.querySelector('.suggestion-box__results li:first-child').textContent).toBe('dick');
            expect(view.el.querySelector('.suggestion-box__results li:nth-child(2)').textContent).toBe('harry');
            expect(view.el.querySelector('.suggestion-box__results li:nth-child(3)').textContent).toBe('tom');
            done();
        }));

        it("autocompletes when the user presses tab",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

            await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
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
                'stopPropagation': _.noop,
                'keyCode': 9,
                'key': 'Tab'
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

            textarea.value = "hello s s";
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
            expect(view.el.querySelectorAll('.suggestion-box__results li').length).toBe(2);
            expect(view.el.querySelector('.suggestion-box__results li[aria-selected="false"]').textContent).toBe('some1');
            expect(view.el.querySelector('.suggestion-box__results li[aria-selected="true"]').textContent).toBe('some2');

            view.keyPressed({
                'target': textarea,
                'preventDefault': _.noop,
                'stopPropagation': _.noop,
                'keyCode': 13 // Enter
            });
            expect(textarea.value).toBe('hello s @some2 ');

            // Test that pressing tab twice selects
            presence = $pres({
                    'to': 'dummy@localhost/resource',
                    'from': 'lounge@localhost/z3r0'
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'z3r0@localhost/resource',
                    'role': 'participant'
                });
            _converse.connection._dataRecv(test_utils.createRequest(presence));
            textarea.value = "hello z";
            view.keyPressed(tab_event);
            view.keyUp(tab_event);

            view.keyPressed(tab_event);
            view.keyUp(tab_event);
            expect(textarea.value).toBe('hello @z3r0 ');
            done();
        }));

        it("autocompletes when the user presses backspace",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

            await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
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
            textarea.value = "hello @some1 ";

            // Press backspace
            const backspace_event = {
                'target': textarea,
                'preventDefault': _.noop,
                'stopPropagation': _.noop,
                'keyCode': 8,
                'key': 'Backspace'
            }
            view.keyPressed(backspace_event);
            textarea.value = "hello @some1"; // Mimic backspace
            view.keyUp(backspace_event);
            expect(view.el.querySelector('.suggestion-box__results').hidden).toBeFalsy();
            expect(view.el.querySelectorAll('.suggestion-box__results li').length).toBe(1);
            expect(view.el.querySelector('.suggestion-box__results li').textContent).toBe('some1');
            done();
        }));
    });
}));
