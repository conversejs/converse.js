import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx } = converse.env;

describe('Discovering the rooms on a MUC service', function () {
    it(
        'lists each room the service hosts, with its name, and skips the items that are nodes',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const service = 'conference.montague.lit';
            const reply = stx`
                <iq xmlns="jabber:client" type="result" from="${service}">
                    <query xmlns="http://jabber.org/protocol/disco#items">
                        <item jid="balcony@${service}" name="Balcony"/>
                        <item jid="${service}" node="http://jabber.org/protocol/commands"/>
                        <item jid="hall@${service}"/>
                    </query>
                </iq>`.tree();
            vi.spyOn(api.disco, 'items').mockResolvedValue(reply);

            expect(await api.rooms.discover(service)).toEqual([
                { jid: `balcony@${service}`, name: 'Balcony' },
                { jid: `hall@${service}`, name: null },
            ]);
            expect(api.disco.items).toHaveBeenCalledWith(service, null, undefined);
        }),
    );
});
