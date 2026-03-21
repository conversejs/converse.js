const { Strophe, stx, u } = converse.env;

fdescribe('Message Reactions (XEP-0444)', function () {
    const popular_reactions = [':thumbsup:', ':heart:', ':tada:', ':joy:', ':open_mouth:'];

    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    describe('sending reactions in a 1:1 chat', function () {
        it(
            'logs an error and sends nothing when given an unknown shortname',
            mock.initConverse(
                ['chatBoxesFetched'],
                { popular_reactions: [':not-an-emoji:'] },
                async function (_converse) {
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
                                id="shortname-error-msg">
                        <body>React to this</body>
                    </message>`,
                    );

                    await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                    const msg_model = view.model.messages.findWhere({ 'msgid': 'shortname-error-msg' });

                    // Open the reaction picker so the converse-reaction-picker element is in the DOM
                    const msg_el = await u.waitUntil(() =>
                        view.querySelector('.chat-msg[data-msgid="shortname-error-msg"]'),
                    );
                    const toggle_el = await u.waitUntil(() =>
                        msg_el.querySelector('converse-message-actions converse-dropdown .dropdown-toggle'),
                    );
                    toggle_el.click();
                    const action_el = await u.waitUntil(() => msg_el.querySelector('.chat-msg__action-reaction'));
                    action_el.click();
                    const picker_el = await u.waitUntil(() => msg_el.querySelector('converse-reaction-picker'));

                    spyOn(api.connection.get(), 'send').and.callThrough();
                    spyOn(converse.env.log, 'error');

                    // Directly invoke onEmojiSelected with the unknown shortname, bypassing DOM button lookup
                    picker_el.onEmojiSelected(':not-an-emoji:');

                    expect(converse.env.log.error).toHaveBeenCalledWith(
                        'sendReaction: could not convert shortname to emoji: :not-an-emoji:',
                    );
                    expect(api.connection.get().send).not.toHaveBeenCalled();
                    expect(msg_model.get('reactions')).toBeFalsy();
                },
            ),
        );

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
                    </message>`,
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

                await u.waitUntil(() => getReactionEmojis(view).includes('👍'));
                expect(getReactionEmojis(view)).toEqual(['👍']);

                // The button should carry the 'reacted' class since the logged-in user reacted
                const btn = await u.waitUntil(() => view.querySelector('converse-reactions .chat-msg__reaction'));
                expect(btn.classList.contains('reacted')).toBeTrue();
            }),
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
                    </message>`,
                );

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({ 'msgid': 'toggle-msg' });

                spyOn(api.connection.get(), 'send').and.callThrough();

                // Add reaction
                await chooseReactionViaUI(view, 'toggle-msg', '👍');
                await u.waitUntil(() => msg_model.get('reactions')?.[_converse.bare_jid]?.includes('👍'));
                await u.waitUntil(() => getReactionEmojis(view).includes('👍'));
                expect(getReactionEmojis(view)).toEqual(['👍']);

                // Toggle off same reaction
                await chooseReactionViaUI(view, 'toggle-msg', '👍');
                await u.waitUntil(() => {
                    const reactions = msg_model.get('reactions') || {};
                    const my_emojis = reactions[_converse.bare_jid] || [];
                    return !my_emojis.includes('👍');
                });
                await u.waitUntil(() => getReactionEmojis(view).length === 0);
                expect(getReactionEmojis(view)).toEqual([]);

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
            }),
        );

        it(
            "clicking someone else's reaction button adds your own reaction",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
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
                                id="click-reaction-msg">
                        <body>Click my reaction</body>
                    </message>`,
                );
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({ 'msgid': 'click-reaction-msg' });

                // Contact reacts with 👍
                await _converse.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${contact_jid}"
                                to="${_converse.jid}"
                                type="chat"
                                id="incoming-reaction-1">
                        <reactions xmlns="urn:xmpp:reactions:0" id="click-reaction-msg">
                            <reaction>👍</reaction>
                        </reactions>
                    </message>`,
                );
                await u.waitUntil(() => getReactionEmojis(view).includes('👍'));
                expect(getReactionCounts(view)['👍']).toBe(1);

                // We click the 👍 button to add our own reaction
                spyOn(api.connection.get(), 'send').and.callThrough();
                const btn = await u.waitUntil(() => view.querySelector('converse-reactions .chat-msg__reaction'));
                btn.click();

                await u.waitUntil(() => msg_model.get('reactions')?.[_converse.bare_jid]?.includes('👍'));
                expect(getReactionCounts(view)['👍']).toBe(2);

                const sent_stanza = api.connection
                    .get()
                    .send.calls.all()
                    .map((c) => (c.args[0] instanceof Element ? c.args[0] : c.args[0].tree()))
                    .find((el) => el.querySelector?.('reactions'));
                expect(sent_stanza).toEqualStanza(stx`
                    <message xmlns="jabber:client"
                             to="${contact_jid}"
                             type="chat"
                             id="${sent_stanza.getAttribute('id')}">
                        <reactions xmlns="urn:xmpp:reactions:0" id="click-reaction-msg">
                            <reaction>👍</reaction>
                        </reactions>
                    </message>
                `);
            }),
        );

        it(
            'clicking your own reaction button removes it',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
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
                                id="remove-own-reaction-msg">
                        <body>Remove my reaction</body>
                    </message>`,
                );
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({ 'msgid': 'remove-own-reaction-msg' });

                // We add a reaction via the picker first
                await chooseReactionViaUI(view, 'remove-own-reaction-msg', '👍');
                await u.waitUntil(() => msg_model.get('reactions')?.[_converse.bare_jid]?.includes('👍'));
                await u.waitUntil(() => getReactionEmojis(view).includes('👍'));

                // Now click the rendered reaction button to remove it
                spyOn(api.connection.get(), 'send').and.callThrough();
                const btn = await u.waitUntil(() => view.querySelector('converse-reactions .chat-msg__reaction'));
                // The button should carry the 'reacted' class before clicking
                expect(btn.classList.contains('reacted')).toBeTrue();
                btn.click();

                await u.waitUntil(() => !msg_model.get('reactions')?.[_converse.bare_jid]?.includes('👍'));
                await u.waitUntil(() => getReactionEmojis(view).length === 0);
                expect(getReactionEmojis(view)).toEqual([]);

                const sent_stanza = api.connection
                    .get()
                    .send.calls.all()
                    .map((c) => (c.args[0] instanceof Element ? c.args[0] : c.args[0].tree()))
                    .find((el) => el.querySelector?.('reactions'));
                expect(sent_stanza).toEqualStanza(stx`
                    <message xmlns="jabber:client"
                             to="${contact_jid}"
                             type="chat"
                             id="${sent_stanza.getAttribute('id')}">
                        <reactions xmlns="urn:xmpp:reactions:0" id="remove-own-reaction-msg"></reactions>
                    </message>
                `);
            }),
        );
    });

    describe('reaction picker', function () {
        it(
            'closes when the user clicks outside it',
            mock.initConverse(['chatBoxesFetched'], { popular_reactions }, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                await _converse.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${contact_jid}"
                                to="${_converse.jid}"
                                type="chat"
                                id="picker-close-msg">
                        <body>Open picker test</body>
                    </message>`,
                );
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

                // Open the reaction picker
                const msg_el = await u.waitUntil(() => view.querySelector('.chat-msg[data-msgid="picker-close-msg"]'));
                const toggle_el = await u.waitUntil(() =>
                    msg_el.querySelector('converse-message-actions converse-dropdown .dropdown-toggle'),
                );
                toggle_el.click();
                const action_el = await u.waitUntil(() => msg_el.querySelector('.chat-msg__action-reaction'));
                action_el.click();
                const picker_el = await u.waitUntil(() => msg_el.querySelector('converse-reaction-picker'));
                await u.waitUntil(() => picker_el.opened);
                expect(picker_el.opened).toBeTrue();

                // Simulate a click outside the picker — the document listener attached by
                // updated() should call close(). Wait for requestAnimationFrame to attach
                // the listener before dispatching the outside click.
                await new Promise((resolve) => requestAnimationFrame(resolve));
                document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                await u.waitUntil(() => !picker_el.opened);
                expect(picker_el.opened).toBeFalse();
            }),
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
                    </message>`,
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
                    </message>`,
                );

                await u.waitUntil(() => msg_model.get('reactions')?.[contact_jid]?.includes('👍'));
                expect(msg_model.get('reactions')[contact_jid]).toContain('👍');

                await u.waitUntil(() => getReactionEmojis(view).includes('👍'));
                expect(getReactionEmojis(view)).toEqual(['👍']);
            }),
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
                    </message>`,
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
                    </message>`,
                );

                await u.waitUntil(() => msg_model.get('reactions')?.[contact_jid]?.includes('👍'));
                expect(msg_model.get('reactions')[contact_jid]).toContain('👍');
                await u.waitUntil(() => getReactionEmojis(view).includes('👍'));
                expect(getReactionEmojis(view)).toEqual(['👍']);

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
                    </message>`,
                );

                await u.waitUntil(() => msg_model.get('reactions')?.[contact_jid]?.includes('❤️'));
                const reactions = msg_model.get('reactions');
                expect(reactions[contact_jid]).toContain('❤️');
                expect(reactions[contact_jid]).not.toContain('👍');

                await u.waitUntil(() => !getReactionEmojis(view).includes('👍'));
                expect(getReactionEmojis(view)).toEqual(['❤️']);
            }),
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
                    </message>`,
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
                    </message>`,
                );

                await u.waitUntil(() => msg_model.get('reactions')?.[contact_jid]?.length === 2);
                await u.waitUntil(() => getReactionEmojis(view).length === 2);
                expect(getReactionEmojis(view)).toContain('👍');
                expect(getReactionEmojis(view)).toContain('❤️');

                // Receive empty reactions (user removed all reactions)
                await _converse.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${contact_jid}"
                                to="${_converse.jid}"
                                type="chat"
                                id="reaction-remove">
                        <reactions xmlns="urn:xmpp:reactions:0" id="remove-react-msg">
                        </reactions>
                    </message>`,
                );

                await u.waitUntil(() => {
                    const reactions = msg_model.get('reactions') || {};
                    return !reactions[contact_jid]?.length;
                });
                const reactions = msg_model.get('reactions');
                expect(reactions[contact_jid]).toBeFalsy();

                await u.waitUntil(() => getReactionEmojis(view).length === 0);
                expect(getReactionEmojis(view)).toEqual([]);
            }),
        );
    });

    describe('reaction tooltip shows the correct reactor name', function () {
        it(
            'shows the contact display name in the tooltip for a 1:1 reaction',
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
                                id="tooltip-1-1-msg">
                        <body>Tooltip test</body>
                    </message>`,
                );

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

                // Contact reacts with 👍
                await _converse.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${contact_jid}"
                                to="${_converse.jid}"
                                type="chat"
                                id="tooltip-reaction-1">
                        <reactions xmlns="urn:xmpp:reactions:0" id="tooltip-1-1-msg">
                            <reaction>👍</reaction>
                        </reactions>
                    </message>`,
                );

                // Wait for the reaction button to appear
                const btn = await u.waitUntil(() => view.querySelector('converse-reactions .chat-msg__reaction'));
                expect(btn).not.toBeNull();

                // The tooltip resolves asynchronously — wait until it is no longer the raw JID
                await u.waitUntil(() => btn.getAttribute('data-tooltip') === mock.cur_names[0]);
                expect(btn.getAttribute('data-tooltip')).toBe(mock.cur_names[0]);
                expect(btn.getAttribute('title')).toBe(mock.cur_names[0]);
            }),
        );

        it(
            'shows "You" (own display name) in the tooltip when the logged-in user reacts in a 1:1 chat',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
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
                                id="tooltip-own-react-msg">
                        <body>Own tooltip test</body>
                    </message>`,
                );

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

                spyOn(api.connection.get(), 'send').and.callThrough();
                await chooseReactionViaUI(view, 'tooltip-own-react-msg', '👍');
                await u.waitUntil(() => getReactionEmojis(view).includes('👍'));

                const btn = await u.waitUntil(() => view.querySelector('converse-reactions .chat-msg__reaction'));
                expect(btn).not.toBeNull();

                // The own user's display name comes from their profile/vcard.
                // The mock vcard sets it to 'Romeo Montague'.
                const own_display_name = _converse.state.profile.getDisplayName();
                await u.waitUntil(() => btn.getAttribute('data-tooltip') === own_display_name);
                expect(btn.getAttribute('data-tooltip')).toBe(own_display_name);
                expect(btn.getAttribute('title')).toBe(own_display_name);
            }),
        );

        it(
            'shows both reactor names in the tooltip when two users have reacted in a 1:1 chat',
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
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
                                id="tooltip-two-reactors-msg">
                        <body>Two reactors test</body>
                    </message>`,
                );

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

                // Contact reacts with 👍
                await _converse.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${contact_jid}"
                                to="${_converse.jid}"
                                type="chat"
                                id="tooltip-two-react-1">
                        <reactions xmlns="urn:xmpp:reactions:0" id="tooltip-two-reactors-msg">
                            <reaction>👍</reaction>
                        </reactions>
                    </message>`,
                );

                await u.waitUntil(() => getReactionEmojis(view).includes('👍'));

                // We also react with 👍 by clicking the existing reaction button
                spyOn(api.connection.get(), 'send').and.callThrough();
                const btn = await u.waitUntil(() => view.querySelector('converse-reactions .chat-msg__reaction'));
                btn.click();

                await u.waitUntil(() => getReactionCounts(view)['👍'] === 2);

                // Tooltip should now list both names: "<Contact> and <Own name>"
                const own_display_name = _converse.state.profile.getDisplayName();
                const contact_display_name = mock.cur_names[0];
                // getReactorNames() puts the first reactor first; contact reacted before us
                const expected_tooltip = `${contact_display_name} and ${own_display_name}`;

                const updated_btn = await u.waitUntil(() =>
                    view.querySelector(
                        'converse-reactions .chat-msg__reaction[data-tooltip="' + expected_tooltip + '"]',
                    ),
                );
                expect(updated_btn).not.toBeNull();
                expect(updated_btn.getAttribute('data-tooltip')).toBe(expected_tooltip);
                expect(updated_btn.getAttribute('title')).toBe(expected_tooltip);
            }),
        );

        it(
            'shows the MUC nick in the tooltip for a groupchat reaction',
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
                                id="muc-tooltip-msg">
                        <body>MUC tooltip test</body>
                        <stanza-id xmlns="urn:xmpp:sid:0" id="muc-tooltip-stanza" by="${muc_jid}"/>
                    </message>`,
                );

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

                // Juliet reacts with 👍
                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/juliet"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="muc-tooltip-react-1">
                        <reactions xmlns="urn:xmpp:reactions:0" id="muc-tooltip-msg">
                            <reaction>👍</reaction>
                        </reactions>
                    </message>`,
                );

                // Wait for the reaction button to appear and tooltip to be populated
                const btn = await u.waitUntil(() => view.querySelector('converse-reactions .chat-msg__reaction'));
                expect(btn).not.toBeNull();

                // For MUC, the nick is extracted from the resource part of the full JID.
                // lounge@montague.lit/juliet → 'juliet'
                await u.waitUntil(() => btn.getAttribute('data-tooltip') === 'juliet');
                expect(btn.getAttribute('data-tooltip')).toBe('juliet');
                expect(btn.getAttribute('title')).toBe('juliet');
            }),
        );

        it(
            'shows the MUC nickname in the tooltip when the logged-in user reacts in a MUC',
            mock.initConverse(['chatBoxesFetched'], { popular_reactions }, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 0);

                const muc_jid = 'lounge@montague.lit';
                await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
                const view = _converse.chatboxviews.get(muc_jid);

                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/juliet"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="muc-tooltip-own-msg">
                        <body>Own MUC reaction tooltip test</body>
                        <stanza-id xmlns="urn:xmpp:sid:0" id="muc-tooltip-own-stanza" by="${muc_jid}"/>
                    </message>`,
                );

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.at(0);

                spyOn(api.connection.get(), 'send').and.callThrough();
                await chooseReactionViaUI(view, msg_model.get('msgid'), '🎉');
                await u.waitUntil(() => getReactionEmojis(view).includes('🎉'));

                const btn = await u.waitUntil(() => view.querySelector('converse-reactions .chat-msg__reaction'));
                expect(btn).not.toBeNull();

                // The logged-in user's own reaction in a MUC must show their nick, not "You" or their bare JID.
                await u.waitUntil(() => btn.getAttribute('data-tooltip') === 'romeo');
                expect(btn.getAttribute('data-tooltip')).toBe('romeo');
                expect(btn.getAttribute('title')).toBe('romeo');
            }),
        );

        it(
            'shows both MUC nicks in the tooltip when two participants have reacted',
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
                                id="muc-tooltip-two-msg">
                        <body>Two MUC reactors test</body>
                        <stanza-id xmlns="urn:xmpp:sid:0" id="muc-tooltip-two-stanza" by="${muc_jid}"/>
                    </message>`,
                );

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

                // Juliet reacts with 👍
                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/juliet"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="muc-tooltip-two-react-1">
                        <reactions xmlns="urn:xmpp:reactions:0" id="muc-tooltip-two-msg">
                            <reaction>👍</reaction>
                        </reactions>
                    </message>`,
                );

                await u.waitUntil(() => getReactionEmojis(view).includes('👍'));

                // Mercutio also reacts with 👍
                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/mercutio"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="muc-tooltip-two-react-2">
                        <reactions xmlns="urn:xmpp:reactions:0" id="muc-tooltip-two-msg">
                            <reaction>👍</reaction>
                        </reactions>
                    </message>`,
                );

                await u.waitUntil(() => getReactionCounts(view)['👍'] === 2);

                const btn = await u.waitUntil(() => view.querySelector('converse-reactions .chat-msg__reaction'));
                expect(btn).not.toBeNull();

                // getReactorNames() shows up to 2 names: "juliet and mercutio"
                await u.waitUntil(() => btn.getAttribute('data-tooltip') === 'juliet and mercutio');
                expect(btn.getAttribute('data-tooltip')).toBe('juliet and mercutio');
                expect(btn.getAttribute('title')).toBe('juliet and mercutio');
            }),
        );

        it(
            'shows "nick1, nick2 and N others" in the tooltip when more than two participants have reacted in a MUC',
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
                                id="muc-tooltip-many-msg">
                        <body>Many MUC reactors test</body>
                        <stanza-id xmlns="urn:xmpp:sid:0" id="muc-tooltip-many-stanza" by="${muc_jid}"/>
                    </message>`,
                );

                // Three participants react with 👍 — remainder is 1
                for (const [i, nick] of [
                    [1, 'juliet'],
                    [2, 'mercutio'],
                    [3, 'benvolio'],
                ]) {
                    await view.model.handleMessageStanza(
                        stx`<message xmlns="jabber:client"
                                    from="${muc_jid}/${nick}"
                                    to="${_converse.bare_jid}"
                                    type="groupchat"
                                    id="muc-tooltip-many-react-${i}">
                            <reactions xmlns="urn:xmpp:reactions:0" id="muc-tooltip-many-msg">
                                <reaction>👍</reaction>
                            </reactions>
                        </message>`,
                    );
                }

                await u.waitUntil(() => getReactionCounts(view)['👍'] === 3);

                // getReactorNames() names the first 2 nicks and counts the rest:
                // "juliet, mercutio and 1 other"
                let btn = await u.waitUntil(() =>
                    view.querySelector(
                        `converse-reactions .chat-msg__reaction[data-tooltip="juliet, mercutio and 1 other"]`,
                    ),
                );
                expect(btn).not.toBeNull();
                expect(btn.getAttribute('data-tooltip')).toBe('juliet, mercutio and 1 other');
                expect(btn.getAttribute('title')).toBe('juliet, mercutio and 1 other');

                // A fourth participant reacts — remainder becomes 2
                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/tybalt"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="muc-tooltip-many-react-4">
                        <reactions xmlns="urn:xmpp:reactions:0" id="muc-tooltip-many-msg">
                            <reaction>👍</reaction>
                        </reactions>
                    </message>`,
                );

                await u.waitUntil(() => getReactionCounts(view)['👍'] === 4);

                const btn2 = await u.waitUntil(() =>
                    view.querySelector(
                        `converse-reactions .chat-msg__reaction[data-tooltip="juliet, mercutio and 2 others"]`,
                    ),
                );
                expect(btn2).not.toBeNull();
                expect(btn2.getAttribute('data-tooltip')).toBe('juliet, mercutio and 2 others');
                expect(btn2.getAttribute('title')).toBe('juliet, mercutio and 2 others');
            }),
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
                    </message>`,
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

                await u.waitUntil(() => msg_model.get('reactions')?.[`${muc_jid}/romeo`]?.includes('🎉'));
                expect(msg_model.get('reactions')[`${muc_jid}/romeo`]).toContain('🎉');

                await u.waitUntil(() => getReactionEmojis(view).includes('🎉'));
                expect(getReactionEmojis(view)).toEqual(['🎉']);
            }),
        );

        it(
            'shows a count of 1 (not 2) when the MUC echoes back our own reaction stanza',
            mock.initConverse(['chatBoxesFetched'], { popular_reactions }, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const muc_jid = 'lounge@montague.lit';
                await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
                const view = _converse.chatboxviews.get(muc_jid);

                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/juliet"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="muc-count-msg">
                        <body>Count test</body>
                        <stanza-id xmlns="urn:xmpp:sid:0" id="muc-count-stanza-id" by="${muc_jid}"/>
                    </message>`,
                );

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({ 'msgid': 'muc-count-msg' });

                // We react (optimistic update stored under full MUC JID room/nick)
                await chooseReactionViaUI(view, 'muc-count-msg', '👍');
                await u.waitUntil(() => msg_model.get('reactions')?.[`${muc_jid}/romeo`]?.includes('👍'));

                // MUC echoes back our reaction under the full JID (room/nick)
                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/romeo"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="${u.getUniqueId()}">
                        <reactions xmlns="urn:xmpp:reactions:0" id="muc-count-msg">
                            <reaction>👍</reaction>
                        </reactions>
                        <stanza-id xmlns="urn:xmpp:sid:0" id="${u.getUniqueId()}" by="${muc_jid}"/>
                    </message>`,
                );

                await u.waitUntil(() => msg_model.get('reactions')?.[`${muc_jid}/romeo`]?.includes('👍'));

                // The bare JID optimistic entry must have been removed
                expect(msg_model.get('reactions')[_converse.bare_jid]).toBeUndefined();

                // Count must be 1, not 2
                await u.waitUntil(() => getReactionEmojis(view).includes('👍'));
                const counts = getReactionCounts(view);
                expect(counts['👍']).toBe(1);
            }),
        );

        it(
            'does not wipe the message body when the MUC echoes back our own reaction stanza',
            mock.initConverse(['chatBoxesFetched'], { popular_reactions }, async function (_converse) {
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
                                id="muc-body-msg">
                        <body>This text must survive reactions</body>
                        <stanza-id xmlns="urn:xmpp:sid:0" id="muc-body-stanza-id" by="${muc_jid}"/>
                    </message>`,
                );

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({ 'msgid': 'muc-body-msg' });
                expect(msg_model.get('body')).toBe('This text must survive reactions');

                // We react via UI (optimistic update stored under full MUC JID room/nick)
                await chooseReactionViaUI(view, 'muc-body-msg', '👍');
                await u.waitUntil(() => msg_model.get('reactions')?.[`${muc_jid}/romeo`]?.includes('👍'));

                // MUC echoes back our own reaction stanza (no <body> element)
                const reaction_id = u.getUniqueId();
                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/romeo"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="${reaction_id}">
                        <reactions xmlns="urn:xmpp:reactions:0" id="muc-body-msg">
                            <reaction>👍</reaction>
                        </reactions>
                        <stanza-id xmlns="urn:xmpp:sid:0" id="${u.getUniqueId()}" by="${muc_jid}"/>
                    </message>`,
                );

                await u.waitUntil(() => msg_model.get('reactions')?.[`${muc_jid}/romeo`]?.includes('👍'));

                // The message body must still be intact
                expect(msg_model.get('body')).toBe('This text must survive reactions');
                expect(view.querySelector('.chat-msg__text').textContent.trim()).toBe(
                    'This text must survive reactions',
                );
            }),
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
                    </message>`,
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
                    </message>`,
                );

                await u.waitUntil(() => msg_model.get('reactions')?.[`${muc_jid}/juliet`]?.includes('👍'));
                expect(msg_model.get('reactions')[`${muc_jid}/juliet`]).toContain('👍');
                await u.waitUntil(() => getReactionEmojis(view).includes('👍'));
                expect(getReactionEmojis(view)).toEqual(['👍']);

                // Receive a reaction from mercutio (👍 and 🎉)
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
                    </message>`,
                );

                await u.waitUntil(() => msg_model.get('reactions')?.[`${muc_jid}/mercutio`]?.includes('🎉'));
                const reactions = msg_model.get('reactions');
                expect(reactions[`${muc_jid}/juliet`]).toContain('👍');
                expect(reactions[`${muc_jid}/mercutio`]).toContain('👍');
                expect(reactions[`${muc_jid}/mercutio`]).toContain('🎉');

                // DOM: 👍 has count 2 (both users), 🎉 has count 1 (mercutio only)
                await u.waitUntil(() => getReactionEmojis(view).includes('🎉'));
                expect(getReactionEmojis(view)).toContain('👍');
                expect(getReactionEmojis(view)).toContain('🎉');
                expect(getReactionEmojis(view).length).toBe(2);
                const counts = getReactionCounts(view);
                expect(counts['👍']).toBe(2);
                expect(counts['🎉']).toBe(1);
            }),
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
                    </message>`,
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
                    </message>`,
                );

                await u.waitUntil(() => msg_model.get('reactions')?.[`${muc_jid}/juliet`]?.includes('👍'));
                expect(msg_model.get('reactions')[`${muc_jid}/juliet`]).toContain('👍');
                await u.waitUntil(() => getReactionEmojis(view).includes('👍'));
                expect(getReactionEmojis(view)).toEqual(['👍']);

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
                    </message>`,
                );

                await u.waitUntil(() => msg_model.get('reactions')?.[`${muc_jid}/mercutio`]?.includes('❤️'));
                expect(msg_model.get('reactions')[`${muc_jid}/mercutio`]).toContain('❤️');
                await u.waitUntil(() => getReactionEmojis(view).includes('❤️'));
                expect(getReactionEmojis(view)).toContain('👍');
                expect(getReactionEmojis(view)).toContain('❤️');

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
                    </message>`,
                );

                await u.waitUntil(() => msg_model.get('reactions')?.[`${muc_jid}/juliet`]?.includes('🎉'));
                expect(msg_model.get('reactions')[`${muc_jid}/juliet`]).toContain('🎉');
                expect(msg_model.get('reactions')[`${muc_jid}/juliet`]).not.toContain('👍');
                expect(msg_model.get('reactions')[`${muc_jid}/mercutio`]).toContain('❤️');

                // DOM: Juliet's 👍 is gone, replaced by 🎉; Mercutio's ❤️ is preserved
                await u.waitUntil(() => !getReactionEmojis(view).includes('👍'));
                expect(getReactionEmojis(view)).toContain('🎉');
                expect(getReactionEmojis(view)).toContain('❤️');
                expect(getReactionEmojis(view)).not.toContain('👍');
                expect(getReactionEmojis(view).length).toBe(2);
            }),
        );

        it(
            "removes only the retracting participant's reactions when an empty reaction stanza is received in a MUC",
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
                                id="muc-retract-msg">
                        <body>React to this</body>
                        <stanza-id xmlns="urn:xmpp:sid:0" id="muc-retract-stanza" by="${muc_jid}"/>
                    </message>`,
                );
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({ 'msgid': 'muc-retract-msg' });

                // Juliet reacts with 👍
                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/juliet"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="muc-retract-react-1">
                        <reactions xmlns="urn:xmpp:reactions:0" id="muc-retract-msg">
                            <reaction>👍</reaction>
                        </reactions>
                    </message>`,
                );

                // Mercutio reacts with ❤️
                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/mercutio"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="muc-retract-react-2">
                        <reactions xmlns="urn:xmpp:reactions:0" id="muc-retract-msg">
                            <reaction>❤️</reaction>
                        </reactions>
                    </message>`,
                );

                await u.waitUntil(() => getReactionCounts(view)['👍'] === 1 && getReactionCounts(view)['❤️'] === 1);
                expect(msg_model.get('reactions')[`${muc_jid}/juliet`]).toEqual(['👍']);
                expect(msg_model.get('reactions')[`${muc_jid}/mercutio`]).toEqual(['❤️']);

                // Juliet sends an empty <reactions/> to retract her reaction
                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/juliet"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="muc-retract-react-3">
                        <reactions xmlns="urn:xmpp:reactions:0" id="muc-retract-msg"/>
                    </message>`,
                );

                // Juliet's reaction is removed; Mercutio's is untouched
                await u.waitUntil(() => !msg_model.get('reactions')?.[`${muc_jid}/juliet`]?.length);
                expect(msg_model.get('reactions')[`${muc_jid}/juliet`]).toBeFalsy();
                expect(msg_model.get('reactions')[`${muc_jid}/mercutio`]).toEqual(['❤️']);

                // UI: only ❤️ remains
                await u.waitUntil(() => !getReactionEmojis(view).includes('👍'));
                expect(getReactionEmojis(view)).toEqual(['❤️']);
            }),
        );

        it(
            'clicking your own reaction button removes it in a MUC',
            mock.initConverse(['chatBoxesFetched'], { popular_reactions }, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 0);

                const muc_jid = 'lounge@montague.lit';
                await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
                const view = _converse.chatboxviews.get(muc_jid);

                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/juliet"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="muc-remove-own-msg">
                        <body>Remove my MUC reaction</body>
                        <stanza-id xmlns="urn:xmpp:sid:0" id="muc-remove-own-stanza" by="${muc_jid}"/>
                    </message>`,
                );
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                const msg_model = view.model.messages.findWhere({ 'msgid': 'muc-remove-own-msg' });

                // We add a reaction via the picker first
                await chooseReactionViaUI(view, 'muc-remove-own-msg', '🎉');
                const own_full_jid = `${muc_jid}/romeo`;
                await u.waitUntil(() => msg_model.get('reactions')?.[own_full_jid]?.includes('🎉'));
                await u.waitUntil(() => getReactionEmojis(view).includes('🎉'));

                // The button should have the 'reacted' class since it's our own reaction
                const btn = await u.waitUntil(() =>
                    view.querySelector('converse-reactions .chat-msg__reaction.reacted'),
                );
                expect(btn).not.toBeNull();
                expect(btn.classList.contains('reacted')).toBeTrue();

                // Click the rendered reaction button to remove it
                spyOn(api.connection.get(), 'send').and.callThrough();
                btn.click();

                await u.waitUntil(() => !msg_model.get('reactions')?.[own_full_jid]?.includes('🎉'));
                await u.waitUntil(() => getReactionEmojis(view).length === 0);
                expect(getReactionEmojis(view)).toEqual([]);

                // Should have sent an empty reactions stanza to the MUC
                const sent_stanza = api.connection
                    .get()
                    .send.calls.all()
                    .map((c) => (c.args[0] instanceof Element ? c.args[0] : c.args[0].tree()))
                    .find((el) => el.querySelector?.('reactions'));
                expect(sent_stanza).toEqualStanza(stx`
                    <message xmlns="jabber:client"
                             to="${muc_jid}"
                             type="groupchat"
                             id="${sent_stanza.getAttribute('id')}">
                        <reactions xmlns="urn:xmpp:reactions:0" id="muc-remove-own-msg"></reactions>
                    </message>
                `);
            }),
        );
    });

    fdescribe('restricted reactions', function () {
        it(
            'sets allowed_reactions on the chatbox when a disco#info result with restricted reactions is received',
            mock.initConverse(['chatBoxesFetched'], { popular_reactions }, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const muc_jid = 'lounge@montague.lit';
                await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
                const view = _converse.chatboxviews.get(muc_jid);

                expect(view.model.get('allowed_reactions')).toBeUndefined();

                // Simulate a disco#info IQ result from the MUC announcing restricted reactions.
                // Per XEP-0444 §2.2, restrictions are advertised via a XEP-0128 data form.
                _converse.api.connection.get()._dataRecv(
                    mock.createRequest(
                        stx`<iq type="result"
                            from="${muc_jid}"
                            to="${_converse.bare_jid}"
                            id="disco-restricted-1"
                            xmlns="jabber:client">
                        <query xmlns="http://jabber.org/protocol/disco#info">
                            <feature var="urn:xmpp:reactions:0"/>
                            <x xmlns="jabber:x:data" type="result">
                                <field var="FORM_TYPE" type="hidden">
                                    <value>urn:xmpp:reactions:0:restrictions</value>
                                </field>
                                <field var="allowlist">
                                    <value>👍</value>
                                    <value>❤️</value>
                                </field>
                            </x>
                        </query>
                    </iq>`,
                    ),
                );

                await u.waitUntil(() => view.model.get('allowed_reactions') !== undefined);
                expect(view.model.get('allowed_reactions')).toEqual(['👍', '❤️']);
            }),
        );

        it(
            'filters the reaction picker to only show allowed emojis',
            mock.initConverse(['chatBoxesFetched'], { popular_reactions }, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);

                const muc_jid = 'lounge@montague.lit';
                await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
                const view = _converse.chatboxviews.get(muc_jid);

                // Receive a MUC message to react to
                await view.model.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${muc_jid}/juliet"
                                to="${_converse.bare_jid}"
                                type="groupchat"
                                id="restricted-picker-msg">
                        <body>Restricted reactions test</body>
                        <stanza-id xmlns="urn:xmpp:sid:0" id="restricted-picker-stanza" by="${muc_jid}"/>
                    </message>`,
                );
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

                // Set allowed_reactions before opening the picker so that the picker
                // renders with the filtered list from the start.
                // popular_reactions has 5 entries; only 👍 and 🎉 are allowed.
                _converse.api.connection.get()._dataRecv(
                    mock.createRequest(
                        stx`<iq type="result"
                            from="${muc_jid}"
                            to="${_converse.bare_jid}"
                            id="disco-restricted-2"
                            xmlns="jabber:client">
                        <query xmlns="http://jabber.org/protocol/disco#info">
                            <feature var="urn:xmpp:reactions:0"/>
                            <x xmlns="jabber:x:data" type="result">
                                <field var="FORM_TYPE" type="hidden">
                                    <value>urn:xmpp:reactions:0:restrictions</value>
                                </field>
                                <field var="allowlist">
                                    <value>👍</value>
                                    <value>🎉</value>
                                </field>
                            </x>
                        </query>
                    </iq>`,
                    ),
                );
                await u.waitUntil(() => view.model.get('allowed_reactions') !== undefined);
                expect(view.model.get('allowed_reactions')).toEqual(['👍', '🎉']);

                // Open the reaction picker
                const msg_el = await u.waitUntil(() =>
                    view.querySelector('.chat-msg[data-msgid="restricted-picker-msg"]'),
                );
                const toggle_el = await u.waitUntil(() =>
                    msg_el.querySelector('converse-message-actions converse-dropdown .dropdown-toggle'),
                );
                toggle_el.click();
                const action_el = await u.waitUntil(() => msg_el.querySelector('.chat-msg__action-reaction'));
                action_el.click();
                // Wait for the picker to open and render its buttons
                const picker_el = await u.waitUntil(() => {
                    const el = msg_el.querySelector('converse-reaction-picker');
                    return el?.querySelectorAll('.reaction-item:not(.more)').length > 0 ? el : null;
                });

                const rendered_emojis = Array.from(picker_el.querySelectorAll('.reaction-item:not(.more)')).map((btn) =>
                    btn.textContent.trim(),
                );

                // Only the two allowed emojis should appear, not the full popular list
                expect(rendered_emojis).toEqual(['👍', '🎉']);
                expect(rendered_emojis.length).toBe(2);
            }),
        );

        it(
            'sets allowed_reactions on the chatbox and filters the picker in a 1:1 chat',
            mock.initConverse(['chatBoxesFetched'], { popular_reactions }, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                // The disco#info comes from a specific resource of the contact
                const contact_full_jid = `${contact_jid}/phone`;
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                expect(view.model.get('allowed_reactions')).toBeUndefined();

                // Per XEP-0444 §2.2 Example 3, a contact's client can advertise
                // restricted reactions in their disco#info result.
                _converse.api.connection.get()._dataRecv(
                    mock.createRequest(
                        stx`<iq type="result"
                                from="${contact_full_jid}"
                                to="${_converse.jid}"
                                id="disco-restricted-1:1"
                                xmlns="jabber:client">
                            <query xmlns="http://jabber.org/protocol/disco#info">
                                <feature var="urn:xmpp:reactions:0"/>
                                <x xmlns="jabber:x:data" type="result">
                                    <field var="FORM_TYPE" type="hidden">
                                        <value>urn:xmpp:reactions:0:restrictions</value>
                                    </field>
                                    <field var="allowlist">
                                        <value>👍</value>
                                        <value>🎉</value>
                                    </field>
                                </x>
                            </query>
                        </iq>`,
                    ),
                );

                // The handler matches on the bare JID, so the chatbox for contact_jid gets updated
                await u.waitUntil(() => view.model.get('allowed_reactions') !== undefined);
                expect(view.model.get('allowed_reactions')).toEqual(['👍', '🎉']);

                // Receive a message to open the picker on
                await _converse.handleMessageStanza(
                    stx`<message xmlns="jabber:client"
                                from="${contact_jid}"
                                to="${_converse.jid}"
                                type="chat"
                                id="restricted-1:1-msg">
                        <body>React to this</body>
                    </message>`,
                );
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

                // Open the reaction picker and verify only allowed emojis are shown
                const msg_el = await u.waitUntil(() =>
                    view.querySelector('.chat-msg[data-msgid="restricted-1:1-msg"]'),
                );
                const toggle_el = await u.waitUntil(() =>
                    msg_el.querySelector('converse-message-actions converse-dropdown .dropdown-toggle'),
                );
                toggle_el.click();
                const action_el = await u.waitUntil(() => msg_el.querySelector('.chat-msg__action-reaction'));
                action_el.click();
                const picker_el = await u.waitUntil(() => {
                    const el = msg_el.querySelector('converse-reaction-picker');
                    return el?.querySelectorAll('.reaction-item:not(.more)').length > 0 ? el : null;
                });

                const rendered_emojis = Array.from(picker_el.querySelectorAll('.reaction-item:not(.more)')).map((btn) =>
                    btn.textContent.trim(),
                );
                expect(rendered_emojis).toEqual(['👍', '🎉']);
                expect(rendered_emojis.length).toBe(2);
            }),
        );
    });
});

