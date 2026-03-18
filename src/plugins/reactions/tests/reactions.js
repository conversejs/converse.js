const { Strophe, stx, u } = converse.env;

const chooseReactionViaUI = async (view, msgid, emoji) => {
    const msg_el = await u.waitUntil(() => view.querySelector(`.chat-msg[data-msgid="${msgid}"]`));
    const dropdown_el = await u.waitUntil(() => msg_el?.querySelector('converse-message-actions converse-dropdown'));
    const toggle_el = await u.waitUntil(() => dropdown_el?.querySelector('.dropdown-toggle'));
    toggle_el.click();

    const action_el = await u.waitUntil(() => dropdown_el?.querySelector('.chat-msg__action-reaction'));
    action_el.click();

    const picker_el = await u.waitUntil(() => msg_el.querySelector('converse-reaction-picker'));
    const emoji_btn = Array.from(picker_el.querySelectorAll('.reaction-item')).find(
        (el) => el.textContent.trim() === emoji
    );
    if (emoji_btn) {
        emoji_btn.click();
        return;
    }

    const more_btn = await u.waitUntil(() => picker_el.querySelector('.reaction-item.more'));
    more_btn.click();

    await u.waitUntil(() => msg_el.querySelector('converse-emoji-picker'));
    await u.waitUntil(() => u.isVisible(msg_el.querySelector('.emoji-picker__lists')));
    const emoji_link = await u.waitUntil(() =>
        Array.from(msg_el.querySelectorAll('.emoji-picker li.insert-emoji a')).find(
            (el) => el.textContent.trim() === emoji
        )
    );
    expect(emoji_link).toBeTruthy();
    emoji_link.click();
};

