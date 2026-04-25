/*global mock, converse */

const { sizzle, stx, u } = converse.env;

describe('The occupants sidebar', function () {
    it(
        "shows all members even if they're not currently present in the groupchat",
        mock.initConverse([], {}, async function (_converse) {
            const muc_jid = 'lounge@montague.lit';
            const members = [
                {
                    'nick': 'juliet',
                    'jid': 'juliet@capulet.lit',
                    'affiliation': 'member',
                },
            ];
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', [], members);
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.model.occupants.length === 2);

            for (let i = 0; i < mock.chatroom_names.length; i++) {
                const name = mock.chatroom_names[i];
                const role = mock.chatroom_roles[name].role;
                // See example 21 https://xmpp.org/extensions/xep-0045.html#enter-pres
                const presence = stx`<presence to="romeo@montague.lit/pda"
                                               from="lounge@montague.lit/${name}"
                                               xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="${mock.chatroom_roles[name].affiliation}"
                              jid="${name.replace(/ /g, '.').toLowerCase()}@montague.lit"
                              role="${role}"/>
                    </x>
                </presence>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            }

            if (view.model.get('hidden_occupants')) {
                // Happens in headless chrome due to smaller viewport size
                view.model.save('hidden_occupants', false);
            }
            const occupants = await u.waitUntil(() => view.querySelector('.occupant-list'));
            await u.waitUntil(() => occupants.querySelectorAll('li').length > 2, 500);
            expect(occupants.querySelectorAll('li').length).toBe(2 + mock.chatroom_names.length);
            expect(view.model.occupants.length).toBe(2 + mock.chatroom_names.length);

            mock.chatroom_names.forEach((name) => {
                const model = view.model.occupants.findWhere({ 'nick': name });
                const index = view.model.occupants.indexOf(model);
                expect(occupants.querySelectorAll('li .occupant-nick')[index].textContent.trim()).toBe(name);
            });

            // Test users leaving the groupchat
            // https://xmpp.org/extensions/xep-0045.html#exit
            for (let i = mock.chatroom_names.length - 1; i > -1; i--) {
                const name = mock.chatroom_names[i];
                // See example 21 https://xmpp.org/extensions/xep-0045.html#enter-pres
                const presence = stx`<presence to="romeo@montague.lit/pda"
                                               from="lounge@montague.lit/${name}"
                                               type="unavailable"
                                               xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="${mock.chatroom_roles[name].affiliation}"
                              jid="${name.replace(/ /g, '.').toLowerCase()}@montague.lit"
                              role="none"/>
                    </x>
                </presence>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
                expect(occupants.querySelectorAll('li').length).toBe(8);
            }
            const presence = stx`<presence to="romeo@montague.lit/pda"
                                           from="lounge@montague.lit/nonmember"
                                           xmlns="jabber:client">
                <x xmlns="http://jabber.org/protocol/muc#user">
                    <item affiliation="" jid="servant@montague.lit" role="visitor"/>
                </x>
            </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => occupants.querySelectorAll('li').length > 8, 500);
            expect(occupants.querySelectorAll('li').length).toBe(9);
            expect(view.model.occupants.length).toBe(9);
            expect(view.model.occupants.filter((o) => o.isMember()).length).toBe(8);

            view.model.rejoin();
            // Test that members aren't removed when we reconnect
            expect(view.model.occupants.length).toBe(8);
            view.model.session.set('connection_status', converse.ROOMSTATUS.ENTERED); // Hack
            await u.waitUntil(() => view.querySelectorAll('.occupant-list li').length === 8);
        })
    );

    it(
        'shows users currently present in the groupchat',
        mock.initConverse([], {}, async function (_converse) {
            await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
            var view = _converse.chatboxviews.get('lounge@montague.lit');
            for (var i = 0; i < mock.chatroom_names.length; i++) {
                const name = mock.chatroom_names[i];
                // See example 21 https://xmpp.org/extensions/xep-0045.html#enter-pres
                const presence = stx`<presence to="romeo@montague.lit/pda"
                                               from="lounge@montague.lit/${name}"
                                               xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none"
                              jid="${name.replace(/ /g, '.').toLowerCase()}@montague.lit"
                              role="participant"/>
                    </x>
                    <status/>
                </presence>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            }

            if (view.model.get('hidden_occupants')) {
                // Happens in headless chrome due to smaller viewport size
                view.model.save('hidden_occupants', false);
            }
            const occupants = await u.waitUntil(() => view.querySelector('.occupant-list'));
            await u.waitUntil(() => occupants.querySelectorAll('li').length > 1);
            expect(occupants.querySelectorAll('li').length).toBe(1 + mock.chatroom_names.length);

            mock.chatroom_names.forEach((name) => {
                const model = view.model.occupants.findWhere({ 'nick': name });
                const index = view.model.occupants.indexOf(model);
                expect(occupants.querySelectorAll('li .occupant-nick')[index].textContent.trim()).toBe(name);
            });

            // Test users leaving the groupchat
            // https://xmpp.org/extensions/xep-0045.html#exit
            for (i = mock.chatroom_names.length - 1; i > -1; i--) {
                const name = mock.chatroom_names[i];
                // See example 21 https://xmpp.org/extensions/xep-0045.html#enter-pres
                const presence = stx`<presence to="romeo@montague.lit/pda"
                                               from="lounge@montague.lit/${name}"
                                               type="unavailable"
                                               xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none"
                              jid="${name.replace(/ /g, '.').toLowerCase()}@montague.lit"
                              role="none"/>
                    </x>
                </presence>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            }
            await u.waitUntil(() => occupants.querySelectorAll('li').length === 1);
        })
    );

    it(
        'indicates moderators and visitors by means of a special css class and tooltip',
        mock.initConverse([], { 'view_mode': 'fullscreen' }, async function (_converse) {
            await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            let contact_jid = mock.cur_names[2].replace(/ /g, '.').toLowerCase() + '@montague.lit';

            if (view.model.get('hidden_occupants')) {
                // Happens in headless chrome due to smaller viewport size
                view.model.save('hidden_occupants', false);
            }
            await u.waitUntil(() => view.querySelectorAll('.occupant-list li').length, 500);
            let occupants = view.querySelectorAll('.occupant-list li');
            expect(occupants.length).toBe(1);
            expect(occupants[0].querySelector('.occupant-nick').textContent.trim()).toBe('romeo');
            expect(occupants[0].querySelectorAll('.badge').length).toBe(2);
            expect(occupants[0].querySelectorAll('.badge')[0].textContent.trim()).toBe('O');
            expect(occupants[0].querySelectorAll('.badge')[0].getAttribute('title').trim()).toBe('Owner');
            expect(occupants[0].querySelectorAll('.badge')[0].getAttribute('aria-label').trim()).toBe('Owner');
            expect(sizzle('.badge:last', occupants[0]).pop().textContent.trim()).toBe('MO');
            expect(sizzle('.badge:last', occupants[0]).pop().getAttribute('title').trim()).toBe('Moderator');

            var presence = stx`<presence to="romeo@montague.lit/pda"
                                           from="lounge@montague.lit/moderatorman"
                                           xmlns="jabber:client">
                <x xmlns="http://jabber.org/protocol/muc#user">
                    <item affiliation="admin" jid="${contact_jid}" role="moderator"/>
                </x>
                <status code="110"/>
            </presence>`;

            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelectorAll('.occupant-list li').length > 1, 500);
            occupants = view.querySelectorAll('.occupant-list li');
            expect(occupants.length).toBe(2);
            expect(occupants[0].querySelector('.occupant-nick').textContent.trim()).toBe('moderatorman');
            expect(occupants[0].querySelector('.occupant-nick').getAttribute('title')).toBe(
                contact_jid + ' This user is a moderator. Click to mention moderatorman in your message.'
            );
            expect(occupants[1].querySelector('.occupant-nick').textContent.trim()).toBe('romeo');
            expect(occupants[0].querySelectorAll('.badge').length).toBe(2);
            expect(occupants[0].querySelectorAll('.badge')[0].textContent.trim()).toBe('A');
            expect(occupants[0].querySelectorAll('.badge')[0].getAttribute('title').trim()).toBe('Admin');
            expect(occupants[0].querySelectorAll('.badge')[0].getAttribute('aria-label').trim()).toBe('Admin');
            expect(occupants[0].querySelectorAll('.badge')[1].textContent.trim()).toBe('MO');
            expect(occupants[0].querySelectorAll('.badge')[1].getAttribute('title').trim()).toBe('Moderator');
            expect(occupants[0].querySelectorAll('.badge')[1].getAttribute('aria-label').trim()).toBe('Moderator');

            contact_jid = mock.cur_names[3].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            presence = stx`<presence to="romeo@montague.lit/pda"
                                       from="lounge@montague.lit/visitorwoman"
                                       xmlns="jabber:client">
                <x xmlns="http://jabber.org/protocol/muc#user">
                    <item jid="${contact_jid}" role="visitor"/>
                </x>
                <status code="110"/>
            </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            await u.waitUntil(() => view.querySelectorAll('.occupant-list li').length > 2, 500);
            occupants = view.querySelector('.occupant-list').querySelectorAll('li');
            expect(occupants.length).toBe(3);
            expect(occupants[2].querySelector('.occupant-nick').textContent.trim()).toBe('visitorwoman');
            expect(occupants[2].querySelector('.occupant-nick').getAttribute('title')).toBe(
                contact_jid +
                    ' This user can NOT send messages in this groupchat. Click to mention visitorwoman in your message.'
            );
            expect(occupants[2].querySelectorAll('.badge').length).toBe(1);
            expect(sizzle('.badge', occupants[2]).pop().textContent.trim()).toBe('V');
            expect(sizzle('.badge', occupants[2]).pop().getAttribute('title').trim()).toBe('Visitor');
        })
    );
});
