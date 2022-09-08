/*global mock, converse */

const $pres = converse.env.$pres;
const $msg = converse.env.$msg;
const Strophe = converse.env.Strophe;
const u = converse.env.utils;

describe("The nickname autocomplete feature", function () {

    it("shows all autocompletion options when the user presses @",
            mock.initConverse(['chatBoxesFetched'], {},
            async function (_converse) {

        await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'tom');
        const view = _converse.chatboxviews.get('lounge@montague.lit');

        // Nicknames from presences
        ['dick', 'harry'].forEach((nick) => {
            _converse.connection._dataRecv(mock.createRequest(
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
        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => view.model.messages.last()?.get('received'));

        // Test that pressing @ brings up all options
        const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
        const at_event = {
            'target': textarea,
            'preventDefault': function preventDefault () {},
            'stopPropagation': function stopPropagation () {},
            'keyCode': 50,
            'key': '@'
        };
        const message_form = view.querySelector('converse-muc-message-form');
        message_form.onKeyDown(at_event);
        textarea.value = '@';
        message_form.onKeyUp(at_event);

        await u.waitUntil(() => view.querySelectorAll('.suggestion-box__results li').length === 4);
        expect(view.querySelector('.suggestion-box__results li:first-child').textContent).toBe('dick');
        expect(view.querySelector('.suggestion-box__results li:nth-child(2)').textContent).toBe('harry');
        expect(view.querySelector('.suggestion-box__results li:nth-child(3)').textContent).toBe('jane');
        expect(view.querySelector('.suggestion-box__results li:nth-child(4)').textContent).toBe('tom');
    }));

    it("shows all autocompletion options when the user presses @ right after a new line",
            mock.initConverse(['chatBoxesFetched'], {},
            async function (_converse) {

        await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'tom');
        const view = _converse.chatboxviews.get('lounge@montague.lit');

        // Nicknames from presences
        ['dick', 'harry'].forEach((nick) => {
            _converse.connection._dataRecv(mock.createRequest(
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
        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => view.model.messages.last()?.get('received'));

        // Test that pressing @ brings up all options
        const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
        const at_event = {
            'target': textarea,
            'preventDefault': function preventDefault () {},
            'stopPropagation': function stopPropagation () {},
            'keyCode': 50,
            'key': '@'
        };
        const message_form = view.querySelector('converse-muc-message-form');
        textarea.value = '\n'
        message_form.onKeyDown(at_event);
        textarea.value = '\n@';
        message_form.onKeyUp(at_event);

        await u.waitUntil(() => view.querySelectorAll('.suggestion-box__results li').length === 4);
        expect(view.querySelector('.suggestion-box__results li:first-child').textContent).toBe('dick');
        expect(view.querySelector('.suggestion-box__results li:nth-child(2)').textContent).toBe('harry');
        expect(view.querySelector('.suggestion-box__results li:nth-child(3)').textContent).toBe('jane');
        expect(view.querySelector('.suggestion-box__results li:nth-child(4)').textContent).toBe('tom');
    }));

    it("shows all autocompletion options when the user presses @ right after an allowed character",
        mock.initConverse(
            ['chatBoxesFetched'], {'opening_mention_characters':['(']},
            async function (_converse) {

        await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'tom');
        const view = _converse.chatboxviews.get('lounge@montague.lit');

        // Nicknames from presences
        ['dick', 'harry'].forEach((nick) => {
            _converse.connection._dataRecv(mock.createRequest(
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
        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => view.model.messages.last()?.get('received'));

        // Test that pressing @ brings up all options
        const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
        const at_event = {
            'target': textarea,
            'preventDefault': function preventDefault () {},
            'stopPropagation': function stopPropagation () {},
            'keyCode': 50,
            'key': '@'
        };
        textarea.value = '('
        const message_form = view.querySelector('converse-muc-message-form');
        message_form.onKeyDown(at_event);
        textarea.value = '(@';
        message_form.onKeyUp(at_event);

        await u.waitUntil(() => view.querySelectorAll('.suggestion-box__results li').length === 4);
        expect(view.querySelector('.suggestion-box__results li:first-child').textContent).toBe('dick');
        expect(view.querySelector('.suggestion-box__results li:nth-child(2)').textContent).toBe('harry');
        expect(view.querySelector('.suggestion-box__results li:nth-child(3)').textContent).toBe('jane');
        expect(view.querySelector('.suggestion-box__results li:nth-child(4)').textContent).toBe('tom');
    }));

    it("should order by query index position and length", mock.initConverse(
            ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'tom');
            const view = _converse.chatboxviews.get('lounge@montague.lit');

            // Nicknames from presences
            ['bernard', 'naber', 'helberlo', 'john', 'jones'].forEach((nick) => {
                _converse.connection._dataRecv(mock.createRequest(
                    $pres({
                        'to': 'tom@montague.lit/resource',
                        'from': `lounge@montague.lit/${nick}`
                    })
                        .c('x', { xmlns: Strophe.NS.MUC_USER })
                        .c('item', {
                            'affiliation': 'none',
                            'jid': `${nick}@montague.lit/resource`,
                            'role': 'participant'
                        })));
            });

            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            const at_event = {
                'target': textarea,
                'preventDefault': function preventDefault() { },
                'stopPropagation': function stopPropagation() { },
                'keyCode': 50,
                'key': '@'
            };

            const message_form = view.querySelector('converse-muc-message-form');
            // Test that results are sorted by query index
            message_form.onKeyDown(at_event);
            textarea.value = '@ber';
            message_form.onKeyUp(at_event);
            await u.waitUntil(() => view.querySelectorAll('.suggestion-box__results li').length === 3);
            expect(view.querySelector('.suggestion-box__results li:first-child').textContent).toBe('bernard');
            expect(view.querySelector('.suggestion-box__results li:nth-child(2)').textContent).toBe('naber');
            expect(view.querySelector('.suggestion-box__results li:nth-child(3)').textContent).toBe('helberlo');

            // Test that when the query index is equal, results should be sorted by length
            textarea.value = '@jo';
            message_form.onKeyUp(at_event);
            await u.waitUntil(() => view.querySelectorAll('.suggestion-box__results li').length === 2);
            expect(view.querySelector('.suggestion-box__results li:first-child').textContent).toBe('john');
            expect(view.querySelector('.suggestion-box__results li:nth-child(2)').textContent).toBe('jones');
    }));

    it("autocompletes when the user presses tab",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
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
        _converse.connection._dataRecv(mock.createRequest(presence));
        expect(view.model.occupants.length).toBe(2);

        const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
        textarea.value = "hello som";

        // Press tab
        const tab_event = {
            'target': textarea,
            'preventDefault': function preventDefault () {},
            'stopPropagation': function stopPropagation () {},
            'keyCode': 9,
            'key': 'Tab'
        }
        const message_form = view.querySelector('converse-muc-message-form');
        message_form.onKeyDown(tab_event);
        message_form.onKeyUp(tab_event);
        await u.waitUntil(() => view.querySelector('.suggestion-box__results').hidden === false);
        expect(view.querySelectorAll('.suggestion-box__results li').length).toBe(1);
        expect(view.querySelector('.suggestion-box__results li').textContent).toBe('some1');

        const backspace_event = {
            'target': textarea,
            'preventDefault': function preventDefault () {},
            'keyCode': 8
        }
        for (let i=0; i<3; i++) {
            // Press backspace 3 times to remove "som"
            message_form.onKeyDown(backspace_event);
            textarea.value = textarea.value.slice(0, textarea.value.length-1)
            message_form.onKeyUp(backspace_event);
        }
        await u.waitUntil(() => view.querySelector('.suggestion-box__results').hidden === true);

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
        _converse.connection._dataRecv(mock.createRequest(presence));

        textarea.value = "hello s s";
        message_form.onKeyDown(tab_event);
        message_form.onKeyUp(tab_event);
        await u.waitUntil(() => view.querySelector('.suggestion-box__results').hidden === false);
        expect(view.querySelectorAll('.suggestion-box__results li').length).toBe(2);

        const up_arrow_event = {
            'target': textarea,
            'preventDefault': () => (up_arrow_event.defaultPrevented = true),
            'stopPropagation': function stopPropagation () {},
            'keyCode': 38
        }
        message_form.onKeyDown(up_arrow_event);
        message_form.onKeyUp(up_arrow_event);
        expect(view.querySelectorAll('.suggestion-box__results li').length).toBe(2);
        expect(view.querySelector('.suggestion-box__results li[aria-selected="false"]').textContent).toBe('some1');
        expect(view.querySelector('.suggestion-box__results li[aria-selected="true"]').textContent).toBe('some2');

        message_form.onKeyDown({
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
        _converse.connection._dataRecv(mock.createRequest(presence));
        textarea.value = "hello z";
        message_form.onKeyDown(tab_event);
        message_form.onKeyUp(tab_event);
        await u.waitUntil(() => view.querySelector('.suggestion-box__results').hidden === false);

        message_form.onKeyDown(tab_event);
        message_form.onKeyUp(tab_event);
        await u.waitUntil(() => textarea.value === 'hello @z3r0 ');
    }));

    it("autocompletes when the user presses backspace",
            mock.initConverse([], {}, async function (_converse) {

        await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
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
        _converse.connection._dataRecv(mock.createRequest(presence));
        expect(view.model.occupants.length).toBe(2);

        const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
        textarea.value = "hello @some1 ";

        // Press backspace
        const backspace_event = {
            'target': textarea,
            'preventDefault': function preventDefault () {},
            'stopPropagation': function stopPropagation () {},
            'keyCode': 8,
            'key': 'Backspace'
        }
        const message_form = view.querySelector('converse-muc-message-form');
        message_form.onKeyDown(backspace_event);
        textarea.value = "hello @some1"; // Mimic backspace
        message_form.onKeyUp(backspace_event);
        await u.waitUntil(() => view.querySelector('.suggestion-box__results').hidden === false);
        expect(view.querySelectorAll('.suggestion-box__results li').length).toBe(1);
        expect(view.querySelector('.suggestion-box__results li').textContent).toBe('some1');
    }));
});
