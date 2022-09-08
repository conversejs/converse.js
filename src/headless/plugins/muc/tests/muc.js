/*global mock, converse */

const { Strophe, sizzle, u } = converse.env;

describe("Groupchats", function () {

    it("keeps track of unread messages and mentions",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        // Open a hidden room
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick, [], [], false, {'hidden': true});
        const model = _converse.chatboxes.get(muc_jid);

        _converse.connection._dataRecv(mock.createRequest(u.toStanza(`
            <message xmlns="jabber:client" type="groupchat" id="1" to="${_converse.jid}" xml:lang="en" from="${muc_jid}/juliet">
                <body>Romeo oh romeo</body>
            </message>`)));
        await u.waitUntil(() => model.messages.length);
        expect(model.get('num_unread_general')).toBe(1);
        expect(model.get('num_unread')).toBe(1);

        _converse.connection._dataRecv(mock.createRequest(u.toStanza(`
            <message xmlns="jabber:client" type="groupchat" id="2" to="${_converse.jid}" xml:lang="en" from="${muc_jid}/juliet">
                <body>Wherefore art though?</body>
            </message>`)));

        await u.waitUntil(() => model.messages.length === 2);

        expect(model.get('num_unread_general')).toBe(2);
        expect(model.get('num_unread')).toBe(1);

        // Check that unread counters are cleared when chat becomes visible
        model.set('hidden', false);
        expect(model.get('num_unread_general')).toBe(0);
        expect(model.get('num_unread')).toBe(0);
    }));

    describe("A groupchat", function () {

        it("sends the user status when joining and when it changes",
                mock.initConverse(['statusInitialized'], {}, async function (_converse) {

            const muc_jid = 'coven@chat.shakespeare.lit';
            _converse.xmppstatus.set('status', 'away');

            const sent_stanzas = _converse.connection.sent_stanzas;
            while (sent_stanzas.length) sent_stanzas.pop();

            const muc = await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');

            let pres = await u.waitUntil(() => sent_stanzas.filter(s => s.nodeName === 'presence').pop());
            expect(Strophe.serialize(pres)).toBe(
                `<presence from="${_converse.jid}" id="${pres.getAttribute('id')}" to="${muc_jid}/romeo" xmlns="jabber:client">`+
                    `<x xmlns="http://jabber.org/protocol/muc"><history maxstanzas="0"/></x>`+
                    `<show>away</show>`+
                    `<c hash="sha-1" node="https://conversejs.org" ver="TfHz9vOOfqIG0Z9lW5CuPaWGnrQ=" xmlns="http://jabber.org/protocol/caps"/>`+
                `</presence>`);

            expect(muc.getOwnOccupant().get('show')).toBe('away');

            while (sent_stanzas.length) sent_stanzas.pop();

            _converse.xmppstatus.set('status', 'xa');
            pres = await u.waitUntil(() => sent_stanzas.filter(s => s.nodeName === 'presence' && s.getAttribute('to') === `${muc_jid}/romeo`).pop());

            expect(Strophe.serialize(pres)).toBe(
                `<presence to="${muc_jid}/romeo" xmlns="jabber:client">`+
                    `<show>xa</show>`+
                    `<priority>0</priority>`+
                    `<c hash="sha-1" node="https://conversejs.org" ver="TfHz9vOOfqIG0Z9lW5CuPaWGnrQ=" xmlns="http://jabber.org/protocol/caps"/>`+
                `</presence>`)

            _converse.xmppstatus.set('status', 'dnd');
            _converse.xmppstatus.set('status_message', 'Do not disturb');
            while (sent_stanzas.length) sent_stanzas.pop();

            const muc2_jid = 'cave@chat.shakespeare.lit';
            const muc2 = await mock.openAndEnterChatRoom(_converse, muc2_jid, 'romeo');

            pres = await u.waitUntil(() => sent_stanzas.filter(s => s.nodeName === 'presence').pop());
            expect(Strophe.serialize(pres)).toBe(
                `<presence from="${_converse.jid}" id="${pres.getAttribute('id')}" to="${muc2_jid}/romeo" xmlns="jabber:client">`+
                    `<x xmlns="http://jabber.org/protocol/muc"><history maxstanzas="0"/></x>`+
                    `<show>dnd</show>`+
                    `<status>Do not disturb</status>`+
                    `<c hash="sha-1" node="https://conversejs.org" ver="TfHz9vOOfqIG0Z9lW5CuPaWGnrQ=" xmlns="http://jabber.org/protocol/caps"/>`+
                `</presence>`);

            expect(muc2.getOwnOccupant().get('show')).toBe('dnd');

        }));

        it("reconnects when no-acceptable error is returned when sending a message",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'coven@chat.shakespeare.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const model = _converse.chatboxes.get(muc_jid);
            expect(model.session.get('connection_status')).toBe(converse.ROOMSTATUS.ENTERED);
            model.sendMessage({'body': 'hello world'});

            const stanza = u.toStanza(`
                <message xmlns='jabber:client'
                         from='${muc_jid}'
                         type='error'
                         to='${_converse.bare_jid}'>
                    <error type='cancel'>
                        <not-acceptable xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                    </error>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));

            let sent_stanzas = _converse.connection.sent_stanzas;
            const iq = await u.waitUntil(() => sent_stanzas.filter(s => sizzle(`[xmlns="${Strophe.NS.PING}"]`, s).length).pop());
            expect(Strophe.serialize(iq)).toBe(
                `<iq id="${iq.getAttribute('id')}" to="coven@chat.shakespeare.lit/romeo" type="get" xmlns="jabber:client">`+
                    `<ping xmlns="urn:xmpp:ping"/>`+
                `</iq>`);

            const result = u.toStanza(`
                <iq from='${muc_jid}'
                    id='${iq.getAttribute('id')}'
                    to='${_converse.bare_jid}'
                    type='error'>
                <error type='cancel'>
                    <not-acceptable xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                </error>
                </iq>`);
            sent_stanzas = _converse.connection.sent_stanzas;
            const index = sent_stanzas.length -1;

            _converse.connection.IQ_stanzas = [];
            _converse.connection._dataRecv(mock.createRequest(result));
            await mock.getRoomFeatures(_converse, muc_jid);

            const pres = await u.waitUntil(
                () => sent_stanzas.slice(index).filter(s => s.nodeName === 'presence').pop());
            expect(Strophe.serialize(pres)).toBe(
                `<presence from="${_converse.jid}" id="${pres.getAttribute('id')}" to="coven@chat.shakespeare.lit/romeo" xmlns="jabber:client">`+
                    `<x xmlns="http://jabber.org/protocol/muc"><history maxstanzas="0"/></x>`+
                    `<c hash="sha-1" node="https://conversejs.org" ver="TfHz9vOOfqIG0Z9lW5CuPaWGnrQ=" xmlns="http://jabber.org/protocol/caps"/>`+
                `</presence>`);
        }));
    });
});