/**
 * Returns the emojis currently rendered in converse-reactions for the given view.
 * Reads the emoji by subtracting the count span's text rather than stripping
 * digits globally, so digit-containing emoji (e.g. keycaps) are not mangled.
 * @param {Element} view
 * @returns {string[]}
 */
const getReactionEmojis = (view) =>
    Array.from(view.querySelectorAll('converse-reactions .chat-msg__reaction')).map((r) => {
        const count_el = r.querySelector('.count');
        const count_text = count_el?.textContent ?? '';
        return r.textContent.replace(count_text, '').trim();
    });

/**
 * Returns the reactor counts for each emoji currently rendered in
 * converse-reactions for the given view, as a map of emoji → count.
 * @param {Element} view
 * @returns {Record<string, number>}
 */
const getReactionCounts = (view) => {
    const result = {};
    for (const r of view.querySelectorAll('converse-reactions .chat-msg__reaction')) {
        const count_el = r.querySelector('.count');
        const count_text = count_el?.textContent ?? '';
        const emoji = r.textContent.replace(count_text, '').trim();
        result[emoji] = parseInt(count_el?.textContent ?? '1', 10);
    }
    return result;
};

const chooseReactionViaUI = async (view, msgid, emoji) => {
    const msg_el = await u.waitUntil(() => view.querySelector(`.chat-msg[data-msgid="${msgid}"]`));
    const dropdown_el = await u.waitUntil(() => msg_el?.querySelector('converse-message-actions converse-dropdown'));
    const toggle_el = await u.waitUntil(() => dropdown_el?.querySelector('.dropdown-toggle'));
    toggle_el.click();

    const action_el = await u.waitUntil(() => dropdown_el?.querySelector('.chat-msg__action-reaction'));
    action_el.click();

    const picker_el = await u.waitUntil(() => msg_el.querySelector('converse-reaction-picker'));
    const emoji_btn = Array.from(picker_el.querySelectorAll('.reaction-item')).find(
        (el) => el.textContent.trim() === emoji,
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
            (el) => el.textContent.trim() === emoji,
        ),
    );
    expect(emoji_link).toBeTruthy();
    emoji_link.click();
};
