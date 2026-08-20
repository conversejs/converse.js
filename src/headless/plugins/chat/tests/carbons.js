import converse from '../../../dist/converse-headless.js';
import mock from '../../../tests/mock.js';

const { Strophe, sizzle, u } = converse.env;

describe('Message Carbons', function () {
    it(
        'are enabled on every connection, including resumed ones',
        // A session established out-of-band and then attached to (e.g. a
        // server-side BOSH prebind) reports as resumed, yet may never have had
        // carbons enabled. Carbons is essential, so we always (re-)enable it
        // rather than trust that a resumed session already had them.
        mock.initConverse(
            converse,
            ['chatBoxesInitialized'],
            // Trim the plugins whose own `connected` handlers would add noise when
            // we re-fire the event below. Carbons live in the (always-on) chat plugin.
            { blacklisted_plugins: ['converse-omemo', 'converse-blocklist', 'converse-reactions', 'converse-bookmarks'] },
            async (_converse) => {
                const { api } = _converse;
                const conn = api.connection.get();

                await mock.waitUntilDiscoConfirmed(_converse, 'montague.lit', [], [Strophe.NS.CARBONS]);

                const isCarbonsEnable = (iq) => sizzle(`enable[xmlns="${Strophe.NS.CARBONS}"]`, iq).length > 0;

                // The initial connection enables carbons.
                await u.waitUntil(() => conn.IQ_stanzas.filter(isCarbonsEnable).length === 1);

                // A resumed session (here forced, as a BOSH prebind attach would
                // report) must still enable carbons, since we can't know whether
                // the out-of-band session that we attached to ever did.
                spyOn(conn, 'hasResumed').and.returnValue(true);
                api.trigger('connected');
                await u.waitUntil(() => conn.IQ_stanzas.filter(isCarbonsEnable).length === 2);
            },
        ),
    );
});
