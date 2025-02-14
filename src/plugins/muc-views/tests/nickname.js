/*global mock, converse */

const { Strophe, sizzle, u, stx } = converse.env;

describe("A MUC", function () {

    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it("allows you to change your nickname via a modal",
        mock.initConverse(
            [],
            { view_mode: 'fullscreen', auto_register_muc_nickname: true },
            async function (_converse) {

        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        const model = await mock.openAndEnterMUC(_converse, muc_jid, nick);

        expect(model.get('nick')).toBe(nick);
        expect(model.occupants.length).toBe(1);
        expect(model.occupants.at(0).get('nick')).toBe(nick);

        const view = _converse.chatboxviews.get(muc_jid);
        const dropdown_item = await u.waitUntil(() => view.querySelector(".open-nickname-modal"));
        dropdown_item.click();

        const modal = _converse.api.modal.get('converse-muc-nickname-modal');
        await u.waitUntil(() => u.isVisible(modal));

        const input = modal.querySelector('input[name="nick"]');
        expect(input.value).toBe(nick);

        const newnick = 'loverboy';
        input.value = newnick;
        modal.querySelector('input[type="submit"]')?.click();

        await u.waitUntil(() => !u.isVisible(modal));
        const { sent_stanzas } = _converse.api.connection.get();
        const sent_stanza = sent_stanzas.pop()
        expect(sent_stanza).toEqualStanza(
            stx`<presence from="${_converse.jid}"
                id="${sent_stanza.getAttribute('id')}"
                to="${muc_jid}/${newnick}"
                xmlns="jabber:client"/>`);

        // clear sent stanzas
        const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
        while (IQ_stanzas.length) IQ_stanzas.pop();

        // Two presence stanzas are received from the MUC service
        _converse.api.connection.get()._dataRecv(mock.createRequest(
            stx`
            <presence
                xmlns="jabber:client"
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

        await u.waitUntil(() => model.get('nick') === newnick);

        // Check that the new nickname gets registered with the MUC
        _converse.api.connection.get()._dataRecv(mock.createRequest(
            stx`
            <presence
                xmlns="jabber:client"
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

        let stanza = await u.waitUntil(() => IQ_stanzas.find(
            iq => sizzle(`iq[type="get"] query[xmlns="${Strophe.NS.MUC_REGISTER}"]`, iq).length));

        expect(stanza).toEqualStanza(
            stx`<iq to="lounge@montague.lit"
                    type="get"
                    xmlns="jabber:client"
                    id="${stanza.getAttribute('id')}"><query xmlns="jabber:iq:register"/></iq>`);

        _converse.api.connection.get()._dataRecv(mock.createRequest(
            stx`<iq from="${muc_jid}"
                id="${stanza.getAttribute('id')}"
                to="${_converse.session.get('jid')}"
                xmlns="jabber:client"
                type="result">
            <query xmlns='jabber:iq:register'>
                <x xmlns='jabber:x:data' type='form'>
                <field
                    type='hidden'
                    var='FORM_TYPE'>
                    <value>http://jabber.org/protocol/muc#register</value>
                </field>
                <field
                    label='Desired Nickname'
                    type='text-single'
                    var='muc#register_roomnick'>
                    <required/>
                </field>
                </x>
            </query>
            </iq>`));

        stanza = await u.waitUntil(() => IQ_stanzas.find(
            iq => sizzle(`iq[type="set"] query[xmlns="${Strophe.NS.MUC_REGISTER}"]`, iq).length));

        expect(stanza).toEqualStanza(
            stx`<iq xmlns="jabber:client" to="${muc_jid}" type="set" id="${stanza.getAttribute('id')}">
                <query xmlns="jabber:iq:register">
                <x xmlns="jabber:x:data" type="submit">
                    <field var="FORM_TYPE"><value>http://jabber.org/protocol/muc#register</value></field>
                    <field var="muc#register_roomnick"><value>loverboy</value></field>
                </x>
                </query>
            </iq>`);
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
        await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'oldnick');

        const view = _converse.chatboxviews.get('lounge@montague.lit');
        await u.waitUntil(() => view.querySelectorAll('li .occupant-nick').length, 500);
        let occupants = view.querySelector('.occupant-list');
        expect(occupants.querySelectorAll('.occupant-nick').length).toBe(1);
        expect(occupants.querySelector('.occupant-nick').textContent.trim()).toBe("oldnick");

        const csntext = await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent);
        expect(csntext.trim()).toEqual("oldnick has entered the groupchat");

        let presence = stx`
            <presence
                    xmlns="jabber:client"
                    from='lounge@montague.lit/oldnick'
                    id='DC352437-C019-40EC-B590-AF29E879AF98'
                    to='romeo@montague.lit/pda'
                    type='unavailable'>
                <x xmlns='http://jabber.org/protocol/muc#user'>
                    <item affiliation='owner'
                        jid='romeo@montague.lit/pda'
                        nick='newnick'
                        role='moderator'/>
                    <status code='303'/>
                    <status code='110'/>
                </x>
            </presence>`;

        _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
        await u.waitUntil(() => view.querySelectorAll('.chat-info').length);

        expect(sizzle('div.chat-info:last').pop().textContent.trim()).toBe(
            __(_converse.labels.muc.STATUS_CODE_MESSAGES["303"], "newnick")
        );
        expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.ENTERED);

        occupants = view.querySelector('.occupant-list');
        expect(occupants.querySelectorAll('.occupant-nick').length).toBe(1);

        presence = stx`
            <presence
                    from='lounge@montague.lit/newnick'
                    id='5B4F27A4-25ED-43F7-A699-382C6B4AFC67'
                    to='romeo@montague.lit/pda'
                    xmlns="jabber:client">
                <x xmlns='http://jabber.org/protocol/muc#user'>
                    <item affiliation='owner'
                        jid='romeo@montague.lit/pda'
                        role='moderator'/>
                    <status code='110'/>
                </x>
            </presence>`;

        _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
        expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.ENTERED);
        expect(view.querySelectorAll('div.chat-info').length).toBe(1);
        expect(sizzle('div.chat-info', view)[0].textContent.trim()).toBe(
            __(_converse.labels.muc.STATUS_CODE_MESSAGES["303"], "newnick")
        );
        occupants = view.querySelector('.occupant-list');
        await u.waitUntil(() => sizzle('.occupant-nick:first', occupants).pop().textContent.trim() === "newnick");
        expect(view.model.occupants.length).toBe(1);
        expect(view.model.get('nick')).toBe("newnick");
    }));

    describe("when being entered", function () {

        it("will use the user's reserved nickname, if it exists",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            const muc_jid = 'lounge@montague.lit';
            _converse.api.rooms.open(muc_jid);
            await mock.waitOnDiscoInfoForNewMUC(_converse, muc_jid);

            const iq = await u.waitUntil(() => IQ_stanzas.filter(
                    s => sizzle(`iq[to="${muc_jid}"] query[node="x-roomuser-item"]`, s).length
                ).pop());

            expect(iq).toEqualStanza(stx`
                <iq from="romeo@montague.lit/orchard" id="${iq.getAttribute('id')}" to="${muc_jid}" type="get" xmlns="jabber:client">
                    <query node="x-roomuser-item" xmlns="http://jabber.org/protocol/disco#info"/>
                </iq>`);

            const stanza = stx`
                <iq type="result"
                    id="${iq.getAttribute("id")}"
                    from="${muc_jid}"
                    to="${_converse.api.connection.get().jid}"
                    xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/disco#info" node="x-roomuser-item">
                        <identity category="conference" name="thirdwitch" type="text"/>
                    </query>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

            // The user has just entered the groupchat (because join was called)
            // and receives their own presence from the server.
            // See example 24:
            // https://xmpp.org/extensions/xep-0045.html#enter-pres
            const presence = stx`
                <presence
                    to="romeo@montague.lit/orchard"
                    from="lounge@montague.lit/thirdwitch"
                    id="DC352437-C019-40EC-B590-AF29E879AF97"
                    xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="member"
                            jid="romeo@montague.lit/orchard"
                            role="participant"/>
                        <status code="110"/>
                        <status code="210"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            // clear sent stanzas
            while (IQ_stanzas.length) IQ_stanzas.pop();

            // Now that the user has entered the groupchat, the features are requested again.
            await mock.waitForMUCDiscoFeatures(_converse, muc_jid);

            const view = await u.waitUntil(() => _converse.chatboxviews.get(muc_jid));
            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));
            await mock.returnMemberLists(_converse, muc_jid, [], ['member', 'admin', 'owner']);
            await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-info').length);
            const info_text = sizzle('.chat-content .chat-info:first', view).pop().textContent.trim();
            expect(info_text).toBe('Your nickname has been automatically set to thirdwitch');
        }));

        it("will use the nickname set in the global settings if the user doesn't have a VCard nickname",
                mock.initConverse(['chatBoxesFetched'], { nickname: 'Benedict-Cucumberpatch'},
                async function (_converse) {

            const { api } = _converse;
            const muc_jid = 'roomy@muc.montague.lit';
            api.rooms.open(muc_jid);
            await mock.waitForMUCDiscoFeatures(_converse, muc_jid);
            await mock.waitForReservedNick(_converse, muc_jid, '');
            const view = await u.waitUntil(() => _converse.chatboxviews.get(muc_jid));
            expect(view.model.get('nick')).toBe('Benedict-Cucumberpatch');
        }));

        it("will render a nickname form if a nickname conflict happens and muc_nickname_from_jid=false",
                mock.initConverse([], { vcard: { nickname: '' }}, async function (_converse) {

            const { api } = _converse;
            const muc_jid = 'conflicted@muc.montague.lit';
            api.rooms.open(muc_jid, { nick: 'romeo' });
            await mock.waitForMUCDiscoFeatures(_converse, muc_jid);

            _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
                <presence
                        from="${muc_jid}/romeo"
                        id="${u.getUniqueId()}"
                        to="romeo@montague.lit/pda"
                        type="error"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc"/>
                    <error by="${muc_jid}" type="cancel">
                        <conflict xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                    </error>
                </presence>`));

            const view = await u.waitUntil(() => _converse.chatboxviews.get(muc_jid));
            const el = await u.waitUntil(() => view.querySelector('.muc-nickname-form .validation-message'));
            expect(el.textContent.trim()).toBe('The nickname you chose is reserved or currently in use, please choose a different one.');
        }));

        it("will automatically choose a new nickname if a nickname conflict happens and muc_nickname_from_jid=true",
                mock.initConverse(['chatBoxesFetched'], {vcard: { nickname: '' }}, async function (_converse) {

            const { api } = _converse;
            const muc_jid = 'conflicting@muc.montague.lit'

            api.settings.set('muc_nickname_from_jid', true);
            api.rooms.open(muc_jid, { nick: 'romeo' });
            await mock.waitForMUCDiscoFeatures(_converse, muc_jid);

            const connection = api.connection.get();
            const sent_stanzas = connection.sent_stanzas;
            await u.waitUntil(() => sent_stanzas.filter(iq => sizzle('presence history', iq).length).pop());

            const { IQ_stanzas } = api.connection.get();

            while (IQ_stanzas.length) IQ_stanzas.pop();
            while (sent_stanzas.length) sent_stanzas.pop();

            // Simulate repeatedly that there's already someone in the groupchat
            // with that nickname
            let presence = stx`
                <presence xmlns="jabber:client"
                        from='${muc_jid}/romeo'
                        id='${u.getUniqueId()}'
                        to='${api.connection.get().jid}'
                        type='error'>
                    <x xmlns='http://jabber.org/protocol/muc'/>
                    <error by='${muc_jid}' type='cancel'>
                        <conflict xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                    </error>
                </presence>`;
            api.connection.get()._dataRecv(mock.createRequest(presence));

            await mock.waitForMUCDiscoFeatures(_converse, muc_jid);

            let sent_stanza = await u.waitUntil(() => sent_stanzas.filter(iq => sizzle('presence history', iq).length).pop());
            expect(sent_stanza).toEqualStanza(stx`
                <presence id="${sent_stanza.getAttribute('id')}"
                        from="${connection.jid}"
                        to="${muc_jid}/romeo-2"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc">
                        <history maxstanzas="0"/>
                    </x>
                    <c xmlns="http://jabber.org/protocol/caps" hash="sha-1" node="https://conversejs.org"
                        ver="TfHz9vOOfqIG0Z9lW5CuPaWGnrQ="/>
                </presence>`);

            while (IQ_stanzas.length) IQ_stanzas.pop();
            while (sent_stanzas.length) sent_stanzas.pop();

            presence = stx`
                <presence
                        xmlns="jabber:client"
                        from="${muc_jid}/romeo-2"
                        id="${u.getUniqueId()}"
                        to="romeo@montague.lit/pda"
                        type="error">
                    <x xmlns="http://jabber.org/protocol/muc"/>
                    <error by="${muc_jid}" type="cancel">
                        <conflict xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                    </error>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            await mock.waitForMUCDiscoFeatures(_converse, muc_jid);

            sent_stanza = await u.waitUntil(() => sent_stanzas.filter(iq => sizzle('presence history', iq).length).pop());
            expect(sent_stanza).toEqualStanza(stx`
                <presence id="${sent_stanza.getAttribute('id')}"
                        from="${connection.jid}"
                        to="${muc_jid}/romeo-3"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc">
                        <history maxstanzas="0"/>
                    </x>
                    <c xmlns="http://jabber.org/protocol/caps" hash="sha-1" node="https://conversejs.org"
                        ver="TfHz9vOOfqIG0Z9lW5CuPaWGnrQ="/>
                </presence>`);

            while (IQ_stanzas.length) IQ_stanzas.pop();
            while (sent_stanzas.length) sent_stanzas.pop();

            presence = stx`
                <presence
                        xmlns="jabber:client"
                        from="${muc_jid}/romeo-3"
                        id="${u.getUniqueId()}"
                        to="romeo@montague.lit/pda"
                        type="error">
                    <x xmlns="http://jabber.org/protocol/muc"/>
                    <error by="${muc_jid}" type="cancel">
                        <conflict xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                    </error>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            await mock.waitForMUCDiscoFeatures(_converse, muc_jid);

            sent_stanza = await u.waitUntil(() => sent_stanzas.filter(iq => sizzle('presence history', iq).length).pop());
            expect(sent_stanza).toEqualStanza(stx`
                <presence id="${sent_stanza.getAttribute('id')}"
                        from="${connection.jid}"
                        to="${muc_jid}/romeo-4"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc">
                        <history maxstanzas="0"/>
                    </x>
                    <c xmlns="http://jabber.org/protocol/caps" hash="sha-1" node="https://conversejs.org"
                        ver="TfHz9vOOfqIG0Z9lW5CuPaWGnrQ="/>
                </presence>`);
        }));

        it("will show an error message if the user's nickname doesn't conform to groupchat policy",
                mock.initConverse([], {}, async function (_converse) {

            const { api } = _converse;
            const muc_jid = 'conformist@muc.montague.lit'
            api.rooms.open(muc_jid, { nick: 'romeo' });
            await mock.waitForMUCDiscoFeatures(_converse, muc_jid);

            const presence = stx`
                <presence
                    xmlns="jabber:client"
                    from='${muc_jid}/romeo'
                    id='${u.getUniqueId()}'
                    to='romeo@montague.lit/pda'
                    type='error'>
                    <x xmlns='http://jabber.org/protocol/muc'/>
                    <error by='lounge@montague.lit' type='cancel'>
                        <not-acceptable xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                    </error>
                </presence>`;
            api.connection.get()._dataRecv(mock.createRequest(presence));

            const view = await u.waitUntil(() => _converse.chatboxviews.get(muc_jid));
            const el = await u.waitUntil(() => view.querySelector('.chatroom-body converse-muc-disconnected .disconnect-msg:last-child'));
            expect(el.textContent.trim()).toBe("Your nickname doesn't conform to this groupchat's policies.");
        }));

        it("doesn't show the nickname field if locked_muc_nickname is true",
            mock.initConverse(['chatBoxesFetched'], {
                locked_muc_nickname: true,
                muc_nickname_from_jid: true,
                vcard: { nickname: '' },
            }, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-add-muc-modal').click();

            const modal = _converse.api.modal.get('converse-add-muc-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000)
            const name_input = modal.querySelector('input[name="chatroom"]');
            name_input.value = muc_jid;
            expect(modal.querySelector('label[for="nickname"]')).toBe(null);
            expect(modal.querySelector('input[name="nickname"]')).toBe(null);
            modal.querySelector('form input[type="submit"]').click();

            await mock.waitForMUCDiscoFeatures(_converse, muc_jid);
            await u.waitUntil(() => _converse.chatboxes.length > 1);
            const chatroom = _converse.chatboxes.get(muc_jid);
            expect(chatroom.get('nick')).toBe('romeo');
        }));

        it("uses the JID node if muc_nickname_from_jid is set to true",
            mock.initConverse(
                ['chatBoxesFetched'],
                {
                    'muc_nickname_from_jid': true,
                    blacklisted_plugins: ['converse-vcard']
                }, async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-add-muc-modal').click();

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

            const modal = _converse.api.modal.get('converse-add-muc-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000)
            const label_nick = modal.querySelector('label[for="nickname"]');
            expect(label_nick.textContent.trim()).toBe('Nickname:');
            const nick_input = modal.querySelector('input[name="nickname"]');
            expect(nick_input.value).toBe('st.nick');
        }));
    });
});
