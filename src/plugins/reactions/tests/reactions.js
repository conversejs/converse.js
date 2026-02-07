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

        it("appears for own messages",
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
                
                // Reaction button should appear for own messages
                const reaction_btn = msg_el.querySelector('.chat-msg__action-reaction');
                expect(reaction_btn).not.toBe(null);
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

    describe("XEP-0444 Discovery Support", function () {

        it("advertises urn:xmpp:reactions:0 in disco#info",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                
                // Check that the feature is registered
                const features = await api.disco.own.features.get();
                expect(features.includes('urn:xmpp:reactions:0')).toBe(true);
            })
        );

        it("hides reaction button if contact does not support reactions",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                // Mock disco info response without reactions support
                const bare_jid = Strophe.getBareJidFromJid(contact_jid);
                const entity = await api.disco.entities.get(bare_jid, true);
                
                // Simulate disco query response without reactions feature
                const disco_stanza = u.toStanza(`
                    <iq type='result' from='${contact_jid}' to='${_converse.bare_jid}'>
                        <query xmlns='http://jabber.org/protocol/disco#info'>
                            <feature var='http://jabber.org/protocol/disco#info'/>
                            <feature var='http://jabber.org/protocol/disco#items'/>
                        </query>
                    </iq>
                `);
                
                _converse.api.connection.get()._dataRecv(mock.createRequest(disco_stanza));
                await u.waitUntil(() => entity.features.length > 0);

                // Receive a message
                const message = await mock.receiveMessage(_converse, {
                    from: contact_jid,
                    to: _converse.bare_jid,
                    msgid: 'test-no-support',
                    body: 'Test message',
                    type: 'chat'
                });

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_el = view.querySelector('.chat-msg');
                
                // Reaction button should be hidden
                const reaction_btn = msg_el.querySelector('.chat-msg__action-reaction');
                expect(reaction_btn).toBe(null);
            })
        );

        it("shows reaction button if contact supports reactions",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                // Mock disco info response WITH reactions support
                const bare_jid = Strophe.getBareJidFromJid(contact_jid);
                const entity = await api.disco.entities.get(bare_jid, true);
                
                const disco_stanza = u.toStanza(`
                    <iq type='result' from='${contact_jid}' to='${_converse.bare_jid}'>
                        <query xmlns='http://jabber.org/protocol/disco#info'>
                            <feature var='http://jabber.org/protocol/disco#info'/>
                            <feature var='urn:xmpp:reactions:0'/>
                        </query>
                    </iq>
                `);
                
                _converse.api.connection.get()._dataRecv(mock.createRequest(disco_stanza));
                await u.waitUntil(() => entity.features.findWhere({'var': 'urn:xmpp:reactions:0'}));

                // Receive a message
                const message = await mock.receiveMessage(_converse, {
                    from: contact_jid,
                    to: _converse.bare_jid,
                    msgid: 'test-with-support',
                    body: 'Test message',
                    type: 'chat'
                });

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_el = view.querySelector('.chat-msg');
                
                // Reaction button should be visible
                const reaction_btn = msg_el.querySelector('.chat-msg__action-reaction');
                expect(reaction_btn).not.toBe(null);
            })
        );
    });

    describe("Restricted Reactions", function () {

        it("parses restricted emoji set from disco#info",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

                // Simulate disco info with restricted reactions
                const disco_stanza = u.toStanza(`
                    <iq type='result' from='${contact_jid}' to='${_converse.bare_jid}'>
                        <query xmlns='http://jabber.org/protocol/disco#info'>
                            <feature var='urn:xmpp:reactions:0'/>
                            <feature var='urn:xmpp:reactions:0#restricted'>
                                <allow>👍</allow>
                                <allow>❤️</allow>
                                <allow>😂</allow>
                            </feature>
                        </query>
                    </iq>
                `);

                _converse.api.connection.get()._dataRecv(mock.createRequest(disco_stanza));

                // Wait for the stanza to be processed
                await u.waitUntil(() => {
                    const plugin = _converse.pluggable.plugins['converse-reactions'];
                    const bare_jid = Strophe.getBareJidFromJid(contact_jid);
                    return plugin.allowed_emojis.has(bare_jid);
                }, 1000);

                const plugin = _converse.pluggable.plugins['converse-reactions'];
                const bare_jid = Strophe.getBareJidFromJid(contact_jid);
                const allowed = plugin.allowed_emojis.get(bare_jid);
                
                expect(allowed).toBeDefined();
                expect(allowed.length).toBe(3);
                expect(allowed).toContain('👍');
                expect(allowed).toContain('❤️');
                expect(allowed).toContain('😂');
            })
        );
    });

    describe("Hybrid Update Strategy", function () {

        it("applies optimistic updates for 1:1 chats",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                // Receive a message to react to
                const message = await mock.receiveMessage(_converse, {
                    from: contact_jid,
                    to: _converse.bare_jid,
                    msgid: 'optimistic-test',
                    body: 'React to this',
                    type: 'chat'
                });

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({'msgid': 'optimistic-test'});
                
                // Get the message element and click reaction button
                const msg_el = view.querySelector('.chat-msg');
                const reaction_btn = msg_el.querySelector('.chat-msg__action-reaction');
                reaction_btn.click();
                
                await u.waitUntil(() => document.querySelector('converse-reaction-picker'));
                const picker = document.querySelector('converse-reaction-picker');
                const first_emoji_btn = picker.querySelector('.reaction-item:not(.more)');
                first_emoji_btn.click();

                // Check that the reaction appears immediately (optimistic update)
                await u.waitUntil(() => {
                    const reactions = msg_model.get('reactions');
                    return reactions && Object.keys(reactions).length > 0;
                }, 500); // Short timeout - should be immediate

                const reactions = msg_model.get('reactions');
                expect(reactions).toBeDefined();
                expect(Object.keys(reactions).length).toBeGreaterThan(0);

                // Verify it's our own JID in the reaction
                const emoji = Object.keys(reactions)[0];
                expect(reactions[emoji]).toContain(_converse.bare_jid);
            })
        );

        it("does NOT apply optimistic updates for MUCs",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                
                // Create a MUC
                const muc_jid = 'lounge@montague.lit';
                await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
                const view = _converse.chatboxviews.get(muc_jid);

                // Receive a message in the MUC
                const message = await view.model.handleMessageStanza(u.toStanza(`
                    <message from='${muc_jid}/juliet' to='${_converse.bare_jid}' type='groupchat'>
                        <body>MUC message to react to</body>
                        <stanza-id xmlns='urn:xmpp:sid:0' id='muc-msg-id' by='${muc_jid}'/>
                    </message>
                `));

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.at(0);
                const original_msgid = msg_model.get('msgid');
                
                // Spy on the model save to detect optimistic updates
                const original_reactions = msg_model.get('reactions');
                spyOn(msg_model, 'save').and.callThrough();
                
                // Trigger a reaction
                const plugin = _converse.pluggable.plugins['converse-reactions'];
                plugin.sendReaction(msg_model, '👍');

                // Wait a bit to ensure no optimistic update occurred
                await new Promise(resolve => setTimeout(resolve, 200));

                // For MUC, the save should NOT have been called with reactions
                // (optimistic update should be skipped)
                const save_calls = msg_model.save.calls.all();
                const reaction_updates = save_calls.filter(call => 
                    call.args[0] && call.args[0].reactions
                );
                
                // Should be 0 since we don't do optimistic updates for MUCs
                expect(reaction_updates.length).toBe(0);
            })
        );

        it("toggles reactions correctly (add and remove)",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                const message = await mock.receiveMessage(_converse, {
                    from: contact_jid,
                    to: _converse.bare_jid,
                    msgid: 'toggle-test',
                    body: 'Toggle reaction test',
                    type: 'chat'
                });

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({'msgid': 'toggle-test'});
                
                const plugin = _converse.pluggable.plugins['converse-reactions'];
                
                // Add a reaction
                plugin.sendReaction(msg_model, '❤️');
                await u.waitUntil(() => msg_model.get('reactions')?.['❤️']);
                
                expect(msg_model.get('reactions')['❤️']).toContain(_converse.bare_jid);

                // Toggle it off (remove)
                plugin.sendReaction(msg_model, '❤️');
                await u.waitUntil(() => !msg_model.get('reactions')?.['❤️']);
                
                const reactions = msg_model.get('reactions');
                expect(reactions['❤️']).toBeFalsy(); // Should be removed
            })
        );
    });

    describe("updateMessageReactions Helper", function () {

        it("correctly updates message reactions",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                const message = await mock.receiveMessage(_converse, {
                    from: contact_jid,
                    to: _converse.bare_jid,
                    msgid: 'helper-test',
                    body: 'Helper test',
                    type: 'chat'
                });

                const msg_model = view.model.messages.findWhere({'msgid': 'helper-test'});
                const plugin = _converse.pluggable.plugins['converse-reactions'];
                
                // Add reaction using helper
                plugin.updateMessageReactions(msg_model, contact_jid, ['👍', '❤️']);
                
                await u.waitUntil(() => msg_model.get('reactions'));
                const reactions = msg_model.get('reactions');
                
                expect(reactions['👍']).toContain(contact_jid);
                expect(reactions['❤️']).toContain(contact_jid);
            })
        );

        it("replaces previous reactions when called again",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                const message = await mock.receiveMessage(_converse, {
                    from: contact_jid,
                    to: _converse.bare_jid,
                    msgid: 'replace-helper-test',
                    body: 'Replace test',
                    type: 'chat'
                });

                const msg_model = view.model.messages.findWhere({'msgid': 'replace-helper-test'});
                const plugin = _converse.pluggable.plugins['converse-reactions'];
                
                // Add initial reactions
                plugin.updateMessageReactions(msg_model, contact_jid, ['👍']);
                await u.waitUntil(() => msg_model.get('reactions')?.['👍']);
                
                // Replace with new reactions
                plugin.updateMessageReactions(msg_model, contact_jid, ['❤️', '😂']);
                await u.waitUntil(() => msg_model.get('reactions')?.['❤️']);
                
                const reactions = msg_model.get('reactions');
                expect(reactions['👍']).toBeFalsy(); // Old reaction removed
                expect(reactions['❤️']).toContain(contact_jid);
                expect(reactions['😂']).toContain(contact_jid);
            })
        );

        it("removes all reactions when given empty array",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                const message = await mock.receiveMessage(_converse, {
                    from: contact_jid,
                    to: _converse.bare_jid,
                    msgid: 'remove-all-test',
                    body: 'Remove all test',
                    type: 'chat'
                });

                const msg_model = view.model.messages.findWhere({'msgid': 'remove-all-test'});
                const plugin = _converse.pluggable.plugins['converse-reactions'];
                
                // Add reactions
                plugin.updateMessageReactions(msg_model, contact_jid, ['👍', '❤️']);
                await u.waitUntil(() => msg_model.get('reactions')?.['👍']);
                
                // Remove all by passing empty array
                plugin.updateMessageReactions(msg_model, contact_jid, []);
                await u.waitUntil(() => {
                    const reactions = msg_model.get('reactions');
                    return !reactions || Object.keys(reactions).length === 0;
                });
                
                const reactions = msg_model.get('reactions');
                expect(reactions['👍']).toBeFalsy();
                expect(reactions['❤️']).toBeFalsy();
            })
        );
    });
});
