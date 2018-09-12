(function (root, factory) {
    define(["jasmine", "mock", "test-utils" ], factory);
} (this, function (jasmine, mock, test_utils) {
    const _ = converse.env._,
          $iq = converse.env.$iq,
          Strophe = converse.env.Strophe,
          sizzle = converse.env.sizzle,
          u = converse.env.utils;

    describe("Chatrooms", function () {
        describe("The auto_register_muc_nickname option", function () {

            it("allows you to automatically register your nickname when joining a room", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {'auto_register_muc_nickname': true},
                    function (done, _converse) {

                let view;
                const room_jid = 'coven@chat.shakespeare.lit';
                test_utils.openAndEnterChatRoom(_converse, 'coven', 'chat.shakespeare.lit', 'romeo')
                .then(() => {
                    view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                    return test_utils.waitUntil(() => _.get(_.filter(
                        _converse.connection.IQ_stanzas,
                        iq => sizzle(`iq[to="coven@chat.shakespeare.lit"][type="get"] query[xmlns="jabber:iq:register"]`, iq.nodeTree).length
                    ).pop(), 'nodeTree'));
                }).then(stanza => {
                    expect(stanza.outerHTML)
                    .toBe(`<iq to="coven@chat.shakespeare.lit" from="dummy@localhost/resource" `+
                                `type="get" xmlns="jabber:client" id="${stanza.getAttribute('id')}">`+
                            `<query xmlns="jabber:iq:register"/></iq>`);
                    view = _converse.chatboxviews.get(room_jid);
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
                    return test_utils.waitUntil(() => _.get(_.filter(
                        _converse.connection.IQ_stanzas,
                        iq => sizzle(`iq[to="coven@chat.shakespeare.lit"][type="set"] query[xmlns="jabber:iq:register"]`, iq.nodeTree).length
                    ).pop(), 'nodeTree'));
                }).then(stanza => {
                    expect(stanza.outerHTML).toBe(
                        `<iq to="coven@chat.shakespeare.lit" from="dummy@localhost/resource" type="set" xmlns="jabber:client" id="${stanza.getAttribute('id')}">`+
                            `<query xmlns="jabber:iq:register">`+
                                `<x xmlns="jabber:x:data" type="submit">`+
                                    `<field var="FORM_TYPE"><value>http://jabber.org/protocol/muc#register</value></field>`+
                                    `<field var="muc#register_roomnick"><value>romeo</value></field>`+
                                `</x>`+
                            `</query>`+
                        `</iq>`);
                    done();
                }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
            }));
        });
    });
}));
