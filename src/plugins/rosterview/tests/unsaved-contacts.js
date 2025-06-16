const { stx, u, sizzle } = converse.env;

describe('An unsaved Contact', function () {
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
            await u.waitUntil(
                () => rosterview.querySelectorAll(`ul[data-group="Unsaved contacts"] li .open-chat`).length
            );
            expect(rosterview.querySelectorAll(`ul[data-group="Unsaved contacts"] li .open-chat`).length).toBe(1);
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

            await u.waitUntil(
                () => rosterview.querySelectorAll(`ul[data-group="Unsaved contacts"] li .open-chat`).length
            );
            expect(rosterview.querySelectorAll(`ul[data-group="Unsaved contacts"] li .open-chat`).length).toBe(1);
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
            await u.waitUntil(
                () => rosterview.querySelectorAll(`ul[data-group="Unsaved contacts"] li .open-chat`).length
            );
            expect(rosterview.querySelectorAll(`ul[data-group="Unsaved contacts"] li .open-chat`).length).toBe(1);
            const el = rosterview.querySelector(`ul[data-group="Unsaved contacts"] li .contact-name`);
            expect(el.textContent).toBe('Mercutio');

            const chat = await api.chats.get(sender_jid);
            chat.close();
            await u.waitUntil(() => rosterview.querySelectorAll(`ul[data-group="Unsaved contacts"] li`).length === 0);
        })
    );
});

describe('A chat with an unsaved contact', function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it(
        'shows an unsaved contact alert when chatting with an unsaved contact',
        mock.initConverse([], { lazy_load_vcards: false }, async function (_converse) {
            const { api } = _converse;
            await mock.waitUntilBlocklistInitialized(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.openControlBox(_converse);

            const sender_jid = mock.cur_jids[0];
            const msg = stx`
                <message xmlns='jabber:client'
                        id='${api.connection.get().getUniqueId()}'
                        to='${_converse.bare_jid}'
                        from='${sender_jid}'
                        type='chat'>
                    <body>Hello</body>
                </message>`;
            await _converse.exports.handleMessageStanza(msg);

            const view = await mock.openChatBoxFor(_converse, sender_jid);
            await u.waitUntil(() => view.querySelector('converse-contact-approval-alert'));

            const alert = view.querySelector('converse-contact-approval-alert');
            expect(alert).toBeTruthy();
            expect(alert.textContent).toContain('Would you like to add Mercutio as a contact?');
            expect(alert.querySelector('.btn-success')).toBeTruthy();
            expect(alert.querySelector('.btn-danger')).toBeTruthy();
        })
    );

    it(
        'can add an unsaved contact via the alert',
        mock.initConverse([], { lazy_load_vcards: false }, async function (_converse) {
            const { api } = _converse;
            await mock.waitUntilBlocklistInitialized(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.openControlBox(_converse);

            const sender_jid = mock.cur_jids[0];
            const msg = stx`
                <message xmlns='jabber:client'
                        id='${api.connection.get().getUniqueId()}'
                        to='${_converse.bare_jid}'
                        from='${sender_jid}'
                        type='chat'>
                    <body>Hello</body>
                </message>`;
            await _converse.handleMessageStanza(msg);

            const view = await mock.openChatBoxFor(_converse, sender_jid);
            await u.waitUntil(() => view.querySelector('converse-contact-approval-alert'));

            const contact = _converse.roster.get(sender_jid);
            spyOn(contact, 'subscribe').and.callThrough();

            const alert = view.querySelector('converse-contact-approval-alert');
            alert.querySelector('.btn-success').click();

            const modal = api.modal.get('converse-add-contact-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000);

            // Submit the add contact modal
            const sent_stanzas = api.connection.get().sent_stanzas;
            while (sent_stanzas.length) sent_stanzas.pop();
            modal.querySelector('button[type="submit"]').click();

            const sent_stanza = await u.waitUntil(() =>
                sent_stanzas
                    .filter((iq) => sizzle(`iq[type="set"] query[xmlns="${Strophe.NS.ROSTER}"]`, iq).length)
                    .pop()
            );
            expect(sent_stanza).toEqualStanza(stx`
                <iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">
                    <query xmlns="jabber:iq:roster">
                        <item jid="${sender_jid}"></item>
                    </query>
                </iq>`);
        })
    );

    it(
        'can dismiss the unsaved contact alert',
        mock.initConverse([], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitUntilBlocklistInitialized(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.openControlBox(_converse);

            const sender_jid = mock.cur_jids[0];
            const msg = stx`
                <message xmlns='jabber:client'
                        id='${api.connection.get().getUniqueId()}'
                        to='${_converse.bare_jid}'
                        from='${sender_jid}'
                        type='chat'>
                    <body>Hello</body>
                </message>`;
            await _converse.handleMessageStanza(msg);

            const view = await mock.openChatBoxFor(_converse, sender_jid);
            const alert = await u.waitUntil(() => view.querySelector('converse-contact-approval-alert'));

            const contact = _converse.roster.get(sender_jid);
            spyOn(contact, 'save').and.callThrough();

            alert.querySelector('.btn-danger').click();

            await u.waitUntil(() => contact.save.calls.count());
            expect(contact.save).toHaveBeenCalledWith({ hide_contact_add_alert: true });
            await u.waitUntil(() => !view.querySelector('converse-contact-approval-alert').childElementCound);
        })
    );
});
