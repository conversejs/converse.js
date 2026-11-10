import mock from '../tests/mock.js';
import converse from '../dist/converse-headless.js';

const { Strophe, u } = converse.env;

describe('Loading the session cache before connecting', function () {
    it(
        'is off by default',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            expect(_converse.state.session_cache_loaded).toBeUndefined();
        }),
    );

    it(
        'keeps what it loaded when the connection comes up',
        mock.initConverse(converse, ['chatBoxesFetched'], { retry_initial_connection: true }, async (_converse) => {
            const { api, state } = _converse;
            expect(state.session_cache_loaded).toBe(true);
            await api.waitUntil('statusInitialized');
            await api.waitUntil('presencesInitialized');

            // The connected stage reuses these, rather than replacing what callers already hold.
            expect(state.profile).toBeDefined();
            expect(state.roster).toBeDefined();
        }),
    );

    it(
        'is not done on a device that clears its cache',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { retry_initial_connection: true, clear_cache_on_logout: true },
            async (_converse) => {
                expect(_converse.state.session_cache_loaded).toBeUndefined();
            },
        ),
    );

    it(
        'is done again for the next session',
        mock.initConverse(converse, ['chatBoxesFetched'], { retry_initial_connection: true }, async (_converse) => {
            const { api, state } = _converse;
            expect(state.session_cache_loaded).toBe(true);
            await api.waitUntil('discoInitialized');
            await api.user.logout();
            expect(state.session_cache_loaded).toBeUndefined();
        }),
    );
});

describe('A MUC without a connection', function () {
    it(
        "doesn't try to join, and joins on connecting",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api, state } = _converse;
            const muc_jid = 'lounge@montague.lit';
            await api.waitUntil('discoInitialized');
            const connection = api.connection.get();
            const presences = () =>
                connection.sent_stanzas.filter(
                    (s) => s.nodeName === 'presence' && s.getAttribute('to')?.includes(muc_jid),
                );

            const connected = vi.spyOn(api.connection, 'connected').mockReturnValue(false);
            const muc = await api.rooms.create(muc_jid, { nick: 'romeo' });
            await muc.initialized;
            expect(muc.session.get('connection_status')).toBe(converse.ROOMSTATUS.DISCONNECTED);
            expect(state.chatboxes.get(muc_jid)).toBe(muc);
            expect(presences().length).toBe(0);

            await muc.join();
            expect(muc.session.get('connection_status')).toBe(converse.ROOMSTATUS.DISCONNECTED);
            expect(presences().length).toBe(0);

            connected.mockRestore();
            connection.status = Strophe.Status.CONNECTED;
            muc.onReconnection();
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);
            await u.waitUntil(() => presences().length === 1);
        }),
    );
});
