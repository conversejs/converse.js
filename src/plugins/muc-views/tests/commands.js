/*global mock, converse */

const { Strophe, Promise, sizzle, stx, u }  = converse.env;

describe("Groupchats", function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    describe("Each chat groupchat can take special commands", function () {

        it("takes /help to show the available commands",
                mock.initConverse([], {}, async function (_converse) {

            spyOn(window, 'confirm').and.callFake(() => true);
            await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            const enter = { 'target': textarea, 'preventDefault': function preventDefault () {}, key: "Enter" };
            textarea.value = '/help';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown(enter);

            await u.waitUntil(() => sizzle('converse-chat-help .chat-info', view).length);
            let chat_help_el = view.querySelector('converse-chat-help');
            let info_messages = sizzle('.chat-info', chat_help_el);
            expect(info_messages.length).toBe(19);
            expect(info_messages.pop().textContent.trim()).toBe('/voice: Allow muted user to post messages');
            expect(info_messages.pop().textContent.trim()).toBe('/topic: Set groupchat subject (alias for /subject)');
            expect(info_messages.pop().textContent.trim()).toBe('/subject: Set groupchat subject');
            expect(info_messages.pop().textContent.trim()).toBe('/revoke: Revoke the user\'s current affiliation');
            expect(info_messages.pop().textContent.trim()).toBe('/register: Register your nickname');
            expect(info_messages.pop().textContent.trim()).toBe('/owner: Grant ownership of this groupchat');
            expect(info_messages.pop().textContent.trim()).toBe('/op: Grant moderator role to user');
            expect(info_messages.pop().textContent.trim()).toBe('/nick: Change your nickname');
            expect(info_messages.pop().textContent.trim()).toBe('/mute: Remove user\'s ability to post messages');
            expect(info_messages.pop().textContent.trim()).toBe('/modtools: Opens up the moderator tools GUI');
            expect(info_messages.pop().textContent.trim()).toBe('/member: Grant membership to a user');
            expect(info_messages.pop().textContent.trim()).toBe('/me: Write in 3rd person');
            expect(info_messages.pop().textContent.trim()).toBe('/kick: Kick user from groupchat');
            expect(info_messages.pop().textContent.trim()).toBe('/help: Show this menu');
            expect(info_messages.pop().textContent.trim()).toBe('/destroy: Remove this groupchat');
            expect(info_messages.pop().textContent.trim()).toBe('/deop: Change user role to participant');
            expect(info_messages.pop().textContent.trim()).toBe('/clear: Clear the chat area');
            expect(info_messages.pop().textContent.trim()).toBe('/ban: Ban user by changing their affiliation to outcast');
            expect(info_messages.pop().textContent.trim()).toBe('/admin: Change user\'s affiliation to admin');

            const occupant = view.model.occupants.findWhere({'jid': _converse.bare_jid});
            occupant.set('affiliation', 'admin');

            view.querySelector('.close-chat-help').click();
            expect(view.model.get('show_help_messages')).toBe(false);
            await u.waitUntil(() => view.querySelector('converse-chat-help') === null);

            textarea.value = '/help';
            message_form.onKeyDown(enter);
            chat_help_el = await u.waitUntil(() => view.querySelector('converse-chat-help'));
            info_messages = sizzle('.chat-info', chat_help_el);
            expect(info_messages.length).toBe(18);
            let commands = info_messages.map(m => m.textContent.replace(/:.*$/, ''));
            expect(commands).toEqual([
                "/admin", "/ban", "/clear", "/deop", "/destroy",
                "/help", "/kick", "/me", "/member", "/modtools", "/mute", "/nick",
                "/op", "/register", "/revoke", "/subject", "/topic", "/voice"
            ]);
            occupant.set('affiliation', 'member');
            view.querySelector('.close-chat-help').click();
            await u.waitUntil(() => view.querySelector('converse-chat-help') === null);

            textarea.value = '/help';
            message_form.onKeyDown(enter);
            chat_help_el = await u.waitUntil(() => view.querySelector('converse-chat-help'));
            info_messages = sizzle('.chat-info', chat_help_el);
            expect(info_messages.length).toBe(9);
            commands = info_messages.map(m => m.textContent.replace(/:.*$/, ''));
            expect(commands).toEqual(["/clear", "/help", "/kick", "/me", "/modtools", "/mute", "/nick", "/register", "/voice"]);

            view.querySelector('.close-chat-help').click();
            await u.waitUntil(() => view.querySelector('converse-chat-help') === null);
            expect(view.model.get('show_help_messages')).toBe(false);

            occupant.set('role', 'participant');
            // Role changes causes rerender, so we need to get the new textarea

            textarea.value = '/help';
            message_form.onKeyDown(enter);
            await u.waitUntil(() => view.model.get('show_help_messages'));
            chat_help_el = await u.waitUntil(() => view.querySelector('converse-chat-help'));
            info_messages = sizzle('.chat-info', chat_help_el);
            expect(info_messages.length).toBe(5);
            commands = info_messages.map(m => m.textContent.replace(/:.*$/, ''));
            expect(commands).toEqual(["/clear", "/help", "/me", "/nick", "/register"]);

            // Test that /topic is available if all users may change the subject
            // Note: we're making a shortcut here, this value should never be set manually
            view.model.config.set('changesubject', true);
            view.querySelector('.close-chat-help').click();
            await u.waitUntil(() => view.querySelector('converse-chat-help') === null);

            textarea.value = '/help';
            message_form.onKeyDown(enter);
            chat_help_el = await u.waitUntil(() => view.querySelector('converse-chat-help'));
            info_messages = sizzle('.chat-info', chat_help_el);
            expect(info_messages.length).toBe(7);
            commands = info_messages.map(m => m.textContent.replace(/:.*$/, ''));
            expect(commands).toEqual(["/clear", "/help", "/me", "/nick", "/register", "/subject", "/topic"]);
        }));

        it("takes /help to show the available commands and commands can be disabled by config",
                mock.initConverse([], {muc_disable_slash_commands: ['mute', 'voice']}, async function (_converse) {

            await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            const enter = { 'target': textarea, 'preventDefault': function () {}, key: "Enter" };
            spyOn(window, 'confirm').and.callFake(() => true);
            textarea.value = '/clear';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown(enter);
            textarea.value = '/help';
            message_form.onKeyDown(enter);

            await u.waitUntil(() => sizzle('.chat-info:not(.chat-event)', view).length);
            const info_messages = sizzle('.chat-info:not(.chat-event)', view);
            expect(info_messages.length).toBe(17);
            expect(info_messages.pop().textContent.trim()).toBe('/topic: Set groupchat subject (alias for /subject)');
            expect(info_messages.pop().textContent.trim()).toBe('/subject: Set groupchat subject');
            expect(info_messages.pop().textContent.trim()).toBe('/revoke: Revoke the user\'s current affiliation');
            expect(info_messages.pop().textContent.trim()).toBe('/register: Register your nickname');
            expect(info_messages.pop().textContent.trim()).toBe('/owner: Grant ownership of this groupchat');
            expect(info_messages.pop().textContent.trim()).toBe('/op: Grant moderator role to user');
            expect(info_messages.pop().textContent.trim()).toBe('/nick: Change your nickname');
            expect(info_messages.pop().textContent.trim()).toBe('/modtools: Opens up the moderator tools GUI');
            expect(info_messages.pop().textContent.trim()).toBe('/member: Grant membership to a user');
            expect(info_messages.pop().textContent.trim()).toBe('/me: Write in 3rd person');
            expect(info_messages.pop().textContent.trim()).toBe('/kick: Kick user from groupchat');
            expect(info_messages.pop().textContent.trim()).toBe('/help: Show this menu');
            expect(info_messages.pop().textContent.trim()).toBe('/destroy: Remove this groupchat');
            expect(info_messages.pop().textContent.trim()).toBe('/deop: Change user role to participant');
            expect(info_messages.pop().textContent.trim()).toBe('/clear: Clear the chat area');
            expect(info_messages.pop().textContent.trim()).toBe('/ban: Ban user by changing their affiliation to outcast');
            expect(info_messages.pop().textContent.trim()).toBe('/admin: Change user\'s affiliation to admin');
        }));

        it("takes /member to make an occupant a member",
                mock.initConverse([], {}, async function (_converse) {

            let iq_stanza;
            const nick = 'romeo';
            const muc_jid = 'lounge@muc.montague.lit';
            const muc = await mock.openAndEnterMUC(_converse, muc_jid, nick);

            /* We don't show join/leave messages for existing occupants. We
             * know about them because we receive their presences before we
             * receive our own.
             */
            _converse.api.connection.get()._dataRecv(mock.createRequest(
                stx`<presence
                        xmlns="jabber:client"
                        to="romeo@montague.lit/orchard"
                        from="lounge@muc.montague.lit/marc">
                    <x xmlns="${Strophe.NS.MUC_USER}">
                        <item affiliation="none" jid="marc@montague.lit/_converse.js-290929789" role="participant"/>
                    </x>
                </presence>`
            ));
            await u.waitUntil(() => muc.occupants.length === 2);

            const view = _converse.chatboxviews.get(muc_jid);
            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            let sent_stanza;
            spyOn(_converse.api.connection.get(), 'send').and.callFake((stanza) => {
                sent_stanza = stanza;
            });

            // First check that an error message appears when a
            // non-existent nick is used.
            textarea.value = '/member chris Welcome to the club!';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                key: "Enter",
            });
            expect(_converse.api.connection.get().send).not.toHaveBeenCalled();
            await u.waitUntil(() => view.querySelectorAll('.chat-error').length);
            expect(view.querySelector('.chat-error').textContent.trim())
                .toBe('Error: couldn\'t find a groupchat participant based on your arguments');

            // Now test with an existing nick
            textarea.value = '/member marc Welcome to the club!';
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                key: "Enter",
            });

            await u.waitUntil(() => sent_stanza?.querySelector('item[affiliation="member"]'));

            expect(sent_stanza).toEqualStanza(
                stx`<iq id="${sent_stanza.getAttribute('id')}" to="lounge@muc.montague.lit" type="set" xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/muc#admin">
                        <item affiliation="member" nick="marc" jid="marc@montague.lit">
                            <reason>Welcome to the club!</reason>
                        </item>
                    </query>
                </iq>`);

            let result = stx`<iq xmlns="jabber:client"
                    type="result"
                    to="romeo@montague.lit/orchard"
                    from="lounge@muc.montague.lit"
                    id="${sent_stanza.getAttribute('id')}"/>`;
            _converse.api.connection.get().IQ_stanzas = [];
            _converse.api.connection.get()._dataRecv(mock.createRequest(result));
            iq_stanza = await u.waitUntil(() => _converse.api.connection.get().IQ_stanzas.filter(
                iq => iq.querySelector('iq[to="lounge@muc.montague.lit"][type="get"] item[affiliation="member"]')).pop()
            );

            expect(Strophe.serialize(iq_stanza)).toBe(
                `<iq id="${iq_stanza.getAttribute('id')}" to="lounge@muc.montague.lit" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                        `<item affiliation="member"/>`+
                    `</query>`+
                `</iq>`)
            expect(view.model.occupants.length).toBe(2);

            result = stx`<iq xmlns="jabber:client"
                    type="result"
                    to="romeo@montague.lit/orchard"
                    from="lounge@muc.montague.lit"
                    id="${iq_stanza.getAttribute("id")}">
                <query xmlns="http://jabber.org/protocol/muc#admin">
                    <item jid="marc" affiliation="member"/>
                </query>
            </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(result));

            expect(view.model.occupants.length).toBe(2);
            iq_stanza = await u.waitUntil(() => _converse.api.connection.get().IQ_stanzas.filter(
                iq => iq.querySelector('iq[to="lounge@muc.montague.lit"][type="get"] item[affiliation="owner"]')).pop()
            );

            expect(Strophe.serialize(iq_stanza)).toBe(
                `<iq id="${iq_stanza.getAttribute('id')}" to="lounge@muc.montague.lit" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                        `<item affiliation="owner"/>`+
                    `</query>`+
                `</iq>`)
            expect(view.model.occupants.length).toBe(2);

            result = stx`<iq xmlns="jabber:client"
                    type="result"
                    to="romeo@montague.lit/orchard"
                    from="lounge@muc.montague.lit"
                    id="${iq_stanza.getAttribute("id")}">
                <query xmlns="http://jabber.org/protocol/muc#admin">
                    <item jid="romeo@montague.lit" affiliation="owner"/>
                </query>
            </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(result));

            expect(view.model.occupants.length).toBe(2);
            iq_stanza = await u.waitUntil(() => _converse.api.connection.get().IQ_stanzas.filter(
                iq => iq.querySelector('iq[to="lounge@muc.montague.lit"][type="get"] item[affiliation="admin"]')).pop()
            );

            expect(Strophe.serialize(iq_stanza)).toBe(
                `<iq id="${iq_stanza.getAttribute('id')}" to="lounge@muc.montague.lit" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                        `<item affiliation="admin"/>`+
                    `</query>`+
                `</iq>`)
            expect(view.model.occupants.length).toBe(2);

            result = stx`<iq xmlns="jabber:client"
                        type="result"
                        to="romeo@montague.lit/orchard"
                        from="lounge@muc.montague.lit"
                        id="${iq_stanza.getAttribute('id')}">
                    <query xmlns="http://jabber.org/protocol/muc#admin"></query>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(result));
            await u.waitUntil(() => view.querySelectorAll('.occupant').length, 500);
            await u.waitUntil(() => view.querySelectorAll('.badge').length > 2);
            expect(view.model.occupants.length).toBe(2);
            expect(view.querySelectorAll('.occupant').length).toBe(2);
        }));

        it("takes /topic to set the groupchat topic", mock.initConverse([], {}, async function (_converse) {
            await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            // Check the alias /topic
            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/topic This is the groupchat subject';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                key: "Enter",
            });
            const { sent_stanzas } = _converse.api.connection.get();
            await u.waitUntil(() => sent_stanzas.filter(s => s.textContent.trim() === 'This is the groupchat subject'));

            // Check /subject
            textarea.value = '/subject This is a new subject';
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                key: "Enter",
            });

            let sent_stanza = await u.waitUntil(() => sent_stanzas.filter(s => s.textContent.trim() === 'This is a new subject').pop());
            expect(sent_stanza).toEqualStanza(stx`
                <message to="lounge@montague.lit" type="groupchat" xmlns="jabber:client">
                    <subject>This is a new subject</subject>
                </message>`);

            // Check case insensitivity
            textarea.value = '/Subject This is yet another subject';
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                key: "Enter",
            });
            sent_stanza = await u.waitUntil(() => sent_stanzas.filter(s => s.textContent.trim() === 'This is yet another subject').pop());
            expect(sent_stanza).toEqualStanza(stx`
                <message to="lounge@montague.lit" type="groupchat" xmlns="jabber:client">
                    <subject>This is yet another subject</subject>
                </message>`);

            while (sent_stanzas.length) {
                sent_stanzas.pop();
            }
            // Check unsetting the topic
            textarea.value = '/topic';
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                key: "Enter",
            });
            sent_stanza = await u.waitUntil(() => sent_stanzas.pop());
            expect(sent_stanza).toEqualStanza(stx`
                <message to="lounge@montague.lit" type="groupchat" xmlns="jabber:client">
                    <subject></subject>
                </message>`);
        }));

        it("takes /clear to clear messages", mock.initConverse([], {}, async function (_converse) {
            await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/clear';
            spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(false));
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                key: "Enter",
            });
            await u.waitUntil(() => _converse.api.confirm.calls.count() === 1);
            expect(_converse.api.confirm).toHaveBeenCalledWith('Are you sure you want to clear the messages from this conversation?');
        }));

        it("takes /owner to make a user an owner", mock.initConverse([], {}, async function (_converse) {
            let sent_IQ, IQ_id;
            const sendIQ = _converse.api.connection.get().sendIQ;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_IQ = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });

            await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            spyOn(view.model, 'validateRoleOrAffiliationChangeArgs').and.callThrough();

            _converse.api.connection.get()._dataRecv(mock.createRequest(
                stx`<presence
                            from="lounge@montague.lit/annoyingGuy"
                            id="27C55F89-1C6A-459A-9EB5-77690145D624"
                            to="romeo@montague.lit/desktop"
                            xmlns="jabber:client">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                        <item jid="annoyingguy@montague.lit" affiliation="member" role="participant"/>
                        </x>
                </presence>`));

            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/owner';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                key: "Enter",
            });
            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count());
            const err_msg = await u.waitUntil(() => view.querySelector('.chat-error'));
            expect(err_msg.textContent.trim()).toBe(
                "Error: the \"owner\" command takes two arguments, the user's nickname and optionally a reason.");

            const sel = 'iq[type="set"] query[xmlns="http://jabber.org/protocol/muc#admin"]';
            const stanzas = _converse.api.connection.get().IQ_stanzas.filter(s => sizzle(sel, s).length);
            expect(stanzas.length).toBe(0);

            // XXX: Calling onFormSubmitted directly, trying
            // again via triggering Event doesn't work for some weird
            // reason.
            textarea.value = '/owner nobody You\'re responsible';
            message_form.onFormSubmitted(new Event('submit'));
            await u.waitUntil(() => view.querySelectorAll('.chat-error').length === 2);
            expect(Array.from(view.querySelectorAll('.chat-error')).pop().textContent.trim()).toBe(
                "Error: couldn't find a groupchat participant based on your arguments");

            expect(_converse.api.connection.get().IQ_stanzas.filter(s => sizzle(sel, s).length).length).toBe(0);

            // Call now with the correct of arguments.
            // XXX: Calling onFormSubmitted directly, trying
            // again via triggering Event doesn't work for some weird
            // reason.
            textarea.value = '/owner annoyingGuy You\'re responsible';
            message_form.onFormSubmitted(new Event('submit'));

            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count() === 3);
            // Check that the member list now gets updated
            expect(sent_IQ).toEqualStanza(
                stx`<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/muc#admin">
                        <item affiliation="owner" nick="annoyingGuy" jid="annoyingguy@montague.lit">
                            <reason>You&apos;re responsible</reason>
                        </item>
                    </query>
                </iq>`);

            _converse.api.connection.get()._dataRecv(mock.createRequest(
                stx`<presence
                        from="lounge@montague.lit/annoyingGuy"
                        id="27C55F89-1C6A-459A-9EB5-77690145D628"
                        to="romeo@montague.lit/desktop"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item jid="annoyingguy@montague.lit" affiliation="owner" role="participant"/>
                    </x>
                </presence>`));
            await u.waitUntil(() =>
                Array.from(view.querySelectorAll('.chat-info__message')).pop()?.textContent.trim() ===
                "annoyingGuy is now an owner of this groupchat"
            );
        }));

        it("takes /ban to ban a user", mock.initConverse([], {}, async function (_converse) {
            let sent_IQ, IQ_id;
            const sendIQ = _converse.api.connection.get().sendIQ;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_IQ = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });

            await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            spyOn(view.model, 'validateRoleOrAffiliationChangeArgs').and.callThrough();

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    stx`<presence
                            from="lounge@montague.lit/annoyingGuy"
                            id="27C55F89-1C6A-459A-9EB5-77690145D624"
                            to="romeo@montague.lit/desktop"
                            xmlns="jabber:client">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item jid="annoyingguy@montague.lit" affiliation="member" role="participant"/>
                        </x>
                    </presence>`));

            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/ban';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                key: "Enter",
            });
            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count());
            await u.waitUntil(() => view.querySelector('.message:last-child')?.textContent?.trim() ===
                "Error: the \"ban\" command takes two arguments, the user's nickname and optionally a reason.");

            const sel = 'iq[type="set"] query[xmlns="http://jabber.org/protocol/muc#admin"]';
            const stanzas = _converse.api.connection.get().IQ_stanzas.filter(s => sizzle(sel, s).length);
            expect(stanzas.length).toBe(0);

            // Call now with the correct amount of arguments.
            // XXX: Calling onFormSubmitted directly, trying
            // again via triggering Event doesn't work for some weird
            // reason.
            textarea.value = '/ban annoyingGuy You\'re annoying';
            message_form.onFormSubmitted(new Event('submit'));

            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count() === 2);
            // Check that the member list now gets updated
            expect(sent_IQ).toEqualStanza(
                stx`<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/muc#admin">
                        <item affiliation="outcast" jid="annoyingguy@montague.lit">
                            <reason>You&apos;re annoying</reason>
                        </item>
                    </query>
                </iq>`);

            _converse.api.connection.get()._dataRecv(mock.createRequest(
                stx`<presence
                        from='lounge@montague.lit/annoyingGuy'
                        id='27C55F89-1C6A-459A-9EB5-77690145D628'
                        to='romeo@montague.lit/desktop'
                        xmlns="jabber:client">
                    <x xmlns='http://jabber.org/protocol/muc#user'>
                        <item jid='annoyingguy@montague.lit' affiliation='outcast' role='participant'>
                            <actor nick='romeo'/>
                            <reason>You're annoying</reason>
                            <status code='301'/>
                        </item>
                    </x>
                </presence>`));

            await u.waitUntil(() => view.querySelectorAll('.chat-info').length === 2);
            expect(view.querySelectorAll('.chat-info__message')[1].textContent.trim()).toBe("annoyingGuy has been banned by romeo");
            expect(view.querySelector('.chat-info:last-child q').textContent.trim()).toBe("You're annoying");
            _converse.api.connection.get()._dataRecv(mock.createRequest(
                stx`<presence
                        from="lounge@montague.lit/joe2"
                        id="27C55F89-1C6A-459A-9EB5-77690145D624"
                        to="romeo@montague.lit/desktop"
                        xmlns="jabber:client">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item jid="joe2@montague.lit" affiliation="member" role="participant"/>
                        </x>
                </presence>`
            ));

            textarea.value = '/ban joe22';
            message_form.onFormSubmitted(new Event('submit'));
            await u.waitUntil(() => view.querySelector('converse-chat-message:last-child')?.textContent?.trim() ===
                "Error: couldn't find a groupchat participant based on your arguments");
        }));


        it("takes a /kick command to kick a user", mock.initConverse([], {}, async function (_converse) {
            let sent_IQ, IQ_id;
            const sendIQ = _converse.api.connection.get().sendIQ;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_IQ = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            spyOn(view.model, 'setRole').and.callThrough();
            spyOn(view.model, 'validateRoleOrAffiliationChangeArgs').and.callThrough();

            let presence = stx`<presence
                    from='lounge@montague.lit/annoying guy'
                    id='27C55F89-1C6A-459A-9EB5-77690145D624'
                    to='romeo@montague.lit/desktop'
                    xmlns="jabber:client"> 
                    <x xmlns='http://jabber.org/protocol/muc#user'>
                        <item jid='annoyingguy@montague.lit' affiliation='none' role='participant'/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/kick';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                key: "Enter",
            });
            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count());
            await u.waitUntil(() => view.querySelector('.message:last-child')?.textContent?.trim() ===
                "Error: the \"kick\" command takes two arguments, the user's nickname and optionally a reason.");
            expect(view.model.setRole).not.toHaveBeenCalled();
            // Call now with the correct amount of arguments.
            // XXX: Calling onFormSubmitted directly, trying
            // again via triggering Event doesn't work for some weird
            // reason.
            textarea.value = '/kick @annoying guy You\'re annoying';
            message_form.onFormSubmitted(new Event('submit'));

            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count() === 2);
            expect(view.model.setRole).toHaveBeenCalled();
            expect(Strophe.serialize(sent_IQ)).toBe(
                `<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                        `<item nick="annoying guy" role="none">`+
                            `<reason>You&apos;re annoying</reason>`+
                        `</item>`+
                    `</query>`+
                `</iq>`);

            presence = stx`<presence
                    from="lounge@montague.lit/annoying guy"
                    to="romeo@montague.lit/desktop"
                    type="unavailable"
                    xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" role="none">
                            <actor nick="romeo"/>
                            <reason>You're annoying</reason>
                            <status code="307"/>
                        </item>
                    </x>
                </presence>`;

            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            await u.waitUntil(() => view.querySelectorAll('.chat-info').length === 2);
            expect(view.querySelectorAll('.chat-info__message')[1].textContent.trim()).toBe("annoying guy has been kicked out by romeo");
            expect(view.querySelector('.chat-info:last-child q').textContent.trim()).toBe("You're annoying");
        }));


        it("takes /op and /deop to make a user a moderator or not",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            let sent_IQ, IQ_id;
            const sendIQ = _converse.api.connection.get().sendIQ;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_IQ = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });
            spyOn(view.model, 'setRole').and.callThrough();
            spyOn(view.model, 'validateRoleOrAffiliationChangeArgs').and.callThrough();

            // New user enters the groupchat
            _converse.api.connection.get()._dataRecv(mock.createRequest(
                stx`<presence
                        from="lounge@montague.lit/trustworthyguy"
                        id="27C55F89-1C6A-459A-9EB5-77690145D624"
                        to="romeo@montague.lit/desktop"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item jid="trustworthyguy@montague.lit" affiliation="member" role="participant"/>
                    </x>
                </presence>`));

            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo and trustworthyguy have entered the groupchat");

            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/op';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                key: "Enter",
            });

            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count());
            await u.waitUntil(() => view.querySelector('.message:last-child')?.textContent?.trim() ===
                "Error: the \"op\" command takes two arguments, the user's nickname and optionally a reason.");

            expect(view.model.setRole).not.toHaveBeenCalled();
            // Call now with the correct amount of arguments.
            // XXX: Calling onFormSubmitted directly, trying
            // again via triggering Event doesn't work for some weird
            // reason.
            textarea.value = '/op trustworthyguy You\'re trustworthy';
            message_form.onFormSubmitted(new Event('submit'));

            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count() === 2);
            expect(view.model.setRole).toHaveBeenCalled();
            expect(Strophe.serialize(sent_IQ)).toBe(
                `<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                        `<item nick="trustworthyguy" role="moderator">`+
                            `<reason>You&apos;re trustworthy</reason>`+
                        `</item>`+
                    `</query>`+
                `</iq>`);

            _converse.api.connection.get()._dataRecv(mock.createRequest(
                stx`<presence
                        from="lounge@montague.lit/trustworthyguy"
                        to="romeo@montague.lit/desktop"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item jid="trustworthyguy@montague.lit" affiliation="member" role="moderator"/>
                    </x>
                </presence>`));
            // Check now that things get restored when the user is given a voice
            await u.waitUntil(
                () => view.querySelector('.chat-content__notifications').textContent.split('\n', 2).pop()?.trim() ===
                    "trustworthyguy is now a moderator");

            // Call now with the correct amount of arguments.
            // XXX: Calling onFormSubmitted directly, trying
            // again via triggering Event doesn't work for some weird
            // reason.
            textarea.value = '/deop trustworthyguy Perhaps not';
            message_form.onFormSubmitted(new Event('submit'));

            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count() === 3);
            expect(view.model.setRole).toHaveBeenCalled();
            expect(sent_IQ).toEqualStanza(stx`
                <iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/muc#admin">
                        <item nick="trustworthyguy" role="participant">
                            <reason>Perhaps not</reason>
                        </item>
                    </query>
                </iq>`);

            _converse.api.connection.get()._dataRecv(mock.createRequest(
                stx`<presence
                        from="lounge@montague.lit/trustworthyguy"
                        to="romeo@montague.lit/desktop"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item jid="trustworthyguy@montague.lit" affiliation="member" role="participant"/>
                    </x>
                </presence>`));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications')
                .textContent.includes("trustworthyguy is no longer a moderator"));
        }));

        it("takes /mute and /voice to mute and unmute a user",
            mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            var sent_IQ, IQ_id;
            var sendIQ = _converse.api.connection.get().sendIQ;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_IQ = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });
            spyOn(view.model, 'setRole').and.callThrough();
            spyOn(view.model, 'validateRoleOrAffiliationChangeArgs').and.callThrough();

            // New user enters the groupchat
            _converse.api.connection.get()._dataRecv(mock.createRequest(
                    stx`<presence
                            from="lounge@montague.lit/annoyingGuy"
                            id="27C55F89-1C6A-459A-9EB5-77690145D624"
                            to="romeo@montague.lit/desktop"
                            xmlns="jabber:client">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item jid="annoyingguy@montague.lit" affiliation="member" role="participant"/>
                        </x>
                    </presence>`));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo and annoyingGuy have entered the groupchat");

            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/mute';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                key: "Enter",
            });

            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count());
            await u.waitUntil(() => view.querySelector('.message:last-child')?.textContent?.trim() ===
                "Error: the \"mute\" command takes two arguments, the user's nickname and optionally a reason.");
            expect(view.model.setRole).not.toHaveBeenCalled();
            // Call now with the correct amount of arguments.
            // XXX: Calling onFormSubmitted directly, trying
            // again via triggering Event doesn't work for some weird
            // reason.
            textarea.value = '/mute annoyingGuy You\'re annoying';
            message_form.onFormSubmitted(new Event('submit'));

            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count() === 2)
            expect(view.model.setRole).toHaveBeenCalled();
            expect(sent_IQ).toEqualStanza(stx`
                <iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/muc#admin">
                        <item nick="annoyingGuy" role="visitor">
                            <reason>You&apos;re annoying</reason>
                        </item>
                    </query>
                </iq>`);

            /* <presence
             *     from='coven@chat.shakespeare.lit/thirdwitch'
             *     to='crone1@shakespeare.lit/desktop'>
             * <x xmlns='http://jabber.org/protocol/muc#user'>
             *     <item affiliation='member'
             *         jid='hag66@shakespeare.lit/pda'
             *         role='visitor'/>
             * </x>
             * </presence>
             */
            _converse.api.connection.get()._dataRecv(mock.createRequest(stx`<presence
                    from="lounge@montague.lit/annoyingGuy"
                    to="romeo@montague.lit/desktop"
                    xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item jid="annoyingguy@montague.lit" affiliation="member" role="visitor"/>
                    </x>
                </presence>`));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.includes("annoyingGuy has been muted"));

            // Call now with the correct of arguments.
            // XXX: Calling onFormSubmitted directly, trying
            // again via triggering Event doesn't work for some weird
            // reason.
            textarea.value = '/voice annoyingGuy Now you can talk again';
            message_form.onFormSubmitted(new Event('submit'));

            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count() === 3);
            expect(view.model.setRole).toHaveBeenCalled();
            expect(sent_IQ).toEqualStanza(stx`
                <iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/muc#admin">
                        <item nick="annoyingGuy" role="participant">
                            <reason>Now you can talk again</reason>
                        </item>
                    </query>
                </iq>`);

            _converse.api.connection.get()._dataRecv(mock.createRequest(
                stx`<presence
                        from="lounge@montague.lit/annoyingGuy"
                        to="romeo@montague.lit/desktop"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item jid="annoyingguy@montague.lit" affiliation="member" role="participant"/>
                    </x>
                </presence>`));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.includes("annoyingGuy has been given a voice"));
        }));

        it("takes /destroy to destroy a muc",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            const new_muc_jid = 'foyer@montague.lit';
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            let view = _converse.chatboxviews.get(muc_jid);
            spyOn(_converse.api, 'confirm').and.callThrough();
            let textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/destroy';
            let message_form = view.querySelector('converse-muc-message-form');
            message_form.onFormSubmitted(new Event('submit'));
            let modal = await u.waitUntil(() => document.querySelector('.modal-dialog'));
            await u.waitUntil(() => u.isVisible(modal));

            let challenge_el = modal.querySelector('[name="challenge"]');
            challenge_el.value = muc_jid+'e';
            const reason_el = modal.querySelector('[name="reason"]');
            reason_el.value = 'Moved to a new location';
            const newjid_el = modal.querySelector('[name="newjid"]');
            newjid_el.value = new_muc_jid;
            let submit = modal.querySelector('[type="submit"]');
            submit.click();

            expect(u.isVisible(modal)).toBeTruthy();
            await u.waitUntil(() => u.hasClass('error', challenge_el));
            challenge_el.value = muc_jid;
            submit.click();

            let sent_IQs = _converse.api.connection.get().IQ_stanzas;
            let sent_IQ = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector('destroy')).pop());
            expect(sent_IQ).toEqualStanza(stx`
                <iq id="${sent_IQ.getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/muc#owner">
                        <destroy jid="${new_muc_jid}">
                            <reason>Moved to a new location</reason>
                        </destroy>
                    </query>
                </iq>`);

            let result_stanza = stx`<iq type="result"
                id="${sent_IQ.getAttribute('id')}"
                from="${view.model.get('jid')}"
                to="${_converse.api.connection.get().jid}"
                xmlns="jabber:client"/>`
            expect(_converse.chatboxes.length).toBe(2);
            spyOn(_converse.api, "trigger").and.callThrough();
            _converse.api.connection.get()._dataRecv(mock.createRequest(result_stanza));
            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.DISCONNECTED));
            await u.waitUntil(() => _converse.chatboxes.length === 1);
            expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));

            // Try again without reason or new JID
            _converse.api.connection.get().IQ_stanzas = [];
            sent_IQs = _converse.api.connection.get().IQ_stanzas;
            await mock.openAndEnterMUC(_converse, new_muc_jid, 'romeo');
            view = _converse.chatboxviews.get(new_muc_jid);
            textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/destroy';
            message_form = view.querySelector('converse-muc-message-form');
            message_form.onFormSubmitted(new Event('submit'));
            modal = await u.waitUntil(() => document.querySelector('.modal-dialog'));
            await u.waitUntil(() => u.isVisible(modal));

            challenge_el = modal.querySelector('[name="challenge"]');
            challenge_el.value = new_muc_jid;
            submit = modal.querySelector('[type="submit"]');
            submit.click();

            sent_IQ = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector('destroy')).pop());
            expect(sent_IQ).toEqualStanza(stx`
                <iq id="${sent_IQ.getAttribute('id')}" to="${new_muc_jid}" type="set" xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/muc#owner">
                        <destroy/>
                    </query>
                </iq>`);

            result_stanza = stx`<iq type="result"
                id="${sent_IQ.getAttribute('id')}"
                from="${view.model.get('jid')}"
                to="${_converse.api.connection.get().jid}"
                xmlns="jabber:client"/>`
            expect(_converse.chatboxes.length).toBe(2);
            _converse.api.connection.get()._dataRecv(mock.createRequest(result_stanza));
            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.DISCONNECTED));
            await u.waitUntil(() => _converse.chatboxes.length === 1);
        }));
    });
});
