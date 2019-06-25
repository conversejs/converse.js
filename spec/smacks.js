(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const $iq = converse.env.$iq;
    const Strophe = converse.env.Strophe;
    const sizzle = converse.env.sizzle;
    const u = converse.env.utils;

    describe("XEP-0198 Stream Management", function () {

        it("gets enabled with an <enable> stanza and resumed with a <resume> stanza",
            mock.initConverse(
                null, ['connectionInitialized', 'chatBoxesInitialized'],
                { 'auto_login': false,
                  'enable_smacks': true,
                  'show_controlbox_by_default': true,
                  'smacks_max_unacked_stanzas': 2
                },
                async function (done, _converse) {

            const view = _converse.chatboxviews.get('controlbox');
            spyOn(view, 'renderControlBoxPane').and.callThrough();

            _converse.api.user.login('romeo@montague.lit/orchard', 'secret');
            const sent_stanzas = _converse.connection.sent_stanzas;
            let stanza = await test_utils.waitUntil(() =>
                sent_stanzas.filter(s => (s.tagName === 'enable')).pop());

            expect(_converse.session.get('smacks_enabled')).toBe(false);
            expect(Strophe.serialize(stanza)).toEqual('<enable resume="true" xmlns="urn:xmpp:sm:3"/>');

            let result = u.toStanza(`<enabled xmlns="urn:xmpp:sm:3" id="some-long-sm-id" resume="true"/>`);
            _converse.connection._dataRecv(test_utils.createRequest(result));
            expect(_converse.session.get('smacks_enabled')).toBe(true);

            await test_utils.waitUntil(() => view.renderControlBoxPane.calls.count());

            let IQ_stanzas = _converse.connection.IQ_stanzas;
            await test_utils.waitUntil(() => IQ_stanzas.length === 4);

            let iq = IQ_stanzas.pop();
            expect(Strophe.serialize(iq)).toBe(
                `<iq from="romeo@montague.lit/orchard" id="${iq.getAttribute('id')}" to="romeo@montague.lit" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/disco#info"/></iq>`);

            iq = IQ_stanzas.pop();
            expect(Strophe.serialize(iq)).toBe(
                `<iq id="${iq.getAttribute('id')}" type="get" xmlns="jabber:client"><query xmlns="jabber:iq:roster"/></iq>`);

            iq = IQ_stanzas.pop();
            expect(Strophe.serialize(iq)).toBe(
                `<iq from="romeo@montague.lit/orchard" id="${iq.getAttribute('id')}" to="montague.lit" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/disco#info"/></iq>`);

            const disco_iq = IQ_stanzas.pop();
            expect(Strophe.serialize(disco_iq)).toBe(
                `<iq from="romeo@montague.lit" id="${disco_iq.getAttribute('id')}" to="romeo@montague.lit" type="get" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub"><items node="eu.siacs.conversations.axolotl.devicelist"/></pubsub></iq>`);

            expect(sent_stanzas.filter(s => (s.nodeName === 'r')).length).toBe(2);
            expect(_converse.session.get('unacked_stanzas').length).toBe(4);

            // test handling of acks
            let ack = u.toStanza(`<a xmlns="urn:xmpp:sm:3" h="1"/>`);
            _converse.connection._dataRecv(test_utils.createRequest(ack));
            expect(_converse.session.get('unacked_stanzas').length).toBe(3);

            // test handling of ack requests
            let r = u.toStanza(`<r xmlns="urn:xmpp:sm:3"/>`);
            _converse.connection._dataRecv(test_utils.createRequest(r));
            ack = await test_utils.waitUntil(() => sent_stanzas.filter(s => (s.nodeName === 'a')).pop());
            expect(Strophe.serialize(ack)).toBe('<a h="0" xmlns="urn:xmpp:sm:3"/>');

            const disco_result = $iq({
                'type': 'result',
                'from': 'montague.lit',
                'to': 'romeo@montague.lit/orchard',
                'id': disco_iq.getAttribute('id'),
            }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#info'})
                .c('identity', {
                    'category': 'server',
                    'type': 'im'
                }).up()
                .c('feature', {'var': 'http://jabber.org/protocol/disco#info'}).up()
                .c('feature', {'var': 'http://jabber.org/protocol/disco#items'});
            _converse.connection._dataRecv(test_utils.createRequest(disco_result));

            ack = u.toStanza(`<a xmlns="urn:xmpp:sm:3" h="2"/>`);
            _converse.connection._dataRecv(test_utils.createRequest(ack));
            expect(_converse.session.get('unacked_stanzas').length).toBe(2);

            r = u.toStanza(`<r xmlns="urn:xmpp:sm:3"/>`);
            _converse.connection._dataRecv(test_utils.createRequest(r));
            ack = await test_utils.waitUntil(() => sent_stanzas.filter(s => (s.nodeName === 'a' && s.getAttribute('h') === '1')).pop());
            expect(Strophe.serialize(ack)).toBe('<a h="1" xmlns="urn:xmpp:sm:3"/>');

            // test session resumption
            _converse.connection.IQ_stanzas = [];
            IQ_stanzas = _converse.connection.IQ_stanzas;
            _converse.api.connection.reconnect();
            stanza = await test_utils.waitUntil(() =>
                sent_stanzas.filter(s => (s.tagName === 'resume')).pop());
            expect(Strophe.serialize(stanza)).toEqual('<resume h="1" previd="some-long-sm-id" xmlns="urn:xmpp:sm:3"/>');

            result = u.toStanza(`<resumed xmlns="urn:xmpp:sm:3" h="another-sequence-number" previd="some-long-sm-id"/>`);
            _converse.connection._dataRecv(test_utils.createRequest(result));

            // Another <enable> stanza doesn't get sent out
            expect(sizzle('enable', sent_stanzas).length).toBe(0);
            expect(_converse.session.get('smacks_enabled')).toBe(true);

            await test_utils.waitUntil(() => IQ_stanzas.length === 2);

            // Test that unacked stanzas get resent out
            iq = IQ_stanzas.pop();
            expect(Strophe.serialize(iq)).toBe(
                `<iq from="romeo@montague.lit/orchard" id="${iq.getAttribute('id')}" to="romeo@montague.lit" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/disco#info"/></iq>`);

            iq = IQ_stanzas.pop();
            expect(Strophe.serialize(iq)).toBe(
                `<iq id="${iq.getAttribute('id')}" type="get" xmlns="jabber:client"><query xmlns="jabber:iq:roster"/></iq>`);

            await _converse.api.waitUntil('statusInitialized');
            done();
        }));
    });
}));
