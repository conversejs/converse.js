(function (root, factory) {
    define(["jasmine", "mock", "test-utils" ], factory);
} (this, function (jasmine, mock, test_utils) {
    const _ = converse.env._,
          $iq = converse.env.$iq,
          Strophe = converse.env.Strophe,
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
                    return test_utils.waitUntil(() => _.get(_.filter(
                        _converse.connection.IQ_stanzas,
                        iq => iq.nodeTree.querySelector(
                            `iq[to="coven@chat.shakespeare.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                        )
                    ).pop(), 'nodeTree'));

                }).then(stanza => {
                    view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                    spyOn(view.model, 'parseRoomFeatures').and.callThrough();
                    const features_stanza = $iq({
                            'from': room_jid,
                            'id': stanza.getAttribute('id'),
                            'to': 'dummy@localhost/desktop',
                            'type': 'result'
                        })
                        .c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                            .c('identity', {
                                'category': 'conference',
                                'name': 'A Dark Cave',
                                'type': 'text'
                            }).up()
                            .c('feature', {'var': 'http://jabber.org/protocol/muc'}).up()
                            .c('feature', {'var': 'jabber:iq:register'}).up()
                            .c('feature', {'var': 'muc_passwordprotected'}).up()
                            .c('feature', {'var': 'muc_hidden'}).up()
                            .c('feature', {'var': 'muc_temporary'}).up()
                            .c('feature', {'var': 'muc_open'}).up()
                            .c('feature', {'var': 'muc_unmoderated'}).up()
                            .c('feature', {'var': 'muc_nonanonymous'});
                    _converse.connection._dataRecv(test_utils.createRequest(features_stanza));
                    return test_utils.waitUntil(() => view.model.parseRoomFeatures.calls.count(), 300)
                }).then(() => {
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
                    view = _converse.chatboxviews.get(room_jid);
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
    });
}));
