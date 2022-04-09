/*global mock, converse */

describe("Service Discovery", function () {

    it("can be used to set the muc_domain", mock.initConverse( ['discoInitialized'], {}, async function (_converse) {
        const { u, $iq } = converse.env;
        const IQ_stanzas = _converse.connection.IQ_stanzas;
        const IQ_ids =  _converse.connection.IQ_ids;
        const { api } = _converse;

        expect(api.settings.get('muc_domain')).toBe(undefined);

        await u.waitUntil(() => IQ_stanzas.filter(
            (iq) => iq.querySelector(`iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]`)).length > 0
        );

        let stanza = IQ_stanzas.find((iq) => iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]'));
        const info_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
        stanza = $iq({
            'type': 'result',
            'from': 'montague.lit',
            'to': 'romeo@montague.lit/orchard',
            'id': info_IQ_id
        }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#info'})
            .c('identity', { 'category': 'server', 'type': 'im'}).up()
            .c('identity', { 'category': 'conference', 'name': 'Play-Specific Chatrooms'}).up()
            .c('feature', { 'var': 'http://jabber.org/protocol/disco#info'}).up()
            .c('feature', { 'var': 'http://jabber.org/protocol/disco#items'}).up();
        _converse.connection._dataRecv(mock.createRequest(stanza));

        const entities = await _converse.api.disco.entities.get();
        expect(entities.length).toBe(2); // We have an extra entity, which is the user's JID
        expect(entities.get(_converse.domain).identities.length).toBe(2);
        expect(entities.get('montague.lit').features.where(
            {'var': 'http://jabber.org/protocol/disco#items'}).length).toBe(1);
        expect(entities.get('montague.lit').features.where(
            {'var': 'http://jabber.org/protocol/disco#info'}).length).toBe(1);

        stanza = await u.waitUntil(() => IQ_stanzas.filter(
            iq => iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]')).pop()
        );

        _converse.connection._dataRecv(mock.createRequest($iq({
            'type': 'result',
            'from': 'montague.lit',
            'to': 'romeo@montague.lit/orchard',
            'id': IQ_ids[IQ_stanzas.indexOf(stanza)]
        }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#items'})
            .c('item', { 'jid': 'chat.shakespeare.lit', 'name': 'Chatroom Service'})));

        stanza = await u.waitUntil(() => IQ_stanzas.filter(
            iq => iq.querySelector('iq[to="chat.shakespeare.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]')).pop()
        );
        _converse.connection._dataRecv(mock.createRequest($iq({
            'type': 'result',
            'from': 'chat.shakespeare.lit',
            'to': 'romeo@montague.lit/orchard',
            'id': IQ_ids[IQ_stanzas.indexOf(stanza)]
        }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#info'})
            .c('identity', { 'category': 'conference', 'name': 'Play-Specific Chatrooms', 'type': 'text'}).up()
            .c('feature', { 'var': 'http://jabber.org/protocol/muc'}).up()));

        await u.waitUntil(() => _converse.api.settings.get('muc_domain') === 'chat.shakespeare.lit');
    }));
});
