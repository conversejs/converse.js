/*global mock, converse */
const { stx, Strophe } = converse.env;

describe('The MUC Affiliations API', function () {

    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it('can be used to set affiliations in MUCs without having to join them first',
        mock.initConverse([], {}, async function (_converse) {
            const { api } = _converse;
            const user_jid = 'annoyingguy@montague.lit';
            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const presence = stx`
                <presence from="lounge@montague.lit/annoyingGuy"
                        id="27C55F89-1C6A-459A-9EB5-77690145D624"
                        to="romeo@montague.lit/desktop"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user"/>
                    <item jid="${user_jid}" affiliation="member" role="participant"/>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            api.rooms.affiliations.set(muc_jid, { jid: user_jid, affiliation: 'outcast', reason: 'Ban hammer!' });

            const iq = _converse.api.connection.get().IQ_stanzas.pop();
            expect(iq).toEqualStanza(stx`
                <iq id="${iq.getAttribute('id')}" to="lounge@montague.lit" type="set" xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/muc#admin">
                        <item affiliation="outcast" jid="${user_jid}">
                            <reason>Ban hammer!</reason>
                        </item>
                    </query>
                </iq>`);
        })
    );
});
