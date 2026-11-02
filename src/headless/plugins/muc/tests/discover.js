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
            expect(api.disco.items).toHaveBeenCalledOnce();
            expect(api.disco.items).toHaveBeenCalledWith(service, null, { rsm: { max: 100, after: undefined } });
        }),
    );

    it(
        'asks a service that pages its list for each page in turn, until a page is empty',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const service = 'conference.montague.lit';
            const page = (rooms, set) =>
                stx`
                <iq xmlns="jabber:client" type="result" from="${service}">
                    <query xmlns="http://jabber.org/protocol/disco#items">
                        ${rooms.map((room) => stx`<item jid="${room}@${service}"/>`)}
                        ${set}
                    </query>
                </iq>`.tree();
            // The count is approximate, as XEP-0059 allows, and too low.
            const items = vi
                .spyOn(api.disco, 'items')
                .mockResolvedValueOnce(
                    page(
                        ['balcony', 'hall'],
                        stx`<set xmlns="http://jabber.org/protocol/rsm">
                            <first index="0">balcony</first><last>hall</last><count>2</count>
                        </set>`,
                    ),
                )
                .mockResolvedValueOnce(
                    page(
                        ['orchard'],
                        stx`<set xmlns="http://jabber.org/protocol/rsm">
                            <first index="2">orchard</first><last>orchard</last><count>2</count>
                        </set>`,
                    ),
                )
                .mockResolvedValueOnce(
                    page([], stx`<set xmlns="http://jabber.org/protocol/rsm"><count>3</count></set>`),
                );

            const rooms = await api.rooms.discover(service, { timeout: 5000 });
            expect(rooms.map((room) => room.jid)).toEqual(['balcony', 'hall', 'orchard'].map((r) => `${r}@${service}`));
            expect(items.mock.calls.map(([, , options]) => options)).toEqual([
                { timeout: 5000, rsm: { max: 100, after: undefined } },
                { timeout: 5000, rsm: { max: 100, after: 'hall' } },
                { timeout: 5000, rsm: { max: 100, after: 'orchard' } },
            ]);
        }),
    );
});
