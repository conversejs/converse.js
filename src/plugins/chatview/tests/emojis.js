/*global mock, converse */

const { stx } = converse.env;
const u = converse.env.utils;
const { Strophe, sizzle } = converse.env;
const original_timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;

describe('Emojis', function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    describe('Emoji PubSub', function () {
        beforeEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000));
        afterEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = original_timeout));

        it(
            'publishes emoji usage to pubsub PEP node when an emoji is sent',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitUntilDiscoConfirmed(
                    _converse,
                    _converse.bare_jid,
                    [{ 'category': 'pubsub', 'type': 'pep' }],
                    ['http://jabber.org/protocol/pubsub#publish-options']
                );

                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                // Type an emoji shortname and send the message
                const textarea = view.querySelector('textarea.chat-textarea');
                textarea.value = ':thumbsup:';
                const message_form = view.querySelector('converse-message-form');
                message_form.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault() {},
                    key: 'Enter',
                });

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

                // Yield to let the async sendMessage event handler run
                await new Promise((resolve) => setTimeout(resolve, 0));

                // Verify the emoji was actually recorded
                const popular_emojis = _converse.state.popular_emojis;
                expect(Object.keys(popular_emojis.get('timestamps')).length).toBeGreaterThan(0);

                // Flush the debounced publish so we can assert on it immediately
                popular_emojis.debouncedPublish.flush();

                // Wait for the pubsub publish stanza
                const sent_stanzas = _converse.api.connection.get().sent_stanzas;
                const sent_stanza = await u.waitUntil(() =>
                    sent_stanzas.find(
                        (iq) => sizzle(`pubsub publish[node="${Strophe.NS.REACTIONS_POPULAR}"]`, iq).length
                    )
                );

                expect(sent_stanza).toEqualStanza(stx`
                    <iq xmlns="jabber:client"
                            from="romeo@montague.lit"
                            type="set"
                            to="romeo@montague.lit"
                            id="${sent_stanza.getAttribute('id')}">
                        <pubsub xmlns="http://jabber.org/protocol/pubsub">
                            <publish node="urn:xmpp:reactions:popular:0">
                            <item id="current">
                                <popular-reactions xmlns="urn:xmpp:reactions:popular:0">
                                <reaction stamp="${sent_stanza.querySelector('reaction')?.getAttribute('stamp')}">👍</reaction>
                                </popular-reactions>
                            </item>
                            </publish>
                            <publish-options>
                                <x xmlns="jabber:x:data" type="submit">
                                    <field var="FORM_TYPE" type="hidden">
                                        <value>http://jabber.org/protocol/pubsub#publish-options</value>
                                    </field>
                                    <field var="pubsub#persist_items">
                                        <value>true</value>
                                    </field>
                                    <field var="pubsub#access_model"><value>whitelist</value></field>
                                </x>
                        </publish-options>
                        </pubsub>
                    </iq>`);
            })
        );
    });

    describe('The emoji picker', function () {
        beforeEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000));
        afterEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = original_timeout));

        it(
            'can be opened by clicking a button in the chat toolbar',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const contact_jid = mock.cur_names[2].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.waitForRoster(_converse, 'current');
                await mock.openControlBox(_converse);
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);
                const toolbar = await u.waitUntil(() => view.querySelector('converse-chat-toolbar'));
                toolbar.querySelector('.toggle-emojis').click();
                await u.waitUntil(() => u.isVisible(view.querySelector('.emoji-picker__lists')), 1000);
                const item = view.querySelector('.emoji-picker li.insert-emoji a');
                item.click();
                expect(view.querySelector('textarea.chat-textarea').value).toBe(':thumbsup: ');
                toolbar.querySelector('.toggle-emojis').click(); // Close the panel again
            })
        );

        it(
            'renders the popular category with recently used emojis',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                // Populate the popular_emojis model with known timestamps
                const popular_emojis = _converse.state.popular_emojis;
                popular_emojis.save({
                    timestamps: {
                        '👍': '2026-03-29T12:00:00.000Z',
                        '❤️': '2026-03-29T11:00:00.000Z',
                        '😂': '2026-03-29T10:00:00.000Z',
                    },
                });

                const toolbar = await u.waitUntil(() => view.querySelector('.chat-toolbar'));
                toolbar.querySelector('.toggle-emojis').click();
                await u.waitUntil(() => u.isVisible(view.querySelector('.emoji-picker__lists')), 1000);

                const picker = await u.waitUntil(() => view.querySelector('converse-emoji-picker'));

                // The popular category tab should exist in the header
                const popular_tab = picker.querySelector('.emoji-category[data-category="popular"]');
                expect(popular_tab).toBeDefined();

                // Click the popular category tab
                const popular_link = popular_tab.querySelector('.pick-category');
                expect(popular_link).toBeDefined();
                popular_link.click();

                // Wait for the popular category content to be visible
                const popular_heading = await u.waitUntil(() => picker.querySelector('#emoji-picker-popular'), 1000);
                expect(popular_heading).toBeDefined();

                // The popular emoji list should contain the 3 emojis we set
                // plus two from the default config
                const popular_list = picker.querySelector('ul.emoji-picker[data-category="popular"]');
                expect(popular_list).toBeDefined();
                const emoji_items = popular_list.querySelectorAll('li.insert-emoji');
                expect(emoji_items.length).toBe(5);

                // Verify the emojis are in the correct order (most recent first)
                const emoji_data = Array.from(emoji_items).map((el) => el.getAttribute('data-emoji'));
                expect(emoji_data).toEqual([':thumbsup:', ':heart:', ':joy:', ':laughing:', ':tada:']);

                toolbar.querySelector('.toggle-emojis').click();
            })
        );

        it(
            'shows the default popular emojis when there is no usage history',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                // Ensure no timestamps exist
                const popular_emojis = _converse.state.popular_emojis;
                expect(Object.keys(popular_emojis.get('timestamps')).length).toBe(0);

                const toolbar = await u.waitUntil(() => view.querySelector('.chat-toolbar'));
                toolbar.querySelector('.toggle-emojis').click();
                await u.waitUntil(() => u.isVisible(view.querySelector('.emoji-picker__lists')), 1000);

                const picker = await u.waitUntil(() => view.querySelector('converse-emoji-picker'));

                // The popular category tab should still exist
                const popular_tab = picker.querySelector('.emoji-category[data-category="popular"]');
                expect(popular_tab).toBeDefined();

                // Click the popular category tab
                const popular_link = popular_tab.querySelector('.pick-category');
                popular_link.click();

                // The popular emoji list should exist but contain no items
                const popular_list = await u.waitUntil(
                    () => picker.querySelector('ul.emoji-picker[data-category="popular"]'),
                    1000
                );
                const emoji_items = popular_list.querySelectorAll('li.insert-emoji');
                expect(emoji_items.length).toBe(5);

                // Verify the emojis are in the correct order (most recent first)
                const emoji_data = Array.from(emoji_items).map((el) => el.getAttribute('data-emoji'));
                expect(emoji_data).toEqual([':thumbsup:', ':heart:', ':laughing:', ':joy:', ':tada:']);
            })
        );
    });

    describe('A Chat Message', function () {
        it(
            "will display larger if it's only emojis",
            mock.initConverse(['chatBoxesFetched'], { 'use_system_emojis': true }, async function (_converse) {
                await mock.waitForRoster(_converse, 'current');
                const sender_jid = mock.cur_names[1].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                _converse.handleMessageStanza(
                    stx`<message from="${sender_jid}"
                                 to="${_converse.api.connection.get().jid}"
                                 type="chat"
                                 id="${_converse.api.connection.get().getUniqueId()}"
                                 xmlns="jabber:client">
                        <body>😇</body>
                        <active xmlns="http://jabber.org/protocol/chatstates"/>
                    </message>`
                );
                await new Promise((resolve) => _converse.on('chatBoxViewInitialized', resolve));
                const view = _converse.chatboxviews.get(sender_jid);
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                await u.waitUntil(() => u.hasClass('chat-msg__text--larger', view.querySelector('.chat-msg__text')));

                _converse.handleMessageStanza(
                    stx`<message from="${sender_jid}"
                                 to="${_converse.api.connection.get().jid}"
                                 type="chat"
                                 id="${_converse.api.connection.get().getUniqueId()}"
                                 xmlns="jabber:client">
                        <body>😇 Hello world! 😇 😇</body>
                        <active xmlns="http://jabber.org/protocol/chatstates"/>
                    </message>`
                );
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
                    preventDefault: function preventDefault() {},
                    key: 'Enter',
                });
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 3);
                const last_msg_sel = 'converse-chat-message:last-child .chat-msg__text';
                await u.waitUntil(() => view.querySelector(last_msg_sel).textContent === '💩 😇');

                expect(textarea.value).toBe('');
                message_form.onKeyDown({
                    target: textarea,
                    key: 'ArrowUp',
                });
                await u.waitUntil(() => textarea.value === '💩 😇');
                expect(view.model.messages.at(2).get('correcting')).toBe(true);
                sel = 'converse-chat-message:last-child .chat-msg';
                await u.waitUntil(() => u.hasClass('correcting', view.querySelector(sel)), 500);
                const edited_text = (textarea.value += 'This is no longer an emoji-only message');
                textarea.value = edited_text;
                message_form.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault() {},
                    key: 'Enter',
                });
                await u.waitUntil(
                    () =>
                        Array.from(view.querySelectorAll('.chat-msg__text')).filter(
                            (el) => el.textContent === edited_text
                        ).length
                );
                expect(view.model.messages.models.length).toBe(3);
                let message = view.querySelector(last_msg_sel);
                expect(u.hasClass('chat-msg__text--larger', message)).toBe(false);

                textarea.value = ':smile: Hello world!';
                message_form.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault() {},
                    key: 'Enter',
                });
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 4);

                textarea.value = ':smile: :smiley: :imp:';
                message_form.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault() {},
                    key: 'Enter',
                });
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 5);

                message = view.querySelector('.message:last-child .chat-msg__text');
                expect(u.hasClass('chat-msg__text--larger', message)).toBe(true);
            })
        );

        it(
            'can render emojis as images',
            mock.initConverse(['chatBoxesFetched'], { 'use_system_emojis': false }, async function (_converse) {
                await mock.waitForRoster(_converse, 'current');
                const contact_jid = mock.cur_names[1].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                _converse.handleMessageStanza(
                    stx`<message from="${contact_jid}"
                                 to="${_converse.api.connection.get().jid}"
                                 type="chat"
                                 id="${_converse.api.connection.get().getUniqueId()}"
                                 xmlns="jabber:client">
                        <body>😇</body>
                        <active xmlns="http://jabber.org/protocol/chatstates"/>
                    </message>`
                );
                await new Promise((resolve) => _converse.on('chatBoxViewInitialized', resolve));
                const view = _converse.chatboxviews.get(contact_jid);
                await new Promise((resolve) => view.model.messages.once('rendered', resolve));
                await u.waitUntil(
                    () =>
                        view.querySelector('.chat-msg__text').innerHTML.replace(/<!-.*?->/g, '') ===
                        '<img class="emoji" loading="lazy" draggable="false" title=":innocent:" alt="😇" src="https://twemoji.maxcdn.com/v/12.1.6//72x72/1f607.png">'
                );

                const last_msg_sel = 'converse-chat-message:last-child .chat-msg__text';
                let message = view.querySelector(last_msg_sel);
                await u.waitUntil(() => u.isVisible(message.querySelector('.emoji')), 1000);
                let imgs = message.querySelectorAll('.emoji');
                expect(imgs.length).toBe(1);
                expect(imgs[0].src).toBe(_converse.api.settings.get('emoji_image_path') + '/72x72/1f607.png');

                const textarea = view.querySelector('textarea.chat-textarea');
                textarea.value = ':poop: :innocent:';
                const message_form = view.querySelector('converse-message-form');
                message_form.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault() {},
                    key: 'Enter',
                });
                await new Promise((resolve) => view.model.messages.once('rendered', resolve));
                message = view.querySelector(last_msg_sel);
                await u.waitUntil(() => u.isVisible(message.querySelector('.emoji')), 1000);
                imgs = message.querySelectorAll('.emoji');
                expect(imgs.length).toBe(2);
                expect(imgs[0].src).toBe(_converse.api.settings.get('emoji_image_path') + '/72x72/1f4a9.png');
                expect(imgs[1].src).toBe(_converse.api.settings.get('emoji_image_path') + '/72x72/1f607.png');

                const sent_stanzas = _converse.api.connection.get().sent_stanzas;
                const sent_stanza = sent_stanzas.filter((s) => s.nodeName === 'message').pop();
                expect(sent_stanza.querySelector('body').innerHTML).toBe('💩 😇');
            })
        );

        it(
            'can show custom emojis',
            mock.initConverse(
                ['chatBoxesFetched'],
                {
                    emoji_categories: {
                        'smileys': ':grinning:',
                        'people': ':thumbsup:',
                        'activity': ':soccer:',
                        'travel': ':motorcycle:',
                        'objects': ':bomb:',
                        'nature': ':rainbow:',
                        'food': ':hotdog:',
                        'symbols': ':musical_note:',
                        'flags': ':flag_ac:',
                        'custom': ':xmpp:',
                    },
                },
                async function (_converse) {
                    await mock.waitForRoster(_converse, 'current', 1);
                    const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                    await mock.openChatBoxFor(_converse, contact_jid);
                    const view = _converse.chatboxviews.get(contact_jid);

                    const toolbar = await u.waitUntil(() => view.querySelector('.chat-toolbar'));
                    toolbar.querySelector('.toggle-emojis').click();
                    await u.waitUntil(() => u.isVisible(view.querySelector('.emoji-picker__lists')), 1000);
                    const picker = await u.waitUntil(() => view.querySelector('converse-emoji-picker'), 1000);
                    const custom_category = picker.querySelector('.pick-category[data-category="custom"]');
                    expect(custom_category.innerHTML.replace(/<!-.*?->/g, '').trim()).toBe(
                        '<img class="emoji" loading="lazy" draggable="false" title=":xmpp:" alt=":xmpp:" src="/dist/./images/custom_emojis/xmpp.png">'
                    );

                    const textarea = view.querySelector('textarea.chat-textarea');
                    textarea.value = 'Running tests for :converse:';
                    const message_form = view.querySelector('converse-message-form');
                    message_form.onKeyDown({
                        target: textarea,
                        preventDefault: function preventDefault() {},
                        key: 'Enter',
                    });
                    await new Promise((resolve) => view.model.messages.once('rendered', resolve));
                    const body = view.querySelector('converse-chat-message-body');
                    await u.waitUntil(
                        () =>
                            body.innerHTML.replace(/<!-.*?->/g, '').trim() ===
                            'Running tests for <img class="emoji" loading="lazy" draggable="false" title=":converse:" alt=":converse:" src="/dist/./images/custom_emojis/converse.png">'
                    );
                }
            )
        );

        it(
            'correctly resolves overlapping custom emoji shortnames',
            mock.initConverse(
                ['chatBoxesFetched'],
                {
                    emoji_categories: {
                        'smileys': ':grinning:',
                        'people': ':thumbsup:',
                        'activity': ':soccer:',
                        'travel': ':motorcycle:',
                        'objects': ':bomb:',
                        'nature': ':rainbow:',
                        'food': ':hotdog:',
                        'symbols': ':musical_note:',
                        'flags': ':flag_ac:',
                        'custom': ':penguin:',
                    },
                },
                async function (_converse) {
                    // Register hook to add custom emojis with overlapping shortnames
                    // (e.g. :penguin: and :penguin3:) before emojis are initialized.
                    // https://github.com/conversejs/converse.js/issues/3502
                    _converse.api.listen.on('loadEmojis', (_context, json) => {
                        json.custom = json.custom || {};
                        json.custom[':penguin:'] = {
                            'sn': ':penguin:',
                            'url': 'https://example.com/penguin.png',
                            'c': 'custom',
                        };
                        json.custom[':penguin3:'] = {
                            'sn': ':penguin3:',
                            'url': 'https://example.com/penguin3.png',
                            'c': 'custom',
                        };
                        return json;
                    });

                    await mock.waitForRoster(_converse, 'current', 1);
                    const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                    await mock.openChatBoxFor(_converse, contact_jid);
                    const view = _converse.chatboxviews.get(contact_jid);

                    // Send a message using the longer shortname :penguin3:
                    const textarea = view.querySelector('textarea.chat-textarea');
                    textarea.value = 'Look at :penguin3: here';
                    const message_form = view.querySelector('converse-message-form');
                    message_form.onKeyDown({
                        target: textarea,
                        preventDefault: function preventDefault() {},
                        key: 'Enter',
                    });
                    await new Promise((resolve) => view.model.messages.once('rendered', resolve));
                    const body = view.querySelector('converse-chat-message-body');
                    // :penguin3: should render as the penguin3 custom emoji image,
                    // NOT as the :penguin: emoji followed by a literal "3"
                    await u.waitUntil(() => body.innerHTML.includes('penguin3'));

                    const message = view.model.messages.last();
                    expect(message.get('body')).toBe('Look at :penguin3: here');
                }
            )
        );
    });
});
