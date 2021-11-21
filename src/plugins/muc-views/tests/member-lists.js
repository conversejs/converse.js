/*global mock, converse */
const { $iq, Strophe, u }  = converse.env;

describe("A Groupchat", function () {

    describe("upon being entered", function () {

        it("will fetch the member list if muc_fetch_members is true",
                mock.initConverse([], {'muc_fetch_members': true}, async function (_converse) {

            const { api } = _converse;
            let sent_IQs = _converse.connection.IQ_stanzas;
            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            let view = _converse.chatboxviews.get(muc_jid);
            expect(sent_IQs.filter(iq => iq.querySelector('query item[affiliation]')).length).toBe(3);

            // Check in reverse order that we requested all three lists
            const owner_iq = sent_IQs.pop();
            expect(Strophe.serialize(owner_iq)).toBe(
                `<iq id="${owner_iq.getAttribute('id')}" to="${muc_jid}" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin"><item affiliation="owner"/></query>`+
                `</iq>`);

            const admin_iq = sent_IQs.pop();
            expect(Strophe.serialize(admin_iq)).toBe(
                `<iq id="${admin_iq.getAttribute('id')}" to="${muc_jid}" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin"><item affiliation="admin"/></query>`+
                `</iq>`);

            const member_iq = sent_IQs.pop();
            expect(Strophe.serialize(member_iq)).toBe(
                `<iq id="${member_iq.getAttribute('id')}" to="${muc_jid}" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin"><item affiliation="member"/></query>`+
                `</iq>`);
            view.close();

            _converse.connection.IQ_stanzas = [];
            sent_IQs = _converse.connection.IQ_stanzas;
            api.settings.set('muc_fetch_members', false);
            await mock.openAndEnterChatRoom(_converse, 'orchard@montague.lit', 'romeo');
            view = _converse.chatboxviews.get('orchard@montague.lit');
            expect(sent_IQs.filter(iq => iq.querySelector('query item[affiliation]')).length).toBe(0);
            await view.close();

            _converse.connection.IQ_stanzas = [];
            sent_IQs = _converse.connection.IQ_stanzas;
            api.settings.set('muc_fetch_members', ['admin']);
            await mock.openAndEnterChatRoom(_converse, 'courtyard@montague.lit', 'romeo');
            view = _converse.chatboxviews.get('courtyard@montague.lit');
            expect(sent_IQs.filter(iq => iq.querySelector('query item[affiliation]')).length).toBe(1);
            expect(sent_IQs.filter(iq => iq.querySelector('query item[affiliation="admin"]')).length).toBe(1);
            view.close();

            _converse.connection.IQ_stanzas = [];
            sent_IQs = _converse.connection.IQ_stanzas;
            api.settings.set('muc_fetch_members', ['owner']);
            await mock.openAndEnterChatRoom(_converse, 'garden@montague.lit', 'romeo');
            view = _converse.chatboxviews.get('garden@montague.lit');
            expect(sent_IQs.filter(iq => iq.querySelector('query item[affiliation]')).length).toBe(1);
            expect(sent_IQs.filter(iq => iq.querySelector('query item[affiliation="owner"]')).length).toBe(1);
            view.close();
        }));

        it("will not fetch the member list if the user is not affiliated",
                mock.initConverse([], {'muc_fetch_members': true}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            const sent_IQs = _converse.connection.IQ_stanzas;
            spyOn(_converse.ChatRoomOccupants.prototype, 'fetchMembers').and.callThrough();
            // Join MUC without an affiliation
            const model = await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', [], [], true, {}, 'none', 'participant');
            await u.waitUntil(() => model.occupants.fetchMembers.calls.count());
            expect(sent_IQs.filter(iq => iq.querySelector('query item[affiliation]')).length).toBe(0);
        }));

        describe("when fetching the member lists", function () {

            it("gracefully handles being forbidden from fetching the lists for certain affiliations",
                    mock.initConverse([], {'muc_fetch_members': true}, async function (_converse) {

                const sent_IQs = _converse.connection.IQ_stanzas;
                const muc_jid = 'lounge@montague.lit';
                const features = [
                    'http://jabber.org/protocol/muc',
                    'jabber:iq:register',
                    'muc_hidden',
                    'muc_membersonly',
                    'muc_passwordprotected',
                    Strophe.NS.MAM,
                    Strophe.NS.SID
                ];
                const nick = 'romeo';
                await _converse.api.rooms.open(muc_jid);
                await mock.getRoomFeatures(_converse, muc_jid, features);
                await mock.waitForReservedNick(_converse, muc_jid, nick);
                mock.receiveOwnMUCPresence(_converse, muc_jid, nick);
                const view = _converse.chatboxviews.get(muc_jid);
                await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));

                // Check in reverse order that we requested all three lists
                const owner_iq = sent_IQs.pop();
                expect(Strophe.serialize(owner_iq)).toBe(
                    `<iq id="${owner_iq.getAttribute('id')}" to="${muc_jid}" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin"><item affiliation="owner"/></query>`+
                    `</iq>`);
                const admin_iq = sent_IQs.pop();
                expect(Strophe.serialize(admin_iq)).toBe(
                    `<iq id="${admin_iq.getAttribute('id')}" to="${muc_jid}" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin"><item affiliation="admin"/></query>`+
                    `</iq>`);
                const member_iq = sent_IQs.pop();
                expect(Strophe.serialize(member_iq)).toBe(
                    `<iq id="${member_iq.getAttribute('id')}" to="${muc_jid}" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/muc#admin"><item affiliation="member"/></query>`+
                    `</iq>`);

                // It might be that the user is not allowed to fetch certain lists.
                let err_stanza = u.toStanza(
                    `<iq xmlns="jabber:client" type="error" to="${_converse.jid}" from="${muc_jid}" id="${admin_iq.getAttribute('id')}">
                        <error type="auth"><forbidden xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error>
                    </iq>`);
                _converse.connection._dataRecv(mock.createRequest(err_stanza));

                err_stanza = u.toStanza(
                    `<iq xmlns="jabber:client" type="error" to="${_converse.jid}" from="${muc_jid}" id="${owner_iq.getAttribute('id')}">
                        <error type="auth"><forbidden xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error>
                    </iq>`);
                _converse.connection._dataRecv(mock.createRequest(err_stanza));

                // Now the service sends the member lists to the user
                const member_list_stanza = $iq({
                        'from': muc_jid,
                        'id': member_iq.getAttribute('id'),
                        'to': 'romeo@montague.lit/orchard',
                        'type': 'result'
                    }).c('query', {'xmlns': Strophe.NS.MUC_ADMIN})
                        .c('item', {
                            'affiliation': 'member',
                            'jid': 'hag66@shakespeare.lit',
                            'nick': 'thirdwitch',
                            'role': 'participant'
                        });
                _converse.connection._dataRecv(mock.createRequest(member_list_stanza));

                await u.waitUntil(() => view.model.occupants.length > 1);
                expect(view.model.occupants.length).toBe(2);
                // The existing owner occupant should not have their
                // affiliation removed due to the owner list
                // not being returned (forbidden err).
                expect(view.model.occupants.findWhere({'jid': _converse.bare_jid}).get('affiliation')).toBe('owner');
                expect(view.model.occupants.findWhere({'jid': 'hag66@shakespeare.lit'}).get('affiliation')).toBe('member');
            }));
        });
    });
});

