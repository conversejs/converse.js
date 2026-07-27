import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

describe("XMPP URI Query Actions (XEP-0147) - MUC", function () {

    describe("Join Action", function () {

        it("triggers xmppURIAction event and opens room",
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {

            const { api } = _converse;
            const jid = 'room@conference.example.com';
            
            // Spy on api.rooms.open
            spyOn(api.rooms, 'open').and.callFake(() => Promise.resolve());

            window.location.hash = `#converse/action?uri=xmpp:${jid}?join;password=secret`;

            // Wait for routing
            await u.routeToQueryAction();

            expect(api.rooms.open).toHaveBeenCalledWith(jid, { password: 'secret' }, true);
        }));
    });
});
