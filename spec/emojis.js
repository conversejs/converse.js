(function (root, factory) {
    define([
        "jasmine",
        "mock",
        "test-utils"
        ], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const { Promise, $msg, $pres, sizzle } = converse.env;
    const u = converse.env.utils;

    describe("Emojis", function () {
        describe("The emoji picker", function () {

            it("can be opened by clicking a button in the chat toolbar",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');
                test_utils.openControlBox(_converse);

                const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await test_utils.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);
                const toolbar = view.el.querySelector('ul.chat-toolbar');
                expect(toolbar.querySelectorAll('li.toggle-smiley__container').length).toBe(1);
                toolbar.querySelector('a.toggle-smiley').click();
                await u.waitUntil(() => u.isVisible(view.el.querySelector('.emoji-picker__lists')));
                const picker = await u.waitUntil(() => view.el.querySelector('.emoji-picker__container'));
                const item = await u.waitUntil(() => picker.querySelector('.emoji-picker li.insert-emoji a'));
                item.click()
                expect(view.el.querySelector('textarea.chat-textarea').value).toBe(':smiley: ');
                toolbar.querySelector('a.toggle-smiley').click(); // Close the panel again
                done();
            }));

            it("is opened to autocomplete emojis in the textarea",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'lounge@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
                const view = _converse.chatboxviews.get(muc_jid);

                const textarea = view.el.querySelector('textarea.chat-textarea');
                textarea.value = ':gri';

                // Press tab
                const tab_event = {
                    'target': textarea,
                    'preventDefault': function preventDefault () {},
                    'stopPropagation': function stopPropagation () {},
                    'keyCode': 9,
                    'key': 'Tab'
                }
                view.onKeyDown(tab_event);
                await u.waitUntil(() => u.isVisible(view.el.querySelector('.emoji-picker__lists')));
                let picker = await u.waitUntil(() => view.el.querySelector('.emoji-picker__container'));
                const input = picker.querySelector('.emoji-search');
                expect(input.value).toBe(':gri');
                let visible_emojis = sizzle('.emojis-lists__container--search .insert-emoji', picker);
                expect(visible_emojis.length).toBe(3);
                expect(visible_emojis[0].getAttribute('data-emoji')).toBe(':grimacing:');
                expect(visible_emojis[1].getAttribute('data-emoji')).toBe(':grin:');
                expect(visible_emojis[2].getAttribute('data-emoji')).toBe(':grinning:');

                // Test that TAB autocompletes the to first match
                view.emoji_picker_view.onKeyDown(tab_event);
                visible_emojis = sizzle('.emojis-lists__container--search .insert-emoji', picker);
                expect(visible_emojis.length).toBe(1);
                expect(visible_emojis[0].getAttribute('data-emoji')).toBe(':grimacing:');
                expect(input.value).toBe(':grimacing:');

                // Check that ENTER now inserts the match
                const enter_event = Object.assign({}, tab_event, {'keyCode': 13, 'key': 'Enter', 'target': input});
                view.emoji_picker_view.onKeyDown(enter_event);
                expect(input.value).toBe('');
                expect(textarea.value).toBe(':grimacing: ');

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
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                textarea.value = ':use';
                view.onKeyDown(tab_event);
                await u.waitUntil(() => u.isVisible(view.el.querySelector('.emoji-picker__lists')));
                picker = await u.waitUntil(() => view.el.querySelector('.emoji-picker__container'));
                expect(input.value).toBe(':use');
                visible_emojis = sizzle('.insert-emoji:not(.hidden)', picker);
                expect(visible_emojis.length).toBe(0);
                done();
            }));


            it("allows you to search for particular emojis",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'lounge@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');

                const view = _converse.chatboxviews.get(muc_jid);
                const toolbar = view.el.querySelector('ul.chat-toolbar');
                expect(toolbar.querySelectorAll('.toggle-smiley__container').length).toBe(1);
                toolbar.querySelector('.toggle-smiley').click();
                await u.waitUntil(() => u.isVisible(view.el.querySelector('.emoji-picker__lists')));
                const picker = await u.waitUntil(() => view.el.querySelector('.emoji-picker__container'));
                const input = picker.querySelector('.emoji-search');
                expect(sizzle('.insert-emoji:not(.hidden)', picker).length).toBe(1589);

                expect(view.emoji_picker_view.model.get('query')).toBeUndefined();
                input.value = 'smiley';
                const event = {
                    'target': input,
                    'preventDefault': function preventDefault () {},
                    'stopPropagation': function stopPropagation () {}
                };
                view.emoji_picker_view.onKeyDown(event);
                await u.waitUntil(() => view.emoji_picker_view.model.get('query') === 'smiley');
                let visible_emojis = sizzle('.emojis-lists__container--search .insert-emoji', picker);
                expect(visible_emojis.length).toBe(2);
                expect(visible_emojis[0].getAttribute('data-emoji')).toBe(':smiley:');
                expect(visible_emojis[1].getAttribute('data-emoji')).toBe(':smiley_cat:');

                // Check that pressing enter without an unambiguous match does nothing
                const enter_event = Object.assign({}, event, {'keyCode': 13});
                view.emoji_picker_view.onKeyDown(enter_event);
                expect(input.value).toBe('smiley');

                // Test that TAB autocompletes the to first match
                const tab_event = Object.assign({}, event, {'keyCode': 9, 'key': 'Tab'});
                view.emoji_picker_view.onKeyDown(tab_event);
                expect(input.value).toBe(':smiley:');
                visible_emojis = sizzle('.emojis-lists__container--search .insert-emoji', picker);
                expect(visible_emojis.length).toBe(1);
                expect(visible_emojis[0].getAttribute('data-emoji')).toBe(':smiley:');

                // Check that ENTER now inserts the match
                view.emoji_picker_view.onKeyDown(enter_event);
                expect(input.value).toBe('');
                expect(view.el.querySelector('textarea.chat-textarea').value).toBe(':smiley: ');
                done();
            }));
        });

        describe("A Chat Message", function () {
            it("will display larger if it's only emojis",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {'use_system_emojis': true},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');
                const sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                _converse.handleMessageStanza($msg({
                        'from': sender_jid,
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': _converse.connection.getUniqueId()
                    }).c('body').t('😇').up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
                await new Promise(resolve => _converse.on('chatBoxViewInitialized', resolve));
                const view = _converse.api.chatviews.get(sender_jid);
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                const chat_content = view.el.querySelector('.chat-content');
                let message = chat_content.querySelector('.chat-msg__text');
                expect(u.hasClass('chat-msg__text--larger', message)).toBe(true);

                _converse.handleMessageStanza($msg({
                        'from': sender_jid,
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': _converse.connection.getUniqueId()
                    }).c('body').t('😇 Hello world! 😇 😇').up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                message = chat_content.querySelector('.message:last-child .chat-msg__text');
                expect(u.hasClass('chat-msg__text--larger', message)).toBe(false);

                // Test that a modified message that no longer contains only
                // emojis now renders normally again.
                const textarea = view.el.querySelector('textarea.chat-textarea');
                textarea.value = ':poop: :innocent:';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13 // Enter
                });
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                expect(view.el.querySelectorAll('.chat-msg').length).toBe(3);
                expect(chat_content.querySelector('.message:last-child .chat-msg__text').textContent).toBe('💩 😇');
                expect(textarea.value).toBe('');
                view.onKeyDown({
                    target: textarea,
                    keyCode: 38 // Up arrow
                });
                expect(textarea.value).toBe('💩 😇');
                expect(view.model.messages.at(2).get('correcting')).toBe(true);
                await u.waitUntil(() => u.hasClass('correcting', view.el.querySelector('.chat-msg:last-child')), 500);
                textarea.value = textarea.value += 'This is no longer an emoji-only message';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13 // Enter
                });
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                expect(view.model.messages.models.length).toBe(3);
                message = chat_content.querySelector('.message:last-child .chat-msg__text');
                expect(u.hasClass('chat-msg__text--larger', message)).toBe(false);

                textarea.value = ':smile: Hello world!';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13 // Enter
                });
                await new Promise(resolve => view.model.messages.once('rendered', resolve));

                textarea.value = ':smile: :smiley: :imp:';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13 // Enter
                });
                await new Promise(resolve => view.model.messages.once('rendered', resolve));

                message = chat_content.querySelector('.message:last-child .chat-msg__text');
                expect(u.hasClass('chat-msg__text--larger', message)).toBe(true);
                done()
            }));
        });
    });
}));
