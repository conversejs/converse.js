/*global mock, converse */

/**
 * Message Reactions Tests (XEP-0444)
 * 
 * To run only specific tests:
 * 1. Change it("test name") to fit("test name") for the test you want to focus on
 * 2. Run: npm run test
 * 3. Click the "Debug" button in the Karma browser window
 * 4. Open browser DevTools (F12) to step through the test
 * 
 * To run all tests, make sure all tests use it() not fit()
 */

const { Strophe, sizzle, u } = converse.env;

describe("Message Reactions (XEP-0444)", function () {

    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    describe("Reaction Picker UI", function () {

        it("appears when hovering over a received message",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.openControlBox(_converse);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                // Create a received message (not from 'me')
                const message = await mock.receiveMessage(_converse, {
                    from: contact_jid,
                    to: _converse.bare_jid,
                    msgid: 'test-message-1',
                    body: 'This is a test message',
                    type: 'chat'
                });

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_el = view.querySelector('.chat-msg');
                expect(msg_el).not.toBe(null);
                
                // Check that reaction picker appears in message actions
                const actions = msg_el.querySelector('.chat-msg__actions');
                expect(actions).not.toBe(null);
                
                const reaction_btn = actions.querySelector('.chat-msg__action-reaction');
                expect(reaction_btn).not.toBe(null);
            })
        );

        it("does not appear for own messages",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                // Send our own message
                const textarea = view.querySelector('textarea.chat-textarea');
                textarea.value = 'This is my message';
                const message_form = view.querySelector('converse-message-form');
                message_form.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    key: "Enter",
                });

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_el = view.querySelector('.chat-msg');
                
                // Reaction button should not appear for own messages
                const reaction_btn = msg_el.querySelector('.chat-msg__action-reaction');
                expect(reaction_btn).toBe(null);
            })
        );

        it("displays popular emojis in the quick picker",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                const message = await mock.receiveMessage(_converse, {
                    from: contact_jid,
                    to: _converse.bare_jid,
                    msgid: 'test-message-2',
                    body: 'Test message for emoji picker',
                    type: 'chat'
                });

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_el = view.querySelector('.chat-msg');
                const reaction_btn = msg_el.querySelector('.chat-msg__action-reaction');
                
                // Click the reaction button
                reaction_btn.click();
                
                await u.waitUntil(() => document.querySelector('converse-reaction-picker'));
                const picker = document.querySelector('converse-reaction-picker');
                expect(picker).not.toBe(null);
                
                // Check for popular emoji buttons
                const emoji_buttons = picker.querySelectorAll('.reaction-item:not(.more)');
                expect(emoji_buttons.length).toBeGreaterThan(0);
            })
        );
    });

    describe("Sending Reactions", function () {

        it("sends a reaction stanza when clicking an emoji",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                const message = await mock.receiveMessage(_converse, {
                    from: contact_jid,
                    to: _converse.bare_jid,
                    msgid: 'msg-to-react',
                    body: 'React to this',
                    type: 'chat'
                });

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_el = view.querySelector('.chat-msg');
                const reaction_btn = msg_el.querySelector('.chat-msg__action-reaction');
                
                spyOn(api.connection.get(), 'send');
                
                reaction_btn.click();
                await u.waitUntil(() => document.querySelector('converse-reaction-picker'));
                
                const picker = document.querySelector('converse-reaction-picker');
                const first_emoji_btn = picker.querySelector('.reaction-item:not(.more)');
                first_emoji_btn.click();

                await u.waitUntil(() => api.connection.get().send.calls.count() > 0);
                expect(api.connection.get().send).toHaveBeenCalled();
                
                const sent_stanza = api.connection.get().send.calls.argsFor(0)[0];
                expect(Strophe.serialize(sent_stanza)).toContain('urn:xmpp:reactions:0');
                expect(Strophe.serialize(sent_stanza)).toContain('msg-to-react');
            })
        );

        it("updates local message with the sent reaction",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                const message = await mock.receiveMessage(_converse, {
                    from: contact_jid,
                    to: _converse.bare_jid,
                    msgid: 'msg-with-reaction',
                    body: 'Message to get reaction',
                    type: 'chat'
                });

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                
                const msg_model = view.model.messages.findWhere({'msgid': 'msg-with-reaction'});
                expect(msg_model.get('reactions')).toBeFalsy();
                
                const msg_el = view.querySelector('.chat-msg');
                const reaction_btn = msg_el.querySelector('.chat-msg__action-reaction');
                reaction_btn.click();
                
                await u.waitUntil(() => document.querySelector('converse-reaction-picker'));
                const picker = document.querySelector('converse-reaction-picker');
                const first_emoji_btn = picker.querySelector('.reaction-item:not(.more)');
                first_emoji_btn.click();

                // Wait for reaction to be added to message model
                await u.waitUntil(() => {
                    const reactions = msg_model.get('reactions');
                    return reactions && Object.keys(reactions).length > 0;
                });

                const reactions = msg_model.get('reactions');
                expect(Object.keys(reactions).length).toBeGreaterThan(0);
            })
        );
    });

    describe("Receiving Reactions", function () {

        it("displays received reactions on the message",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                // Send a message first
                const textarea = view.querySelector('textarea.chat-textarea');
                textarea.value = 'Message to receive reaction';
                const message_form = view.querySelector('converse-message-form');
                message_form.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    key: "Enter",
                });

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.at(0);
                const msgid = msg_model.get('msgid');

                // Simulate receiving a reaction
                const reaction_stanza = u.toStanza(`
                    <message from='${contact_jid}' to='${_converse.bare_jid}' type='chat'>
                        <reaction xmlns='urn:xmpp:reactions:0' id='${msgid}'>
                            <emoji>👍</emoji>
                        </reaction>
                    </message>
                `);

                _converse.api.connection.get()._dataRecv(mock.createRequest(reaction_stanza));

                // Wait for reaction to appear
                await u.waitUntil(() => {
                    const reactions = msg_model.get('reactions');
                    return reactions && reactions['👍'];
                });

                const reactions = msg_model.get('reactions');
                expect(reactions['👍']).toContain(contact_jid);
            })
        );

        it("updates reaction count when multiple users react with the same emoji",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 2);
                const contact1_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                const contact2_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                
                await mock.openChatBoxFor(_converse, contact1_jid);
                const view = _converse.chatboxviews.get(contact1_jid);

                // Receive a message
                const message = await mock.receiveMessage(_converse, {
                    from: contact1_jid,
                    to: _converse.bare_jid,
                    msgid: 'multi-reaction-msg',
                    body: 'Multiple reactions here',
                    type: 'chat'
                });

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({'msgid': 'multi-reaction-msg'});

                // First reaction from contact1
                const reaction1 = u.toStanza(`
                    <message from='${contact1_jid}' to='${_converse.bare_jid}' type='chat'>
                        <reaction xmlns='urn:xmpp:reactions:0' id='multi-reaction-msg'>
                            <emoji>❤️</emoji>
                        </reaction>
                    </message>
                `);
                _converse.api.connection.get()._dataRecv(mock.createRequest(reaction1));

                await u.waitUntil(() => msg_model.get('reactions')?.['❤️']?.length === 1);

                // Second reaction from contact2 with same emoji
                const reaction2 = u.toStanza(`
                    <message from='${contact2_jid}' to='${_converse.bare_jid}' type='chat'>
                        <reaction xmlns='urn:xmpp:reactions:0' id='multi-reaction-msg'>
                            <emoji>❤️</emoji>
                        </reaction>
                    </message>
                `);
                _converse.api.connection.get()._dataRecv(mock.createRequest(reaction2));

                await u.waitUntil(() => msg_model.get('reactions')?.['❤️']?.length === 2);

                const reactions = msg_model.get('reactions');
                expect(reactions['❤️'].length).toBe(2);
                expect(reactions['❤️']).toContain(contact1_jid);
                expect(reactions['❤️']).toContain(contact2_jid);
            })
        );

        it("replaces a user's previous reaction when they react again",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                const message = await mock.receiveMessage(_converse, {
                    from: contact_jid,
                    to: _converse.bare_jid,
                    msgid: 'replace-reaction-msg',
                    body: 'Change reaction test',
                    type: 'chat'
                });

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({'msgid': 'replace-reaction-msg'});

                // First reaction
                const reaction1 = u.toStanza(`
                    <message from='${contact_jid}' to='${_converse.bare_jid}' type='chat'>
                        <reaction xmlns='urn:xmpp:reactions:0' id='replace-reaction-msg'>
                            <emoji>👍</emoji>
                        </reaction>
                    </message>
                `);
                _converse.api.connection.get()._dataRecv(mock.createRequest(reaction1));

                await u.waitUntil(() => msg_model.get('reactions')?.['👍']);
                expect(msg_model.get('reactions')['👍']).toContain(contact_jid);

                // Second reaction from same user (should replace first)
                const reaction2 = u.toStanza(`
                    <message from='${contact_jid}' to='${_converse.bare_jid}' type='chat'>
                        <reaction xmlns='urn:xmpp:reactions:0' id='replace-reaction-msg'>
                            <emoji>❤️</emoji>
                        </reaction>
                    </message>
                `);
                _converse.api.connection.get()._dataRecv(mock.createRequest(reaction2));

                await u.waitUntil(() => msg_model.get('reactions')?.['❤️']);
                
                const reactions = msg_model.get('reactions');
                expect(reactions['👍']).toBeFalsy(); // Old reaction removed
                expect(reactions['❤️']).toContain(contact_jid); // New reaction present
            })
        );
    });

    describe("Reaction Display", function () {

        it("shows reaction bubbles below the message",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                const message = await mock.receiveMessage(_converse, {
                    from: contact_jid,
                    to: _converse.bare_jid,
                    msgid: 'bubble-test-msg',
                    body: 'Message with reaction bubbles',
                    type: 'chat'
                });

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({'msgid': 'bubble-test-msg'});

                // Add reaction
                const reaction = u.toStanza(`
                    <message from='${contact_jid}' to='${_converse.bare_jid}' type='chat'>
                        <reaction xmlns='urn:xmpp:reactions:0' id='bubble-test-msg'>
                            <emoji>🎉</emoji>
                        </reaction>
                    </message>
                `);
                _converse.api.connection.get()._dataRecv(mock.createRequest(reaction));

                await u.waitUntil(() => view.querySelector('.chat-msg__reactions'));
                
                const reactions_container = view.querySelector('.chat-msg__reactions');
                expect(reactions_container).not.toBe(null);
                
                const reaction_bubble = reactions_container.querySelector('.chat-msg__reaction');
                expect(reaction_bubble).not.toBe(null);
                expect(reaction_bubble.textContent).toContain('🎉');
                expect(reaction_bubble.textContent).toContain('1'); // Count
            })
        );

        it("displays reaction count correctly",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 2);
                const contact1_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                const contact2_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                
                await mock.openChatBoxFor(_converse, contact1_jid);
                const view = _converse.chatboxviews.get(contact1_jid);

                const message = await mock.receiveMessage(_converse, {
                    from: contact1_jid,
                    to: _converse.bare_jid,
                    msgid: 'count-test-msg',
                    body: 'Count test',
                    type: 'chat'
                });

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                
                // Add two reactions with same emoji
                const reactions = [contact1_jid, contact2_jid].map(jid => u.toStanza(`
                    <message from='${jid}' to='${_converse.bare_jid}' type='chat'>
                        <reaction xmlns='urn:xmpp:reactions:0' id='count-test-msg'>
                            <emoji>⭐</emoji>
                        </reaction>
                    </message>
                `));

                reactions.forEach(r => _converse.api.connection.get()._dataRecv(mock.createRequest(r)));

                await u.waitUntil(() => {
                    const bubble = view.querySelector('.chat-msg__reaction .count');
                    return bubble && bubble.textContent === '2';
                });

                const count_elem = view.querySelector('.chat-msg__reaction .count');
                expect(count_elem.textContent).toBe('2');
            })
        );
    });
});
