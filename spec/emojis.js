/*global mock */

const { Promise, $msg, $pres, sizzle } = converse.env;
const u = converse.env.utils;
const original_timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;

describe("Emojis", function () {
    describe("The emoji picker", function () {

        beforeEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = 7000));
        afterEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = original_timeout));

        it("can be opened by clicking a button in the chat toolbar",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.waitForRoster(_converse, 'current');
            await mock.openControlBox(_converse);
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            const toolbar = await u.waitUntil(() => view.el.querySelector('ul.chat-toolbar'));
            expect(toolbar.querySelectorAll('li.toggle-smiley__container').length).toBe(1);
            toolbar.querySelector('a.toggle-smiley').click();
            await u.waitUntil(() => u.isVisible(view.el.querySelector('.emoji-picker__lists')), 1000);
            const picker = await u.waitUntil(() => view.el.querySelector('.emoji-picker__container'), 1000);
            const item = await u.waitUntil(() => picker.querySelector('.emoji-picker li.insert-emoji a'), 1000);
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
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
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
            const picker = await u.waitUntil(() => view.el.querySelector('.emoji-picker__container'));
            const input = picker.querySelector('.emoji-search');
            expect(input.value).toBe(':gri');
            await u.waitUntil(() =>  sizzle('.emojis-lists__container--search .insert-emoji', picker).length === 3, 1000);
            let visible_emojis = sizzle('.emojis-lists__container--search .insert-emoji', picker);
            expect(visible_emojis[0].getAttribute('data-emoji')).toBe(':grimacing:');
            expect(visible_emojis[1].getAttribute('data-emoji')).toBe(':grin:');
            expect(visible_emojis[2].getAttribute('data-emoji')).toBe(':grinning:');

            // Test that TAB autocompletes the to first match
            input.dispatchEvent(new KeyboardEvent('keydown', tab_event));

            await u.waitUntil(() => sizzle(".emojis-lists__container--search .insert-emoji:not('.hidden')", picker).length === 1);
            visible_emojis = sizzle(".emojis-lists__container--search .insert-emoji:not('.hidden')", picker);
            expect(visible_emojis[0].getAttribute('data-emoji')).toBe(':grimacing:');
            expect(input.value).toBe(':grimacing:');

            // Check that ENTER now inserts the match
            const enter_event = Object.assign({}, tab_event, {'keyCode': 13, 'key': 'Enter', 'target': input});
            input.dispatchEvent(new KeyboardEvent('keydown', enter_event));

            await u.waitUntil(() => input.value === '');
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
            _converse.connection._dataRecv(mock.createRequest(presence));

            textarea.value = ':use';
            view.onKeyDown(tab_event);
            await u.waitUntil(() => u.isVisible(view.el.querySelector('.emoji-picker__lists')));
            await u.waitUntil(() => input.value === ':use');
            visible_emojis = sizzle('.insert-emoji:not(.hidden)', picker);
            expect(visible_emojis.length).toBe(0);
            done();
        }));

        it("allows you to search for particular emojis",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');

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
            input.dispatchEvent(new KeyboardEvent('keydown', event));

            await u.waitUntil(() => view.emoji_picker_view.model.get('query') === 'smiley', 1000);
            await u.waitUntil(() => sizzle('.emojis-lists__container--search .insert-emoji', picker).length === 2, 1000);
            let visible_emojis = sizzle('.emojis-lists__container--search .insert-emoji', picker);
            expect(visible_emojis[0].getAttribute('data-emoji')).toBe(':smiley:');
            expect(visible_emojis[1].getAttribute('data-emoji')).toBe(':smiley_cat:');

            // Check that pressing enter without an unambiguous match does nothing
            const enter_event = Object.assign({}, event, {'keyCode': 13});
            input.dispatchEvent(new KeyboardEvent('keydown', enter_event));
            expect(input.value).toBe('smiley');

            // Test that TAB autocompletes the to first match
            const tab_event = Object.assign({}, event, {'keyCode': 9, 'key': 'Tab'});
            input.dispatchEvent(new KeyboardEvent('keydown', tab_event));

            await u.waitUntil(() => input.value === ':smiley:');
            await u.waitUntil(() => sizzle(".emojis-lists__container--search .insert-emoji:not('.hidden')", picker).length === 1);
            visible_emojis = sizzle(".emojis-lists__container--search .insert-emoji:not('.hidden')", picker);
            expect(visible_emojis[0].getAttribute('data-emoji')).toBe(':smiley:');

            // Check that ENTER now inserts the match
            input.dispatchEvent(new KeyboardEvent('keydown', enter_event));
            await u.waitUntil(() => input.value === '');
            expect(view.el.querySelector('textarea.chat-textarea').value).toBe(':smiley: ');
            done();
        }));
    });

    describe("A Chat Message", function () {

        it("will display larger if it's only emojis",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {'use_system_emojis': true},
                async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current');
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
            await u.waitUntil(() => u.hasClass('chat-msg__text--larger', view.content.querySelector('.chat-msg__text')));

            _converse.handleMessageStanza($msg({
                    'from': sender_jid,
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'id': _converse.connection.getUniqueId()
                }).c('body').t('😇 Hello world! 😇 😇').up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            let sel = '.message:last-child .chat-msg__text';
            await u.waitUntil(() => u.hasClass('chat-msg__text--larger', view.content.querySelector(sel)));

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
            const last_msg_sel = 'converse-chat-message:last-child .chat-msg__text';
            await u.waitUntil(() => view.content.querySelector(last_msg_sel).textContent === '💩 😇');

            expect(textarea.value).toBe('');
            view.onKeyDown({
                target: textarea,
                keyCode: 38 // Up arrow
            });
            expect(textarea.value).toBe('💩 😇');
            expect(view.model.messages.at(2).get('correcting')).toBe(true);
            sel = 'converse-chat-message:last-child .chat-msg'
            await u.waitUntil(() => u.hasClass('correcting', view.el.querySelector(sel)), 500);
            textarea.value = textarea.value += 'This is no longer an emoji-only message';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            expect(view.model.messages.models.length).toBe(3);
            let message = view.content.querySelector(last_msg_sel);
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

            message = view.content.querySelector('.message:last-child .chat-msg__text');
            expect(u.hasClass('chat-msg__text--larger', message)).toBe(true);
            done()
        }));


        it("can show custom emojis",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'],
                { emoji_categories: {
                    "smileys": ":grinning:",
                    "people": ":thumbsup:",
                    "activity": ":soccer:",
                    "travel": ":motorcycle:",
                    "objects": ":bomb:",
                    "nature": ":rainbow:",
                    "food": ":hotdog:",
                    "symbols": ":musical_note:",
                    "flags": ":flag_ac:",
                    "custom": ':xmpp:'
                } },
                async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.api.chatviews.get(contact_jid);

            const toolbar = await u.waitUntil(() => view.el.querySelector('ul.chat-toolbar'));
            expect(toolbar.querySelectorAll('li.toggle-smiley__container').length).toBe(1);
            toolbar.querySelector('a.toggle-smiley').click();
            await u.waitUntil(() => u.isVisible(view.el.querySelector('.emoji-picker__lists')), 1000);
            const picker = await u.waitUntil(() => view.el.querySelector('.emoji-picker__container'), 1000);
            const custom_category = picker.querySelector('.pick-category[data-category="custom"]');
            expect(custom_category.innerHTML.replace(/<!---->/g, '').trim()).toBe(
                '<img class="emoji" draggable="false" title=":xmpp:" alt=":xmpp:" src="/dist/images/custom_emojis/xmpp.png">');

            const textarea = view.el.querySelector('textarea.chat-textarea');
            textarea.value = 'Running tests for :converse:';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            const body = view.el.querySelector('converse-chat-message-body');
            expect(body.innerHTML.replace(/<!---->/g, '').trim()).toBe(
                'Running tests for <img class="emoji" draggable="false" title=":converse:" alt=":converse:" src="/dist/images/custom_emojis/converse.png">');
            done();
        }));
    });
});
