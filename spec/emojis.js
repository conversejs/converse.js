/*global mock, converse */

const { Promise, $msg, $pres, sizzle } = converse.env;
const u = converse.env.utils;
const original_timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;


describe("Emojis", function () {
    describe("The emoji picker", function () {

        beforeEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000));
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
            const toolbar = await u.waitUntil(() => view.querySelector('converse-chat-toolbar'));
            toolbar.querySelector('.toggle-emojis').click();
            await u.waitUntil(() => u.isVisible(view.querySelector('.emoji-picker__lists')), 1000);
            const item = view.querySelector('.emoji-picker li.insert-emoji a');
            item.click()
            expect(view.querySelector('textarea.chat-textarea').value).toBe(':smiley: ');
            toolbar.querySelector('.toggle-emojis').click(); // Close the panel again
            done();
        }));

        it("is opened to autocomplete emojis in the textarea",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.querySelector('converse-emoji-dropdown'));
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
            view.onKeyDown(tab_event);
            await u.waitUntil(() => view.querySelector('converse-emoji-picker .emoji-search').value === ':gri');
            await u.waitUntil(() =>  sizzle('.emojis-lists__container--search .insert-emoji', view).length === 3, 1000);
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
            const enter_event = Object.assign({}, tab_event, {'keyCode': 13, 'key': 'Enter', 'target': input});
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
            view.onKeyDown(tab_event);
            await u.waitUntil(() => u.isVisible(view.querySelector('.emoji-picker__lists')));
            await u.waitUntil(() => input.value === ':use');
            visible_emojis = sizzle('.insert-emoji:not(.hidden)', picker);
            expect(visible_emojis.length).toBe(0);
            done();
        }));

        it("is focused to autocomplete emojis in the textarea",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.querySelector('converse-emoji-dropdown'));
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
            view.onKeyDown(tab_event);
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
            view.onKeyDown(tab_event);

            await u.waitUntil(() => input.value === ':');
            input.value = ':grimacing';
            input.dispatchEvent(new KeyboardEvent('keydown', event));
            await u.waitUntil(() =>  sizzle('.emojis-lists__container--search .insert-emoji', view).length === 1, 1000);
            emoji = sizzle('.emojis-lists__container--search .insert-emoji:not(.hidden) a', view).pop();
            emoji.click();
            await u.waitUntil(() => textarea.value === ':grinning: :grimacing: ');
            done();
        }));


        it("properly inserts emojis into the chat textarea",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.querySelector('converse-emoji-dropdown'));
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
            view.onKeyDown(tab_event);
            await u.waitUntil(() => u.isVisible(view.querySelector('.emoji-picker__lists')));
            const picker = view.querySelector('converse-emoji-picker');
            const input = picker.querySelector('.emoji-search');
            input.dispatchEvent(new KeyboardEvent('keydown', tab_event));
            await u.waitUntil(() => input.value === ':100:');
            const enter_event = Object.assign({}, tab_event, {'keyCode': 13, 'key': 'Enter', 'target': input});
            input.dispatchEvent(new KeyboardEvent('keydown', enter_event));
            expect(textarea.value).toBe(':100: ');

            textarea.value = ':';
            view.onKeyDown(tab_event);
            await u.waitUntil(() => u.isVisible(view.querySelector('.emoji-picker__lists')));
            await u.waitUntil(() => input.value === ':');
            input.dispatchEvent(new KeyboardEvent('keydown', tab_event));
            await u.waitUntil(() => input.value === ':100:');
            await u.waitUntil(() => sizzle('.emojis-lists__container--search .insert-emoji:not(.hidden)', view).length === 1, 1000);
            const emoji = sizzle('.emojis-lists__container--search .insert-emoji:not(.hidden) a', view).pop();
            emoji.click();
            expect(textarea.value).toBe(':100: ');
            done();
        }));


        it("allows you to search for particular emojis",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'lounge@montague.lit';
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
            const enter_event = Object.assign({}, event, {'keyCode': 13});
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
            const textarea = view.querySelector('textarea.chat-textarea');
            textarea.value = ':poop: :innocent:';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            expect(view.querySelectorAll('.chat-msg').length).toBe(3);
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
            await u.waitUntil(() => u.hasClass('correcting', view.querySelector(sel)), 500);
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

        it("can render emojis as images",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {'use_system_emojis': false},
                async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current');
            const contact_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            _converse.handleMessageStanza($msg({
                    'from': contact_jid,
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'id': _converse.connection.getUniqueId()
                }).c('body').t('😇').up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            await new Promise(resolve => _converse.on('chatBoxViewInitialized', resolve));
            const view = _converse.api.chatviews.get(contact_jid);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            await u.waitUntil(() => view.content.querySelector('.chat-msg__text').innerHTML.replace(/<!---->/g, '') ===
                '<img class="emoji" draggable="false" title=":innocent:" alt="😇" src="https://twemoji.maxcdn.com/v/12.1.6//72x72/1f607.png">');

            const last_msg_sel = 'converse-chat-message:last-child .chat-msg__text';
            let message = view.content.querySelector(last_msg_sel);
            await u.waitUntil(() => u.isVisible(message.querySelector('.emoji')), 1000);
            let imgs = message.querySelectorAll('.emoji');
            expect(imgs.length).toBe(1);
            expect(imgs[0].src).toBe(_converse.api.settings.get('emoji_image_path')+'/72x72/1f607.png');

            const textarea = view.querySelector('textarea.chat-textarea');
            textarea.value = ':poop: :innocent:';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            message = view.content.querySelector(last_msg_sel);
            await u.waitUntil(() => u.isVisible(message.querySelector('.emoji')), 1000);
            imgs = message.querySelectorAll('.emoji');
            expect(imgs.length).toBe(2);
            expect(imgs[0].src).toBe(_converse.api.settings.get('emoji_image_path')+'/72x72/1f4a9.png');
            expect(imgs[1].src).toBe(_converse.api.settings.get('emoji_image_path')+'/72x72/1f607.png');

            const sent_stanzas = _converse.connection.sent_stanzas;
            const sent_stanza = sent_stanzas.filter(s => s.nodeName === 'message').pop();
            expect(sent_stanza.querySelector('body').innerHTML).toBe('💩 😇');
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

            const toolbar = await u.waitUntil(() => view.querySelector('.chat-toolbar'));
            toolbar.querySelector('.toggle-emojis').click();
            await u.waitUntil(() => u.isVisible(view.querySelector('.emoji-picker__lists')), 1000);
            const picker = await u.waitUntil(() => view.querySelector('converse-emoji-picker'), 1000);
            const custom_category = picker.querySelector('.pick-category[data-category="custom"]');
            expect(custom_category.innerHTML.replace(/<!---->/g, '').trim()).toBe(
                '<img class="emoji" draggable="false" title=":xmpp:" alt=":xmpp:" src="/dist/images/custom_emojis/xmpp.png">');

            const textarea = view.querySelector('textarea.chat-textarea');
            textarea.value = 'Running tests for :converse:';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            const body = view.querySelector('converse-chat-message-body');
            await u.waitUntil(() => body.innerHTML.replace(/<!---->/g, '').trim() ===
                'Running tests for <img class="emoji" draggable="false" title=":converse:" alt=":converse:" src="/dist/images/custom_emojis/converse.png">');
            done();
        }));
    });
});
