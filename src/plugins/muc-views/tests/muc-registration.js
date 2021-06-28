/*global mock, converse */

const { $iq, Strophe, sizzle, u } = converse.env;

describe("Chatrooms", function () {

    describe("The /register commmand", function () {

        it("allows you to register your nickname in a room",
                mock.initConverse(['chatBoxesFetched'], {'auto_register_muc_nickname': true},
                async function (_converse) {

            const muc_jid = 'coven@chat.shakespeare.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo')
            const view = _converse.chatboxviews.get(muc_jid);
            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/register';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13
            });
            let stanza = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(
                iq => sizzle(`iq[to="${muc_jid}"][type="get"] query[xmlns="jabber:iq:register"]`, iq).length
            ).pop());
            expect(Strophe.serialize(stanza))
                .toBe(`<iq id="${stanza.getAttribute('id')}" to="coven@chat.shakespeare.lit" `+
                            `type="get" xmlns="jabber:client">`+
                        `<query xmlns="jabber:iq:register"/></iq>`);
            const result = $iq({
                'from': view.model.get('jid'),
                'id': stanza.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result',
            }).c('query', {'type': 'jabber:iq:register'})
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
                `<iq id="${stanza.getAttribute('id')}" to="coven@chat.shakespeare.lit" type="set" xmlns="jabber:client">`+
                    `<query xmlns="jabber:iq:register">`+
                        `<x type="submit" xmlns="jabber:x:data">`+
                            `<field var="FORM_TYPE"><value>http://jabber.org/protocol/muc#register</value></field>`+
                            `<field var="muc#register_roomnick"><value>romeo</value></field>`+
                        `</x>`+
                    `</query>`+
                `</iq>`);
        }));
    });
});
