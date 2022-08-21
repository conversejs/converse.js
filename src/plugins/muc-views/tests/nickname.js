/*global mock, converse */

const { $pres, $iq, Strophe, sizzle, u, stx } = converse.env;

describe("A MUC", function () {

    it("allows you to change your nickname via a modal",
            mock.initConverse([], {'view_mode': 'fullscreen'}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        const nick = 'romeo';
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, nick);

        expect(model.get('nick')).toBe(nick);
        expect(model.occupants.length).toBe(1);
        expect(model.occupants.at(0).get('nick')).toBe(nick);

        const view = _converse.chatboxviews.get(muc_jid);
        const dropdown_item = view.querySelector(".open-nickname-modal");
        dropdown_item.click();

        const modal = _converse.api.modal.get('converse-muc-nickname-modal');
        await u.waitUntil(() => u.isVisible(modal));

        const input = modal.querySelector('input[name="nick"]');
        expect(input.value).toBe(nick);

        const newnick = 'loverboy';
        input.value = newnick;
        modal.querySelector('input[type="submit"]')?.click();

        await u.waitUntil(() => !u.isVisible(modal));

        const { sent_stanzas } = _converse.connection;
        const sent_stanza = sent_stanzas.pop()
        expect(Strophe.serialize(sent_stanza).toLocaleString()).toBe(
            `<presence from="${_converse.jid}" id="${sent_stanza.getAttribute('id')}" to="${muc_jid}/${newnick}" xmlns="jabber:client"/>`);

        // Two presence stanzas are received from the MUC service
        _converse.connection._dataRecv(mock.createRequest(
            stx`
            <presence
                from='${muc_jid}/${nick}'
                id='DC352437-C019-40EC-B590-AF29E879AF98'
                to='${_converse.jid}'
                type='unavailable'>
            <x xmlns='http://jabber.org/protocol/muc#user'>
                <item affiliation='member'
                    jid='${_converse.jid}'
                    nick='${newnick}'
                    role='participant'/>
                <status code='303'/>
                <status code='110'/>
            </x>
            </presence>`
        ));

        expect(model.get('nick')).toBe(newnick);

        _converse.connection._dataRecv(mock.createRequest(
            stx`
            <presence
                from='${muc_jid}/${newnick}'
                id='5B4F27A4-25ED-43F7-A699-382C6B4AFC67'
                to='${_converse.jid}'>
            <x xmlns='http://jabber.org/protocol/muc#user'>
                <item affiliation='member'
                    jid='${_converse.jid}'
                    role='participant'/>
                <status code='110'/>
            </x>
            </presence>`
        ));

        await u.waitUntil(() => model.occupants.at(0).get('nick') === newnick);
        expect(model.occupants.length).toBe(1);
    }));

    it("informs users if their nicknames have been changed.",
            mock.initConverse([], {}, async function (_converse) {

        /* The service then sends two presence stanzas to the full JID
         * of each occupant (including the occupant who is changing his
         * or her room nickname), one of type "unavailable" for the old
         * nickname and one indicating availability for the new
         * nickname.
         *
         * See: https://xmpp.org/extensions/xep-0045.html#changenick
         *
         *  <presence
         *      from='coven@montague.lit/thirdwitch'
         *      id='DC352437-C019-40EC-B590-AF29E879AF98'
         *      to='hag66@shakespeare.lit/pda'
         *      type='unavailable'>
         *  <x xmlns='http://jabber.org/protocol/muc#user'>
         *      <item affiliation='member'
         *          jid='hag66@shakespeare.lit/pda'
         *          nick='oldhag'
         *          role='participant'/>
         *      <status code='303'/>
         *      <status code='110'/>
         *  </x>
         *  </presence>
         *
         *  <presence
         *      from='coven@montague.lit/oldhag'
         *      id='5B4F27A4-25ED-43F7-A699-382C6B4AFC67'
         *      to='hag66@shakespeare.lit/pda'>
         *  <x xmlns='http://jabber.org/protocol/muc#user'>
         *      <item affiliation='member'
         *          jid='hag66@shakespeare.lit/pda'
         *          role='participant'/>
         *      <status code='110'/>
         *  </x>
         *  </presence>
         */
        const { __ } = _converse;
        await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'oldnick');

        const view = _converse.chatboxviews.get('lounge@montague.lit');
        await u.waitUntil(() => view.querySelectorAll('li .occupant-nick').length, 500);
        let occupants = view.querySelector('.occupant-list');
        expect(occupants.childElementCount).toBe(1);
        expect(occupants.firstElementChild.querySelector('.occupant-nick').textContent.trim()).toBe("oldnick");

        const csntext = await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent);
        expect(csntext.trim()).toEqual("oldnick has entered the groupchat");

        let presence = $pres().attrs({
                from:'lounge@montague.lit/oldnick',
                id:'DC352437-C019-40EC-B590-AF29E879AF98',
                to:'romeo@montague.lit/pda',
                type:'unavailable'
            })
            .c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
            .c('item').attrs({
                affiliation: 'owner',
                jid: 'romeo@montague.lit/pda',
                nick: 'newnick',
                role: 'moderator'
            }).up()
            .c('status').attrs({code:'303'}).up()
            .c('status').attrs({code:'110'}).nodeTree;

        _converse.connection._dataRecv(mock.createRequest(presence));
        await u.waitUntil(() => view.querySelectorAll('.chat-info').length);

        expect(sizzle('div.chat-info:last').pop().textContent.trim()).toBe(
            __(_converse.muc.new_nickname_messages["303"], "newnick")
        );
        expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.ENTERED);

        occupants = view.querySelector('.occupant-list');
        expect(occupants.childElementCount).toBe(1);

        presence = $pres().attrs({
                from:'lounge@montague.lit/newnick',
                id:'5B4F27A4-25ED-43F7-A699-382C6B4AFC67',
                to:'romeo@montague.lit/pda'
            })
            .c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
            .c('item').attrs({
                affiliation: 'owner',
                jid: 'romeo@montague.lit/pda',
                role: 'moderator'
            }).up()
            .c('status').attrs({code:'110'}).nodeTree;

        _converse.connection._dataRecv(mock.createRequest(presence));
        expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.ENTERED);
        expect(view.querySelectorAll('div.chat-info').length).toBe(1);
        expect(sizzle('div.chat-info', view)[0].textContent.trim()).toBe(
            __(_converse.muc.new_nickname_messages["303"], "newnick")
        );
        occupants = view.querySelector('.occupant-list');
        await u.waitUntil(() => sizzle('.occupant-nick:first', occupants).pop().textContent.trim() === "newnick");
        expect(view.model.occupants.length).toBe(1);
        expect(view.model.get('nick')).toBe("newnick");
    }));

    describe("when being entered", function () {

        it("will use the user's reserved nickname, if it exists",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const IQ_stanzas = _converse.connection.IQ_stanzas;
            const muc_jid = 'lounge@montague.lit';
            await mock.openChatRoom(_converse, 'lounge', 'montague.lit', 'romeo');

            let stanza = await u.waitUntil(() => IQ_stanzas.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop()
            );
            // We pretend this is a new room, so no disco info is returned.
            const features_stanza = $iq({
                    from: 'lounge@montague.lit',
                    'id': stanza.getAttribute('id'),
                    'to': 'romeo@montague.lit/desktop',
                    'type': 'error'
                }).c('error', {'type': 'cancel'})
                    .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
            _converse.connection._dataRecv(mock.createRequest(features_stanza));


            /* <iq from='hag66@shakespeare.lit/pda'
             *     id='getnick1'
             *     to='coven@chat.shakespeare.lit'
             *     type='get'>
             * <query xmlns='http://jabber.org/protocol/disco#info'
             *         node='x-roomuser-item'/>
             * </iq>
             */
            const iq = await u.waitUntil(() => IQ_stanzas.filter(
                    s => sizzle(`iq[to="${muc_jid}"] query[node="x-roomuser-item"]`, s).length
                ).pop());

            expect(Strophe.serialize(iq)).toBe(
                `<iq from="romeo@montague.lit/orchard" id="${iq.getAttribute('id')}" to="lounge@montague.lit" `+
                    `type="get" xmlns="jabber:client">`+
                        `<query node="x-roomuser-item" xmlns="http://jabber.org/protocol/disco#info"/></iq>`);

            /* <iq from='coven@chat.shakespeare.lit'
             *     id='getnick1'
             *     to='hag66@shakespeare.lit/pda'
             *     type='result'>
             *     <query xmlns='http://jabber.org/protocol/disco#info'
             *             node='x-roomuser-item'>
             *         <identity
             *             category='conference'
             *             name='thirdwitch'
             *             type='text'/>
             *     </query>
             * </iq>
             */
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            stanza = $iq({
                'type': 'result',
                'id': iq.getAttribute('id'),
                'from': view.model.get('jid'),
                'to': _converse.connection.jid
            }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#info', 'node': 'x-roomuser-item'})
            .c('identity', {'category': 'conference', 'name': 'thirdwitch', 'type': 'text'});
            _converse.connection._dataRecv(mock.createRequest(stanza));

            // The user has just entered the groupchat (because join was called)
            // and receives their own presence from the server.
            // See example 24:
            // https://xmpp.org/extensions/xep-0045.html#enter-pres
            const presence = $pres({
                    to:'romeo@montague.lit/orchard',
                    from:'lounge@montague.lit/thirdwitch',
                    id:'DC352437-C019-40EC-B590-AF29E879AF97'
            }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    affiliation: 'member',
                    jid: 'romeo@montague.lit/orchard',
                    role: 'participant'
                }).up()
                .c('status').attrs({code:'110'}).up()
                .c('status').attrs({code:'210'}).nodeTree;

            _converse.connection._dataRecv(mock.createRequest(presence));

            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));
            await mock.returnMemberLists(_converse, muc_jid, [], ['member', 'admin', 'owner']);
            await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-info').length);
            const info_text = sizzle('.chat-content .chat-info:first', view).pop().textContent.trim();
            expect(info_text).toBe('Your nickname has been automatically set to thirdwitch');
        }));

        it("will use the nickname set in the global settings if the user doesn't have a VCard nickname",
                mock.initConverse(['chatBoxesFetched'], {'nickname': 'Benedict-Cucumberpatch'},
                async function (_converse) {

            await mock.openChatRoomViaModal(_converse, 'roomy@muc.montague.lit');
            const view = _converse.chatboxviews.get('roomy@muc.montague.lit');
            expect(view.model.get('nick')).toBe('Benedict-Cucumberpatch');
        }));

        it("will render a nickname form if a nickname conflict happens and muc_nickname_from_jid=false",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'conflicted@muc.montague.lit';
            await mock.openChatRoomViaModal(_converse, muc_jid, 'romeo');
            const iq = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop());

            const features_stanza = $iq({
                    'from': muc_jid,
                    'id': iq.getAttribute('id'),
                    'to': 'romeo@montague.lit/desktop',
                    'type': 'result'
                })
                .c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                    .c('identity', {'category': 'conference', 'name': 'A Dark Cave', 'type': 'text'}).up()
                    .c('feature', {'var': 'http://jabber.org/protocol/muc'}).up()
                    .c('feature', {'var': 'muc_hidden'}).up()
                    .c('feature', {'var': 'muc_temporary'}).up()
            _converse.connection._dataRecv(mock.createRequest(features_stanza));

            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING);

            const presence = $pres().attrs({
                    from: `${muc_jid}/romeo`,
                    id: u.getUniqueId(),
                    to: 'romeo@montague.lit/pda',
                    type: 'error'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                  .c('error').attrs({by: muc_jid, type:'cancel'})
                      .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
            _converse.connection._dataRecv(mock.createRequest(presence));

            const el = await u.waitUntil(() => view.querySelector('.muc-nickname-form .validation-message'));
            expect(el.textContent.trim()).toBe('The nickname you chose is reserved or currently in use, please choose a different one.');
        }));


        it("will automatically choose a new nickname if a nickname conflict happens and muc_nickname_from_jid=true",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const { api } = _converse;
            const muc_jid = 'conflicting@muc.montague.lit'
            await mock.openChatRoomViaModal(_converse, muc_jid, 'romeo');
            /* <presence
             *      from='coven@chat.shakespeare.lit/thirdwitch'
             *      id='n13mt3l'
             *      to='hag66@shakespeare.lit/pda'
             *      type='error'>
             *  <x xmlns='http://jabber.org/protocol/muc'/>
             *  <error by='coven@chat.shakespeare.lit' type='cancel'>
             *      <conflict xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
             *  </error>
             *  </presence>
             */
            api.settings.set('muc_nickname_from_jid', true);

            const attrs = {
                'from': `${muc_jid}/romeo`,
                'id': u.getUniqueId(),
                'to': 'romeo@montague.lit/pda',
                'type': 'error'
            };
            let presence = $pres().attrs(attrs)
                .c('x').attrs({'xmlns':'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({'by': muc_jid, 'type':'cancel'})
                    .c('conflict').attrs({'xmlns':'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

            const view = _converse.chatboxviews.get(muc_jid);
            spyOn(view.model, 'join').and.callThrough();

            // Simulate repeatedly that there's already someone in the groupchat
            // with that nickname
            _converse.connection._dataRecv(mock.createRequest(presence));
            expect(view.model.join).toHaveBeenCalledWith('romeo-2');

            attrs.from = `${muc_jid}/romeo-2`;
            attrs.id = u.getUniqueId();
            presence = $pres().attrs(attrs)
                .c('x').attrs({'xmlns':'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({'by': muc_jid, type:'cancel'})
                    .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
            _converse.connection._dataRecv(mock.createRequest(presence));

            expect(view.model.join).toHaveBeenCalledWith('romeo-3');

            attrs.from = `${muc_jid}/romeo-3`;
            attrs.id = new Date().getTime();
            presence = $pres().attrs(attrs)
                .c('x').attrs({'xmlns': 'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({'by': muc_jid, 'type': 'cancel'})
                    .c('conflict').attrs({'xmlns':'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
            _converse.connection._dataRecv(mock.createRequest(presence));
            expect(view.model.join).toHaveBeenCalledWith('romeo-4');
        }));

        it("will show an error message if the user's nickname doesn't conform to groupchat policy",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'conformist@muc.montague.lit'
            await mock.openChatRoomViaModal(_converse, muc_jid, 'romeo');

            const iq = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop());
            const features_stanza = $iq({
                    'from': muc_jid,
                    'id': iq.getAttribute('id'),
                    'to': 'romeo@montague.lit/desktop',
                    'type': 'result'
                }).c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                    .c('identity', {'category': 'conference', 'name': 'A Dark Cave', 'type': 'text'}).up()
                    .c('feature', {'var': 'http://jabber.org/protocol/muc'}).up()
            _converse.connection._dataRecv(mock.createRequest(features_stanza));

            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING));

            const presence = $pres().attrs({
                    from: `${muc_jid}/romeo`,
                    id: u.getUniqueId(),
                    to:'romeo@montague.lit/pda',
                    type:'error'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                  .c('error').attrs({by:'lounge@montague.lit', type:'cancel'})
                      .c('not-acceptable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

            _converse.connection._dataRecv(mock.createRequest(presence));
            const el = await u.waitUntil(() => view.querySelector('.chatroom-body converse-muc-disconnected .disconnect-msg:last-child'));
            expect(el.textContent.trim()).toBe("Your nickname doesn't conform to this groupchat's policies.");
        }));

        it("doesn't show the nickname field if locked_muc_nickname is true",
                mock.initConverse(['chatBoxesFetched'], {'locked_muc_nickname': true, 'muc_nickname_from_jid': true}, async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-add-muc-modal').click();
            mock.closeControlBox(_converse);
            const modal = _converse.api.modal.get('converse-add-muc-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000)
            const name_input = modal.querySelector('input[name="chatroom"]');
            name_input.value = 'lounge@montague.lit';
            expect(modal.querySelector('label[for="nickname"]')).toBe(null);
            expect(modal.querySelector('input[name="nickname"]')).toBe(null);
            modal.querySelector('form input[type="submit"]').click();
            await u.waitUntil(() => _converse.chatboxes.length > 1);
            const chatroom = _converse.chatboxes.get('lounge@montague.lit');
            expect(chatroom.get('nick')).toBe('romeo');
        }));

        it("uses the JID node if muc_nickname_from_jid is set to true",
                mock.initConverse(['chatBoxesFetched'], {'muc_nickname_from_jid': true}, async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-add-muc-modal').click();
            mock.closeControlBox(_converse);
            const modal = _converse.api.modal.get('converse-add-muc-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000)
            const label_nick = modal.querySelector('label[for="nickname"]');
            expect(label_nick.textContent.trim()).toBe('Nickname:');
            const nick_input = modal.querySelector('input[name="nickname"]');
            expect(nick_input.value).toBe('romeo');
        }));

        it("uses the nickname passed in to converse.initialize",
                mock.initConverse(['chatBoxesFetched'], {'nickname': 'st.nick'}, async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-add-muc-modal').click();
            mock.closeControlBox(_converse);
            const modal = _converse.api.modal.get('converse-add-muc-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000)
            const label_nick = modal.querySelector('label[for="nickname"]');
            expect(label_nick.textContent.trim()).toBe('Nickname:');
            const nick_input = modal.querySelector('input[name="nickname"]');
            expect(nick_input.value).toBe('st.nick');
        }));
    });
});
