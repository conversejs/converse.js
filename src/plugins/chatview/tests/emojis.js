/*global mock, converse */

const { Promise, $msg } = converse.env;
const u = converse.env.utils;
const original_timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;

describe("Emojis", function () {
    describe("The emoji picker", function () {

        beforeEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000));
        afterEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = original_timeout));

        it("can be opened by clicking a button in the chat toolbar",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

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
        }));
    });

    describe("A Chat Message", function () {

        it("will display larger if it's only emojis",
                mock.initConverse(['chatBoxesFetched'], {'use_system_emojis': true}, async function (_converse) {

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
            const view = _converse.chatboxviews.get(sender_jid);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
            await u.waitUntil(() => u.hasClass('chat-msg__text--larger', view.querySelector('.chat-msg__text')));

            _converse.handleMessageStanza($msg({
                    'from': sender_jid,
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'id': _converse.connection.getUniqueId()
                }).c('body').t('😇 Hello world! 😇 😇').up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);

            let sel = '.message:last-child .chat-msg__text';
            await u.waitUntil(() => u.hasClass('chat-msg__text--larger', view.querySelector(sel)));

            // Test that a modified message that no longer contains only
            // emojis now renders normally again.
            const textarea = view.querySelector('textarea.chat-textarea');
            textarea.value = ':poop: :innocent:';
            const message_form = view.querySelector('converse-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 3);
            const last_msg_sel = 'converse-chat-message:last-child .chat-msg__text';
            await u.waitUntil(() => view.querySelector(last_msg_sel).textContent === '💩 😇');

            expect(textarea.value).toBe('');
            message_form.onKeyDown({
                target: textarea,
                keyCode: 38 // Up arrow
            });
            expect(textarea.value).toBe('💩 😇');
            expect(view.model.messages.at(2).get('correcting')).toBe(true);
            sel = 'converse-chat-message:last-child .chat-msg'
            await u.waitUntil(() => u.hasClass('correcting', view.querySelector(sel)), 500);
            const edited_text = textarea.value += 'This is no longer an emoji-only message';
            textarea.value = edited_text;
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await u.waitUntil(() => Array.from(view.querySelectorAll('.chat-msg__text'))
                .filter(el => el.textContent === edited_text).length);
            expect(view.model.messages.models.length).toBe(3);
            let message = view.querySelector(last_msg_sel);
            expect(u.hasClass('chat-msg__text--larger', message)).toBe(false);

            textarea.value = ':smile: Hello world!';
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 4);

            textarea.value = ':smile: :smiley: :imp:';
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 5);

            message = view.querySelector('.message:last-child .chat-msg__text');
            expect(u.hasClass('chat-msg__text--larger', message)).toBe(true);
        }));

        it("can render emojis as images",
                mock.initConverse(
                    ['chatBoxesFetched'], {'use_system_emojis': false},
                    async function (_converse) {

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
            const view = _converse.chatboxviews.get(contact_jid);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            await u.waitUntil(() => view.querySelector('.chat-msg__text').innerHTML.replace(/<!-.*?->/g, '') ===
                '<img class="emoji" loading="lazy" draggable="false" title=":innocent:" alt="😇" src="https://twemoji.maxcdn.com/v/12.1.6//72x72/1f607.png">');

            const last_msg_sel = 'converse-chat-message:last-child .chat-msg__text';
            let message = view.querySelector(last_msg_sel);
            await u.waitUntil(() => u.isVisible(message.querySelector('.emoji')), 1000);
            let imgs = message.querySelectorAll('.emoji');
            expect(imgs.length).toBe(1);
            expect(imgs[0].src).toBe(_converse.api.settings.get('emoji_image_path')+'/72x72/1f607.png');

            const textarea = view.querySelector('textarea.chat-textarea');
            textarea.value = ':poop: :innocent:';
            const message_form = view.querySelector('converse-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            message = view.querySelector(last_msg_sel);
            await u.waitUntil(() => u.isVisible(message.querySelector('.emoji')), 1000);
            imgs = message.querySelectorAll('.emoji');
            expect(imgs.length).toBe(2);
            expect(imgs[0].src).toBe(_converse.api.settings.get('emoji_image_path')+'/72x72/1f4a9.png');
            expect(imgs[1].src).toBe(_converse.api.settings.get('emoji_image_path')+'/72x72/1f607.png');

            const sent_stanzas = _converse.connection.sent_stanzas;
            const sent_stanza = sent_stanzas.filter(s => s.nodeName === 'message').pop();
            expect(sent_stanza.querySelector('body').innerHTML).toBe('💩 😇');
        }));

        it("can show custom emojis",
            mock.initConverse(
                ['chatBoxesFetched'],
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
                async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const toolbar = await u.waitUntil(() => view.querySelector('.chat-toolbar'));
            toolbar.querySelector('.toggle-emojis').click();
            await u.waitUntil(() => u.isVisible(view.querySelector('.emoji-picker__lists')), 1000);
            const picker = await u.waitUntil(() => view.querySelector('converse-emoji-picker'), 1000);
            const custom_category = picker.querySelector('.pick-category[data-category="custom"]');
            expect(custom_category.innerHTML.replace(/<!-.*?->/g, '').trim()).toBe(
                '<img class="emoji" loading="lazy" draggable="false" title=":xmpp:" alt=":xmpp:" src="/dist/images/custom_emojis/xmpp.png">');

            const textarea = view.querySelector('textarea.chat-textarea');
            textarea.value = 'Running tests for :converse:';
            const message_form = view.querySelector('converse-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            const body = view.querySelector('converse-chat-message-body');
            await u.waitUntil(() => body.innerHTML.replace(/<!-.*?->/g, '').trim() ===
                'Running tests for <img class="emoji" loading="lazy" draggable="false" title=":converse:" alt=":converse:" src="/dist/images/custom_emojis/converse.png">');
        }));
    });
});
