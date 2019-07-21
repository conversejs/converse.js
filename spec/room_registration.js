(function (root, factory) {
    define(["jasmine", "mock", "test-utils" ], factory);
} (this, function (jasmine, mock, test_utils) {
    const _ = converse.env._,
          $iq = converse.env.$iq,
          Strophe = converse.env.Strophe,
          sizzle = converse.env.sizzle,
          u = converse.env.utils;

    describe("Chatrooms", function () {


        describe("The /register commmand", function () {

            it("allows you to register your nickname in a room",
                mock.initConverse(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {'auto_register_muc_nickname': true},
                    async function (done, _converse) {

                const muc_jid = 'coven@chat.shakespeare.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo')
                const view = _converse.chatboxviews.get(muc_jid);
                const textarea = view.el.querySelector('.chat-textarea')
                textarea.value = '/register';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13
                });
                let stanza = await u.waitUntil(() => _.filter(
                    _converse.connection.IQ_stanzas,
                    iq => sizzle(`iq[to="${muc_jid}"][type="get"] query[xmlns="jabber:iq:register"]`, iq).length
                ).pop());
                expect(Strophe.serialize(stanza))
                    .toBe(`<iq from="romeo@montague.lit/orchard" id="${stanza.getAttribute('id')}" to="coven@chat.shakespeare.lit" `+
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
                _converse.connection._dataRecv(test_utils.createRequest(result));
                stanza = await u.waitUntil(() => _.filter(
                    _converse.connection.IQ_stanzas,
                    iq => sizzle(`iq[to="${muc_jid}"][type="set"] query[xmlns="jabber:iq:register"]`, iq).length
                ).pop());

                expect(Strophe.serialize(stanza)).toBe(
                    `<iq from="romeo@montague.lit/orchard" id="${stanza.getAttribute('id')}" to="coven@chat.shakespeare.lit" type="set" xmlns="jabber:client">`+
                        `<query xmlns="jabber:iq:register">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                                `<field var="FORM_TYPE"><value>http://jabber.org/protocol/muc#register</value></field>`+
                                `<field var="muc#register_roomnick"><value>romeo</value></field>`+
                            `</x>`+
                        `</query>`+
                    `</iq>`);
                done();
            }));

        });

        describe("The auto_register_muc_nickname option", function () {

            it("allows you to automatically register your nickname when joining a room",
                mock.initConverse(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {'auto_register_muc_nickname': true},
                    async function (done, _converse) {

                const IQ_stanzas = _converse.connection.IQ_stanzas;
                const muc_jid = 'coven@chat.shakespeare.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
                const view = _converse.chatboxviews.get(muc_jid);

                let stanza = await u.waitUntil(() => _.filter(
                    _converse.connection.IQ_stanzas,
                    iq => sizzle(`iq[to="coven@chat.shakespeare.lit"][type="get"] query[xmlns="jabber:iq:register"]`, iq).length
                ).pop());

                expect(Strophe.serialize(stanza))
                .toBe(`<iq from="romeo@montague.lit/orchard" id="${stanza.getAttribute('id')}" to="coven@chat.shakespeare.lit" `+
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
                _converse.connection._dataRecv(test_utils.createRequest(result));
                stanza = await u.waitUntil(() => _.filter(
                    _converse.connection.IQ_stanzas,
                    iq => sizzle(`iq[to="coven@chat.shakespeare.lit"][type="set"] query[xmlns="jabber:iq:register"]`, iq).length
                ).pop());

                expect(Strophe.serialize(stanza)).toBe(
                    `<iq from="romeo@montague.lit/orchard" id="${stanza.getAttribute('id')}" to="coven@chat.shakespeare.lit" type="set" xmlns="jabber:client">`+
                        `<query xmlns="jabber:iq:register">`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                                `<field var="FORM_TYPE"><value>http://jabber.org/protocol/muc#register</value></field>`+
                                `<field var="muc#register_roomnick"><value>romeo</value></field>`+
                            `</x>`+
                        `</query>`+
                    `</iq>`);
                done();
            }));
        });
    });
}));
