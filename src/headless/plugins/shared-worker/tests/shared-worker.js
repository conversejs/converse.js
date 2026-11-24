import converse from '../../../dist/converse-headless.js';
import mock from '../../../tests/mock.js';

// Not logged in by itself at start-up, so that each spec logs in once.
const SETTINGS = { auto_login: false, keepalive: false, connection_options: { worker: '/worker.js' } };

/**
 * Stands in for the shared worker that holds the connection, and records
 * whether each connection attaches to its session or connects anew.
 * @param {any} api
 */
function spyOnConnections(api) {
    vi.stubGlobal(
        'SharedWorker',
        class {
            port = { start() {}, postMessage() {}, addEventListener() {} };
        },
    );
    const calls = { restore: vi.fn().mockResolvedValue(true), connect: vi.fn() };
    const init = api.connection.init;
    vi.spyOn(api.connection, 'init').mockImplementation(function (...args) {
        const connection = init.apply(this, args);
        connection.restoreWorkerSession = calls.restore;
        connection.connect = calls.connect;
        return connection;
    });
    return calls;
}

describe('A shared worker session', function () {
    afterEach(() => vi.unstubAllGlobals());

    it(
        'is attached to at login, before anything else is done',
        mock.initConverse(converse, [], SETTINGS, async (_converse) => {
            const { api } = _converse;
            const { restore, connect } = spyOnConnections(api);

            await api.user.login('romeo@montague.lit', 'secret');

            expect(restore).toHaveBeenCalledOnce();
            expect(connect).not.toHaveBeenCalled();
            expect(_converse.session.get('jid')).toBeUndefined();
        }),
    );

    it(
        'is reported at login to need its plugin',
        mock.initConverse(
            converse,
            [],
            { ...SETTINGS, blacklisted_plugins: ['converse-shared-worker'] },
            async (_converse) => {
                await expect(_converse.api.user.login('romeo@montague.lit', 'secret')).rejects.toThrow(
                    "the converse-shared-worker plugin isn't loaded",
                );
                expect(_converse.session.get('jid')).toBeUndefined();
            },
        ),
    );
});
