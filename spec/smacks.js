(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const $iq = converse.env.$iq;
    const $msg = converse.env.$msg;
    const Strophe = converse.env.Strophe;
    const sizzle = converse.env.sizzle;
    const u = converse.env.utils;

    describe("XEP-0198 Stream Management", function () {

        it("gets enabled with an <enable> stanza and resumed with a <resume> stanza",
            mock.initConverse(
                ['chatBoxesInitialized'],
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
            let stanza = await u.waitUntil(() =>
                sent_stanzas.filter(s => (s.tagName === 'enable')).pop());

            expect(_converse.session.get('smacks_enabled')).toBe(false);
            expect(Strophe.serialize(stanza)).toEqual('<enable resume="true" xmlns="urn:xmpp:sm:3"/>');

            let result = u.toStanza(`<enabled xmlns="urn:xmpp:sm:3" id="some-long-sm-id" resume="true"/>`);
            _converse.connection._dataRecv(test_utils.createRequest(result));
            expect(_converse.session.get('smacks_enabled')).toBe(true);

            await u.waitUntil(() => view.renderControlBoxPane.calls.count());

            let IQ_stanzas = _converse.connection.IQ_stanzas;
            await u.waitUntil(() => IQ_stanzas.length === 4);

            let iq = IQ_stanzas[IQ_stanzas.length-1];
            expect(Strophe.serialize(iq)).toBe(
                `<iq id="${iq.getAttribute('id')}" type="get" xmlns="jabber:client"><query xmlns="jabber:iq:roster"/></iq>`);
            await test_utils.waitForRoster(_converse, 'current', 1);
            IQ_stanzas.pop();

            const expected_IQs = disco_iq => ([
                `<iq from="romeo@montague.lit" id="${disco_iq.getAttribute('id')}" to="romeo@montague.lit" type="get" xmlns="jabber:client">`+
                `<pubsub xmlns="http://jabber.org/protocol/pubsub"><items node="eu.siacs.conversations.axolotl.devicelist"/></pubsub></iq>`,

                `<iq from="romeo@montague.lit/orchard" id="${iq.getAttribute('id')}" to="romeo@montague.lit" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/disco#info"/></iq>`,

                `<iq from="romeo@montague.lit/orchard" id="${iq.getAttribute('id')}" to="montague.lit" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/disco#info"/></iq>`]);

            const disco_iq = IQ_stanzas.pop();
            expect(expected_IQs(disco_iq).includes(Strophe.serialize(disco_iq))).toBe(true);
            iq = IQ_stanzas.pop();
            expect(expected_IQs(disco_iq).includes(Strophe.serialize(disco_iq))).toBe(true);
            iq = IQ_stanzas.pop();
            expect(expected_IQs(disco_iq).includes(Strophe.serialize(disco_iq))).toBe(true);

            expect(sent_stanzas.filter(s => (s.nodeName === 'r')).length).toBe(2);
            expect(_converse.session.get('unacked_stanzas').length).toBe(5);

            // test handling of acks
            let ack = u.toStanza(`<a xmlns="urn:xmpp:sm:3" h="2"/>`);
            _converse.connection._dataRecv(test_utils.createRequest(ack));
            expect(_converse.session.get('unacked_stanzas').length).toBe(3);

            // test handling of ack requests
            let r = u.toStanza(`<r xmlns="urn:xmpp:sm:3"/>`);
            _converse.connection._dataRecv(test_utils.createRequest(r));

            ack = await u.waitUntil(() => sent_stanzas.filter(s => (s.nodeName === 'a')).pop());
            expect(Strophe.serialize(ack)).toBe('<a h="1" xmlns="urn:xmpp:sm:3"/>');


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

            ack = u.toStanza(`<a xmlns="urn:xmpp:sm:3" h="3"/>`);
            _converse.connection._dataRecv(test_utils.createRequest(ack));
            expect(_converse.session.get('unacked_stanzas').length).toBe(2);

            r = u.toStanza(`<r xmlns="urn:xmpp:sm:3"/>`);
            _converse.connection._dataRecv(test_utils.createRequest(r));
            ack = await u.waitUntil(() => sent_stanzas.filter(s => (s.nodeName === 'a' && s.getAttribute('h') === '1')).pop());
            expect(Strophe.serialize(ack)).toBe('<a h="1" xmlns="urn:xmpp:sm:3"/>');

            // test session resumption
            _converse.connection.IQ_stanzas = [];
            IQ_stanzas = _converse.connection.IQ_stanzas;
            await _converse.api.connection.reconnect();
            stanza = await u.waitUntil(() => sent_stanzas.filter(s => (s.tagName === 'resume')).pop());

            expect(Strophe.serialize(stanza)).toEqual('<resume h="2" previd="some-long-sm-id" xmlns="urn:xmpp:sm:3"/>');

            result = u.toStanza(`<resumed xmlns="urn:xmpp:sm:3" h="another-sequence-number" previd="some-long-sm-id"/>`);
            _converse.connection._dataRecv(test_utils.createRequest(result));

            // Another <enable> stanza doesn't get sent out
            expect(sent_stanzas.filter(s => (s.tagName === 'enable')).length).toBe(1);
            expect(_converse.session.get('smacks_enabled')).toBe(true);

            await u.waitUntil(() => IQ_stanzas.length === 1);

            // Test that unacked stanzas get resent out
            iq = IQ_stanzas.pop();
            expect(Strophe.serialize(iq)).toBe(`<iq id="${iq.getAttribute('id')}" type="get" xmlns="jabber:client"><query xmlns="jabber:iq:roster"/></iq>`);

            expect(IQ_stanzas.filter(iq => sizzle('query[xmlns="jabber:iq:roster"]', iq).pop()).length).toBe(0);

            await _converse.api.waitUntil('statusInitialized');
            done();
        }));


        it("might not resume and the session will then be reset",
            mock.initConverse(
                ['chatBoxesInitialized'],
                { 'auto_login': false,
                  'enable_smacks': true,
                  'show_controlbox_by_default': true,
                  'smacks_max_unacked_stanzas': 2
                },
                async function (done, _converse) {

            _converse.api.user.login('romeo@montague.lit/orchard', 'secret');
            const sent_stanzas = _converse.connection.sent_stanzas;
            let stanza = await u.waitUntil(() => sent_stanzas.filter(s => (s.tagName === 'enable')).pop());
            expect(Strophe.serialize(stanza)).toEqual('<enable resume="true" xmlns="urn:xmpp:sm:3"/>');
            let result = u.toStanza(`<enabled xmlns="urn:xmpp:sm:3" id="some-long-sm-id" resume="true"/>`);
            _converse.connection._dataRecv(test_utils.createRequest(result));

            await test_utils.waitForRoster(_converse, 'current', 1);

            // test session resumption
            await _converse.api.connection.reconnect();
            stanza = await u.waitUntil(() => sent_stanzas.filter(s => (s.tagName === 'resume')).pop());
            expect(Strophe.serialize(stanza)).toEqual('<resume h="1" previd="some-long-sm-id" xmlns="urn:xmpp:sm:3"/>');

            result = u.toStanza(
                `<failed xmlns="urn:xmpp:sm:3" h="another-sequence-number">`+
                    `<item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>`+
                `</failed>`);
            _converse.connection._dataRecv(test_utils.createRequest(result));

            // Session data gets reset
            expect(_converse.session.get('smacks_enabled')).toBe(false);
            expect(_converse.session.get('num_stanzas_handled')).toBe(0);
            expect(_converse.session.get('num_stanzas_handled_by_server')).toBe(0);
            expect(_converse.session.get('num_stanzas_since_last_ack')).toBe(0);
            expect(_converse.session.get('unacked_stanzas').length).toBe(0);
            expect(_converse.session.get('roster_cached')).toBeFalsy();


            await u.waitUntil(() => sent_stanzas.filter(s => (s.tagName === 'enable')).length === 2);
            stanza = sent_stanzas.filter(s => (s.tagName === 'enable')).pop();
            expect(Strophe.serialize(stanza)).toEqual('<enable resume="true" xmlns="urn:xmpp:sm:3"/>');

            result = u.toStanza(`<enabled xmlns="urn:xmpp:sm:3" id="another-long-sm-id" resume="true"/>`);
            _converse.connection._dataRecv(test_utils.createRequest(result));
            expect(_converse.session.get('smacks_enabled')).toBe(true);

            // Check that the roster gets fetched
            await test_utils.waitForRoster(_converse, 'current', 1);
            done();
        }));


        it("can cause MUC messages to be received before chatboxes are initialized",
            mock.initConverse(
                ['chatBoxesInitialized'],
                { 'auto_login': false,
                  'blacklisted_plugins': 'converse-mam',
                  'enable_smacks': true,
                  'muc_fetch_members': false,
                  'show_controlbox_by_default': true,
                  'smacks_max_unacked_stanzas': 2
                },
                async function (done, _converse) {

            const key = "converse-test-session/converse.session-romeo@montague.lit-converse.session-romeo@montague.lit";
            sessionStorage.setItem(
                key,
                JSON.stringify({
                    "id": "converse.session-romeo@montague.lit",
                    "jid": "romeo@montague.lit/converse.js-100020907",
                    "bare_jid": "romeo@montague.lit",
                    "resource": "converse.js-100020907",
                    "domain": "montague.lit",
                    "active": false,
                    "smacks_enabled": true,
                    "num_stanzas_handled": 580,
                    "num_stanzas_handled_by_server": 525,
                    "num_stanzas_since_last_ack": 0,
                    "unacked_stanzas": [],
                    "smacks_stream_id": "some-long-sm-id",
                    "push_enabled": ["romeo@montague.lit"],
                    "carbons_enabled": true,
                    "roster_cached": true
                })
            );

            const muc_jid = 'lounge@montague.lit';
            const chatkey = `converse.chatboxes-romeo@montague.lit-${muc_jid}`;
            sessionStorage.setItem('converse.chatboxes-romeo@montague.lit', JSON.stringify([chatkey]));
            sessionStorage.setItem(chatkey,
                JSON.stringify({
                    hidden: false,
                    message_type: "groupchat",
                    name: "lounge",
                    num_unread: 0,
                    type: "chatroom",
                    jid: muc_jid,
                    id: muc_jid,
                    box_id: "box-YXJnQGNvbmZlcmVuY2UuY2hhdC5leGFtcGxlLm9yZw==",
                    nick: "romeo"
                })
            );

            _converse.no_connection_on_bind = true; // XXX Don't trigger CONNECTED in tests/mock.js
            _converse.api.user.login('romeo@montague.lit', 'secret');
            delete _converse.no_connection_on_bind;

            const sent_stanzas = _converse.connection.sent_stanzas;
            const stanza = await u.waitUntil(() => sent_stanzas.filter(s => (s.tagName === 'resume')).pop());
            expect(Strophe.serialize(stanza)).toEqual('<resume h="580" previd="some-long-sm-id" xmlns="urn:xmpp:sm:3"/>');

            const result = u.toStanza(`<resumed xmlns="urn:xmpp:sm:3" h="another-sequence-number" previd="some-long-sm-id"/>`);
            _converse.connection._dataRecv(test_utils.createRequest(result));
            expect(_converse.session.get('smacks_enabled')).toBe(true);


            const nick = 'romeo';
            const func = _converse.chatboxes.onChatBoxesFetched;
            spyOn(_converse.chatboxes, 'onChatBoxesFetched').and.callFake(collection => {
                const muc = new _converse.ChatRoom({'jid': muc_jid, 'id': muc_jid, nick}, {'collection': _converse.chatboxes});
                _converse.chatboxes.add(muc);
                func.call(_converse.chatboxes, collection);
            });

            // A MUC message gets received
            const msg = $msg({
                    from: `${muc_jid}/juliet`,
                    id: u.getUniqueId(),
                    to: 'romeo@montague.lit',
                    type: 'groupchat'
                }).c('body').t('First message').tree();

            _converse.connection._dataRecv(test_utils.createRequest(msg));

            await _converse.api.waitUntil('chatBoxesFetched');
            const muc = _converse.chatboxes.get(muc_jid);
            await u.waitUntil(() => muc.message_queue.length === 1);

            const view = _converse.chatboxviews.get(muc_jid);
            await test_utils.getRoomFeatures(_converse, muc_jid);
            await test_utils.receiveOwnMUCPresence(_converse, muc_jid, nick);
            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));
            await view.model.messages.fetched;

            await u.waitUntil(() => muc.messages.length);
            expect(muc.messages.at(0).get('message')).toBe('First message')
            done();
        }));
    });
}));
