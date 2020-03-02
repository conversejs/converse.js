(function (root, factory) {
    define([
        "jasmine",
        "mock",
        "test-utils"
        ], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const $pres = converse.env.$pres;
    const $msg = converse.env.$msg;
    const Strophe = converse.env.Strophe;
    const u = converse.env.utils;

    describe("The nickname autocomplete feature", function () {

        it("shows all autocompletion options when the user presses @",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

            await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'tom');
            const view = _converse.chatboxviews.get('lounge@montague.lit');

            // Nicknames from presences
            ['dick', 'harry'].forEach((nick) => {
                _converse.connection._dataRecv(test_utils.createRequest(
                    $pres({
                        'to': 'tom@montague.lit/resource',
                        'from': `lounge@montague.lit/${nick}`
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': `${nick}@montague.lit/resource`,
                        'role': 'participant'
                    })));
            });

            // Nicknames from messages
            const msg = $msg({
                    from: 'lounge@montague.lit/jane',
                    id: u.getUniqueId(),
                    to: 'romeo@montague.lit',
                    type: 'groupchat'
                }).c('body').t('Hello world').tree();
            await view.model.queueMessage(msg);

            // Test that pressing @ brings up all options
            const textarea = view.el.querySelector('textarea.chat-textarea');
            const at_event = {
                'target': textarea,
                'preventDefault': function preventDefault () {},
                'stopPropagation': function stopPropagation () {},
                'keyCode': 50,
                'key': '@'
            };
            view.onKeyDown(at_event);
            textarea.value = '@';
            view.onKeyUp(at_event);

            expect(view.el.querySelectorAll('.suggestion-box__results li').length).toBe(4);
            expect(view.el.querySelector('.suggestion-box__results li:first-child').textContent).toBe('dick');
            expect(view.el.querySelector('.suggestion-box__results li:nth-child(2)').textContent).toBe('harry');
            expect(view.el.querySelector('.suggestion-box__results li:nth-child(3)').textContent).toBe('jane');
            expect(view.el.querySelector('.suggestion-box__results li:nth-child(4)').textContent).toBe('tom');
            done();
        }));

        it("autocompletes when the user presses tab",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

            await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            expect(view.model.occupants.length).toBe(1);
            let presence = $pres({
                    'to': 'romeo@montague.lit/orchard',
                    'from': 'lounge@montague.lit/some1'
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'some1@montague.lit/resource',
                    'role': 'participant'
                });
            _converse.connection._dataRecv(test_utils.createRequest(presence));
            expect(view.model.occupants.length).toBe(2);

            const textarea = view.el.querySelector('textarea.chat-textarea');
            textarea.value = "hello som";

            // Press tab
            const tab_event = {
                'target': textarea,
                'preventDefault': function preventDefault () {},
                'stopPropagation': function stopPropagation () {},
                'keyCode': 9,
                'key': 'Tab'
            }
            view.onKeyDown(tab_event);
            view.onKeyUp(tab_event);
            expect(view.el.querySelector('.suggestion-box__results').hidden).toBeFalsy();
            expect(view.el.querySelectorAll('.suggestion-box__results li').length).toBe(1);
            expect(view.el.querySelector('.suggestion-box__results li').textContent).toBe('some1');

            const backspace_event = {
                'target': textarea,
                'preventDefault': function preventDefault () {},
                'keyCode': 8
            }
            for (var i=0; i<3; i++) {
                // Press backspace 3 times to remove "som"
                view.onKeyDown(backspace_event);
                textarea.value = textarea.value.slice(0, textarea.value.length-1)
                view.onKeyUp(backspace_event);
            }
            expect(view.el.querySelector('.suggestion-box__results').hidden).toBeTruthy();

            presence = $pres({
                    'to': 'romeo@montague.lit/orchard',
                    'from': 'lounge@montague.lit/some2'
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'some2@montague.lit/resource',
                    'role': 'participant'
                });
            _converse.connection._dataRecv(test_utils.createRequest(presence));

            textarea.value = "hello s s";
            view.onKeyDown(tab_event);
            view.onKeyUp(tab_event);
            expect(view.el.querySelector('.suggestion-box__results').hidden).toBeFalsy();
            expect(view.el.querySelectorAll('.suggestion-box__results li').length).toBe(2);

            const up_arrow_event = {
                'target': textarea,
                'preventDefault': () => (up_arrow_event.defaultPrevented = true),
                'stopPropagation': function stopPropagation () {},
                'keyCode': 38
            }
            view.onKeyDown(up_arrow_event);
            view.onKeyUp(up_arrow_event);
            expect(view.el.querySelectorAll('.suggestion-box__results li').length).toBe(2);
            expect(view.el.querySelector('.suggestion-box__results li[aria-selected="false"]').textContent).toBe('some1');
            expect(view.el.querySelector('.suggestion-box__results li[aria-selected="true"]').textContent).toBe('some2');

            view.onKeyDown({
                'target': textarea,
                'preventDefault': function preventDefault () {},
                'stopPropagation': function stopPropagation () {},
                'keyCode': 13 // Enter
            });
            expect(textarea.value).toBe('hello s @some2 ');

            // Test that pressing tab twice selects
            presence = $pres({
                    'to': 'romeo@montague.lit/orchard',
                    'from': 'lounge@montague.lit/z3r0'
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'z3r0@montague.lit/resource',
                    'role': 'participant'
                });
            _converse.connection._dataRecv(test_utils.createRequest(presence));
            textarea.value = "hello z";
            view.onKeyDown(tab_event);
            view.onKeyUp(tab_event);

            view.onKeyDown(tab_event);
            view.onKeyUp(tab_event);
            expect(textarea.value).toBe('hello @z3r0 ');
            done();
        }));

        it("autocompletes when the user presses backspace",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

            await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            expect(view.model.occupants.length).toBe(1);
            const presence = $pres({
                    'to': 'romeo@montague.lit/orchard',
                    'from': 'lounge@montague.lit/some1'
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'some1@montague.lit/resource',
                    'role': 'participant'
                });
            _converse.connection._dataRecv(test_utils.createRequest(presence));
            expect(view.model.occupants.length).toBe(2);

            const textarea = view.el.querySelector('textarea.chat-textarea');
            textarea.value = "hello @some1 ";

            // Press backspace
            const backspace_event = {
                'target': textarea,
                'preventDefault': function preventDefault () {},
                'stopPropagation': function stopPropagation () {},
                'keyCode': 8,
                'key': 'Backspace'
            }
            view.onKeyDown(backspace_event);
            textarea.value = "hello @some1"; // Mimic backspace
            view.onKeyUp(backspace_event);
            expect(view.el.querySelector('.suggestion-box__results').hidden).toBeFalsy();
            expect(view.el.querySelectorAll('.suggestion-box__results li').length).toBe(1);
            expect(view.el.querySelector('.suggestion-box__results li').textContent).toBe('some1');
            done();
        }));
    });
}));
