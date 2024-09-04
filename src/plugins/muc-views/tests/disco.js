/* global mock, converse */

const { Strophe, u, stx } = converse.env;

describe("Service Discovery", function () {

    it("can be used to set the muc_domain", mock.initConverse( ['discoInitialized'], {}, async function (_converse) {
        const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
        const IQ_ids =  _converse.api.connection.get().IQ_ids;
        const { api } = _converse;

        expect(api.settings.get('muc_domain')).toBe(undefined);

        await u.waitUntil(() => IQ_stanzas.filter(
            (iq) => iq.querySelector(`iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]`)).length > 0
        );

        let stanza = IQ_stanzas.find((iq) => iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]'));
        const info_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];

        _converse.api.connection.get()._dataRecv(mock.createRequest(
            stx`<iq type="result"
                    from="montague.lit"
                    to="romeo@montague.lit/orchard"
                    id="${info_IQ_id}"
                    xmlns="jabber:client">
                <query xmlns="http://jabber.org/protocol/disco#info">
                    <identity category="server" type="im"/>
                    <identity category="conference" name="Play-Specific Chatrooms"/>
                    <feature var="http://jabber.org/protocol/disco#info"/>
                    <feature var="http://jabber.org/protocol/disco#items"/>
                </query>
            </iq>`));

        stanza = await u.waitUntil(() => IQ_stanzas.filter(
            iq => iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]')).pop()
        );

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <iq type="result"
                    from="montague.lit"
                    to="romeo@montague.lit/orchard"
                    id="${IQ_ids[IQ_stanzas.indexOf(stanza)]}"
                    xmlns="jabber:client">
                <query xmlns="http://jabber.org/protocol/disco#items">
                    <item jid="chat.shakespeare.lit" name="Chatroom Service"/>
                </query>
            </iq>`));

        stanza = await u.waitUntil(() => IQ_stanzas.filter(
            iq => iq.querySelector('iq[to="chat.shakespeare.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]')).pop()
        );
        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <iq type="result"
                    from="chat.shakespeare.lit"
                    to="romeo@montague.lit/orchard"
                    id="${IQ_ids[IQ_stanzas.indexOf(stanza)]}"
                    xmlns="jabber:client">
                <query xmlns="http://jabber.org/protocol/disco#info">
                    <identity category="conference" name="Play-Specific Chatrooms" type="text"/>
                    <feature var="http://jabber.org/protocol/muc"/>
                </query>
            </iq>`));

        const entities = await _converse.api.disco.entities.get();
        expect(entities.length).toBe(3); // We have an extra entity, which is the user's JID
        expect(entities.get(_converse.domain).identities.length).toBe(2);
        expect(entities.get('montague.lit').features.where(
            {'var': 'http://jabber.org/protocol/disco#items'}).length).toBe(1);
        expect(entities.get('montague.lit').features.where(
            {'var': 'http://jabber.org/protocol/disco#info'}).length).toBe(1);

        await u.waitUntil(() => _converse.api.settings.get('muc_domain') === 'chat.shakespeare.lit');
    }));
});
