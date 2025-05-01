const { stx, u } = converse.env;

fdescribe('An unsaved Contact', function () {
    it(
        'is shown upon receiving a message',
        mock.initConverse([], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitUntilBlocklistInitialized(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.openControlBox(_converse);

            const sender_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const msg = stx`
                <message xmlns='jabber:client'
                        id='${api.connection.get().getUniqueId()}'
                        to='${_converse.bare_jid}'
                        from='${sender_jid}'
                        type='chat'>
                    <body>Hello</body>
                </message>`;
            await _converse.handleMessageStanza(msg);

            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => rosterview.querySelectorAll(`ul[data-group="Unsaved contacts"] li`).length);
            expect(rosterview.querySelectorAll(`ul[data-group="Unsaved contacts"] li`).length).toBe(1);
            const el = rosterview.querySelector(`ul[data-group="Unsaved contacts"] li .contact-name`);
            expect(el.textContent).toBe('Mercutio');
        })
    );

    it(
        'is shown upon receiving a message to a previously removed contact',
        mock.initConverse([], { lazy_load_vcards: false }, async function (_converse) {
            const { api } = _converse;
            await mock.waitUntilBlocklistInitialized(_converse);
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);

            const sender_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            let msg = stx`
                <message xmlns='jabber:client'
                        id='${api.connection.get().getUniqueId()}'
                        to='${_converse.bare_jid}'
                        from='${sender_jid}'
                        type='chat'>
                    <body>Hello</body>
                </message>`;
            await _converse.handleMessageStanza(msg);

            spyOn(_converse.api, 'confirm').and.returnValue(Promise.resolve(true));

            const rosterview = document.querySelector('converse-roster');
            rosterview.querySelector(`.remove-xmpp-contact`).click();
            expect(_converse.api.confirm).toHaveBeenCalled();

            msg = stx`
                <message xmlns='jabber:client'
                        id='${api.connection.get().getUniqueId()}'
                        to='${_converse.bare_jid}'
                        from='${sender_jid}'
                        type='chat'>
                    <body>Why did you remove me?</body>
                </message>`;
            await _converse.handleMessageStanza(msg);

            await u.waitUntil(() => rosterview.querySelectorAll(`ul[data-group="Unsaved contacts"] li`).length);
            expect(rosterview.querySelectorAll(`ul[data-group="Unsaved contacts"] li`).length).toBe(1);
            const el = rosterview.querySelector(`ul[data-group="Unsaved contacts"] li .contact-name`);
            expect(el.textContent).toBe('Mercutio');
        })
    );

    it(
        'is removed again when the chat is closed',
        mock.initConverse([], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitUntilBlocklistInitialized(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.openControlBox(_converse);

            const sender_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const msg = stx`
                <message xmlns='jabber:client'
                        id='${api.connection.get().getUniqueId()}'
                        to='${_converse.bare_jid}'
                        from='${sender_jid}'
                        type='chat'>
                    <body>Hello</body>
                </message>`;
            await _converse.handleMessageStanza(msg);

            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => rosterview.querySelectorAll(`ul[data-group="Unsaved contacts"] li`).length);
            expect(rosterview.querySelectorAll(`ul[data-group="Unsaved contacts"] li`).length).toBe(1);
            const el = rosterview.querySelector(`ul[data-group="Unsaved contacts"] li .contact-name`);
            expect(el.textContent).toBe('Mercutio');

            const chat = await api.chats.get(sender_jid);
            chat.close();
            await u.waitUntil(() => rosterview.querySelectorAll(`ul[data-group="Unsaved contacts"] li`).length === 0);
        })
    );
});
