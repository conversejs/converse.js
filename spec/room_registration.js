(function (root, factory) {
    define(["jasmine", "mock", "test-utils" ], factory);
} (this, function (jasmine, mock, test_utils) {
    const _ = converse.env._,
          $iq = converse.env.$iq,
          $pres = converse.env.$pres,
          Strophe = converse.env.Strophe,
          sizzle = converse.env.sizzle,
          u = converse.env.utils;

    describe("Chatrooms", function () {


        describe("The /register commmand", function () {

            it("allows you to register your nickname in a room",
                mock.initConverse(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {'auto_register_muc_nickname': true},
                    function (done, _converse) {

                let view;
                const room_jid = 'coven@chat.shakespeare.lit';
                test_utils.openAndEnterChatRoom(_converse, 'coven', 'chat.shakespeare.lit', 'romeo')
                .then(() => {
                    view = _converse.chatboxviews.get(room_jid);
                    const textarea = view.el.querySelector('.chat-textarea')
                    textarea.value = '/register';
                    view.keyPressed({
                        target: textarea,
                        preventDefault: _.noop,
                        keyCode: 13
                    });
                    return test_utils.waitUntil(() => _.filter(
                        _converse.connection.IQ_stanzas,
                        iq => sizzle(`iq[to="coven@chat.shakespeare.lit"][type="get"] query[xmlns="jabber:iq:register"]`, iq.nodeTree).length
                    ).pop());
                }).then(node => {
                    const stanza = node.nodeTree;
                    expect(node.toLocaleString())
                    .toBe(`<iq from="dummy@localhost/resource" id="${stanza.getAttribute('id')}" to="coven@chat.shakespeare.lit" `+
                                `type="get" xmlns="jabber:client">`+
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
                    return test_utils.waitUntil(() => _.filter(
                        _converse.connection.IQ_stanzas,
                        iq => sizzle(`iq[to="coven@chat.shakespeare.lit"][type="set"] query[xmlns="jabber:iq:register"]`, iq.nodeTree).length
                    ).pop());
                }).then(node => {
                    const stanza = node.nodeTree;
                    expect(node.toLocaleString()).toBe(
                        `<iq from="dummy@localhost/resource" id="${stanza.getAttribute('id')}" to="coven@chat.shakespeare.lit" type="set" xmlns="jabber:client">`+
                            `<query xmlns="jabber:iq:register">`+
                                `<x type="submit" xmlns="jabber:x:data">`+
                                    `<field var="FORM_TYPE"><value>http://jabber.org/protocol/muc#register</value></field>`+
                                    `<field var="muc#register_roomnick"><value>romeo</value></field>`+
                                `</x>`+
                            `</query>`+
                        `</iq>`);
                    done();
                }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
            }));

        });

        describe("The auto_register_muc_nickname option", function () {

            it("allows you to automatically register your nickname when joining a room",
                mock.initConverse(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {'auto_register_muc_nickname': true},
                    function (done, _converse) {

                let view;
                const IQ_stanzas = _converse.connection.IQ_stanzas; 
                const room_jid = 'coven@chat.shakespeare.lit';
                _converse.api.rooms.open(room_jid, {'nick': 'romeo'})
                .then(() => {
                    return test_utils.waitUntil(() => _.get(_.filter(
                        IQ_stanzas,
                        iq => iq.nodeTree.querySelector(
                            `iq[to="${room_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                        )).pop(), 'nodeTree'));
                }).then(stanza => {
                    const features_stanza = $iq({
                        'from': room_jid,
                        'id': stanza.getAttribute('id'),
                        'to': 'dummy@localhost/desktop',
                        'type': 'result'
                    }).c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                        .c('identity', {
                            'category': 'conference',
                            'name': 'A Dark Cave',
                            'type': 'text'
                        }).up()
                        .c('feature', {'var': 'http://jabber.org/protocol/muc'}).up()
                        .c('feature', {'var': 'jabber:iq:register'});
                    _converse.connection._dataRecv(test_utils.createRequest(features_stanza));
                    view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
                    return test_utils.waitUntil(() => (view.model.get('connection_status') === converse.ROOMSTATUS.CONNECTING));
                }).then(stanza => {
                    // The user has just entered the room (because join was called)
                    // and receives their own presence from the server.
                    // See example 24: http://xmpp.org/extensions/xep-0045.html#enter-pres
                    const presence = $pres({
                            to: _converse.connection.jid,
                            from: room_jid,
                            id: u.getUniqueId()
                    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                        .c('item').attrs({
                            affiliation: 'owner',
                            jid: _converse.bare_jid,
                            role: 'moderator'
                        }).up()
                        .c('status').attrs({code:'110'});
                    _converse.connection._dataRecv(test_utils.createRequest(presence));
                    return test_utils.waitUntil(() => _.filter(
                        _converse.connection.IQ_stanzas,
                        iq => sizzle(`iq[to="coven@chat.shakespeare.lit"][type="get"] query[xmlns="jabber:iq:register"]`, iq.nodeTree).length
                    ).pop());
                }).then(node => {
                    const stanza = node.nodeTree;
                    expect(node.toLocaleString())
                    .toBe(`<iq from="dummy@localhost/resource" id="${stanza.getAttribute('id')}" to="coven@chat.shakespeare.lit" `+
                                `type="get" xmlns="jabber:client">`+
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
                    return test_utils.waitUntil(() => _.filter(
                        _converse.connection.IQ_stanzas,
                        iq => sizzle(`iq[to="coven@chat.shakespeare.lit"][type="set"] query[xmlns="jabber:iq:register"]`, iq.nodeTree).length
                    ).pop());
                }).then(node => {
                    const stanza = node.nodeTree;
                    expect(node.toLocaleString()).toBe(
                        `<iq from="dummy@localhost/resource" id="${stanza.getAttribute('id')}" to="coven@chat.shakespeare.lit" type="set" xmlns="jabber:client">`+
                            `<query xmlns="jabber:iq:register">`+
                                `<x type="submit" xmlns="jabber:x:data">`+
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
