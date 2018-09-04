(function (root, factory) {
    define(["jasmine", "mock", "test-utils" ], factory);
} (this, function (jasmine, mock, test_utils) {
    const _ = converse.env._,
          $iq = converse.env.$iq,
          Strophe = converse.env.Strophe,
          u = converse.env.utils;

    describe("The _converse.api.rooms API", function () {

        it("allows you to register a user with a room", 
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                function (done, _converse) {

            let view;
            const room_jid = 'coven@chat.shakespeare.lit';
            test_utils.openAndEnterChatRoom(_converse, 'coven', 'chat.shakespeare.lit', 'romeo')
            .then(() => {
                view = _converse.chatboxviews.get(room_jid);
                _converse.api.rooms.register(room_jid, _converse.bare_jid, 'romeo');
                return test_utils.waitUntil(() => _.get(_.filter(
                    _converse.connection.IQ_stanzas,
                    iq => iq.nodeTree.querySelector(`iq[to="coven@chat.shakespeare.lit"] query[xmlns="jabber:iq:register"]`)
                ).pop(), 'nodeTree'));
            }).then(stanza => {
                expect(stanza.outerHTML)
                .toBe(`<iq from="dummy@localhost" to="coven@chat.shakespeare.lit" `+
                            `type="get" xmlns="jabber:client" id="${stanza.getAttribute('id')}">`+
                        `<query xmlns="jabber:iq:register"/></iq>`);
                // Room does not exist
                const result = $iq({
                    'from': view.model.get('jid'),
                    'id': stanza.getAttribute('id'),
                    'to': _converse.bare_jid,
                    'type': 'error',
                }).c('error', {'type': "cancel"})
                    .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"})
                _converse.connection._dataRecv(test_utils.createRequest(result));
                done();
            }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
        }));
    });
}));
