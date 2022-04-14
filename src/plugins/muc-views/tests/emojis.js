/*global mock, converse */

const { $pres, sizzle } = converse.env;
const u = converse.env.utils;

describe("Emojis", function () {

    describe("The emoji picker", function () {

        it("is opened to autocomplete emojis in the textarea",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 0);
            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.querySelector('converse-emoji-picker'));
            const textarea = view.querySelector('textarea.chat-textarea');
            textarea.value = ':gri';

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
            await u.waitUntil(() => view.querySelector('converse-emoji-picker .emoji-search')?.value === ':gri');
            await u.waitUntil(() => sizzle('.emojis-lists__container--search .insert-emoji', view).length === 3, 1000);
            let visible_emojis = sizzle('.emojis-lists__container--search .insert-emoji', view);
            expect(visible_emojis[0].getAttribute('data-emoji')).toBe(':grimacing:');
            expect(visible_emojis[1].getAttribute('data-emoji')).toBe(':grin:');
            expect(visible_emojis[2].getAttribute('data-emoji')).toBe(':grinning:');

            const picker = view.querySelector('converse-emoji-picker');
            const input = picker.querySelector('.emoji-search');
            // Test that TAB autocompletes the to first match
            input.dispatchEvent(new KeyboardEvent('keydown', tab_event));

            await u.waitUntil(() => sizzle(".emojis-lists__container--search .insert-emoji:not('.hidden')", picker).length === 1, 1000);
            visible_emojis = sizzle(".emojis-lists__container--search .insert-emoji:not('.hidden')", picker);
            expect(visible_emojis[0].getAttribute('data-emoji')).toBe(':grimacing:');
            expect(input.value).toBe(':grimacing:');

            // Check that ENTER now inserts the match
            const enter_event = Object.assign({}, tab_event, {'keyCode': 13, 'key': 'Enter', 'target': input, 'bubbles': true});
            input.dispatchEvent(new KeyboardEvent('keydown', enter_event));

            await u.waitUntil(() => input.value === '');
            await u.waitUntil(() => textarea.value === ':grimacing: ');

            // Test that username starting with : doesn't cause issues
            const presence = $pres({
                    'from': `${muc_jid}/:username`,
                    'id': '27C55F89-1C6A-459A-9EB5-77690145D624',
                    'to': _converse.jid
                })
                .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        'jid': 'some1@montague.lit',
                        'affiliation': 'member',
                        'role': 'participant'
                    });
            _converse.connection._dataRecv(mock.createRequest(presence));

            textarea.value = ':use';
            message_form.onKeyDown(tab_event);
            await u.waitUntil(() => u.isVisible(view.querySelector('.emoji-picker__lists')));
            await u.waitUntil(() => input.value === ':use');
            visible_emojis = sizzle('.insert-emoji:not(.hidden)', picker);
            expect(visible_emojis.length).toBe(0);
        }));

        it("is focused to autocomplete emojis in the textarea",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.querySelector('converse-emoji-picker'));
            const textarea = view.querySelector('textarea.chat-textarea');
            textarea.value = ':';
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
            await u.waitUntil(() => u.isVisible(view.querySelector('.emoji-picker__lists')));

            const picker = view.querySelector('converse-emoji-picker');
            const input = picker.querySelector('.emoji-search');
            expect(input.value).toBe(':');
            input.value = ':gri';
            const event = {
                'target': input,
                'preventDefault': function preventDefault () {},
                'stopPropagation': function stopPropagation () {}
            };
            input.dispatchEvent(new KeyboardEvent('keydown', event));
            await u.waitUntil(() =>  sizzle('.emojis-lists__container--search .insert-emoji', view).length === 3, 1000);
            let emoji = sizzle('.emojis-lists__container--search .insert-emoji:not(.hidden) a', view).pop();
            emoji.click();
            await u.waitUntil(() => textarea.value === ':grinning: ');
            textarea.value = ':grinning: :';
            message_form.onKeyDown(tab_event);

            await u.waitUntil(() => input.value === ':');
            input.value = ':grimacing';
            input.dispatchEvent(new KeyboardEvent('keydown', event));
            await u.waitUntil(() =>  sizzle('.emojis-lists__container--search .insert-emoji', view).length === 1, 1000);
            emoji = sizzle('.emojis-lists__container--search .insert-emoji:not(.hidden) a', view).pop();
            emoji.click();
            await u.waitUntil(() => textarea.value === ':grinning: :grimacing: ');
        }));


        it("properly inserts emojis into the chat textarea",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.querySelector('converse-emoji-picker'));
            const textarea = view.querySelector('textarea.chat-textarea');
            textarea.value = ':gri';

            // Press tab
            const tab_event = {
                'target': textarea,
                'preventDefault': function preventDefault () {},
                'stopPropagation': function stopPropagation () {},
                'keyCode': 9,
                'key': 'Tab'
            }
            textarea.value = ':';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown(tab_event);
            await u.waitUntil(() => u.isVisible(view.querySelector('.emoji-picker__lists')));
            const picker = view.querySelector('converse-emoji-picker');
            const input = picker.querySelector('.emoji-search');
            input.dispatchEvent(new KeyboardEvent('keydown', tab_event));
            await u.waitUntil(() => input.value === ':100:');
            const enter_event = Object.assign({}, tab_event, {'keyCode': 13, 'key': 'Enter', 'target': input, 'bubbles': true});
            input.dispatchEvent(new KeyboardEvent('keydown', enter_event));
            expect(textarea.value).toBe(':100: ');

            textarea.value = ':';
            message_form.onKeyDown(tab_event);
            await u.waitUntil(() => u.isVisible(view.querySelector('.emoji-picker__lists')));
            await u.waitUntil(() => input.value === ':');
            input.dispatchEvent(new KeyboardEvent('keydown', tab_event));
            await u.waitUntil(() => input.value === ':100:');
            await u.waitUntil(() => sizzle('.emojis-lists__container--search .insert-emoji:not(.hidden)', view).length === 1, 1000);
            const emoji = sizzle('.emojis-lists__container--search .insert-emoji:not(.hidden) a', view).pop();
            emoji.click();
            expect(textarea.value).toBe(':100: ');
        }));


        it("allows you to search for particular emojis",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.querySelector('converse-emoji-dropdown'));
            const toolbar = view.querySelector('converse-chat-toolbar');
            toolbar.querySelector('.toggle-emojis').click();
            await u.waitUntil(() => u.isVisible(view.querySelector('.emoji-picker__lists')));
            await u.waitUntil(() => sizzle('converse-chat-toolbar .insert-emoji:not(.hidden)', view).length === 1589);

            const input = view.querySelector('.emoji-search');
            input.value = 'smiley';
            const event = {
                'target': input,
                'preventDefault': function preventDefault () {},
                'stopPropagation': function stopPropagation () {}
            };
            input.dispatchEvent(new KeyboardEvent('keydown', event));

            await u.waitUntil(() => sizzle('.emojis-lists__container--search .insert-emoji:not(.hidden)', view).length === 2, 1000);
            let visible_emojis = sizzle('.emojis-lists__container--search .insert-emoji:not(.hidden)', view);
            expect(visible_emojis[0].getAttribute('data-emoji')).toBe(':smiley:');
            expect(visible_emojis[1].getAttribute('data-emoji')).toBe(':smiley_cat:');

            // Check that pressing enter without an unambiguous match does nothing
            const enter_event = Object.assign({}, event, {'keyCode': 13, 'bubbles': true});
            input.dispatchEvent(new KeyboardEvent('keydown', enter_event));
            expect(input.value).toBe('smiley');

            // Check that search results update when chars are deleted
            input.value = 'sm';
            input.dispatchEvent(new KeyboardEvent('keydown', event));
            await u.waitUntil(() => sizzle('.emojis-lists__container--search .insert-emoji:not(.hidden)', view).length === 25, 1000);

            input.value = 'smiley';
            input.dispatchEvent(new KeyboardEvent('keydown', event));
            await u.waitUntil(() => sizzle('.emojis-lists__container--search .insert-emoji:not(.hidden)', view).length === 2, 1000);

            // Test that TAB autocompletes the to first match
            const tab_event = Object.assign({}, event, {'keyCode': 9, 'key': 'Tab'});
            input.dispatchEvent(new KeyboardEvent('keydown', tab_event));

            await u.waitUntil(() => input.value === ':smiley:');
            await u.waitUntil(() => sizzle(".emojis-lists__container--search .insert-emoji:not('.hidden')", view).length === 1, 1000);
            visible_emojis = sizzle(".emojis-lists__container--search .insert-emoji:not('.hidden')", view);
            expect(visible_emojis[0].getAttribute('data-emoji')).toBe(':smiley:');

            // Check that ENTER now inserts the match
            input.dispatchEvent(new KeyboardEvent('keydown', enter_event));
            await u.waitUntil(() => input.value === '');
            expect(view.querySelector('textarea.chat-textarea').value).toBe(':smiley: ');
        }));
    });
});
