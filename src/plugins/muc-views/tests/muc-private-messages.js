/*global mock, converse */
const { stx, u } = converse.env;

describe('MUC Private Messages', () => {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it(
        'cannot be sent when the intended recipient is not in the MUC',
        mock.initConverse(['chatBoxesFetched'], { view_mode: 'fullscreen' }, async (_converse) => {
            await mock.waitForRoster(_converse, 'current', 0);
            const nick = 'romeo';
            const muc_jid = 'coven@chat.shakespeare.lit';

            const members = [
                {
                    nick: 'firstwitch',
                    jid: 'witch@wiccarocks.lit',
                    affiliation: 'member',
                },
            ];
            await mock.openAndEnterChatRoom(_converse, muc_jid, nick, [], members);

            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.model.occupants.length === 2);

            const avatar_el = await u.waitUntil(() =>
                view.querySelector('.occupant-list converse-avatar[name="firstwitch"]')
            );
            avatar_el.click();
        })
    );

    describe('When receiving a MUC private message', () => {
        it(
            "doesn't appear in the main MUC chatarea",
            mock.initConverse(['chatBoxesFetched'], { view_mode: 'fullscreen' }, async (_converse) => {
                const nick = 'romeo';
                const muc_jid = 'coven@chat.shakespeare.lit';
                await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
                const view = _converse.chatboxviews.get(muc_jid);

                _converse.api.connection.get()._dataRecv(
                    mock.createRequest(stx`
                        <presence
                            from="${muc_jid}/firstwitch"
                            id="${u.getUniqueId()}"
                            to="${_converse.jid}"
                            xmlns="jabber:client">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="owner" role="moderator"/>
                        </x>
                        </presence>`)
                );
                await u.waitUntil(() => view.model.occupants.length === 2);

                _converse.api.connection.get()._dataRecv(
                    mock.createRequest(stx`
                        <message from="${muc_jid}/firstwitch"
                                id="${u.getUniqueId()}"
                                to="${_converse.jid}"
                                type="chat"
                                xmlns="jabber:client">
                            <body>I'll give thee a wind.</body>
                            <x xmlns="http://jabber.org/protocol/muc#user" />
                        </message>
                    `)
                );

                _converse.api.connection.get()._dataRecv(
                    mock.createRequest(stx`
                        <message from="coven@chat.shakespeare.lit/thirdwitch"
                                id="${u.getUniqueId()}"
                                to="${_converse.jid}"
                                type="groupchat"
                                xmlns="jabber:client">
                            <body>Harpier cries: "tis time, "tis time.</body>
                        </message>
                    `)
                );

                await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);

                expect(view.model.messages.length).toBe(1);
                expect(view.model.messages.pop().get('message')).toBe('Harpier cries: "tis time, "tis time.');

                const occupant = view.model.occupants.findOccupant({ nick: 'firstwitch' });
                expect(occupant.get('num_unread')).toBe(1);
                expect(occupant.messages.length).toBe(1);
                expect(occupant.messages.pop().get('message')).toBe("I'll give thee a wind.");
            })
        );
    });

    describe('When sending a MUC private message', () => {
        it(
            'sends out the correct stanza',
            mock.initConverse(['chatBoxesFetched'], { view_mode: 'fullscreen' }, async (_converse) => {
                const { api } = _converse;
                const nick = 'romeo';
                const muc_jid = 'coven@chat.shakespeare.lit';
                await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
                const view = _converse.chatboxviews.get(muc_jid);

                _converse.api.connection.get()._dataRecv(
                    mock.createRequest(stx`
                            <presence
                                from="${muc_jid}/firstwitch"
                                id="${u.getUniqueId()}"
                                to="${_converse.jid}"
                                xmlns="jabber:client">
                            <x xmlns="http://jabber.org/protocol/muc#user">
                                <item affiliation="owner" role="moderator"/>
                            </x>
                            </presence>`)
                );
                await u.waitUntil(() => view.querySelectorAll('.occupant-list converse-avatar').length === 2);

                // Open the occupant view in the sidebar
                view.querySelector('.occupant-list converse-avatar[name="firstwitch"]').click();

                const textarea = await u.waitUntil(() => view.querySelector('converse-muc-occupant textarea'));
                textarea.value = 'hello';

                const button = view.querySelector('converse-muc-occupant .send-button');
                button.click();

                await u.waitUntil(
                    () => api.connection.get().sent_stanzas.filter((s) => s.nodeName === 'message').length
                );

                const sent_stanza = api.connection.get().sent_stanzas.pop();
                expect(sent_stanza).toEqualStanza(stx`
                        <message from="${muc_jid}/${nick}"
                                to="${muc_jid}/firstwitch"
                                id="${sent_stanza.getAttribute('id')}"
                                xmlns="jabber:client">
                            <body>hello</body>
                            <active xmlns="http://jabber.org/protocol/chatstates"/>
                            <request xmlns="urn:xmpp:receipts"/>
                            <origin-id xmlns="urn:xmpp:sid:0" id="${sent_stanza.querySelector('origin-id')?.getAttribute('id')}"/>
                        </message>`);
            })
        );

        it(
            'correctly shows the senders avatar',
            mock.initConverse(['chatBoxesFetched'], { view_mode: 'fullscreen' }, async (_converse) => {
                const { api } = _converse;
                const nick = 'romeo';
                const muc_jid = 'coven@chat.shakespeare.lit';
                await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
                const view = _converse.chatboxviews.get(muc_jid);

                _converse.api.connection.get()._dataRecv(
                    mock.createRequest(stx`
                            <presence
                                from="${muc_jid}/firstwitch"
                                id="${u.getUniqueId()}"
                                to="${_converse.jid}"
                                xmlns="jabber:client">
                            <x xmlns="http://jabber.org/protocol/muc#user">
                                <item affiliation="owner" role="moderator"/>
                            </x>
                            </presence>`)
                );
                await u.waitUntil(() => view.querySelectorAll('.occupant-list converse-avatar').length === 2);

                // Open the occupant view in the sidebar
                view.querySelector('.occupant-list converse-avatar[name="firstwitch"]').click();

                const occupant = view.model.getOccupant('firstwitch');
                occupant.sendMessage({ body: 'hello world' });

                await u.waitUntil(
                    () => api.connection.get().sent_stanzas.filter((s) => s.nodeName === 'message').length
                );

                const avatar = view.querySelector('converse-muc-occupant converse-chat-message converse-avatar');
                expect(avatar).toBeDefined();
                expect(avatar.getAttribute('name')).toBe('romeo');
                expect(avatar.model).toBe(view.model.getOccupant('romeo'));
            })
        );

        describe('And an error is returned', () => {
            it(
                'is correctly shown with the sent message',
                mock.initConverse(['chatBoxesFetched'], { view_mode: 'fullscreen' }, async (_converse) => {
                    const { api } = _converse;
                    const nick = 'romeo';
                    const muc_jid = 'coven@chat.shakespeare.lit';
                    await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
                    const view = _converse.chatboxviews.get(muc_jid);

                    _converse.api.connection.get()._dataRecv(
                        mock.createRequest(stx`
                            <presence
                                from="${muc_jid}/firstwitch"
                                id="${u.getUniqueId()}"
                                to="${_converse.jid}"
                                xmlns="jabber:client">
                            <x xmlns="http://jabber.org/protocol/muc#user">
                                <item affiliation="owner" role="moderator"/>
                            </x>
                            </presence>`)
                    );
                    await u.waitUntil(() => view.querySelectorAll('.occupant-list converse-avatar').length === 2);

                    // Open the occupant view in the sidebar
                    view.querySelector('.occupant-list converse-avatar[name="firstwitch"]').click();

                    const occupant = view.model.getOccupant('firstwitch');
                    occupant.sendMessage({ body: 'hello world' });

                    await u.waitUntil(
                        () => api.connection.get().sent_stanzas.filter((s) => s.nodeName === 'message').length
                    );
                    const sent_stanza = api.connection.get().sent_stanzas.pop();

                    const err_msg_text = 'Recipient not in room';
                    api.connection.get()._dataRecv(
                        mock.createRequest(stx`
                        <message xmlns="jabber:client"
                            id="${sent_stanza.getAttribute('id')}"
                            to="${_converse.session.get('jid')}"
                            type="error"
                            from="${muc_jid}/firstwitch">

                            <error type="cancel" by="${muc_jid}">
                                <item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                                <text xmlns="urn:ietf:params:xml:ns:xmpp-stanzas">${err_msg_text}</text>
                            </error>
                        </message>`)
                    );

                    expect(await u.waitUntil(() => view.querySelector('.chat-msg__error')?.textContent?.trim())).toBe(
                        `Message delivery failed.\n${err_msg_text}`
                    );
                })
            );
        });
    });
});