describe('Message Reactions (XEP-0444)', function () {
    const popular_reactions = [':thumbsup:', ':heart:', ':tada:', ':joy:', ':open_mouth:'];

    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    describe('sending reactions in a 1:1 chat', function () {
        it(
            'sends a correct XEP-0444 stanza when a reaction is added',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                // Receive a message to react to
                await _converse.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${contact_jid}"
                                to="${_converse.jid}"
                                type="chat"
                                id="msg-to-react-to">
                        <body>React to this</body>
                    </message>`
                );

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({ 'msgid': 'msg-to-react-to' });

                spyOn(api.connection.get(), 'send').and.callThrough();

                await chooseReactionViaUI(view, 'msg-to-react-to', '👍');

                await u.waitUntil(() => api.connection.get().send.calls.count() > 0);
                const sent_stanza = api.connection
                    .get()
                    .send.calls.all()
                    .map((c) => (c.args[0] instanceof Element ? c.args[0] : c.args[0].tree()))
                    .find((el) => el.querySelector && el.querySelector('reactions'));

                expect(sent_stanza).toBeDefined();
                expect(sent_stanza).toEqualStanza(stx`
                    <message xmlns="jabber:client"
                             to="${contact_jid}"
                             type="chat"
                             id="${sent_stanza.getAttribute('id')}">
                        <reactions xmlns="urn:xmpp:reactions:0" id="msg-to-react-to">
                            <reaction>👍</reaction>
                        </reactions>
                    </message>
                `);

                // Reactions are JID-keyed: { jid: [emojis] }
                await u.waitUntil(() => msg_model.get('reactions')?.[_converse.bare_jid]?.includes('👍'));
                expect(msg_model.get('reactions')[_converse.bare_jid]).toContain('👍');
            })
        );

        it(
            'toggles off a reaction when the same emoji is sent again',
            mock.initConverse(['chatBoxesFetched'], { popular_reactions }, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                await _converse.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${contact_jid}"
                                to="${_converse.jid}"
                                type="chat"
                                id="toggle-msg">
                        <body>Toggle test</body>
                    </message>`
                );

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({ 'msgid': 'toggle-msg' });

                spyOn(api.connection.get(), 'send').and.callThrough();

                // Add reaction
                await chooseReactionViaUI(view, 'toggle-msg', '👍');
                await u.waitUntil(() => msg_model.get('reactions')?.[_converse.bare_jid]?.includes('👍'));

                // Toggle off same reaction
                await chooseReactionViaUI(view, 'toggle-msg', '👍');
                await u.waitUntil(() => {
                    const reactions = msg_model.get('reactions') || {};
                    const my_emojis = reactions[_converse.bare_jid] || [];
                    return !my_emojis.includes('👍');
                });

                const all_stanzas = api.connection
                    .get()
                    .send.calls.all()
                    .map((c) => (c.args[0] instanceof Element ? c.args[0] : c.args[0].tree()))
                    .filter((el) => el.querySelector && el.querySelector('reactions'));

                expect(all_stanzas.length).toBe(2);
                const toggle_off_stanza = all_stanzas[1];
                expect(toggle_off_stanza).toEqualStanza(stx`
                    <message xmlns="jabber:client"
                             to="${contact_jid}"
                             type="chat"
                             id="${toggle_off_stanza.getAttribute('id')}">
                        <reactions xmlns="urn:xmpp:reactions:0" id="toggle-msg"></reactions>
                    </message>
                `);
            })
        );
    });

    describe('receiving reactions in a 1:1 chat', function () {
        it(
            'applies an incoming reaction stanza to the correct message',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                // Receive a message to react to
                await _converse.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${contact_jid}"
                                to="${_converse.jid}"
                                type="chat"
                                id="incoming-react-msg">
                        <body>Hello there</body>
                    </message>`
                );

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({ 'msgid': 'incoming-react-msg' });

                // Receive a reaction stanza from the contact
                await _converse.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${contact_jid}"
                                to="${_converse.jid}"
                                type="chat"
                                id="reaction-1">
                        <reactions xmlns="urn:xmpp:reactions:0" id="incoming-react-msg">
                            <reaction>👍</reaction>
                        </reactions>
                    </message>`
                );

                await u.waitUntil(() => msg_model.get('reactions')?.[contact_jid]?.includes('👍'));
                expect(msg_model.get('reactions')[contact_jid]).toContain('👍');
            })
        );

        it(
            "replaces a user's previous reactions when receiving a new reaction stanza",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                await _converse.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${contact_jid}"
                                to="${_converse.jid}"
                                type="chat"
                                id="react-replace-msg">
                        <body>React to this message</body>
                    </message>`
                );

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({ 'msgid': 'react-replace-msg' });

                // Receive a reaction stanza with 👍
                await _converse.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${contact_jid}"
                                to="${_converse.jid}"
                                type="chat"
                                id="reaction-1">
                        <reactions xmlns="urn:xmpp:reactions:0" id="react-replace-msg">
                            <reaction>👍</reaction>
                        </reactions>
                    </message>`
                );

                await u.waitUntil(() => msg_model.get('reactions')?.[contact_jid]?.includes('👍'));
                expect(msg_model.get('reactions')[contact_jid]).toContain('👍');

                // Receive a new reaction stanza with ❤️ (replaces 👍 per XEP-0444)
                await _converse.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${contact_jid}"
                                to="${_converse.jid}"
                                type="chat"
                                id="reaction-2">
                        <reactions xmlns="urn:xmpp:reactions:0" id="react-replace-msg">
                            <reaction>❤️</reaction>
                        </reactions>
                    </message>`
                );

                await u.waitUntil(() => msg_model.get('reactions')?.[contact_jid]?.includes('❤️'));
                const reactions = msg_model.get('reactions');
                expect(reactions[contact_jid]).toContain('❤️');
                expect(reactions[contact_jid]).not.toContain('👍');
            })
        );

        it(
            'removes all reactions when receiving an empty reaction set',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                await _converse.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${contact_jid}"
                                to="${_converse.jid}"
                                type="chat"
                                id="remove-react-msg">
                        <body>React to this</body>
                    </message>`
                );

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({ 'msgid': 'remove-react-msg' });

                // Receive a reaction
                await _converse.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${contact_jid}"
                                to="${_converse.jid}"
                                type="chat"
                                id="reaction-add">
                        <reactions xmlns="urn:xmpp:reactions:0" id="remove-react-msg">
                            <reaction>👍</reaction>
                            <reaction>❤️</reaction>
                        </reactions>
                    </message>`
                );

                await u.waitUntil(() => msg_model.get('reactions')?.[contact_jid]?.length === 2);

                // Receive empty reactions (user removed all reactions)
                await _converse.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${contact_jid}"
                                to="${_converse.jid}"
                                type="chat"
                                id="reaction-remove">
                        <reactions xmlns="urn:xmpp:reactions:0" id="remove-react-msg">
                        </reactions>
                    </message>`
                );

                await u.waitUntil(() => {
                    const reactions = msg_model.get('reactions') || {};
                    return !reactions[contact_jid]?.length;
                });
                const reactions = msg_model.get('reactions');
                expect(reactions[contact_jid]).toBeFalsy();
            })
        );
    });

    describe('in a MUC', function () {
        it(
            'sends a groupchat reaction stanza targeting the MUC JID',
            mock.initConverse(['chatBoxesFetched'], { popular_reactions }, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);

                const muc_jid = 'lounge@montague.lit';
                await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
                const view = _converse.chatboxviews.get(muc_jid);

                // Receive a MUC message
                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/juliet"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="muc-msg-1">
                        <body>React to this MUC message</body>
                        <stanza-id xmlns="urn:xmpp:sid:0" id="muc-stanza-id" by="${muc_jid}"/>
                    </message>`
                );

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.at(0);

                spyOn(api.connection.get(), 'send').and.callThrough();

                await chooseReactionViaUI(view, msg_model.get('msgid'), '🎉');

                await u.waitUntil(() => api.connection.get().send.calls.count() > 0);
                const sent_stanza = api.connection
                    .get()
                    .send.calls.all()
                    .map((c) => (c.args[0] instanceof Element ? c.args[0] : c.args[0].tree()))
                    .find((el) => el.querySelector && el.querySelector('reactions'));

                expect(sent_stanza).toBeDefined();
                expect(sent_stanza).toEqualStanza(stx`
                    <message xmlns="jabber:client"
                             to="${muc_jid}"
                             type="groupchat"
                             id="${sent_stanza.getAttribute('id')}">
                        <reactions xmlns="urn:xmpp:reactions:0" id="${msg_model.get('msgid')}">
                            <reaction>🎉</reaction>
                        </reactions>
                    </message>
                `);

                await u.waitUntil(() => msg_model.get('reactions')?.[_converse.bare_jid]?.includes('🎉'));
                expect(msg_model.get('reactions')[_converse.bare_jid]).toContain('🎉');
            })
        );

        it(
            'accumulates reactions from multiple participants via incoming stanzas',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const muc_jid = 'lounge@montague.lit';
                await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
                const view = _converse.chatboxviews.get(muc_jid);

                // Receive a MUC message from juliet
                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/juliet"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="muc-accum-msg">
                        <body>React to this</body>
                    </message>`
                );

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({ 'msgid': 'muc-accum-msg' });

                // Receive a reaction from juliet
                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/juliet"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="muc-react-1">
                        <reactions xmlns="urn:xmpp:reactions:0" id="muc-accum-msg">
                            <reaction>👍</reaction>
                        </reactions>
                    </message>`
                );

                await u.waitUntil(() => {
                    const reactions = msg_model.get('reactions') || {};
                    return reactions[`${muc_jid}/juliet`]?.includes('👍');
                });

                // Receive a reaction from mercutio
                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/mercutio"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="muc-react-2">
                        <reactions xmlns="urn:xmpp:reactions:0" id="muc-accum-msg">
                            <reaction>👍</reaction>
                            <reaction>🎉</reaction>
                        </reactions>
                    </message>`
                );

                await u.waitUntil(() => {
                    const reactions = msg_model.get('reactions') || {};
                    return reactions[`${muc_jid}/mercutio`]?.includes('🎉');
                });

                // Both users' reactions should be preserved
                const reactions = msg_model.get('reactions');
                expect(reactions[`${muc_jid}/juliet`]).toContain('👍');
                expect(reactions[`${muc_jid}/mercutio`]).toContain('👍');
                expect(reactions[`${muc_jid}/mercutio`]).toContain('🎉');
            })
        );

        it(
            "preserves other users' reactions when one user updates theirs",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const muc_jid = 'lounge@montague.lit';
                await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
                const view = _converse.chatboxviews.get(muc_jid);

                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/juliet"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="muc-preserve-msg">
                        <body>Preserve reactions test</body>
                    </message>`
                );

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({ 'msgid': 'muc-preserve-msg' });

                // Juliet reacts with 👍
                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/juliet"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="preserve-react-1">
                        <reactions xmlns="urn:xmpp:reactions:0" id="muc-preserve-msg">
                            <reaction>👍</reaction>
                        </reactions>
                    </message>`
                );

                await u.waitUntil(() => msg_model.get('reactions')?.[`${muc_jid}/juliet`]);

                // Mercutio reacts with ❤️
                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/mercutio"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="preserve-react-2">
                        <reactions xmlns="urn:xmpp:reactions:0" id="muc-preserve-msg">
                            <reaction>❤️</reaction>
                        </reactions>
                    </message>`
                );

                await u.waitUntil(() => msg_model.get('reactions')?.[`${muc_jid}/mercutio`]);

                // Juliet changes her reaction to 🎉 (replaces 👍)
                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/juliet"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="preserve-react-3">
                        <reactions xmlns="urn:xmpp:reactions:0" id="muc-preserve-msg">
                            <reaction>🎉</reaction>
                        </reactions>
                    </message>`
                );

                await u.waitUntil(() => msg_model.get('reactions')?.[`${muc_jid}/juliet`]?.includes('🎉'));

                // Mercutio's reaction should still be there
                const reactions = msg_model.get('reactions');
                expect(reactions[`${muc_jid}/juliet`]).toContain('🎉');
                expect(reactions[`${muc_jid}/juliet`]).not.toContain('👍');
                expect(reactions[`${muc_jid}/mercutio`]).toContain('❤️');
            })
        );
    });
});
