/*global mock, converse */

const $iq = converse.env.$iq;
const Strophe = converse.env.Strophe;
const sizzle = converse.env.sizzle;
const u = converse.env.utils;
const original_timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;

describe("XEP-0357 Push Notifications", function () {

    beforeEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = 7000));
    afterEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = original_timeout));

    it("can be enabled",
        mock.initConverse(
            [], {
                'push_app_servers': [{
                    'jid': 'push-5@client.example',
                    'node': 'yxs32uqsflafdk3iuqo'
                }]
            }, async function (_converse) {

        const { api } = _converse;
        const IQ_stanzas = _converse.connection.IQ_stanzas;
        expect(_converse.session.get('push_enabled')).toBeFalsy();

        await mock.waitUntilDiscoConfirmed(
            _converse, api.settings.get('push_app_servers')[0].jid,
            [{'category': 'pubsub', 'type':'push'}],
            ['urn:xmpp:push:0'], [], 'info');
        await mock.waitUntilDiscoConfirmed(
                _converse,
                _converse.bare_jid,
                [{'category': 'account', 'type':'registered'}],
                ['urn:xmpp:push:0'], [], 'info');
        const stanza = await u.waitUntil(() =>
            IQ_stanzas.filter(iq => iq.querySelector('iq[type="set"] enable[xmlns="urn:xmpp:push:0"]')).pop()
        );
        expect(Strophe.serialize(stanza)).toEqual(
            `<iq id="${stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                '<enable jid="push-5@client.example" node="yxs32uqsflafdk3iuqo" xmlns="urn:xmpp:push:0"/>'+
            '</iq>'
        )
        _converse.connection._dataRecv(mock.createRequest($iq({
            'to': _converse.connection.jid,
            'type': 'result',
            'id': stanza.getAttribute('id')
        })));
        await u.waitUntil(() => _converse.session.get('push_enabled'));
    }));

    it("can be enabled for a MUC domain",
        mock.initConverse(
            [], {
                'enable_muc_push': true,
                'push_app_servers': [{
                    'jid': 'push-5@client.example',
                    'node': 'yxs32uqsflafdk3iuqo'
                }]
            }, async function (_converse) {

        const { api } = _converse;
        const IQ_stanzas = _converse.connection.IQ_stanzas;
        await mock.waitUntilDiscoConfirmed(
            _converse, api.settings.get('push_app_servers')[0].jid,
            [{'category': 'pubsub', 'type':'push'}],
            ['urn:xmpp:push:0'], [], 'info');
        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid, [],
            ['urn:xmpp:push:0']);

        let iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(`iq[type="set"] enable[xmlns="${Strophe.NS.PUSH}"]`, iq).length).pop());

        expect(Strophe.serialize(iq)).toBe(
            `<iq id="${iq.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                `<enable jid="push-5@client.example" node="yxs32uqsflafdk3iuqo" xmlns="urn:xmpp:push:0"/>`+
            `</iq>`
        );
        const result = u.toStanza(`<iq type="result" id="${iq.getAttribute('id')}" to="romeo@montague.lit" />`);
        _converse.connection._dataRecv(mock.createRequest(result));

        await u.waitUntil(() => _converse.session.get('push_enabled'));
        expect(_converse.session.get('push_enabled').length).toBe(1);
        expect(_converse.session.get('push_enabled').includes('romeo@montague.lit')).toBe(true);

        mock.openAndEnterChatRoom(_converse, 'coven@chat.shakespeare.lit', 'oldhag');
        await mock.waitUntilDiscoConfirmed(
            _converse, 'chat.shakespeare.lit',
            [{'category': 'account', 'type':'registered'}],
            ['urn:xmpp:push:0'], [], 'info');
        iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(`iq[type="set"][to="chat.shakespeare.lit"] enable[xmlns="${Strophe.NS.PUSH}"]`, iq).length
        ).pop());

        expect(Strophe.serialize(iq)).toEqual(
            `<iq id="${iq.getAttribute('id')}" to="chat.shakespeare.lit" type="set" xmlns="jabber:client">`+
                '<enable jid="push-5@client.example" node="yxs32uqsflafdk3iuqo" xmlns="urn:xmpp:push:0"/>'+
            '</iq>'
        );
        _converse.connection._dataRecv(mock.createRequest($iq({
            'to': _converse.connection.jid,
            'type': 'result',
            'id': iq.getAttribute('id')
        })));
        await u.waitUntil(() => _converse.session.get('push_enabled').includes('chat.shakespeare.lit'));
    }));

    it("can be disabled",
        mock.initConverse(
            ['chatBoxesFetched'], {
                'push_app_servers': [{
                    'jid': 'push-5@client.example',
                    'node': 'yxs32uqsflafdk3iuqo',
                    'disable': true
                }]
            }, async function (_converse) {

        const IQ_stanzas = _converse.connection.IQ_stanzas;
        expect(_converse.session.get('push_enabled')).toBeFalsy();

        await mock.waitUntilDiscoConfirmed(
            _converse,
            _converse.bare_jid,
            [{'category': 'account', 'type':'registered'}],
            ['urn:xmpp:push:0'], [], 'info');
        const stanza = await u.waitUntil(() => IQ_stanzas.filter(iq => iq.querySelector('iq[type="set"] disable[xmlns="urn:xmpp:push:0"]')).pop());
        expect(Strophe.serialize(stanza)).toEqual(
            `<iq id="${stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                '<disable jid="push-5@client.example" node="yxs32uqsflafdk3iuqo" xmlns="urn:xmpp:push:0"/>'+
            '</iq>'
        );
        _converse.connection._dataRecv(mock.createRequest($iq({
            'to': _converse.connection.jid,
            'type': 'result',
            'id': stanza.getAttribute('id')
        })));
        await u.waitUntil(() => _converse.session.get('push_enabled'))
    }));


    it("can require a secret token to be included",
        mock.initConverse([], {
                'push_app_servers': [{
                    'jid': 'push-5@client.example',
                    'node': 'yxs32uqsflafdk3iuqo',
                    'secret': 'eruio234vzxc2kla-91'
                }]
            }, async function (_converse) {

        const { api } = _converse;
        const IQ_stanzas = _converse.connection.IQ_stanzas;
        expect(_converse.session.get('push_enabled')).toBeFalsy();

        await mock.waitUntilDiscoConfirmed(
            _converse, api.settings.get('push_app_servers')[0].jid,
            [{'category': 'pubsub', 'type':'push'}],
            ['urn:xmpp:push:0'], [], 'info');
        await mock.waitUntilDiscoConfirmed(
                _converse,
                _converse.bare_jid,
                [{'category': 'account', 'type':'registered'}],
                ['urn:xmpp:push:0'], [], 'info');

        const stanza = await u.waitUntil(() => IQ_stanzas.filter(iq => iq.querySelector('iq[type="set"] enable[xmlns="urn:xmpp:push:0"]')).pop());
        expect(Strophe.serialize(stanza)).toEqual(
            `<iq id="${stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                '<enable jid="push-5@client.example" node="yxs32uqsflafdk3iuqo" xmlns="urn:xmpp:push:0">'+
                    '<x type="submit" xmlns="jabber:x:data">'+
                        '<field var="FORM_TYPE"><value>http://jabber.org/protocol/pubsub#publish-options</value></field>'+
                        '<field var="secret"><value>eruio234vzxc2kla-91</value></field>'+
                    '</x>'+
                '</enable>'+
            '</iq>'
        )
        _converse.connection._dataRecv(mock.createRequest($iq({
            'to': _converse.connection.jid,
            'type': 'result',
            'id': stanza.getAttribute('id')
        })));
        await u.waitUntil(() => _converse.session.get('push_enabled'))
    }));
});
