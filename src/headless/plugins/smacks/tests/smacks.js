/*global mock, converse */

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
            async function (_converse) {

        await _converse.api.user.login('romeo@montague.lit/orchard', 'secret');

        const sent_stanzas = _converse.connection.sent_stanzas;
        let stanza = await u.waitUntil(() => sent_stanzas.filter(s => (s.tagName === 'enable'), 1000).pop());

        expect(_converse.session.get('smacks_enabled')).toBe(false);
        expect(Strophe.serialize(stanza)).toEqual('<enable resume="true" xmlns="urn:xmpp:sm:3"/>');

        let result = u.toStanza(`<enabled xmlns="urn:xmpp:sm:3" id="some-long-sm-id" resume="true"/>`);
        _converse.connection._dataRecv(mock.createRequest(result));
        expect(_converse.session.get('smacks_enabled')).toBe(true);

        await mock.waitUntilDiscoConfirmed(
            _converse,
            "montague.lit",
            [],
            [Strophe.NS.CARBONS]
        );

        let IQ_stanzas = _converse.connection.IQ_stanzas;
        await u.waitUntil(() => IQ_stanzas.length === 5);

        const disco_iq = IQ_stanzas[0];
        expect(Strophe.serialize(disco_iq)).toBe(
            `<iq from="romeo@montague.lit/orchard" id="${disco_iq.getAttribute('id')}" to="montague.lit" type="get" xmlns="jabber:client">`+
                `<query xmlns="http://jabber.org/protocol/disco#info"/></iq>`);

        expect(Strophe.serialize(IQ_stanzas[1])).toBe(
            `<iq id="${IQ_stanzas[1].getAttribute('id')}" type="get" xmlns="jabber:client"><query xmlns="jabber:iq:roster"/></iq>`);
        await mock.waitForRoster(_converse, 'current', 1);

        const omemo_iq = IQ_stanzas[2];
        expect(Strophe.serialize(omemo_iq)).toBe(
            `<iq from="romeo@montague.lit" id="${omemo_iq.getAttribute('id')}" to="romeo@montague.lit" type="get" xmlns="jabber:client">`+
            `<pubsub xmlns="http://jabber.org/protocol/pubsub"><items node="eu.siacs.conversations.axolotl.devicelist"/></pubsub></iq>`);

        expect(Strophe.serialize(IQ_stanzas[3])).toBe(
            `<iq from="romeo@montague.lit/orchard" id="${IQ_stanzas[3].getAttribute('id')}" to="romeo@montague.lit" type="get" xmlns="jabber:client">`+
                `<query xmlns="http://jabber.org/protocol/disco#info"/></iq>`);

        expect(Strophe.serialize(IQ_stanzas[4])).toBe(
            `<iq from="romeo@montague.lit/orchard" id="${IQ_stanzas[4].getAttribute('id')}" type="set" xmlns="jabber:client"><enable xmlns="urn:xmpp:carbons:2"/></iq>`);

        await u.waitUntil(() => sent_stanzas.filter(s => (s.nodeName === 'presence')).length);

        expect(sent_stanzas.filter(s => (s.nodeName === 'r')).length).toBe(3);
        expect(_converse.session.get('unacked_stanzas').length).toBe(6);

        // test handling of acks
        let ack = u.toStanza(`<a xmlns="urn:xmpp:sm:3" h="2"/>`);
        _converse.connection._dataRecv(mock.createRequest(ack));
        expect(_converse.session.get('unacked_stanzas').length).toBe(4);

        // test handling of ack requests
        let r = u.toStanza(`<r xmlns="urn:xmpp:sm:3"/>`);
        _converse.connection._dataRecv(mock.createRequest(r));

        // "h" is 3 because we received two IQ responses, for disco and the roster
        ack = await u.waitUntil(() => sent_stanzas.filter(s => (s.nodeName === 'a')).pop());
        expect(Strophe.serialize(ack)).toBe('<a h="2" xmlns="urn:xmpp:sm:3"/>');

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
        _converse.connection._dataRecv(mock.createRequest(disco_result));

        ack = u.toStanza(`<a xmlns="urn:xmpp:sm:3" h="2"/>`);
        _converse.connection._dataRecv(mock.createRequest(ack));
        expect(_converse.session.get('unacked_stanzas').length).toBe(4);

        expect(_converse.session.get('unacked_stanzas')[0]).toBe(Strophe.serialize(IQ_stanzas[2]));
        expect(_converse.session.get('unacked_stanzas')[1]).toBe(Strophe.serialize(IQ_stanzas[3]));
        expect(_converse.session.get('unacked_stanzas')[2]).toBe(Strophe.serialize(IQ_stanzas[4]));
        expect(_converse.session.get('unacked_stanzas')[3]).toBe(
            `<presence xmlns="jabber:client"><priority>0</priority>`+
                `<c hash="sha-1" node="https://conversejs.org" ver="TfHz9vOOfqIG0Z9lW5CuPaWGnrQ=" xmlns="http://jabber.org/protocol/caps"/>`+
            `</presence>`);

        r = u.toStanza(`<r xmlns="urn:xmpp:sm:3"/>`);
        _converse.connection._dataRecv(mock.createRequest(r));

        ack = await u.waitUntil(() => sent_stanzas.filter(s => (s.nodeName === 'a' && s.getAttribute('h') === '3')).pop());

        expect(Strophe.serialize(ack)).toBe('<a h="3" xmlns="urn:xmpp:sm:3"/>');
        await _converse.api.waitUntil('rosterInitialized');

        // test session resumption
        _converse.connection.IQ_stanzas = [];
        IQ_stanzas = _converse.connection.IQ_stanzas;
        await _converse.api.connection.reconnect();
        stanza = await u.waitUntil(() => sent_stanzas.filter(s => (s.tagName === 'resume')).pop(), 1000);
        expect(Strophe.serialize(stanza)).toEqual('<resume h="3" previd="some-long-sm-id" xmlns="urn:xmpp:sm:3"/>');

        result = u.toStanza(`<resumed xmlns="urn:xmpp:sm:3" h="another-sequence-number" previd="some-long-sm-id"/>`);
        _converse.connection._dataRecv(mock.createRequest(result));

        // Another <enable> stanza doesn't get sent out
        expect(sent_stanzas.filter(s => (s.tagName === 'enable')).length).toBe(1);
        expect(_converse.session.get('smacks_enabled')).toBe(true);

        await new Promise(resolve => _converse.api.listen.once('reconnected', resolve));
        await u.waitUntil(() => IQ_stanzas.length === 3);

        // Test that unacked stanzas get resent out
        let iq = IQ_stanzas.pop();
        expect(Strophe.serialize(iq)).toBe(
            `<iq from="romeo@montague.lit/orchard" id="${iq.getAttribute('id')}" type="set" xmlns="jabber:client"><enable xmlns="urn:xmpp:carbons:2"/></iq>`);

        iq = IQ_stanzas.pop();
        expect(Strophe.serialize(iq)).toBe(
            `<iq from="romeo@montague.lit/orchard" id="${iq.getAttribute('id')}" to="romeo@montague.lit" type="get" xmlns="jabber:client">`+
                `<query xmlns="http://jabber.org/protocol/disco#info"/></iq>`);

        iq = IQ_stanzas.pop();
        expect(Strophe.serialize(iq)).toBe(
            `<iq from="romeo@montague.lit" id="${iq.getAttribute('id')}" to="romeo@montague.lit" type="get" xmlns="jabber:client">`+
            `<pubsub xmlns="http://jabber.org/protocol/pubsub"><items node="eu.siacs.conversations.axolotl.devicelist"/></pubsub></iq>`);

        expect(IQ_stanzas.filter(iq => sizzle('query[xmlns="jabber:iq:roster"]', iq).pop()).length).toBe(0);
    }));


    it("might not resume and the session will then be reset",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { 'auto_login': false,
              'enable_smacks': true,
              'show_controlbox_by_default': true,
              'smacks_max_unacked_stanzas': 2
            },
            async function (_converse) {

        await _converse.api.user.login('romeo@montague.lit/orchard', 'secret');
        const sent_stanzas = _converse.connection.sent_stanzas;
        let stanza = await u.waitUntil(() => sent_stanzas.filter(s => (s.tagName === 'enable')).pop());
        expect(Strophe.serialize(stanza)).toEqual('<enable resume="true" xmlns="urn:xmpp:sm:3"/>');
        let result = u.toStanza(`<enabled xmlns="urn:xmpp:sm:3" id="some-long-sm-id" resume="true"/>`);
        _converse.connection._dataRecv(mock.createRequest(result));

        await mock.waitForRoster(_converse, 'current', 1);

        // test session resumption
        await _converse.api.connection.reconnect();
        stanza = await u.waitUntil(() => sent_stanzas.filter(s => (s.tagName === 'resume')).pop());
        expect(Strophe.serialize(stanza)).toEqual('<resume h="1" previd="some-long-sm-id" xmlns="urn:xmpp:sm:3"/>');

        result = u.toStanza(
            `<failed xmlns="urn:xmpp:sm:3" h="another-sequence-number">`+
                `<item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>`+
            `</failed>`);
        _converse.connection._dataRecv(mock.createRequest(result));

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
        _converse.connection._dataRecv(mock.createRequest(result));
        expect(_converse.session.get('smacks_enabled')).toBe(true);

        // Check that the roster gets fetched
        await mock.waitForRoster(_converse, 'current', 1);
        await new Promise(resolve => _converse.api.listen.once('reconnected', resolve));
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
            async function (_converse) {

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

        _converse.no_connection_on_bind = true; // XXX Don't trigger CONNECTED in MockConnection
        await _converse.api.user.login('romeo@montague.lit', 'secret');

        const sent_stanzas = _converse.connection.sent_stanzas;
        const stanza = await u.waitUntil(() => sent_stanzas.filter(s => (s.tagName === 'resume')).pop());
        expect(Strophe.serialize(stanza)).toEqual('<resume h="580" previd="some-long-sm-id" xmlns="urn:xmpp:sm:3"/>');

        const result = u.toStanza(`<resumed xmlns="urn:xmpp:sm:3" h="another-sequence-number" previd="some-long-sm-id"/>`);
        _converse.connection._dataRecv(mock.createRequest(result));
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

        _converse.connection._dataRecv(mock.createRequest(msg));

        await _converse.api.waitUntil('chatBoxesFetched');
        const muc = _converse.chatboxes.get(muc_jid);
        await mock.getRoomFeatures(_converse, muc_jid);
        await mock.receiveOwnMUCPresence(_converse, muc_jid, nick);
        await u.waitUntil(() => (muc.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));
        await muc.messages.fetched;
        await u.waitUntil(() => muc.messages.length);
        expect(muc.messages.at(0).get('message')).toBe('First message')
        delete _converse.no_connection_on_bind;
    }));
});