describe("Someone being invited to a groupchat", function () {

    it("will first be added to the member list if the groupchat is members only",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 0);
        spyOn(_converse.ChatRoomOccupants.prototype, 'fetchMembers').and.callThrough();
        const sent_IQs = _converse.connection.IQ_stanzas;
        const muc_jid = 'coven@chat.shakespeare.lit';
        const nick = 'romeo';
        const room_creation_promise = _converse.api.rooms.open(muc_jid, {nick});

        // Check that the groupchat queried for the features.
        let stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`)).pop());
        expect(Strophe.serialize(stanza)).toBe(
            `<iq from="romeo@montague.lit/orchard" id="${stanza.getAttribute("id")}" to="${muc_jid}" type="get" xmlns="jabber:client">`+
                `<query xmlns="http://jabber.org/protocol/disco#info"/>`+
            `</iq>`);

        // State that the chat is members-only via the features IQ
        const view = _converse.chatboxviews.get(muc_jid);
        const features_stanza = $iq({
                from: 'coven@chat.shakespeare.lit',
                'id': stanza.getAttribute('id'),
                'to': 'romeo@montague.lit/desktop',
                'type': 'result'
            })
            .c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                .c('identity', {
                    'category': 'conference',
                    'name': 'A Dark Cave',
                    'type': 'text'
                }).up()
                .c('feature', {'var': 'http://jabber.org/protocol/muc'}).up()
                .c('feature', {'var': 'muc_hidden'}).up()
                .c('feature', {'var': 'muc_temporary'}).up()
                .c('feature', {'var': 'muc_membersonly'}).up();
        _converse.connection._dataRecv(mock.createRequest(features_stanza));
        const sent_stanzas = _converse.connection.sent_stanzas;
        await u.waitUntil(() => sent_stanzas.filter(s => s.matches(`presence[to="${muc_jid}/${nick}"]`)).pop());
        expect(view.model.features.get('membersonly')).toBeTruthy();

        await room_creation_promise;
        await mock.createContacts(_converse, 'current');

        let sent_stanza, sent_id;
        spyOn(_converse.connection, 'send').and.callFake(function (stanza) {
            if (stanza.nodeName === 'message') {
                sent_id = stanza.getAttribute('id');
                sent_stanza = stanza;
            }
        });
        const invitee_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const reason = "Please join this groupchat";
        view.model.directInvite(invitee_jid, reason);

        // Check in reverse order that we requested all three lists
        const owner_iq = sent_IQs.pop();
        expect(Strophe.serialize(owner_iq)).toBe(
            `<iq id="${owner_iq.getAttribute('id')}" to="coven@chat.shakespeare.lit" type="get" xmlns="jabber:client">`+
                `<query xmlns="http://jabber.org/protocol/muc#admin"><item affiliation="owner"/></query>`+
            `</iq>`);

        const admin_iq = sent_IQs.pop();
        expect(Strophe.serialize(admin_iq)).toBe(
            `<iq id="${admin_iq.getAttribute('id')}" to="coven@chat.shakespeare.lit" type="get" xmlns="jabber:client">`+
                `<query xmlns="http://jabber.org/protocol/muc#admin"><item affiliation="admin"/></query>`+
            `</iq>`);

        const member_iq = sent_IQs.pop();
        expect(Strophe.serialize(member_iq)).toBe(
            `<iq id="${member_iq.getAttribute('id')}" to="coven@chat.shakespeare.lit" type="get" xmlns="jabber:client">`+
                `<query xmlns="http://jabber.org/protocol/muc#admin"><item affiliation="member"/></query>`+
            `</iq>`);

        // Now the service sends the member lists to the user
        const member_list_stanza = $iq({
                'from': 'coven@chat.shakespeare.lit',
                'id': member_iq.getAttribute('id'),
                'to': 'romeo@montague.lit/orchard',
                'type': 'result'
            }).c('query', {'xmlns': Strophe.NS.MUC_ADMIN})
                .c('item', {
                    'affiliation': 'member',
                    'jid': 'hag66@shakespeare.lit',
                    'nick': 'thirdwitch',
                    'role': 'participant'
                });
        _converse.connection._dataRecv(mock.createRequest(member_list_stanza));

        const admin_list_stanza = $iq({
                'from': 'coven@chat.shakespeare.lit',
                'id': admin_iq.getAttribute('id'),
                'to': 'romeo@montague.lit/orchard',
                'type': 'result'
            }).c('query', {'xmlns': Strophe.NS.MUC_ADMIN})
                .c('item', {
                    'affiliation': 'admin',
                    'jid': 'wiccarocks@shakespeare.lit',
                    'nick': 'secondwitch'
                });
        _converse.connection._dataRecv(mock.createRequest(admin_list_stanza));

        const owner_list_stanza = $iq({
                'from': 'coven@chat.shakespeare.lit',
                'id': owner_iq.getAttribute('id'),
                'to': 'romeo@montague.lit/orchard',
                'type': 'result'
            }).c('query', {'xmlns': Strophe.NS.MUC_ADMIN})
                .c('item', {
                    'affiliation': 'owner',
                    'jid': 'crone1@shakespeare.lit',
                });
        _converse.connection._dataRecv(mock.createRequest(owner_list_stanza));

        // Converse puts the user on the member list
        stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/muc#admin"]`)).pop());
        expect(stanza.outerHTML,
            `<iq id="${stanza.getAttribute('id')}" to="coven@chat.shakespeare.lit" type="set" xmlns="jabber:client">`+
                `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                    `<item affiliation="member" jid="${invitee_jid}">`+
                        `<reason>Please join this groupchat</reason>`+
                    `</item>`+
                `</query>`+
            `</iq>`);

        const result = $iq({
                'from': 'coven@chat.shakespeare.lit',
                'id': stanza.getAttribute('id'),
                'to': 'romeo@montague.lit/orchard',
                'type': 'result'
            });
        _converse.connection._dataRecv(mock.createRequest(result));

        await u.waitUntil(() => view.model.occupants.fetchMembers.calls.count());

        // Finally check that the user gets invited.
        expect(Strophe.serialize(sent_stanza)).toBe( // Strophe adds the xmlns attr (although not in spec)
            `<message from="romeo@montague.lit/orchard" id="${sent_id}" to="${invitee_jid}" xmlns="jabber:client">`+
                `<x jid="coven@chat.shakespeare.lit" reason="Please join this groupchat" xmlns="jabber:x:conference"/>`+
            `</message>`
        );
    }));
});
