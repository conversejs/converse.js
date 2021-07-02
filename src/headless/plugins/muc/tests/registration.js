/*global mock, converse */

const { $iq, Strophe, sizzle, u } = converse.env;

describe("Chatrooms", function () {

    describe("The auto_register_muc_nickname option", function () {

        it("allows you to automatically register your nickname when joining a room",
                mock.initConverse(['chatBoxesFetched'], {'auto_register_muc_nickname': true},
                async function (_converse) {

            const muc_jid = 'coven@chat.shakespeare.lit';
            const room = await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');

            let stanza = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(
                iq => sizzle(`iq[to="${muc_jid}"][type="get"] query[xmlns="jabber:iq:register"]`, iq).length
            ).pop());

            expect(Strophe.serialize(stanza))
            .toBe(`<iq id="${stanza.getAttribute('id')}" to="${muc_jid}" `+
                        `type="get" xmlns="jabber:client">`+
                    `<query xmlns="jabber:iq:register"/></iq>`);
            const result = $iq({
                'from': room.get('jid'),
                'id': stanza.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result',
            }).c('query', {'xmlns': 'jabber:iq:register'})
                .c('x', {'xmlns': 'jabber:x:data', 'type': 'form'})
                    .c('field', {
                        'label': 'Desired Nickname',
                        'type': 'text-single',
                        'var': 'muc#register_roomnick'
                    }).c('required');
            _converse.connection._dataRecv(mock.createRequest(result));
            stanza = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(
                iq => sizzle(`iq[to="${muc_jid}"][type="set"] query[xmlns="jabber:iq:register"]`, iq).length
            ).pop());

            expect(Strophe.serialize(stanza)).toBe(
                `<iq id="${stanza.getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">`+
                    `<query xmlns="jabber:iq:register">`+
                        `<x type="submit" xmlns="jabber:x:data">`+
                            `<field var="FORM_TYPE"><value>http://jabber.org/protocol/muc#register</value></field>`+
                            `<field var="muc#register_roomnick"><value>romeo</value></field>`+
                        `</x>`+
                    `</query>`+
                `</iq>`);
        }));

        it("allows you to automatically deregister your nickname when closing a room",
                mock.initConverse(['chatBoxesFetched'], {'auto_register_muc_nickname': 'unregister'},
                async function (_converse) {

            const muc_jid = 'coven@chat.shakespeare.lit';
            const room = await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');

            let stanza = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(
                iq => sizzle(`iq[to="${muc_jid}"][type="get"] query[xmlns="jabber:iq:register"]`, iq).length
            ).pop());
            let result = $iq({
                'from': room.get('jid'),
                'id': stanza.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result',
            }).c('query', {'xmlns': 'jabber:iq:register'})
                .c('x', {'xmlns': 'jabber:x:data', 'type': 'form'})
                    .c('field', {
                        'label': 'Desired Nickname',
                        'type': 'text-single',
                        'var': 'muc#register_roomnick'
                    }).c('required');
            _converse.connection._dataRecv(mock.createRequest(result));
            await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(
                iq => sizzle(`iq[to="${muc_jid}"][type="set"] query[xmlns="jabber:iq:register"]`, iq).length
            ).pop());

            _converse.connection.IQ_stanzas = [];
            room.close();

            stanza = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(
                iq => sizzle(`iq[to="${muc_jid}"][type="set"] query[xmlns="jabber:iq:register"]`, iq).length
            ).pop());
            expect(Strophe.serialize(stanza)).toBe(
                `<iq id="${stanza.getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">`+
                    `<query xmlns="jabber:iq:register"><remove/></query>`+
                `</iq>`);

            result = $iq({
                'from': room.get('jid'),
                'id': stanza.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result',
            }).c('query', {'xmlns': 'jabber:iq:register'});
            _converse.connection._dataRecv(mock.createRequest(result));

        }));
    });
});
